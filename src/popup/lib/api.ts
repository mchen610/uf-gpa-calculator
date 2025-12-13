import type { DegreeSnapshot, PendingCourse, UnofficialTranscriptResponse } from '$shared/types'
import { sum } from '$shared/utils'

export async function getUnofficialTranscript(): Promise<{ transcript?: UnofficialTranscriptResponse; url?: string }> {
  const [{ id, url }] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  })

  if (id === undefined || url === undefined) {
    return { url }
  }

  try {
    const transcript = await chrome.tabs.sendMessage(id, {
      type: 'getTranscript',
    })
    return { transcript, url }
  } catch {
    return { url }
  }
}

function parseTranscriptToSnapshot(transcript: UnofficialTranscriptResponse): DegreeSnapshot | undefined {
  const undergrad = transcript.records.undergraduate
  if (!undergrad) return undefined

  const currentTerm = undergrad.terms.at(-1)
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
    gradePoints: parseFloat(undergrad.gradePointsEarned),
    creditHours: parseFloat(undergrad.ufHoursCarried) - pendingCreditHours,
    term: currentTerm.termDescription,
    pendingCourses,
  }
}

export async function getDegreeSnapshot(): Promise<{ snapshot?: DegreeSnapshot; url?: string }> {
  const { transcript, url } = await getUnofficialTranscript()

  if (!transcript) {
    return { url }
  }

  const snapshot = parseTranscriptToSnapshot(transcript)
  return { snapshot, url }
}
