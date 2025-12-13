import type { DegreeSnapshot } from '$lib/types'

export async function getDegreeSnapshot(): Promise<{ snapshot?: DegreeSnapshot; url?: string }> {
  const [{ id, url }] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  })

  if (id === undefined || url === undefined) {
    return { url }
  }

  try {
    const snapshot = await chrome.tabs.sendMessage(id, {
      type: 'getSnapshot',
    })
    return { snapshot, url }
  } catch {
    return { url }
  }
}
