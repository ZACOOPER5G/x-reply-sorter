import { Storage } from '@plasmohq/storage'

export type SortOption = 'likes' | 'recent' | 'relevance'

export type PremiumFilter =
  | 'verified_only'
  | 'hide_verified'
  | 'op_only'
  | 'hide_links'
  | 'media_only'
  | 'hide_ads'
  | 'hide_quote_only'

export type PremiumSort = 'none' | 'retweets' | 'views' | 'replies'

export interface Settings {
  enabled: boolean
  sortBy: SortOption
  premiumFilters: PremiumFilter[]
  premiumSort: PremiumSort
}

export interface LicenseData {
  key: string
  valid: boolean
  activatedAt: string
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  sortBy: 'likes',
  premiumFilters: [],
  premiumSort: 'none'
}

// Set this date when you flip the switch to paid.
// All installs before this date get Pro for free.
const PRO_CUTOFF_DATE = '' // e.g. '2026-09-01T00:00:00Z'

const storage = new Storage()

export const getSettings = async (): Promise<Settings> => {
  const saved = await storage.get<Settings>('settings')
  return { ...DEFAULT_SETTINGS, ...saved }
}

export const saveSettings = async (
  settings: Partial<Settings>
): Promise<Settings> => {
  const current = await getSettings()
  const updated = { ...current, ...settings }
  await storage.set('settings', updated)
  return updated
}

export const getLicense = async (): Promise<LicenseData | null> => {
  return storage.get<LicenseData>('license') || null
}

export const saveLicense = async (license: LicenseData): Promise<void> => {
  await storage.set('license', license)
}

export const removeLicense = async (): Promise<void> => {
  await storage.remove('license')
}

export const getInstalledAt = async (): Promise<string | null> => {
  return storage.get<string>('installedAt') || null
}

export const setInstalledAt = async (): Promise<string> => {
  const existing = await getInstalledAt()
  if (existing) return existing

  const now = new Date().toISOString()
  await storage.set('installedAt', now)
  return now
}

export const isGrandfathered = async (): Promise<boolean> => {
  if (!PRO_CUTOFF_DATE) return true // No cutoff set = everyone gets Pro free

  const installedAt = await getInstalledAt()
  if (!installedAt) return false

  return new Date(installedAt) < new Date(PRO_CUTOFF_DATE)
}

export const isPremium = async (): Promise<boolean> => {
  const grandfathered = await isGrandfathered()
  if (grandfathered) return true

  const license = await getLicense()
  return license?.valid === true
}
