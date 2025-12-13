import { isValidGrade, type Grade } from './grades'

const STORAGE_KEY = 'savedGrades'

export type SavedGrades = Record<string, Grade>

export async function loadSavedGrades(): Promise<SavedGrades> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return result[STORAGE_KEY] ?? {}
}

export async function saveValidGrades(rawUserInputs: Record<string, string | undefined>): Promise<void> {
  const gradesToSave: Record<string, Grade> = {}
  for (const [code, input] of Object.entries(rawUserInputs)) {
    if (input && isValidGrade(input)) {
      gradesToSave[code] = input
    }
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: gradesToSave })
}
