import { useEffect, useRef, useState } from 'react'
import { SignOut, X } from '@phosphor-icons/react'
import type { AccountSyncState } from './AccountDialog'

export type ThemePreference = 'system' | 'light' | 'dark'

interface SettingsDialogProps {
  themePreference: ThemePreference
  onThemePreferenceChange: (preference: ThemePreference) => void
  onManageAccount: () => void
  isSignedIn: boolean
  accountEmail: string | null
  syncState: AccountSyncState
  onSignOut: () => Promise<void>
  onClose: () => void
}

const themeOptions: { value: ThemePreference; label: string; description: string }[] = [
  { value: 'system', label: 'System', description: 'Use your device setting' },
  { value: 'light', label: 'Light', description: 'Always use light theme' },
  { value: 'dark', label: 'Dark', description: 'Always use dark theme' },
]

export function SettingsDialog({
  themePreference,
  onThemePreferenceChange,
  onManageAccount,
  isSignedIn,
  accountEmail,
  syncState,
  onSignOut,
  onClose,
}: SettingsDialogProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const [signOutBusy, setSignOutBusy] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const canSignOut = syncState === 'synced'

  async function handleSignOut() {
    setSignOutBusy(true)
    setSignOutError(null)
    try {
      await onSignOut()
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Sign-out failed. Please try again.')
    } finally {
      setSignOutBusy(false)
    }
  }

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.querySelector<HTMLInputElement>('input:checked')?.focus()

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const focusableElements = Array.from(dialog?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [])
      if (focusableElements.length === 0) {
        event.preventDefault()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const focusIsOutsideDialog = !dialog?.contains(document.activeElement)
      if (event.shiftKey && (document.activeElement === firstElement || focusIsOutsideDialog)) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && (document.activeElement === lastElement || focusIsOutsideDialog)) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [onClose])

  return (
    <div className="composer-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} className="composer-sheet settings-sheet" role="dialog" aria-modal="true" aria-labelledby="settings-heading">
        <div className="composer-title-row">
          <div className="composer-heading-group">
            <h2 className="composer-heading" id="settings-heading">Settings</h2>
          </div>
          <button className="composer-close" type="button" aria-label="Close settings" onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="settings-content">
          <fieldset className="settings-theme-field">
            <legend>Appearance</legend>
            <div className="settings-theme-options">
              {themeOptions.map((option) => (
                <label className={`settings-theme-option ${themePreference === option.value ? 'is-selected' : ''}`} key={option.value}>
                  <input
                    type="radio"
                    name="theme-preference"
                    value={option.value}
                    checked={themePreference === option.value}
                    onChange={() => onThemePreferenceChange(option.value)}
                  />
                  <span className="settings-theme-copy">
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <section className="settings-info" aria-labelledby="settings-data-heading">
            <h3 id="settings-data-heading">Your data</h3>
            <p>Your tasks stay available on this device and sync to your account when you are connected.</p>
            {isSignedIn ? (
              <>
                <p className="settings-account-email">{accountEmail ?? 'Google account connected'}</p>
                <button
                  className="account-signout settings-signout-button"
                  type="button"
                  disabled={!canSignOut || signOutBusy}
                  title={!canSignOut ? 'Sync pending changes before signing out' : undefined}
                  onClick={() => { void handleSignOut() }}
                >
                  <SignOut size={18} aria-hidden="true" />
                  <span>{signOutBusy ? 'Signing out…' : canSignOut ? 'Sign out of Google' : 'Sync tasks to sign out'}</span>
                </button>
                <p className="account-signout-note">This signs you out of Daymark. It does not sign you out of Gmail in other tabs or Google apps.</p>
                {signOutError && <p className="account-error" role="alert">{signOutError}</p>}
              </>
            ) : (
              <button className="settings-account-button" type="button" onClick={onManageAccount}>Connect Google account</button>
            )}
          </section>
        </div>
      </section>
    </div>
  )
}
