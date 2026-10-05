import { useRef, useState } from 'react'
import '@fontsource/poppins/latin-400.css'
import '@fontsource/poppins/latin-500.css'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/poppins/latin-700.css'
import '@fontsource/poppins/latin-800.css'
import '@fontsource/poppins/latin-ext-400.css'
import '@fontsource/poppins/latin-ext-500.css'
import '@fontsource/poppins/latin-ext-600.css'
import '@fontsource/poppins/latin-ext-700.css'
import '@fontsource/poppins/latin-ext-800.css'
import { Bell, Camera, ChevronDown, ChevronLeft, LogOut, MessageSquare, Pencil, UserRound, X } from 'lucide-react'
import type { AccountSyncState } from './AccountDialog'
import { useLocale, type Language } from './locale'
import { readProfilePreferences, writeProfilePreferences, type ProfilePreferences } from './profilePreferences'
import unitedKingdomFlag from 'flag-icons/flags/4x3/gb.svg'
import philippinesFlag from 'flag-icons/flags/4x3/ph.svg'

export type ThemePreference = 'system' | 'light' | 'dark'

interface ProfileScreenProps {
  themePreference: ThemePreference
  onThemePreferenceChange: (preference: ThemePreference) => void
  onManageAccount: (trigger: HTMLButtonElement) => void
  isSignedIn: boolean
  accountEmail: string | null
  profileName?: string | null
  profileImage?: string | null
  profileScope: string
  onUpdateProfileName: (name: string) => Promise<void>
  syncState: AccountSyncState
  onSignOut: () => Promise<void>
  notificationPermission: NotificationPermission | 'unsupported'
  browserAlertsEnabled?: boolean
  notificationError: string | null
  onRequestNotificationPermission: () => Promise<void>
  onOpenNotifications: () => void
}

const themeOptions: { value: ThemePreference; label: string; description: string }[] = [
  { value: 'system', label: 'System', description: 'Use your device setting' },
  { value: 'light', label: 'Light', description: 'A bright paper feel' },
  { value: 'dark', label: 'Dark', description: 'A softer evening feel' },
]

