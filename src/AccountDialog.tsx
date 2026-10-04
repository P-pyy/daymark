import { useEffect, useRef, useState } from 'react'
import { SignOut, X } from '@phosphor-icons/react'
import type { User } from '@supabase/supabase-js'

export type AccountSyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error'

interface AccountDialogProps {
  configured: boolean
  user: User | null
  syncState: AccountSyncState
  syncError: string | null
  loginNoticeError: string | null
  onSignIn: () => Promise<void>
  onSignOut: () => Promise<void>
  onRetrySync: () => void
  onRetryLoginNotice: () => void
  onClose: () => void
}

export function AccountDialog({
  configured,
  user,
  syncState,
  syncError,
  loginNoticeError,
  onSignIn,
  onSignOut,
  onRetrySync,
  onRetryLoginNotice,
  onClose,
}: AccountDialogProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const metadataName = user?.user_metadata.full_name ?? user?.user_metadata.name
  const metadataImage = user?.user_metadata.avatar_url ?? user?.user_metadata.picture
  const profileName = typeof metadataName === 'string' ? metadataName : 'Google account'
  const profileImage = typeof metadataImage === 'string' ? metadataImage : null
  const canSignOut = syncState === 'synced'

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.querySelector<HTMLElement>('button:not([disabled])')?.focus()

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = Array.from(dialog?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [])
      if (!focusable.length) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [onClose])

  async function runAction(action: () => Promise<void>) {
    setBusy(true)
    setActionError(null)
    try {
      await action()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The account request failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="composer-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} className="composer-sheet settings-sheet account-sheet" role="dialog" aria-modal="true" aria-labelledby="account-heading">
        <div className="composer-title-row">
          <div className="composer-heading-group">
            <h2 className="composer-heading" id="account-heading">Profile</h2>
          </div>
          <button className="composer-close" type="button" aria-label="Close profile" onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {!configured ? (
          <div className="account-message" role="status">
            <h3>Profile setup is needed</h3>
            <p>Daymark needs a Supabase project and Google sign-in configuration before you can connect an account.</p>
          </div>
        ) : user ? (
          <div className="account-content">
            <div className="account-identity">
              {profileImage
                ? <img className="account-avatar" src={profileImage} alt="" referrerPolicy="no-referrer" />
                : <span className="account-avatar account-avatar-fallback" aria-hidden="true">{profileName.slice(0, 1).toUpperCase()}</span>}
              <div>
                <strong>{profileName}</strong>
                <span>{user.email ?? 'Google account'}</span>
              </div>
            </div>

            <div className="account-sync-state" role="status" aria-live="polite">
              <strong>{syncState === 'syncing'
                ? 'Syncing your tasks'
                : syncState === 'synced'
                  ? 'Tasks are up to date'
                  : syncState === 'offline'
                    ? 'You are offline'
                    : syncState === 'error'
                      ? 'Sync needs attention'
                      : 'Preparing task sync'}</strong>
              <p>{syncState === 'synced'
                ? 'Tasks are available across your signed-in devices.'
                : syncState === 'offline'
                  ? 'Your changes are saved on this device and will sync when you reconnect.'
                  : syncError ?? 'Daymark is checking for account changes.'}</p>
              {(syncState === 'error' || syncState === 'offline') && (
                <button className="account-text-button" type="button" onClick={onRetrySync}>Try sync again</button>
              )}
            </div>

            {loginNoticeError && (
              <div className="account-message" role="alert">
                <p>You are signed in, but the sign-in email could not be sent.</p>
                <button className="account-text-button" type="button" onClick={onRetryLoginNotice}>Try sending again</button>
              </div>
            )}

            <button
              className="account-signout"
              type="button"
              disabled={!canSignOut || busy}
              title={!canSignOut ? 'Reconnect and sync pending changes before signing out' : undefined}
              onClick={() => { void runAction(onSignOut) }}
            >
              <SignOut size={18} aria-hidden="true" />
              <span>{syncState === 'synced' ? 'Sign out' : 'Sync before signing out'}</span>
            </button>
            {!canSignOut && <p className="account-signout-note">Sign out is available after all changes have synced.</p>}
          </div>
        ) : (
          <div className="account-content">
            <div className="account-message">
              <h3>Connect your Google account</h3>
              <p>Sign in to sync your tasks across devices. Daymark uses your account name, email, and profile photo only. It cannot read your Gmail inbox.</p>
            </div>
            <button className="account-google-button" type="button" disabled={busy} onClick={() => { void runAction(onSignIn) }}>
              <span className="google-mark" aria-hidden="true">G</span>
              <span>{busy ? 'Connecting…' : 'Continue with Google'}</span>
            </button>
          </div>
        )}
        {actionError && <p className="account-error" role="alert">{actionError}</p>}
      </section>
    </div>
  )
}
