import { useEffect, useState } from 'react'

import {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
  type Settings
} from '~utils/storage'

import * as styles from './popup.module.css'

const Popup = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s)
      setLoaded(true)
    })
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
      chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED' })
    }
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
