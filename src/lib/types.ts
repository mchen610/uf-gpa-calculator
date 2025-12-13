import type { Grade } from './grades'

export interface PendingCourse {
  id: string
  title: string
  credits: number
  grade: Grade | undefined
}

export interface DegreeSnapshot {
  gradePoints: number | undefined
  hoursCarried: number | undefined
  currentGpa: number | undefined
  pendingCourses: PendingCourse[]
}

