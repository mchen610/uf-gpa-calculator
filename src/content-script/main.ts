import type { DegreeSnapshot, PendingCourse } from '$shared/types'

const LABEL_TEXT = {
  gradePoints: 'UF Cumulative Grade Points',
  creditHours: 'UF Cumulative Hours Carried',
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

function resolveValueElement(element: HTMLLabelElement): HTMLElement | undefined {
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

function scrapePendingCoursesAndCurrentTerm(): { pendingCourses: PendingCourse[]; term: string | undefined } {
  const pendingCourses: PendingCourse[] = []
  let term: string | undefined

  // Select all course title paragraphs by their aria-label pattern
  const titleElements = document.querySelectorAll('p[aria-label^="course title -"]')

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

    const code = normalizeText(courseTitleCell.previousElementSibling?.textContent).split(' ')[0]
    if (seenCourseIds.has(code)) continue
    seenCourseIds.add(code)

    const gradeCell = courseTitleCell.nextElementSibling
    const attemptedCell = gradeCell?.nextElementSibling
    const earnedCell = attemptedCell?.nextElementSibling
    const numCreditsCell = earnedCell?.nextElementSibling

    if (normalizeText(gradeCell?.textContent) !== '--') continue
    if (parseNumericText(earnedCell?.textContent) !== 0) continue

    const numCredits = parseNumericText(numCreditsCell?.textContent)
    if (numCredits == undefined) continue

    if (!term) {
      const accordion = titleEl.closest('.MuiAccordion-root')
      const termHeader = accordion?.querySelector('.MuiAccordionSummary-content h4')
      if (termHeader) {
        term = normalizeText(termHeader.textContent)
      }
    }
    pendingCourses.push({
      code,
      title: courseTitle,
      credits: numCredits,
      grade: undefined,
    })
  }

  return { pendingCourses, term }
}

function scrapeDegreeSnapshot(): DegreeSnapshot | undefined {
  const gradePoints = valueForLabel(LABEL_TEXT.gradePoints)
  const currentAndPendingCreditHours = valueForLabel(LABEL_TEXT.creditHours)
  const { pendingCourses, term } = scrapePendingCoursesAndCurrentTerm()

  if (
    gradePoints === undefined ||
    currentAndPendingCreditHours === undefined ||
    term === undefined ||
    pendingCourses.length === 0
  ) {
    return undefined
  }

  const pendingCreditHours = pendingCourses.reduce((acc, course) => acc + course.credits, 0)
  const creditHours = currentAndPendingCreditHours - pendingCreditHours

  const snapshot: DegreeSnapshot = {
    gradePoints,
    creditHours,
    term,
    pendingCourses,
  }

  return snapshot
}

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message?.type === 'getSnapshot') {
    sendResponse(scrapeDegreeSnapshot())
  }
})
