import { typedKeys } from '$shared/typeUtils'
import { sum } from '$shared/utils'
import type { DegreeSnapshot, PendingCourse, ProjectionDetails } from '$shared/types'

/**
 * https://catalog.ufl.edu/UGRD/academic-regulations/grades-grading-policies/
 */
export const GRADES_THAT_COUNT = {
  // Passing
  A: 4.0,
  'A-': 3.67,
  'B+': 3.33,
  B: 3.0,
  'B-': 2.67,
  'C+': 2.33,
  C: 2.0,
  'C-': 1.67,
  'D+': 1.33,
  D: 1.0,
  'D-': 0.67,
  E: 0.0,
  WF: 0.0,
  I: 0.0,
  NG: 0.0,
} as const

export const GRADES_THAT_DONT_COUNT = {
  S: 0.0,
  U: 0.0,
  W: 0.0,
  H: 0.0,
  'I*': 0.0,
  'N*': 0.0,
} as const

export const GRADE_POINTS = { ...GRADES_THAT_COUNT, ...GRADES_THAT_DONT_COUNT } as const

export type Grade = keyof typeof GRADE_POINTS

export function isValidGrade(raw: string): raw is Grade {
  return typedKeys(GRADE_POINTS).includes(raw as Grade)
}

export function normalizeGradeInput(raw: string | undefined): Grade | undefined {
  if (!raw) return undefined
  const normalized = raw.trim().toUpperCase()
  return isValidGrade(normalized) ? normalized : undefined
}

export function computeProjection(courses: PendingCourse[]): ProjectionDetails {
  const userInputs = courses.map((course) => {
    const { credits, grade } = course
    const points = grade && grade in GRADES_THAT_COUNT ? GRADE_POINTS[grade] : undefined
    return points !== undefined ? { credits, points } : undefined
  })

  return {
    addedGradePoints: sum(userInputs, (input) => (input === undefined ? 0 : input.points * input.credits)),
    addedCreditHours: sum(userInputs, (input) => (input === undefined ? 0 : input.credits)),
  }
}

export function calculateGpa(args: { gradePoints: number; creditHours: number }): number {
  const { gradePoints, creditHours } = args
  return gradePoints / creditHours
}

export function calculateProjectedGpa(args: {
  gradePoints: number
  creditHours: number
  addedGradePoints: number
  addedCreditHours: number
}): number {
  const { gradePoints, creditHours, addedGradePoints, addedCreditHours } = args
  return (gradePoints + addedGradePoints) / (creditHours + addedCreditHours)
}
