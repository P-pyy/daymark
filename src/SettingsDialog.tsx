import { useEffect, useRef } from 'react'
import { X } from '@phosphor-icons/react'

export type ThemePreference = 'system' | 'light' | 'dark'

interface SettingsDialogProps {
  themePreference: ThemePreference
  onThemePreferenceChange: (preference: ThemePreference) => void
  onManageAccount: () => void
  onClose: () => void
}

const themeOptions: { value: ThemePreference; label: string; description: string }[] = [
  { value: 'system', label: 'System', description: 'Use your device setting' },
  { value: 'light', label: 'Light', description: 'Always use light theme' },
  { value: 'dark', label: 'Dark', description: 'Always use dark theme' },
]

export function SettingsDialog({ themePreference, onThemePreferenceChange, onManageAccount, onClose }: SettingsDialogProps) {
  const dialogRef = useRef<HTMLElement>(null)

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
            <button className="settings-account-button" type="button" onClick={onManageAccount}>Manage profile</button>
          </section>
        </div>
      </section>
    </div>
  )
}
