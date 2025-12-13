export interface PendingCourse {
  code: string
  title: string
  credits: number
  grade: string | undefined
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
