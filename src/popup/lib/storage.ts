import type { Grade } from './grades'

export type LocalState = {
  grades: Record<string, Grade>
  lastFocusedCourseId: 'unset' | string
}

const DEFAULT_STATE: LocalState = {
  grades: {},
  lastFocusedCourseId: 'unset',
}

export async function loadLocalState(): Promise<LocalState> {
  const result = await chrome.storage.local.get()
  return { ...DEFAULT_STATE, ...result }
}

export async function saveLocalState(update: Partial<LocalState>): Promise<void> {
  const localState = await loadLocalState()
  await chrome.storage.local.set({ ...localState, ...update })
}
