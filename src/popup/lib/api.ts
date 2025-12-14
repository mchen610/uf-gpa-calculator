import type { DegreeSnapshot, PendingCourse, UnofficialTranscriptResponse } from '$shared/types'
import { sum } from '$shared/utils'
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
  const [{ id, url }] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (id === undefined || url === undefined) return undefined

  if (!url.includes('one.uf.edu')) return undefined

  try {
    return await chrome.tabs.sendMessage(id, { type: 'getTranscript' })
  } catch {
    return undefined
  }
}

export async function getUnofficialTranscript(): Promise<UnofficialTranscriptResponse | undefined> {
  const cached = await getCachedTranscript()
  if (cached) return cached

  const fresh = await fetchTranscript()
  if (fresh) await setCachedTranscript(fresh)
  return fresh
}

function parseTranscriptToSnapshot(transcript: UnofficialTranscriptResponse): DegreeSnapshot | undefined {
  const records = Object.values(transcript.records).filter((r) => r !== undefined)
  const record = records.sort((a, b) => (b.terms.at(-1)?.termCode ?? 0) - (a.terms.at(-1)?.termCode ?? 0))[0]
  if (!record) return undefined

  const currentTerm = record.terms.at(-1)
  if (!currentTerm) return undefined

  const pendingCourses: PendingCourse[] = currentTerm.creditSources
    .filter((src) => src.sourceType === 'ENRL')
    .flatMap((src) => src.sessions)
    .flatMap((session) => session.courses)
    .filter((course) => course.grade === '')
    .map((course) => ({
      code: `${course.subject}${course.catalogNumber}`,
      title: course.title,
      credits: course.hoursCarried,
      grade: undefined,
    }))

  const pendingCreditHours = sum(pendingCourses, (course) => course.credits)

  return {
    gradePoints: parseFloat(record.gradePointsEarned),
    creditHours: parseFloat(record.ufHoursCarried) - pendingCreditHours,
    term: currentTerm.termDescription,
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
