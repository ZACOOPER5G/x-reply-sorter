import { useEffect, useState } from 'react'

import {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
  getLicense,
  setInstalledAt,
  isGrandfathered,
  isPremium as checkIsPremium,
  type Settings,
  type PremiumFilter,
  type PremiumSort,
  type LicenseData
} from '~utils/storage'
import { activateLicenseKey, deactivateLicense } from '~utils/license'

import * as styles from './popup.module.css'

const PREMIUM_FILTERS: {
  id: PremiumFilter
  label: string
  excludes?: PremiumFilter
}[] = [
  { id: 'verified_only', label: 'Verified accounts only', excludes: 'hide_verified' },
  { id: 'hide_verified', label: 'Hide verified accounts', excludes: 'verified_only' },
  { id: 'op_only', label: 'OP replies only' },
  { id: 'hide_links', label: 'Hide replies with links' },
  { id: 'media_only', label: 'Media replies only' },
  { id: 'hide_ads', label: 'Hide promoted replies' },
  { id: 'hide_quote_only', label: 'Hide quote-only replies' }
]

const Popup = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [license, setLicense] = useState<LicenseData | null>(null)
  const [licenseKey, setLicenseKey] = useState('')
  const [licenseError, setLicenseError] = useState('')
  const [activating, setActivating] = useState(false)
  const [showLicenseInput, setShowLicenseInput] = useState(false)
  const [isPro, setIsPro] = useState(false)
  const [grandfathered, setGrandfathered] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const load = async () => {
      await setInstalledAt()
      const [s, l, premium, gf] = await Promise.all([
        getSettings(),
        getLicense(),
        checkIsPremium(),
        isGrandfathered()
      ])
      setSettings(s)
      setLicense(l)
      setIsPro(premium)
      setGrandfathered(gf)
      setLoaded(true)
    }
    load()
  }, [])

  const updateSetting = async <K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ) => {
    const updated = await saveSettings({ [key]: value })
    setSettings(updated)

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    })

    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED' }).catch(() => {})
    }
  }

  const toggleFilter = async (filterId: PremiumFilter) => {
    const current = settings.premiumFilters || []
    const filter = PREMIUM_FILTERS.find((f) => f.id === filterId)

    let updated: PremiumFilter[]
    if (current.includes(filterId)) {
      updated = current.filter((f) => f !== filterId)
    } else {
      // Remove the mutually exclusive filter if present
      updated = filter?.excludes
        ? [...current.filter((f) => f !== filter.excludes), filterId]
        : [...current, filterId]
    }

    await updateSetting('premiumFilters', updated)
  }

  const handleActivate = async () => {
    if (!licenseKey.trim()) return

    setActivating(true)
    setLicenseError('')

    const result = await activateLicenseKey(licenseKey.trim())

    if (result.valid) {
      const l = await getLicense()
      setLicense(l)
      setIsPro(true)
      setLicenseKey('')
      setShowLicenseInput(false)
    } else {
      setLicenseError(result.error || 'Invalid license key')
    }

    setActivating(false)
  }

  const handleDeactivate = async () => {
    await deactivateLicense()
    setLicense(null)
    setIsPro(false)
    await updateSetting('premiumFilters', [])
  }

  if (!loaded) return null

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <svg
            className={styles.logo}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z" />
          </svg>
          X Reply Sorter
        </h1>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => updateSetting('enabled', e.target.checked)}
          />
          <span className={styles.slider} />
        </label>
      </div>

      <div
        className={`${styles.controls} ${!settings.enabled ? styles.disabled : ''}`}
      >
        <div className={styles.controlGroup}>
          <span className={styles.label}>Default sort</span>
          <select
            className={styles.select}
            value={settings.sortBy}
            onChange={(e) =>
              updateSetting('sortBy', e.target.value as Settings['sortBy'])
            }
          >
            <option value="likes">Likes</option>
            <option value="recent">Recent</option>
            <option value="relevance">Relevant (X default)</option>
          </select>
        </div>

        <p className={styles.hint}>
          Automatically selects this sort order when you open a tweet's
          replies.
        </p>
      </div>

      <hr className={styles.divider} />

      <div className={styles.proSection}>
        <div className={styles.proHeader}>
          <span className={styles.proTitle}>
            <span className={styles.proBadge}>PRO</span>
            Filters
            {grandfathered && (
              <span className={styles.earlyBadge}>Early Access</span>
            )}
          </span>
          {isPro && !grandfathered ? (
            <button
              className={styles.deactivateBtn}
              onClick={handleDeactivate}
            >
              Deactivate
            </button>
          ) : !isPro ? (
            <button
              className={styles.upgradeBtn}
              onClick={() => setShowLicenseInput(!showLicenseInput)}
            >
              Upgrade
            </button>
          ) : null}
        </div>

        {!isPro && showLicenseInput && (
          <div className={styles.licenseInput}>
            <input
              type="text"
              className={styles.keyInput}
              placeholder="Enter license key"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
              disabled={activating}
            />
            <button
              className={styles.activateBtn}
              onClick={handleActivate}
              disabled={activating || !licenseKey.trim()}
            >
              {activating ? '...' : 'Activate'}
            </button>
            {licenseError && (
              <p className={styles.licenseError}>{licenseError}</p>
            )}
          </div>
        )}

        <div
          className={`${styles.controlGroup} ${!isPro || !settings.enabled ? styles.disabled : ''}`}
        >
          <span className={styles.label}>Pro sort</span>
          <div className={styles.proSelectWrapper}>
            <select
              className={styles.proSelect}
              value={settings.premiumSort || 'none'}
              onChange={(e) =>
                updateSetting('premiumSort', e.target.value as PremiumSort)
              }
              disabled={!isPro}
            >
              <option value="none">None (use default)</option>
              <option value="retweets">Most retweets</option>
              <option value="views">Most views</option>
              <option value="replies">Most replies</option>
            </select>
            {!isPro && <span className={styles.lockIcon}>&#128274;</span>}
          </div>
        </div>

        <div
          className={`${styles.filterList} ${!isPro || !settings.enabled ? styles.disabled : ''}`}
        >
          {PREMIUM_FILTERS.map((filter) => {
            const isExcluded =
              filter.excludes &&
              settings.premiumFilters?.includes(filter.excludes)

            return (
              <label
                key={filter.id}
                className={`${styles.filterItem} ${isExcluded ? styles.excludedFilter : ''}`}
              >
                <input
                  type="checkbox"
                  checked={settings.premiumFilters?.includes(filter.id) || false}
                  onChange={() => toggleFilter(filter.id)}
                  disabled={!isPro || isExcluded}
                />
                <span className={styles.filterLabel}>{filter.label}</span>
                {!isPro && <span className={styles.lockIcon}>&#128274;</span>}
              </label>
            )
          })}
        </div>
      </div>

      <hr className={styles.divider} />

      {process.env.PLASMO_PUBLIC_ADSENSE_PUB_ID &&
        process.env.PLASMO_PUBLIC_ADSENSE_SLOT_ID && (
          <div className={styles.adBanner}>
            <span className={styles.adLabel}>Sponsored</span>
            <div className={styles.adSlot}>
              <ins
                className="adsbygoogle"
                style={{ display: 'block', width: '288px', height: '60px' }}
                data-ad-client={process.env.PLASMO_PUBLIC_ADSENSE_PUB_ID}
                data-ad-slot={process.env.PLASMO_PUBLIC_ADSENSE_SLOT_ID}
                data-ad-format="fixed"
              />
            </div>
          </div>
        )}

      <div className={styles.footer}>
        <div className={styles.footerLinks}>
          <a
            className={styles.footerLink}
            href="https://ko-fi.com/zacooper"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className={styles.kofiIcon}>&#9749;</span>
            Buy me a coffee
          </a>
          <a
            className={styles.footerLink}
            href="https://github.com/sponsors/zacooper5g"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className={styles.heart}>&#9829;</span>
            Sponsor
          </a>
          <a
            className={styles.footerLink}
            href="https://github.com/zacooper5g/x-reply-sorter/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className={styles.feedbackIcon}>&#9993;</span>
            Feedback
          </a>
          <span className={styles.version}>v0.1.0</span>
        </div>
      </div>
    </div>
  )
}

export default Popup
