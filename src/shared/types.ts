import type { Grade } from 'src/popup/lib/grades'

export interface PendingCourse {
  id: number
  code: string
  title: string
  credits: number
  grade: Grade | undefined
}

export interface DegreeSnapshot {
  gradePoints: number
  creditHours: number
  term: string
  level: string
  pendingCourses: PendingCourse[]
}

export interface ProjectionDetails {
  addedGradePoints: number
  addedCreditHours: number
}

// =========================
// Transcript UF API types
// =========================

export interface TranscriptCourse {
  subject: string
  catalogNumber: string
  classNumber: string
  courseHeader: string
  title: string
  grade: string
  credits: string
  hoursEarned: string
  hoursCarried: number
  reqDesignation: string
  reqDesignationGrade: string
  repeatDate: string
  repeatCodeDescr: string
  printRepeat: string
}

export interface TranscriptSession {
  sessionDescription: string
  courses: TranscriptCourse[]
}

export interface TranscriptCreditSource {
  sourceType: string
  sourceDescription: string
  sessions: TranscriptSession[]
  currentGpa?: string
  totalHoursCarried?: string
  totalHoursEarned?: string
  totalGradePointsEarned?: string
  totalCredits?: string
}

export interface TranscriptTerm {
  termCode: number
  termDescription: string
  college: string
  level: string
  withdrawalCode: string
  withdrawalDate: string
  withdrawalReason: string
  creditSources: TranscriptCreditSource[]
}

export interface TranscriptRecord {
  ufGpa: string
  totalHoursEarned: string
  gradePointsEarned: string
  ufHoursEarned: string
  ufHoursCarried: string
  transferHoursEarned: string
  terms: TranscriptTerm[]
}

export type TranscriptRecords = Record<string, TranscriptRecord | undefined>
export interface UnofficialTranscriptResponse {
  records: TranscriptRecords
}
