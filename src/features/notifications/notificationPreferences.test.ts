import { beforeEach, describe, expect, it } from 'vitest'
import {
  browserAlertsPreferenceKey,
  readBrowserAlertsPreference,
  writeBrowserAlertsPreference,
} from './notificationPreferences'

describe('browser alert preferences', () => {
  beforeEach(() => localStorage.clear())

  it('uses the supplied default until a preference has been saved', () => {
    expect(readBrowserAlertsPreference(true)).toEqual({ enabled: true, failed: false })
    expect(readBrowserAlertsPreference(false)).toEqual({ enabled: false, failed: false })
  })

  it('persists and reads both enabled and disabled preferences', () => {
    expect(writeBrowserAlertsPreference(true)).toBe(true)
    expect(localStorage.getItem(browserAlertsPreferenceKey)).toBe('true')
    expect(readBrowserAlertsPreference(false)).toEqual({ enabled: true, failed: false })

    expect(writeBrowserAlertsPreference(false)).toBe(true)
    expect(readBrowserAlertsPreference(true)).toEqual({ enabled: false, failed: false })
  })

  it('flags malformed stored preferences instead of silently accepting them', () => {
    localStorage.setItem(browserAlertsPreferenceKey, 'sometimes')

    expect(readBrowserAlertsPreference(true)).toEqual({ enabled: true, failed: true })
  })
})
