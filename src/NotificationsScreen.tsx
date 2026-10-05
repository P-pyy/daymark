import { useState } from 'react'
import { Bell, CheckCircle, GearSix } from '@phosphor-icons/react'
import type { DueNotification } from './dueNotifications'
import { useLocale } from './locale'

interface NotificationsScreenProps {
  notifications: DueNotification[]
  storageError: string | null
  onOpenSettings: () => void
  onOpenTask: (notification: DueNotification, trigger: HTMLButtonElement) => void
}

function formatReminderDate(value: string, locale: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' })
    .format(new Date(year, month - 1, day))
}

export function NotificationsScreen({
  notifications,
  storageError,
  onOpenSettings,
  onOpenTask,
}: NotificationsScreenProps) {
  const { language, translate: t } = useLocale()
  const intlLocale = language === 'fil' ? 'fil-PH' : 'en'
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all')
  const visibleNotifications = activeFilter === 'unread'
    ? notifications.filter((notification) => !notification.read)
    : notifications

  return (
    <section className="notifications-page" aria-labelledby="notifications-heading">
      <header className="feature-page-header notifications-page-header">
        <div className="feature-page-copy">
          <h1 id="notifications-heading">{t('Notifications')}</h1>
          <p>{t('Updates from your tasks')}</p>
        </div>
        <span className="notifications-header-art" aria-hidden="true"><Bell size={19} weight="regular" /></span>
      </header>

      <div className="notifications-toolbar">
        <div className="notification-tabs" role="tablist" aria-label={t('Notification filter')}>
          <button
            type="button"
            role="tab"
            aria-selected={activeFilter === 'all'}
            className={activeFilter === 'all' ? 'is-active' : ''}
            onClick={() => setActiveFilter('all')}
          >
            {t('All')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeFilter === 'unread'}
            className={activeFilter === 'unread' ? 'is-active' : ''}
            onClick={() => setActiveFilter('unread')}
          >
            {t('Unread')}
          </button>
        </div>

        <button
          className="notification-settings-button"
          type="button"
          aria-label={t('Notification settings')}
          onClick={onOpenSettings}
        >
          <GearSix size={17} aria-hidden="true" />
        </button>
      </div>

      {storageError && <p className="notification-storage-error" role="alert">{storageError}</p>}

      {visibleNotifications.length > 0 ? (
        <div className="notifications-results">
          <ul className="notification-list">
            {visibleNotifications.map((notification) => {
              return (
                <li className={`notification-row ${notification.read ? '' : 'is-unread'}`} key={notification.id}>
                  <button
                    className="notification-open-button"
                    type="button"
                    aria-label={`${t('Open task')} “${notification.taskTitle}” ${t('due')} ${formatReminderDate(notification.dueDate, intlLocale)}`}
                    onClick={(event) => onOpenTask(notification, event.currentTarget)}
                  >
                    <span className="notification-icon" aria-hidden="true"><CheckCircle size={21} weight="duotone" /></span>
                    <span className="notification-copy">
                      <strong>{t('Due today')}</strong>
                      <span>{notification.taskTitle}</span>
                      <time dateTime={notification.dueDate}>{formatReminderDate(notification.dueDate, intlLocale)}</time>
                    </span>
                    {!notification.read && <span className="notification-unread-dot" aria-label="Unread" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <div className="notifications-empty-state">
          <img src="/daymark-empty-notifications.svg" alt="" aria-hidden="true" />
          <h2>{t(activeFilter === 'unread' ? 'No unread notifications' : 'No notifications yet')}</h2>
          <p>{t(activeFilter === 'unread' ? "You're all caught up." : 'Reminders from your tasks will show up here.')}</p>
        </div>
      )}
    </section>
  )
}
