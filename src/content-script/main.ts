import type { UnofficialTranscriptResponse } from '$shared/types'

async function fetchUnofficialTranscript(): Promise<UnofficialTranscriptResponse> {
  const response = await fetch('https://one.uf.edu/api/transcript/getunofficialtranscript', {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain, */*',
      Referer: 'https://one.uf.edu/transcript/',
    },
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch transcript: ${response.status}`)
  }

  return response.json()
}

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message?.type === 'getTranscript') {
    fetchUnofficialTranscript()
      .then((data) => sendResponse(data))
      .catch(() => sendResponse(undefined))
    return true
  }
})
