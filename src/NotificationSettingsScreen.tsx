import { useState } from 'react'
import { Bell, ChevronLeft } from 'lucide-react'
import { useLocale } from './locale'

interface NotificationSettingsScreenProps {
  permission: NotificationPermission | 'unsupported'
  browserAlertsEnabled: boolean
  error: string | null
  onSave: (enabled: boolean) => Promise<boolean>
  onCancel: () => void
}

export function NotificationSettingsScreen({
  permission,
  browserAlertsEnabled,
  error,
  onSave,
  onCancel,
}: NotificationSettingsScreenProps) {
  const { translate: t } = useLocale()
  const [draftEnabled, setDraftEnabled] = useState(browserAlertsEnabled)
  const [saving, setSaving] = useState(false)
  const canChangeBrowserAlerts = permission !== 'denied' && permission !== 'unsupported'

  const browserAlertDescription = permission === 'denied'
    ? t("Notifications are blocked. Allow them in your browser's site settings, then try again.")
    : permission === 'unsupported'
      ? t('Browser notifications are not available in this browser. In-app reminders are still available.')
      : permission === 'granted'
        ? draftEnabled
          ? t('Browser alerts are on for tasks due today.')
          : t('Browser alerts are off. In-app reminders are still available.')
        : t('Allow an optional browser alert when an active task is due today.')

  async function save() {
    setSaving(true)
    try {
      if (await onSave(draftEnabled)) onCancel()
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="notification-settings-page" aria-labelledby="notification-settings-heading">
      <header className="notification-settings-header">
        <button className="notification-settings-back" type="button" aria-label={t('Back to notifications')} onClick={onCancel}>
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h1 id="notification-settings-heading">{t('Notification settings')}</h1>
        <Bell className="notification-settings-bell" size={18} aria-hidden="true" />
      </header>

      <div className="notification-settings-content">
        <section className="notification-settings-group" aria-labelledby="notification-device-heading">
          <h2 id="notification-device-heading">{t('On this device')}</h2>
          <div className="notification-settings-card notification-push-card">
            <div className="notification-setting-copy">
              <strong>{t('Push notifications')}</strong>
              <p>{browserAlertDescription}</p>
            </div>
            <button
              className="notification-switch"
              type="button"
              role="switch"
              aria-checked={draftEnabled && canChangeBrowserAlerts}
              aria-label={t('Push notifications')}
              disabled={!canChangeBrowserAlerts || saving}
              onClick={() => setDraftEnabled((enabled) => !enabled)}
            >
              <span />
            </button>
          </div>
        </section>

        <section className="notification-settings-group" aria-labelledby="notification-reminders-heading">
          <h2 id="notification-reminders-heading">{t('Task reminders')}</h2>
          <div className="notification-settings-card notification-reminder-card">
            <span className="notification-reminder-radio" aria-hidden="true" />
            <div className="notification-setting-copy">
              <strong>{t('Due-today task reminders')}</strong>
              <p>{t('Active tasks due today appear in Daymark when you open it. You can mark reminders as read.')}</p>
            </div>
          </div>
        </section>

        {error && <p className="notification-settings-error" role="alert">{error}</p>}

        <div className="notification-settings-actions">
          <button className="notification-save-button" type="button" disabled={saving} onClick={() => { void save() }}>
            {saving ? t('Saving…') : t('Save')}
          </button>
          <button className="notification-cancel-button" type="button" disabled={saving} onClick={onCancel}>
            {t('Cancel')}
          </button>
        </div>
      </div>
    </section>
  )
}
