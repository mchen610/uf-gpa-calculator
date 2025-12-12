import type { DegreeSnapshot, PendingCourse } from '$lib/types'

const LABEL_TEXT = {
  gradePoints: 'UF Cumulative Grade Points',
  hoursCarried: 'UF Cumulative Hours Carried',
} as const

const NORMALIZE_WHITESPACE = /\s+/g

function normalizeText(value: string | undefined): string {
  return value ? value.trim().replace(NORMALIZE_WHITESPACE, ' ') : ''
}

function parseNumericText(value: string | undefined): number | undefined {
  if (!value) return undefined
  const text = value.replace(/[^\d.-]/g, '')
  return isFinite(Number(text)) ? Number(text) : undefined
}

function resolveValueElement(
  element: HTMLLabelElement,
): HTMLElement | undefined {
  const forId = element.getAttribute('for')
  if (!forId) return undefined
  const target = document.getElementById(forId) ?? undefined
  return target
}

function valueForLabel(targetLabelText: string): number | undefined {
  const labels = document.querySelectorAll('label')
  for (const label of labels) {
    if (normalizeText(label.textContent) !== targetLabelText) continue
    const element = resolveValueElement(label)
    if (!element) continue
    const parsed = parseNumericText(element.textContent)
    if (parsed != undefined) {
      return parsed
    }
  }
  return undefined
}

function collectPendingClasses(): PendingCourse[] {
  const pending: PendingCourse[] = []
  // Select all course title paragraphs by their aria-label pattern
  const titleElements = document.querySelectorAll(
    'p[aria-label^="course title -"]',
  )

  /**
   * For some reason, the one.uf transcript page has invisible duplicates of every course,
   * so we use a set to deduplicate.
   */
  const seenCourseIds = new Set<string>()

  for (const titleEl of titleElements) {
    const courseTitle = normalizeText(titleEl.textContent)
    if (!courseTitle) continue

    // Each course element has the structure courseIdCell -> courseTitleCell -> gradeCell -> attemptedCell -> earnedCell -> numCreditsCell
    const courseTitleCell = titleEl.closest('[class*="MuiGrid-item"]')
    if (!courseTitleCell) continue

    const id = normalizeText(
      courseTitleCell.previousElementSibling?.textContent,
    )
    if (seenCourseIds.has(id)) continue
    seenCourseIds.add(id)

    const gradeCell = courseTitleCell.nextElementSibling
    const attemptedCell = gradeCell?.nextElementSibling
    const earnedCell = attemptedCell?.nextElementSibling
    const numCreditsCell = earnedCell?.nextElementSibling

    if (normalizeText(gradeCell?.textContent) !== '--') continue
    if (parseNumericText(earnedCell?.textContent) !== 0) continue

    const numCredits = parseNumericText(numCreditsCell?.textContent)
    if (numCredits == undefined) continue

    pending.push({
      id,
      title: courseTitle,
      credits: numCredits,
      grade: undefined,
    })
  }

  return pending
}

function collectSnapshot(): DegreeSnapshot | undefined {
  const gradePoints = valueForLabel(LABEL_TEXT.gradePoints)
  const hoursCarried = valueForLabel(LABEL_TEXT.hoursCarried)
  const pendingClasses = collectPendingClasses()

  if (
    gradePoints === undefined ||
    hoursCarried === undefined ||
    pendingClasses.length === 0
  ) {
    return undefined
  }

  const currentGpa = gradePoints / hoursCarried

  const snapshot: DegreeSnapshot = {
    gradePoints,
    hoursCarried,
    currentGpa,
    pendingClasses,
  }

  return snapshot
}

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message?.type === 'getSnapshot') {
    sendResponse(collectSnapshot())
  }
})
