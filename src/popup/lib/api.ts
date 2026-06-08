import type { DegreeSnapshot, PendingCourse, UnofficialTranscriptResponse } from '$shared/types'
import { sum } from '$shared/utils'
import { GRADES_THAT_COUNT, GRADE_POINTS, normalizeGradeInput, type Grade } from './grades'
import { loadLocalState, saveLocalState } from './storage'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

async function getCachedTranscript(): Promise<UnofficialTranscriptResponse | undefined> {
  const { transcriptCache } = await loadLocalState()
  if (!('timestamp' in transcriptCache)) return undefined

  const isExpired = Date.now() - transcriptCache.timestamp > CACHE_TTL_MS
  if (isExpired) return undefined
  if (!transcriptCache.transcript.records) return undefined
  return transcriptCache.transcript
}

async function setCachedTranscript(transcript: UnofficialTranscriptResponse): Promise<void> {
  if (!transcript.records) return
  await saveLocalState({ transcriptCache: { transcript, timestamp: Date.now() } })
}

async function fetchTranscript(signal?: AbortSignal): Promise<UnofficialTranscriptResponse | undefined> {
  const response = await fetch('https://one.uf.edu/api/transcript/getunofficialtranscript', {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain, */*',
      Referer: 'https://one.uf.edu/transcript/',
    },
    credentials: 'include',
    signal,
  })

  if (!response.ok) return undefined

  return response.json()
}

export async function getUnofficialTranscript(signal?: AbortSignal): Promise<{
  response: UnofficialTranscriptResponse | undefined
  cached: boolean
}> {
  const cached = await getCachedTranscript()
  if (cached) return { response: cached, cached: true }

  const fresh = await fetchTranscript(signal)
  if (fresh) await setCachedTranscript(fresh)
  return { response: fresh, cached: false }
}

function parseTranscriptToSnapshot(transcript: UnofficialTranscriptResponse): DegreeSnapshot | undefined {
  if (!transcript.records) return undefined
  const records = Object.values(transcript.records).filter((r) => r !== undefined)
  const record = records.sort((a, b) => (b.terms.at(-1)?.termCode ?? 0) - (a.terms.at(-1)?.termCode ?? 0))[0]
  if (!record) return undefined

  const currentTerm = record.terms.at(-1)
  if (!currentTerm) return undefined

  /**
   * Calculate totals from all UF courses (ENRL) across past terms.
   * For past terms, use hoursCarried since that's what actually counted toward GPA.
   */
  const pastCourses = record.terms
    .slice(0, -1)
    .flatMap((term) => term.creditSources)
    .filter((src) => src.sourceType === 'ENRL')
    .flatMap((src) => src.sessions)
    .flatMap((session) => session.courses)
    .map((course) => ({ grade: normalizeGradeInput(course.grade), hours: course.hoursCarried }))
    .filter((c): c is { grade: Grade; hours: number } => c.grade !== undefined && c.grade in GRADES_THAT_COUNT)

  const gradePoints = sum(pastCourses, (c) => GRADE_POINTS[c.grade] * c.hours)
  const creditHours = sum(pastCourses, (c) => c.hours)

  const pendingCourses: PendingCourse[] = currentTerm.creditSources
    .filter((src) => src.sourceType === 'ENRL')
    .flatMap((src) => src.sessions)
    .flatMap((session) => session.courses)
    .filter((course) => course.classNumber !== '')
    .map((course) => ({
      id: Number(course.classNumber),
      code: `${course.subject}${course.catalogNumber}`,
      title: course.title,
      /**
       * Use `credits` instead of `hoursCarried` for current term courses.
       * For grades like I*, hoursCarried becomes 0, but we still want to
       * show the course and let users project what-if scenarios with different grades.
       */
      credits: Number(course.credits),
      grade: normalizeGradeInput(course.grade),
    }))

  return {
    gradePoints,
    creditHours,
    term: currentTerm.termDescription.toLowerCase(),
    level: currentTerm.level.toLowerCase(),
    pendingCourses,
  }
}

export async function getDegreeSnapshot(signal?: AbortSignal): Promise<{
  snapshot: DegreeSnapshot | undefined
  cached: boolean
}> {
  const { response, cached } = await getUnofficialTranscript(signal)
  return { snapshot: response ? parseTranscriptToSnapshot(response) : undefined, cached }
}
