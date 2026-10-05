export const browserAlertsPreferenceKey = 'daymark.browser-alerts.enabled.v1'

export interface BrowserAlertsPreference {
  enabled: boolean
  failed: boolean
}

export function readBrowserAlertsPreference(defaultEnabled: boolean): BrowserAlertsPreference {
  try {
    const stored = localStorage.getItem(browserAlertsPreferenceKey)
    if (stored === null) return { enabled: defaultEnabled, failed: false }
    if (stored === 'true') return { enabled: true, failed: false }
    if (stored === 'false') return { enabled: false, failed: false }
    return { enabled: defaultEnabled, failed: true }
  } catch {
    return { enabled: defaultEnabled, failed: true }
  }
}

export function writeBrowserAlertsPreference(enabled: boolean): boolean {
  try {
    localStorage.setItem(browserAlertsPreferenceKey, String(enabled))
    return true
  } catch {
    return false
  }
}
