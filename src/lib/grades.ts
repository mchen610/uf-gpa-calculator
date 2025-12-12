import { typedKeys } from './typeUtils'

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