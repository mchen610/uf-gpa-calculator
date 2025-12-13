import type { Grade } from "src/popup/lib/grades"

export interface PendingCourse {
  code: string
  title: string
  credits: number
  grade: Grade | undefined
}

export interface DegreeSnapshot {
  gradePoints: number
  creditHours: number
  term: string
  pendingCourses: PendingCourse[]
}

export interface ProjectionDetails {
  addedGradePoints: number
  addedCreditHours: number
}
