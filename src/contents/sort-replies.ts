import type { PlasmoCSConfig } from 'plasmo'

import { getSettings } from '~utils/storage'

export const config: PlasmoCSConfig = {
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  run_at: 'document_idle'
}

let isProcessing = false

/**
 * Find and click X's native reply sort dropdown, then select the
 * menu item matching the user's chosen sort criteria.
 *
 * X's sort button is a <button aria-haspopup="menu"> containing a <span>
 * with the current sort label (e.g. "Relevant", "Likes", "Recent").
 * Clicking it opens a dropdown with div[role="menuitem"] options.
 */
const clickSortOption = async (sortBy: string): Promise<boolean> => {
  // Map our setting names to X's menu item labels
  const labelMap: Record<string, string> = {
    likes: 'Likes',
    recent: 'Recent',
    relevance: 'Relevant'
  }

  const targetLabel = labelMap[sortBy]
  if (!targetLabel) return false

  // Known sort labels X uses on the button (current sort shown as button text)
  const sortLabels = ['relevant', 'likes', 'recent']

  // Find the sort dropdown trigger button.
  // It's a <button aria-haspopup="menu"> with a <span> child whose text
  // matches one of the known sort labels.
  const sortButtons = document.querySelectorAll<HTMLElement>(
    'button[aria-haspopup="menu"]'
  )

  let sortButton: HTMLElement | null = null

  for (const btn of sortButtons) {
    const span = btn.querySelector('span')
    if (!span) continue

    const spanText = span.textContent?.trim().toLowerCase() || ''

    if (sortLabels.includes(spanText)) {
      sortButton = btn
      break
    }
  }

  // Fallback: div[role="button"] variant
  if (!sortButton) {
    const roleBtns = document.querySelectorAll<HTMLElement>(
      'div[role="button"][aria-haspopup="menu"]'
    )

    for (const btn of roleBtns) {
      const span = btn.querySelector('span')
      if (!span) continue

      const spanText = span.textContent?.trim().toLowerCase() || ''

      if (sortLabels.includes(spanText)) {
        sortButton = btn
        break
      }
    }
  }

  if (!sortButton) {
    console.log('[X Reply Sorter] Sort button not found on this page')
    return false
  }

  // Check if already sorted by our target
  const currentSpan = sortButton.querySelector('span')
  const currentText = currentSpan?.textContent?.trim() || ''
  if (currentText === targetLabel) {
    console.log(`[X Reply Sorter] Already sorted by ${targetLabel}`)
    return true
  }

  // Click the sort button to open the dropdown menu
  sortButton.click()

  // Wait for the dropdown menu to appear and find our target option
  const menuItem = await waitForElement(
    `div[role="menuitem"]`,
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

/**
 * Wait for an element matching the selector to appear in the DOM.
 * Optionally filter with a predicate function.
 */
const waitForElement = (
  selector: string,
  timeout: number,
  predicate?: (el: HTMLElement) => boolean
): Promise<HTMLElement | null> => {
  return new Promise((resolve) => {
    // Check if it already exists
    const existing = findMatchingElement(selector, predicate)
    if (existing) {
      resolve(existing)
      return
    }

    const observer = new MutationObserver(() => {
      const el = findMatchingElement(selector, predicate)
      if (el) {
        observer.disconnect()
        resolve(el)
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)
  })
}

/**
 * Find an element matching selector and optional predicate.
 */
const findMatchingElement = (
  selector: string,
  predicate?: (el: HTMLElement) => boolean
): HTMLElement | null => {
  const elements = document.querySelectorAll<HTMLElement>(selector)

  for (const el of elements) {
    if (!predicate || predicate(el)) {
      return el
    }
  }

  return null
}

/**
 * Main: attempt to sort replies on the current page.
 */
const sortReplies = async () => {
  if (isProcessing) return
  isProcessing = true

  try {
    const settings = await getSettings()

    if (!settings.enabled) {
      isProcessing = false
      return
    }

    // Only run on individual tweet pages
    if (!window.location.pathname.match(/\/status\/\d+/)) {
      isProcessing = false
      return
    }

    await clickSortOption(settings.sortBy)
  } catch (err) {
    console.error('[X Reply Sorter]', err)
  }

  isProcessing = false
}

/**
 * Debounced sort — wait for page content to load.
 */
let sortTimeout: ReturnType<typeof setTimeout> | null = null

const debouncedSort = () => {
  if (sortTimeout) clearTimeout(sortTimeout)
  sortTimeout = setTimeout(sortReplies, 1500)
}

/**
 * Watch for URL changes (X is a SPA).
 */
let lastUrl = window.location.href

const urlObserver = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href
    debouncedSort()
  }
})

/**
 * Listen for settings changes from the popup.
 */
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SETTINGS_UPDATED') {
    sortReplies()
  }
})

/**
 * Initialize.
 */
const init = () => {
  // Watch for SPA navigation
  const titleEl = document.querySelector('head > title')
  if (titleEl) {
    urlObserver.observe(titleEl, { childList: true })
  }

  // Initial sort on page load
  debouncedSort()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
