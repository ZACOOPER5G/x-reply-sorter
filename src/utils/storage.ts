import { Storage } from '@plasmohq/storage'

export interface Settings {
  enabled: boolean
  sortBy: 'likes' | 'recent' | 'relevance'
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  sortBy: 'likes'
}

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
