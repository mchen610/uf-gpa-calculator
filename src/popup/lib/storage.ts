import type { UnofficialTranscriptResponse } from '$shared/types'

export type TranscriptCache = {
  transcript: UnofficialTranscriptResponse
  timestamp: number
}

export type LocalState = {
  rawUserInputs: Record<number, string | undefined>
  lastFocusedCourseId: 'unset' | number
  transcriptCache: TranscriptCache | Record<string, never>
}

const DEFAULT_STATE: LocalState = {
  rawUserInputs: {},
  lastFocusedCourseId: 'unset',
  transcriptCache: {},
}

export async function loadLocalState(): Promise<LocalState> {
  const result = await chrome.storage.local.get()
  return { ...DEFAULT_STATE, ...result }
}

export async function saveLocalState(update: Partial<LocalState>): Promise<void> {
  const localState = await loadLocalState()
  await chrome.storage.local.set({ ...localState, ...update })
}
