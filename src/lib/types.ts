import type { Grade } from './grades'

export interface PendingCourse {
  code: string
  title: string
  credits: number
  grade: Grade | undefined
}

export interface DegreeSnapshot {
  gradePoints: number | undefined
  creditHours: number | undefined
  pendingCourses: PendingCourse[]
}

export interface ProjectionDetails {
  addedGradePoints: number
  addedCreditHours: number
}
