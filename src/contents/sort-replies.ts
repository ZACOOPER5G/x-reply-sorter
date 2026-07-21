import type { PlasmoCSConfig } from 'plasmo'

import { getSettings } from '~utils/storage'

export const config: PlasmoCSConfig = {
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  run_at: 'document_start'
}

const SORT_LABELS = ['relevant', 'likes', 'recent']

/**
 * STRATEGY 1: Query param injection on initial page load.
 */
const applySortParam = async (): Promise<boolean> => {
  const url = new URL(window.location.href)

  if (!isTweetPage(url)) return false
  if (url.searchParams.has('sort_replies')) return false

  const settings = await getSettings()

  if (!settings.enabled || settings.sortBy === 'relevance') return false

  url.searchParams.set('sort_replies', settings.sortBy)
  window.location.replace(url.toString())
  return true
}

/**
 * STRATEGY 2: DOM click fallback for SPA navigation.
 */
const clickSortOption = async (sortBy: string): Promise<boolean> => {
  const labelMap: Record<string, string> = {
    likes: 'Likes',
    recent: 'Recent',
    relevance: 'Relevant'
  }

  const targetLabel = labelMap[sortBy]
  if (!targetLabel) return false

  const isSortButton = (el: HTMLElement): boolean => {
    const span = el.querySelector('span')
    if (!span) return false
    return SORT_LABELS.includes(span.textContent?.trim().toLowerCase() || '')
  }

  let sortButton = await waitForElement(
    'button[aria-haspopup="menu"]',
    8000,
    isSortButton
  )

  if (!sortButton) {
    sortButton = await waitForElement(
      'div[role="button"][aria-haspopup="menu"]',
      2000,
      isSortButton
    )
  }

  if (!sortButton) return false

  const currentSpan = sortButton.querySelector('span')
  if (currentSpan?.textContent?.trim() === targetLabel) return true

  sortButton.click()

  const menuItem = await waitForElement(
    'div[role="menuitem"]',
    1500,
    (el) => {
      const spans = el.querySelectorAll('span')
      for (const s of spans) {
        if (s.textContent?.trim() === targetLabel) return true
      }
      return false
    }
  )

  if (!menuItem) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    return false
  }

  menuItem.click()
  return true
}

const waitForElement = (
  selector: string,
  timeout: number,
  predicate?: (el: HTMLElement) => boolean
): Promise<HTMLElement | null> => {
  return new Promise((resolve) => {
    const match = findMatch(selector, predicate)
    if (match) { resolve(match); return }

    const observer = new MutationObserver(() => {
      const el = findMatch(selector, predicate)
      if (el) { observer.disconnect(); resolve(el) }
    })

    observer.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => { observer.disconnect(); resolve(null) }, timeout)
  })
}

const findMatch = (
  selector: string,
  predicate?: (el: HTMLElement) => boolean
): HTMLElement | null => {
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    if (!predicate || predicate(el)) return el
  }
  return null
}

const isTweetPage = (url: URL) => /\/status\/\d+/.test(url.pathname)

let lastUrl = window.location.href
let isProcessing = false
let lastSortedTweetId = ''

const getTweetId = (url: URL): string => {
  const match = url.pathname.match(/\/status\/(\d+)/)
  return match ? match[1] : ''
}

const onSpaNavigation = async () => {
  if (isProcessing) return

  const url = new URL(window.location.href)
  if (!isTweetPage(url)) return

  const tweetId = getTweetId(url)
  if (tweetId === lastSortedTweetId) return

  isProcessing = true

  try {
    const settings = await getSettings()
    if (!settings.enabled || settings.sortBy === 'relevance') return

    const success = await clickSortOption(settings.sortBy)
    if (success) lastSortedTweetId = tweetId
  } catch (_) {
    // silently fail
  } finally {
    isProcessing = false
  }
}

const checkUrlChange = () => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href
    onSpaNavigation()
  }
}

const setupSpaDetection = () => {
  setInterval(checkUrlChange, 500)
  window.addEventListener('popstate', checkUrlChange)
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SETTINGS_UPDATED') {
    const url = new URL(window.location.href)
    if (!isTweetPage(url)) return

    getSettings().then((settings) => {
      if (!settings.enabled) return
      clickSortOption(settings.sortBy)
    })
  }
})

const init = async () => {
  setupSpaDetection()

  const url = new URL(window.location.href)

  if (url.searchParams.has('sort_replies') && isTweetPage(url)) {
    lastSortedTweetId = getTweetId(url)
    return
  }

  await applySortParam()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