export function ProfileScreen({
  themePreference,
  onThemePreferenceChange,
  onManageAccount,
  isSignedIn,
  accountEmail,
  profileName,
  profileImage,
  profileScope,
  onUpdateProfileName,
  syncState,
  onSignOut,
  notificationPermission,
  browserAlertsEnabled = true,
  notificationError,
  onRequestNotificationPermission,
  onOpenNotifications,
}: ProfileScreenProps) {
  const { language, setLanguage, storageError: languageStorageError, translate: t } = useLocale()
  const [storedProfile] = useState(() => readProfilePreferences(profileScope))
  const [profilePreferences, setProfilePreferences] = useState<ProfilePreferences | null>(storedProfile.preferences)
  const [optimisticAccountName, setOptimisticAccountName] = useState<{
    source: string | null
    value: string
  } | null>(null)
  const profilePreferencesFailed = storedProfile.failed
  const profilePreferencesReady = true
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftPhoto, setDraftPhoto] = useState<string | null>(null)
  const [photoChanged, setPhotoChanged] = useState(false)
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [signOutBusy, setSignOutBusy] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [notificationBusy, setNotificationBusy] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const canSignOut = syncState === 'synced'
  const savedPhoto = profilePreferences && Object.prototype.hasOwnProperty.call(profilePreferences, 'avatarDataUrl')
    ? profilePreferences.avatarDataUrl ?? null
    : profileImage ?? null
  const displayedName = profilePreferences?.displayName
    ?? (optimisticAccountName && optimisticAccountName.source === profileName ? optimisticAccountName.value : profileName)
    ?? (isSignedIn ? 'Google account' : 'Your Daymark profile')

  function startEditing() {
    setDraftName(displayedName === 'Your Daymark profile' || displayedName === 'Google account' ? '' : displayedName)
    setDraftPhoto(savedPhoto)
    setPhotoChanged(false)
    setProfileError(null)
    setEditing(true)
  }

  function cancelEditing() {
    setProfileError(null)
    setEditing(false)
  }

  function handlePhotoSelection(file: File | undefined) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setProfileError(t('Choose a JPG, PNG, or WebP image.'))
      return
    }
    if (file.size > 1024 * 1024) {
      setProfileError(t('Choose an image smaller than 1 MB.'))
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setProfileError(t('This image could not be read. Choose another file.'))
        return
      }
      setDraftPhoto(reader.result)
      setPhotoChanged(true)
      setProfileError(null)
    }
    reader.onerror = () => setProfileError(t('This image could not be read. Choose another file.'))
    reader.readAsDataURL(file)
  }

  async function saveProfile() {
    const name = draftName.trim()
    if (!name) {
      setProfileError(t('Enter a display name before saving.'))
      nameInputRef.current?.focus()
      return
    }
    if (!profilePreferencesReady || profilePreferencesFailed) {
      setProfileError(t('Your saved profile preferences could not be read. Reload Daymark before trying again.'))
      return
    }

    setProfileBusy(true)
    setProfileError(null)
    const nextPreferences: ProfilePreferences = {
      ...(!isSignedIn ? { displayName: name } : profilePreferences?.displayName ? { displayName: profilePreferences.displayName } : {}),
      ...(photoChanged ? { avatarDataUrl: draftPhoto } : profilePreferences?.avatarDataUrl !== undefined
        ? { avatarDataUrl: profilePreferences.avatarDataUrl }
        : {}),
    }
    const shouldSavePreferences = !isSignedIn || photoChanged
    const preferencesSaved = shouldSavePreferences
      ? writeProfilePreferences(profileScope, nextPreferences)
      : true

    if (!preferencesSaved) {
      setProfileBusy(false)
      setProfileError(t('Your profile photo could not be saved on this device. Check available browser storage and try again.'))
      return
    }

    try {
      if (isSignedIn) await onUpdateProfileName(name)
      if (isSignedIn) setOptimisticAccountName({ source: profileName ?? null, value: name })
      setProfilePreferences(shouldSavePreferences ? nextPreferences : profilePreferences)
      setEditing(false)
    } catch (error) {
      const rolledBack = shouldSavePreferences
        ? writeProfilePreferences(profileScope, profilePreferences)
        : true
      setProfileError(error instanceof Error
        ? `${error.message}${rolledBack ? '' : ' Your previous local profile photo could not be restored.'}`
        : t('Your profile could not be saved. Please try again.'))
    } finally {
      setProfileBusy(false)
    }
  }

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

  async function handleNotificationRequest() {
    setNotificationBusy(true)
    try {
      await onRequestNotificationPermission()
    } finally {
      setNotificationBusy(false)
    }
  }

  const notificationStatus = notificationPermission === 'granted'
    ? t(browserAlertsEnabled ? 'Browser notifications are on' : 'Browser notifications are off')
    : notificationPermission === 'denied'
      ? t('Blocked in browser settings')
      : notificationPermission === 'unsupported'
        ? t('Not available in this browser')
        : t('Optional browser notifications')
  const feedbackUrl = new URL('https://github.com/P-pyy/daymark/issues/new')
  feedbackUrl.searchParams.set('title', t('Feedback for Daymark'))
  feedbackUrl.searchParams.set('body', t('Describe your idea or the problem you encountered.'))

  return (
    <section className="profile-page" aria-labelledby="profile-heading">
      <header className={`profile-settings-header${editing ? ' is-editing' : ''}`}>
        {editing ? (
          <>
            <button className="profile-header-back" type="button" aria-label={t('Back to Settings')} onClick={cancelEditing}>
              <ChevronLeft size={21} aria-hidden="true" />
            </button>
            <div className="profile-settings-title">
              <h1 id="profile-heading">{t('Edit profile')}</h1>
            </div>
            <span className="profile-header-doodle profile-doodle-star" aria-hidden="true">✧</span>
            <span className="profile-header-doodle profile-doodle-heart" aria-hidden="true">♡</span>
            <span className="profile-header-doodle profile-doodle-spark" aria-hidden="true">✦</span>
          </>
        ) : (
          <>
            <span className="profile-header-doodle profile-doodle-star" aria-hidden="true">✧</span>
            <span className="profile-header-doodle profile-doodle-heart" aria-hidden="true">♡</span>
            <div className="profile-settings-title">
              <h1 id="profile-heading">{t('Settings')}</h1>
              <p>{t('Your account')}</p>
            </div>
            <button className="profile-header-account" type="button" aria-label={t('Manage account')} onClick={(event) => onManageAccount(event.currentTarget)}>
              <UserRound size={22} aria-hidden="true" />
            </button>
            <span className="profile-header-doodle profile-doodle-spark" aria-hidden="true">✦</span>
          </>
        )}
      </header>

      {editing ? (
        <section className="profile-edit-content" aria-label={t('Edit profile details')}>
          <div className="profile-photo-editor">
            <span className="profile-photo-frame">
              {draftPhoto
                ? <img src={draftPhoto} alt="" />
                : <span className="profile-photo-fallback" aria-hidden="true">
                    {displayedName && displayedName !== 'Your Daymark profile' ? displayedName.slice(0, 1).toUpperCase() : <UserRound size={38} />}
                  </span>}
            </span>
            {draftPhoto && (
              <button className="profile-photo-remove" type="button" aria-label={t('Remove profile photo')} onClick={() => {
                setDraftPhoto(null)
                setPhotoChanged(true)
                setProfileError(null)
              }}>
                <X size={14} aria-hidden="true" />
              </button>
            )}
            <button className="profile-photo-upload" type="button" aria-label={t('Choose a profile photo')} onClick={() => photoInputRef.current?.click()}>
              <Camera size={16} aria-hidden="true" />
            </button>
            <input
              ref={photoInputRef}
              className="profile-photo-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label={t('Upload profile photo')}
              onChange={(event) => {
                handlePhotoSelection(event.currentTarget.files?.[0])
                event.currentTarget.value = ''
              }}
            />
          </div>

          <form className="profile-edit-form" onSubmit={(event) => { event.preventDefault(); void saveProfile() }}>
            <div className="profile-edit-field">
              <label htmlFor="profile-display-name">{t('Display name')} <span aria-hidden="true">*</span></label>
              <input
                ref={nameInputRef}
                id="profile-display-name"
                name="displayName"
                type="text"
                value={draftName}
                maxLength={80}
                autoComplete="name"
                required
                onChange={(event) => setDraftName(event.currentTarget.value)}
              />
              <p>{t('This is the name shown on your Daymark profile.')}</p>
              {profileError && <p className="profile-edit-error" role="alert">{profileError}</p>}
            </div>
            <div className="profile-edit-actions">
              <button className="profile-save-button" type="submit" disabled={profileBusy || !profilePreferencesReady}>
                {profileBusy ? t('Saving…') : t('Save')}
              </button>
              <button className="profile-cancel-button" type="button" onClick={cancelEditing} disabled={profileBusy}>{t('Cancel')}</button>
            </div>
          </form>
        </section>
      ) : (
      <>
      <div className="profile-settings-panel">
      <section className="profile-account-card" aria-label={t('Profile')}>
        <div className="profile-account-identity">
          {savedPhoto
            ? <img className="profile-avatar" src={savedPhoto} alt="" referrerPolicy="no-referrer" />
            : <span className="profile-avatar profile-avatar-fallback" aria-hidden="true">
                {displayedName !== 'Your Daymark profile' ? displayedName.slice(0, 1).toUpperCase() : <UserRound size={24} />}
              </span>}
          <span className="profile-account-copy">
            <strong>{displayedName}</strong>
            <small>{accountEmail ?? t('Tasks stay on this device unless you connect an account; then they sync across your signed-in devices.')}</small>
            <span className="profile-account-badge">{isSignedIn ? t('Google account') : t('Private on this device')}</span>
          </span>
        </div>
        <button className="profile-account-action" type="button" onClick={startEditing}>
          <Pencil size={16} aria-hidden="true" /> {t('Edit profile')}
        </button>
      </section>

        <section className="profile-settings-section profile-select-section" aria-labelledby="profile-language-heading">
          <div className="profile-setting-copy">
            <h2 id="profile-language-heading">{t('Language')}</h2>
            <p>{t('Choose your preferred language for Daymark.')}</p>
          </div>
          <div className="profile-select-control profile-language-control">
            <img
              className="profile-language-flag"
              src={language === 'fil' ? philippinesFlag : unitedKingdomFlag}
              alt=""
              aria-hidden="true"
            />
            <select
              className="profile-setting-select"
              aria-label={t('Language')}
              value={language}
              onChange={(event) => setLanguage(event.currentTarget.value as Language)}
            >
              <option value="en">English</option>
              <option value="fil">Filipino</option>
            </select>
            <ChevronDown className="profile-select-chevron" size={16} strokeWidth={2.2} aria-hidden="true" />
          </div>
          {languageStorageError && <p className="profile-setting-error" role="alert">{t(languageStorageError)}</p>}
        </section>

        <section className="profile-settings-section profile-select-section" aria-labelledby="profile-appearance-heading">
          <div className="profile-setting-copy">
            <h2 id="profile-appearance-heading">{t('Appearance')}</h2>
            <p>{t('Choose how Daymark looks on this device.')}</p>
          </div>
          <div className="profile-select-control">
            <select
              className="profile-setting-select"
              aria-label={t('Appearance')}
              value={themePreference}
              onChange={(event) => onThemePreferenceChange(event.currentTarget.value as ThemePreference)}
            >
              {themeOptions.map((option) => <option value={option.value} key={option.value}>{t(option.label)}</option>)}
            </select>
            <ChevronDown className="profile-select-chevron" size={16} strokeWidth={2.2} aria-hidden="true" />
          </div>
        </section>

        <section className="profile-settings-section profile-action-section" aria-labelledby="profile-reminders-heading">
          <div className="profile-setting-copy">
            <h2 id="profile-reminders-heading">{t('Notification settings')}</h2>
            <p className="profile-row-description">{t('All reminders')} · {notificationStatus}</p>
          </div>
          <button className="profile-row-action" type="button" onClick={onOpenNotifications}>
            <Bell size={16} aria-hidden="true" /> {t('Notifications')}
          </button>
          {notificationPermission === 'default' && (
            <button
              className="profile-inline-action"
              type="button"
              disabled={notificationBusy}
              onClick={() => { void handleNotificationRequest() }}
            >
              {notificationBusy ? t('Checking permission…') : t('Enable browser notifications')}
            </button>
          )}
          {notificationError && <p className="account-error" role="alert">{notificationError}</p>}
        </section>

        <section className="profile-settings-section profile-action-section" aria-labelledby="profile-feedback-heading">
          <div className="profile-setting-copy">
            <h2 id="profile-feedback-heading">{t('Send feedback')}</h2>
            <p className="profile-row-description">{t('Report a bug or share an idea with us.')}</p>
          </div>
          <a className="profile-row-action" href={feedbackUrl.toString()} target="_blank" rel="noreferrer">
            <MessageSquare size={16} aria-hidden="true" /> {t('Feedback')}
          </a>
        </section>
      </div>
      <div className="profile-signout-wrap">
        {isSignedIn ? (
          <>
            <button
              className="profile-logout-button"
              type="button"
              disabled={!canSignOut || signOutBusy}
              title={!canSignOut ? t('Sync tasks to sign out') : undefined}
              onClick={() => { void handleSignOut() }}
            >
              <LogOut size={16} aria-hidden="true" />
              {signOutBusy ? t('Logging out…') : canSignOut ? t('Log out') : t('Sync tasks to sign out')}
            </button>
            <p className="profile-signout-note">{canSignOut
              ? t("You'll need to sign in again to sync your tasks.")
              : t('Sign out is available after all changes have synced.')}</p>
              {signOutError && <p className="account-error" role="alert">{signOutError}</p>}
          </>
        ) : (
          <button className="profile-logout-button" type="button" onClick={(event) => onManageAccount(event.currentTarget)}>
            <UserRound size={16} aria-hidden="true" /> {t('Connect account')}
          </button>
        )}
      </div>
      </>
      )}
    </section>
  )
}
