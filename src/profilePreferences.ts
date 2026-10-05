export interface ProfilePreferences {
  displayName?: string
  avatarDataUrl?: string | null
}

export interface ProfilePreferencesRead {
  preferences: ProfilePreferences | null
  failed: boolean
}

function profilePreferencesKey(scope: string) {
  return `daymark.profile.v1.${encodeURIComponent(scope)}`
}

export function readProfilePreferences(scope: string): ProfilePreferencesRead {
  try {
    const stored = localStorage.getItem(profilePreferencesKey(scope))
    if (!stored) return { preferences: null, failed: false }

    const parsed: unknown = JSON.parse(stored)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { preferences: null, failed: true }
    }

    const value = parsed as Record<string, unknown>
    const validName = value.displayName === undefined || typeof value.displayName === 'string'
    const validAvatar = value.avatarDataUrl === undefined
      || value.avatarDataUrl === null
      || (typeof value.avatarDataUrl === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(value.avatarDataUrl))
    if (!validName || !validAvatar) return { preferences: null, failed: true }

    const preferences: ProfilePreferences = {}
    if (typeof value.displayName === 'string') preferences.displayName = value.displayName
    if (value.avatarDataUrl === null || typeof value.avatarDataUrl === 'string') {
      preferences.avatarDataUrl = value.avatarDataUrl
    }
    return { preferences, failed: false }
  } catch {
    return { preferences: null, failed: true }
  }
}

export function writeProfilePreferences(scope: string, preferences: ProfilePreferences | null) {
  try {
    const key = profilePreferencesKey(scope)
    if (preferences === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(preferences))
    return true
  } catch {
    return false
  }
}
