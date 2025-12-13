import { typedKeys } from '$lib/typeUtils'
import { sum } from '$lib/utils'
import type { PendingCourse, ProjectionDetails } from '$lib/types'

export const GRADE_POINTS = {
  'A': 4.0,
  'A-': 3.67,
  'B+': 3.33,
  'B': 3.0,
  'B-': 2.67,
  'C+': 2.33,
  'C': 2.0,
  'C-': 1.67,
  'D+': 1.33,
  'D': 1.0,
  'D-': 0.67,
  'E': 0.0,
} as const

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
    const points = grade ? (GRADE_POINTS as Record<string, number>)[grade] : undefined
    return points !== undefined ? { credits, points } : undefined
  })

  return {
    addedGradePoints: sum(userInputs, (input) => (input === undefined ? 0 : input.points * input.credits)),
    addedCreditHours: sum(userInputs, (input) => (input === undefined ? 0 : input.credits)),
  }
}

