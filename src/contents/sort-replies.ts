import type { PlasmoCSConfig } from 'plasmo'

import { getSettings } from '~utils/storage'

export const config: PlasmoCSConfig = {
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  run_at: 'document_start'
}

const SORT_LABELS = ['relevant', 'likes', 'recent']

/**
 * STRATEGY 1: Query param injection on initial page load.
 * Fastest — param is set before X even fetches replies.
 * Returns true if it triggered a redirect (caller should stop).
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
 * No reload — finds and clicks X's native sort dropdown.
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

  // Wait for the sort button to appear (replies load lazily)
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

  if (!sortButton) {
    console.log('[X Reply Sorter] Sort button not found')
    return false
  }

  // Already sorted correctly
  const currentSpan = sortButton.querySelector('span')
  if (currentSpan?.textContent?.trim() === targetLabel) {
    console.log(`[X Reply Sorter] Already sorted by ${targetLabel}`)
    return true
  }

  // Open the dropdown
  sortButton.click()

  // Wait for the menu item
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
    console.log(`[X Reply Sorter] "${targetLabel}" menu item not found`)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    return false
  }

  menuItem.click()
  console.log(`[X Reply Sorter] Sorted by ${targetLabel}`)
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

/**
 * SPA navigation handler — uses DOM click (no reload).
 */
let lastUrl = window.location.href
let isProcessing = false

const onSpaNavigation = async () => {
  if (isProcessing) return
  isProcessing = true

  try {
    const url = new URL(window.location.href)
    if (!isTweetPage(url)) return

    const settings = await getSettings()
    if (!settings.enabled || settings.sortBy === 'relevance') return

    await clickSortOption(settings.sortBy)
  } catch (err) {
    console.error('[X Reply Sorter]', err)
  } finally {
    isProcessing = false
  }
}

const urlObserver = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href
    onSpaNavigation()
  }
})

/**
 * Settings change from popup — use DOM click on current page.
 */
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

/**
 * Initialize: query param on first load, DOM observer for SPA nav.
 */
const init = async () => {
  // Try query param first (instant, no DOM needed)
  const redirected = await applySortParam()
  if (redirected) return

  // Watch for SPA navigation
  const titleEl = document.querySelector('head > title')
  if (titleEl) {
    urlObserver.observe(titleEl, { childList: true })
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
