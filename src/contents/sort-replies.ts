import type { PlasmoCSConfig } from 'plasmo'

import { getSettings } from '~utils/storage'

export const config: PlasmoCSConfig = {
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  run_at: 'document_start'
}

const LOG = (...args: unknown[]) => console.log('[X Reply Sorter]', ...args)

const SORT_LABELS = ['relevant', 'likes', 'recent']

/**
 * STRATEGY 1: Query param injection on initial page load.
 */
const applySortParam = async (): Promise<boolean> => {
  const url = new URL(window.location.href)

  if (!isTweetPage(url)) {
    LOG('Not a tweet page, skipping param injection')
    return false
  }

  if (url.searchParams.has('sort_replies')) {
    LOG('sort_replies param already set:', url.searchParams.get('sort_replies'))
    return false
  }

  const settings = await getSettings()
  LOG('Settings:', JSON.stringify(settings))

  if (!settings.enabled) { LOG('Extension disabled'); return false }
  if (settings.sortBy === 'relevance') { LOG('Sort is relevance (default), skipping'); return false }

  LOG('Injecting sort_replies=' + settings.sortBy)
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
  if (!targetLabel) { LOG('Unknown sortBy:', sortBy); return false }

  LOG('Looking for sort button (target:', targetLabel + ')...')

  const isSortButton = (el: HTMLElement): boolean => {
    const span = el.querySelector('span')
    if (!span) return false
    return SORT_LABELS.includes(span.textContent?.trim().toLowerCase() || '')
  }

  // Log all buttons with aria-haspopup="menu" for debugging
  const allMenuButtons = document.querySelectorAll<HTMLElement>('button[aria-haspopup="menu"]')
  LOG('Found', allMenuButtons.length, 'buttons with aria-haspopup="menu"')
  allMenuButtons.forEach((btn, i) => {
    const span = btn.querySelector('span')
    LOG(`  Button ${i}: span text="${span?.textContent?.trim()}", outerHTML="${btn.outerHTML.slice(0, 150)}"`)
  })

  // Wait for the sort button to appear (replies load lazily)
  let sortButton = await waitForElement(
    'button[aria-haspopup="menu"]',
    8000,
    isSortButton
  )

  if (!sortButton) {
    LOG('Primary selector failed, trying div[role="button"] fallback...')
    sortButton = await waitForElement(
      'div[role="button"][aria-haspopup="menu"]',
      2000,
      isSortButton
    )
  }

  if (!sortButton) {
    LOG('Sort button not found after waiting')
    return false
  }

  // Already sorted correctly
  const currentSpan = sortButton.querySelector('span')
  const currentText = currentSpan?.textContent?.trim()
  LOG('Sort button found, current sort:', currentText)

  if (currentText === targetLabel) {
    LOG('Already sorted by', targetLabel)
    return true
  }

  // Open the dropdown
  LOG('Clicking sort button to open dropdown...')
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
    LOG('"' + targetLabel + '" menu item not found')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    return false
  }

  menuItem.click()
  LOG('Sorted by', targetLabel)
  return true
}

const waitForElement = (
  selector: string,
  timeout: number,
  predicate?: (el: HTMLElement) => boolean
): Promise<HTMLElement | null> => {
  return new Promise((resolve) => {
    const match = findMatch(selector, predicate)
    if (match) {
      LOG('waitForElement: found immediately for', selector)
      resolve(match)
      return
    }

    LOG('waitForElement: waiting up to', timeout + 'ms for', selector)

    const observer = new MutationObserver(() => {
      const el = findMatch(selector, predicate)
      if (el) {
        LOG('waitForElement: found via observer for', selector)
        observer.disconnect()
        resolve(el)
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => {
      LOG('waitForElement: timed out for', selector)
      observer.disconnect()
      resolve(null)
    }, timeout)
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
 * SPA navigation handler — always uses DOM click (never redirect).
 * This avoids back-button loops where removing the query param
 * triggers a redirect that re-adds it.
 */
let lastUrl = window.location.href
let isProcessing = false
let lastSortedTweetId = ''

const getTweetId = (url: URL): string => {
  const match = url.pathname.match(/\/status\/(\d+)/)
  return match ? match[1] : ''
}

const onSpaNavigation = async () => {
  if (isProcessing) { LOG('SPA nav: already processing, skipping'); return }

  const url = new URL(window.location.href)
  if (!isTweetPage(url)) return

  // Don't re-sort the same tweet we just sorted (prevents loops)
  const tweetId = getTweetId(url)
  if (tweetId === lastSortedTweetId) { return }

  isProcessing = true

  try {
    LOG('SPA navigation detected:', url.pathname)

    const settings = await getSettings()
    LOG('SPA nav settings:', JSON.stringify(settings))

    if (!settings.enabled) { LOG('SPA nav: disabled'); return }
    if (settings.sortBy === 'relevance') { LOG('SPA nav: relevance, skipping'); return }

    LOG('SPA nav: attempting DOM click for', settings.sortBy)
    const success = await clickSortOption(settings.sortBy)
    if (success) lastSortedTweetId = tweetId
  } catch (err) {
    console.error('[X Reply Sorter]', err)
  } finally {
    isProcessing = false
  }
}

const checkUrlChange = () => {
  if (window.location.href !== lastUrl) {
    LOG('URL changed:', lastUrl, '->', window.location.href)
    lastUrl = window.location.href
    onSpaNavigation()
  }
}

/**
 * Detect SPA navigation by polling URL changes.
 * Content scripts run in an isolated world so we can't intercept
 * the page's history.pushState. Polling every 500ms is reliable
 * and has negligible performance impact.
 */
const setupSpaDetection = () => {
  LOG('Setting up SPA detection (URL polling)')

  setInterval(checkUrlChange, 500)

  window.addEventListener('popstate', () => {
    LOG('popstate event')
    checkUrlChange()
  })

  LOG('SPA detection ready')
}

/**
 * Settings change from popup.
 */
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SETTINGS_UPDATED') {
    LOG('Settings updated from popup')
    const url = new URL(window.location.href)
    if (!isTweetPage(url)) return

    getSettings().then((settings) => {
      if (!settings.enabled) return
      clickSortOption(settings.sortBy)
    })
  }
})

/**
 * Initialize.
 * Query param on true initial page load only.
 * After that, all SPA navigations use DOM click.
 */
const init = async () => {
  LOG('Initializing, readyState:', document.readyState, 'url:', window.location.href)

  setupSpaDetection()

  const url = new URL(window.location.href)

  // If we already have the sort param (e.g. from our own redirect), mark this tweet as sorted
  if (url.searchParams.has('sort_replies') && isTweetPage(url)) {
    lastSortedTweetId = getTweetId(url)
    LOG('Already has sort param, marked tweet', lastSortedTweetId, 'as sorted')
    return
  }

  // Only use query param redirect on true initial page load
  const redirected = await applySortParam()
  if (redirected) {
    LOG('Redirected with query param, done')
    return
  }

  LOG('Init complete, watching for SPA navigation')
}

if (document.readyState === 'loading') {
  LOG('Document loading, waiting for DOMContentLoaded')
  document.addEventListener('DOMContentLoaded', init)
} else {
  LOG('Document already loaded, initializing now')
  init()
}
