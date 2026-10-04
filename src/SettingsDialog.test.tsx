import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SettingsDialog } from './SettingsDialog'

describe('SettingsDialog Google account controls', () => {
  it('shows a sync-gated sign-out action for a connected account', async () => {
    const onSignOut = vi.fn().mockResolvedValue(undefined)
    const props = {
      themePreference: 'system' as const,
      onThemePreferenceChange: vi.fn(),
      onManageAccount: vi.fn(),
      isSignedIn: true,
      accountEmail: 'daymark@example.com',
      syncState: 'syncing' as const,
      onSignOut,
      onClose: vi.fn(),
    }

    const { rerender } = render(<SettingsDialog {...props} />)

    expect(screen.getByText('daymark@example.com')).toBeInTheDocument()
    expect(screen.getByText(/does not sign you out of Gmail in other tabs or Google apps/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sync tasks to sign out' })).toBeDisabled()

    rerender(<SettingsDialog {...props} syncState="synced" />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign out of Google' }))

    await waitFor(() => expect(onSignOut).toHaveBeenCalledOnce())
  })
})
