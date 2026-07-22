import { getLicense, saveLicense, removeLicense } from './storage'

interface LemonSqueezyResponse {
  valid: boolean
  error?: string
  license_key?: {
    status: string
    key: string
  }
}

export const validateLicenseKey = async (
  key: string
): Promise<{ valid: boolean; error?: string }> => {
  try {
    const response = await fetch(
      'https://api.lemonsqueezy.com/v1/licenses/validate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: key,
          instance_name: 'x-reply-sorter'
        })
      }
    )

    const data: LemonSqueezyResponse = await response.json()

    if (data.valid) {
      await saveLicense({
        key,
        valid: true,
        activatedAt: new Date().toISOString()
      })
      return { valid: true }
    }

    return { valid: false, error: data.error || 'Invalid license key' }
  } catch {
    return { valid: false, error: 'Could not validate license. Check your connection.' }
  }
}

export const activateLicenseKey = async (
  key: string
): Promise<{ valid: boolean; error?: string }> => {
  try {
    const response = await fetch(
      'https://api.lemonsqueezy.com/v1/licenses/activate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: key,
          instance_name: 'x-reply-sorter'
        })
      }
    )

    const data = await response.json()

    if (data.activated || data.valid) {
      await saveLicense({
        key,
        valid: true,
        activatedAt: new Date().toISOString()
      })
      return { valid: true }
    }

    return { valid: false, error: data.error || 'Could not activate license' }
  } catch {
    return { valid: false, error: 'Could not activate license. Check your connection.' }
  }
}

export const deactivateLicense = async (): Promise<void> => {
  const license = await getLicense()

  if (license?.key) {
    try {
      await fetch('https://api.lemonsqueezy.com/v1/licenses/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: license.key,
          instance_id: 'x-reply-sorter'
        })
      })
    } catch {
      // Best-effort deactivation
    }
  }

  await removeLicense()
}
