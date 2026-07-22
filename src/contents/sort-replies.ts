import type { PlasmoCSConfig } from 'plasmo'

import {
  getSettings,
  isPremium,
  type PremiumFilter,
  type PremiumSort
} from '~utils/storage'

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

/**
 * PREMIUM SORT: DOM-based reply reordering by engagement counts.
 */
const parseCount = (text: string): number => {
  if (!text) return 0
  const cleaned = text.trim().toLowerCase()
  if (cleaned.endsWith('k')) return parseFloat(cleaned) * 1000
  if (cleaned.endsWith('m')) return parseFloat(cleaned) * 1000000
  return parseInt(cleaned.replace(/,/g, ''), 10) || 0
}

const getEngagementCount = (
  reply: HTMLElement,
  sortType: PremiumSort
): number => {
  // X uses aria-label on engagement buttons: "123 replies", "45 reposts", "678 likes", "1234 views"
  const buttons = reply.querySelectorAll(
    '[role="button"][aria-label], a[role="link"][aria-label]'
  )

  const labelMatch: Record<string, RegExp> = {
    retweets: /(\d[\d,.]*[km]?)\s+repost/i,
    views: /(\d[\d,.]*[km]?)\s+view/i,
    replies: /(\d[\d,.]*[km]?)\s+repl/i
  }

  const pattern = labelMatch[sortType]
  if (!pattern) return 0

  for (const btn of buttons) {
    const label = btn.getAttribute('aria-label') || ''
    const match = label.match(pattern)
    if (match) return parseCount(match[1])
  }

  return 0
}

