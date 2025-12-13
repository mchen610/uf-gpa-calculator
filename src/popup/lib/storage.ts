import type { UnofficialTranscriptResponse } from '$shared/types'
import type { Grade } from './grades'

export type TranscriptCache = {
  transcript: UnofficialTranscriptResponse
  timestamp: number
}

export type LocalState = {
  grades: Record<string, Grade>
  lastFocusedCourseId: 'unset' | string
  transcriptCache: TranscriptCache | undefined
}

const DEFAULT_STATE: LocalState = {
  grades: {},
  lastFocusedCourseId: 'unset',
  transcriptCache: undefined,
}

export async function loadLocalState(): Promise<LocalState> {
  const result = await chrome.storage.local.get()
  return { ...DEFAULT_STATE, ...result }
}

export async function saveLocalState(update: Partial<LocalState>): Promise<void> {
  const localState = await loadLocalState()
  await chrome.storage.local.set({ ...localState, ...update })
}
