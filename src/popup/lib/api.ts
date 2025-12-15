import type { DegreeSnapshot, PendingCourse, UnofficialTranscriptResponse } from '$shared/types'
import { sum } from '$shared/utils'
import { normalizeGradeInput } from './grades'
import { loadLocalState, saveLocalState } from './storage'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

async function getCachedTranscript(): Promise<UnofficialTranscriptResponse | undefined> {
  const { transcriptCache } = await loadLocalState()
  if (!transcriptCache) return undefined

  const isExpired = Date.now() - transcriptCache.timestamp > CACHE_TTL_MS
  return isExpired ? undefined : transcriptCache.transcript
}

async function setCachedTranscript(transcript: UnofficialTranscriptResponse): Promise<void> {
  await saveLocalState({ transcriptCache: { transcript, timestamp: Date.now() } })
}

async function fetchTranscript(): Promise<UnofficialTranscriptResponse | undefined> {
  const response = await fetch('https://one.uf.edu/api/transcript/getunofficialtranscript', {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain, */*',
      Referer: 'https://one.uf.edu/transcript/',
    },
    credentials: 'include',
  })

  if (!response.ok) return undefined

  return response.json()
}

export async function getUnofficialTranscript(): Promise<UnofficialTranscriptResponse | undefined> {
  const cached = await getCachedTranscript()
  if (cached) return cached

  const fresh = await fetchTranscript()
  if (fresh) await setCachedTranscript(fresh)
  return fresh
}

/**
 * ufHoursCarried randomly includes pending credit hours near the end of the semester.
 * We check which option (with or without pending) produces a GPA closer to the actual ufGpa.
 */
function calculateCreditHours({
  gradePoints,
  ufHoursCarried,
  pendingCreditHours,
  ufGpa,
}: {
  gradePoints: number
  ufHoursCarried: number
  pendingCreditHours: number
  ufGpa: number
}): number {
  const withPending = ufHoursCarried
  const withoutPending = ufHoursCarried - pendingCreditHours

  const gpaWithPending = gradePoints / withPending
  const gpaWithoutPending = gradePoints / withoutPending

  const diffWithPending = Math.abs(gpaWithPending - ufGpa)
  const diffWithoutPending = Math.abs(gpaWithoutPending - ufGpa)

  return diffWithPending < diffWithoutPending ? withPending : withoutPending
}

function parseTranscriptToSnapshot(transcript: UnofficialTranscriptResponse): DegreeSnapshot | undefined {
  const records = Object.values(transcript.records).filter((r) => r !== undefined)
  const record = records.sort((a, b) => (b.terms.at(-1)?.termCode ?? 0) - (a.terms.at(-1)?.termCode ?? 0))[0]
  if (!record) return undefined

  const currentTerm = record.terms.at(-1)
  if (!currentTerm) return undefined

  const pendingCourses: PendingCourse[] = currentTerm.creditSources
    /**
     * 'ENRL' means the course is being taken at UF
     */
    .filter((src) => src.sourceType === 'ENRL')
    .flatMap((src) => src.sessions)
    .flatMap((session) => session.courses)
    .filter((course) => course.classNumber !== '')
    .map((course) => ({
      id: Number(course.classNumber),
      code: `${course.subject}${course.catalogNumber}`,
      title: course.title,
      credits: course.hoursCarried,
      grade: normalizeGradeInput(course.grade),
    }))

  const pendingCreditHours = sum(pendingCourses, (course) => course.credits)
  const gradePoints = parseFloat(record.gradePointsEarned)
  const ufHoursCarried = parseFloat(record.ufHoursCarried)
  const ufGpa = parseFloat(record.ufGpa)
  const creditHours = calculateCreditHours({
    pendingCreditHours,
    gradePoints,
    ufHoursCarried,
    ufGpa,
  })

  return {
    gradePoints,
    creditHours,
    term: currentTerm.termDescription,
    level: currentTerm.level,
    pendingCourses,
  }
}

export async function getDegreeSnapshot(): Promise<DegreeSnapshot | undefined> {
  const transcript = await getUnofficialTranscript()
  if (!transcript) return undefined
  return parseTranscriptToSnapshot(transcript)
}

export async function refreshDegreeSnapshot(): Promise<DegreeSnapshot | undefined> {
  await saveLocalState({ transcriptCache: {} })
  return getDegreeSnapshot()
}