const applyPremiumSort = async () => {
  const premium = await isPremium()
  if (!premium) return

  const settings = await getSettings()
  const sortType = settings.premiumSort
  if (!sortType || sortType === 'none') return

  const timeline = document.querySelector(
    '[aria-label="Timeline: Conversation"]'
  )
  if (!timeline) return

  const container = timeline.querySelector(':scope > div')
  if (!container) return

  const allItems = Array.from(
    container.querySelectorAll<HTMLElement>(':scope > div')
  )

  if (allItems.length < 2) return

  // First item is the original tweet — skip it
  const originalTweet = allItems[0]
  const replies = allItems.slice(1)

  const scored = replies.map((el) => ({
    el,
    count: getEngagementCount(el, sortType)
  }))

  scored.sort((a, b) => b.count - a.count)

  // Reorder DOM: append in sorted order (original tweet stays first)
  for (const { el } of scored) {
    container.appendChild(el)
  }
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

  if (!isTweetPage(url)) {
    teardownFilterObserver()
    return
  }

  const tweetId = getTweetId(url)
  if (tweetId === lastSortedTweetId) return

  isProcessing = true

  try {
    const settings = await getSettings()
    if (!settings.enabled || settings.sortBy === 'relevance') return

    const success = await clickSortOption(settings.sortBy)
    if (success) lastSortedTweetId = tweetId

    // Apply premium filters after sorting
    teardownFilterObserver()
    setupFilterObserver()
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

/**
 * PREMIUM FILTERS: DOM-based reply filtering.
 */
const getReplyElements = (): HTMLElement[] => {
  const timeline = document.querySelector('[aria-label="Timeline: Conversation"]')
  if (!timeline) return []

  const allItems = Array.from(
    timeline.querySelectorAll<HTMLElement>(':scope > div > div')
  )

  // Skip the first item — it's the original tweet, not a reply
  return allItems.slice(1)
}

const getTweetAuthor = (): string => {
  const url = new URL(window.location.href)
  const match = url.pathname.match(/^\/([^/]+)\/status/)
  return match ? match[1].toLowerCase() : ''
}

const applyFilter = (reply: HTMLElement, filter: PremiumFilter): boolean => {
  const textContent = reply.textContent || ''

  switch (filter) {
    case 'verified_only': {
      const badge = reply.querySelector('[data-testid="icon-verified"]') ||
        reply.querySelector('svg[aria-label="Verified account"]')
      return !!badge
    }

    case 'hide_verified': {
      const badge = reply.querySelector('[data-testid="icon-verified"]') ||
        reply.querySelector('svg[aria-label="Verified account"]')
      return !badge
    }

    case 'op_only': {
      const author = getTweetAuthor()
      if (!author) return true
      const userLinks = reply.querySelectorAll('a[role="link"]')
      for (const link of userLinks) {
        const href = (link as HTMLAnchorElement).href
        if (href && new URL(href).pathname.toLowerCase() === `/${author}`) {
          return true
        }
      }
      return false
    }

    case 'hide_links': {
      const replyText = reply.querySelector('[data-testid="tweetText"]')
      if (!replyText) return true
      const links = replyText.querySelectorAll('a')
      for (const link of links) {
        const href = link.getAttribute('href') || ''
        // Allow @mentions and hashtags, hide external links
        if (!href.startsWith('/') && !href.startsWith('#')) return false
      }
      return true
    }

    case 'media_only': {
      const hasMedia = reply.querySelector(
        '[data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="card.wrapper"]'
      )
      return !!hasMedia
    }

    case 'hide_quote_only': {
      // Quote-only replies have tweetText containing just "Quote" and an embedded quoted tweet
      const tweetText = reply.querySelector('[data-testid="tweetText"]')
      const text = tweetText?.textContent?.trim() || ''
      const hasQuotedTweet = reply.querySelector('[role="link"][tabindex="0"] [data-testid="tweetText"]')
      return !(text.toLowerCase() === 'quote' && hasQuotedTweet)
    }

    case 'hide_ads': {
      // Promoted tweets have a "Ad" label or a promotedIndicator testid
      const isAd =
        reply.querySelector('[data-testid="promotedIndicator"]') ||
        reply.querySelector('span')?.textContent?.trim() === 'Ad' ||
        reply.querySelector('[data-testid="placementTracking"]')
      return !isAd
    }

    default:
      return true
  }
}

const applyPremiumFilters = async () => {
  const premium = await isPremium()
  if (!premium) return

  const settings = await getSettings()
  const filters = settings.premiumFilters || []
  if (filters.length === 0) return

  const replies = getReplyElements()

  for (const reply of replies) {
    const shouldShow = filters.every((filter) => applyFilter(reply, filter))
    const el = reply as HTMLElement

    if (shouldShow) {
      el.style.display = ''
    } else {
      el.style.display = 'none'
    }
  }
}

let filterObserver: MutationObserver | null = null

const setupFilterObserver = async () => {
  const premium = await isPremium()
  if (!premium) return

  const settings = await getSettings()
  if (!settings.premiumFilters?.length) return

  // Re-apply filters when new replies load (infinite scroll)
  filterObserver = new MutationObserver(() => {
    applyPremiumFilters()
  })

  const startObserving = () => {
    const timeline = document.querySelector('[aria-label="Timeline: Conversation"]')
    if (timeline) {
      filterObserver!.observe(timeline, { childList: true, subtree: true })
      applyPremiumSort()
      applyPremiumFilters()
    }
  }

  if (document.querySelector('[aria-label="Timeline: Conversation"]')) {
    startObserving()
  } else {
    // Wait for timeline to appear
    const bodyObserver = new MutationObserver(() => {
      if (document.querySelector('[aria-label="Timeline: Conversation"]')) {
        bodyObserver.disconnect()
        startObserving()
      }
    })
    bodyObserver.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => bodyObserver.disconnect(), 15000)
  }
}

const teardownFilterObserver = () => {
  if (filterObserver) {
    filterObserver.disconnect()
    filterObserver = null
  }

  // Unhide all replies
  const replies = getReplyElements()
  for (const reply of replies) {
    ;(reply as HTMLElement).style.display = ''
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SETTINGS_UPDATED') {
    const url = new URL(window.location.href)
    if (!isTweetPage(url)) return

    getSettings().then((settings) => {
      if (!settings.enabled) return
      clickSortOption(settings.sortBy)

      // Re-apply premium filters
      teardownFilterObserver()
      setupFilterObserver()
    })
  }
})

const init = async () => {
  setupSpaDetection()

  const url = new URL(window.location.href)

  if (url.searchParams.has('sort_replies') && isTweetPage(url)) {
    lastSortedTweetId = getTweetId(url)
    setupFilterObserver()
    return
  }

  const redirected = await applySortParam()
  if (!redirected && isTweetPage(url)) {
    setupFilterObserver()
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
