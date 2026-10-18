import type { ComponentProps } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfileScreen } from './ProfileScreen'
import { LocaleProvider } from '../../shared/locale'

const profileKey = 'daymark.profile.v1.local'

function renderProfile(overrides: Partial<ComponentProps<typeof ProfileScreen>> = {}) {
  const props = {
    themePreference: 'system' as const,
    onThemePreferenceChange: vi.fn(),
    onManageAccount: vi.fn(),
    isSignedIn: false,
    accountEmail: null,
    profileScope: 'local',
    onUpdateProfileName: vi.fn().mockResolvedValue(undefined),
    syncState: 'idle' as const,
    onSignOut: vi.fn().mockResolvedValue(undefined),
    notificationPermission: 'default' as const,
    notificationError: null,
    onRequestNotificationPermission: vi.fn().mockResolvedValue(undefined),
    onOpenNotifications: vi.fn(),
    ...overrides,
  }
  return { ...render(<LocaleProvider><ProfileScreen {...props} /></LocaleProvider>), props }
}

beforeEach(() => localStorage.clear())

describe('ProfileScreen Google account controls', () => {
  it('shows a sync-gated sign-out action for a connected account', async () => {
    const onSignOut = vi.fn().mockResolvedValue(undefined)
    const props = {
      themePreference: 'system' as const,
      onThemePreferenceChange: vi.fn(),
      onManageAccount: vi.fn(),
      isSignedIn: true,
      accountEmail: 'daymark@example.com',
      profileScope: 'user-1',
      onUpdateProfileName: vi.fn().mockResolvedValue(undefined),
      syncState: 'syncing' as const,
      onSignOut,
      notificationPermission: 'default' as const,
      notificationError: null,
      onRequestNotificationPermission: vi.fn().mockResolvedValue(undefined),
      onOpenNotifications: vi.fn(),
    }

    const { rerender } = render(<ProfileScreen {...props} />)

    expect(within(screen.getByRole('region', { name: 'Profile' })).getByText('daymark@example.com')).toBeInTheDocument()
    expect(screen.getByText(/Sign out is available after all changes have synced/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sync tasks to sign out' })).toBeDisabled()

    rerender(<ProfileScreen {...props} syncState="synced" />)
    expect(screen.getByText(/sign in again to sync your tasks/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))

    await waitFor(() => expect(onSignOut).toHaveBeenCalledOnce())
  })

  it('shows the reference-style Settings header and omits timezone controls', async () => {
    renderProfile({ profileName: 'Mira Day', accountEmail: 'mira@example.com', isSignedIn: true })

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByText('Your account')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit profile' })).toBeInTheDocument()
    expect(screen.getByText('Mira Day')).toBeInTheDocument()
    expect(screen.queryByText(/timezone/i)).not.toBeInTheDocument()
  })

  it('localizes the settings screen and persists the selected language', () => {
    renderProfile({ isSignedIn: true, profileName: 'Mira Day' })

    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'fil' } })

    expect(screen.getByRole('heading', { name: 'Mga setting' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hitsura' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mga setting ng notification' })).toBeInTheDocument()
    expect(localStorage.getItem('daymark.language.preference.v1')).toBe('fil')
  })

  it('opens the reminder center from notification settings', () => {
    const onOpenNotifications = vi.fn()
    renderProfile({ onOpenNotifications })

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))

    expect(onOpenNotifications).toHaveBeenCalledOnce()
  })

  it('opens and cancels the feedback sheet, returning focus to its trigger', () => {
    renderProfile()
    const trigger = screen.getByRole('button', { name: 'Feedback' })

    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Send feedback' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Bug' })).toBeChecked()
    expect(screen.getByText('Report a bug, share an idea, or tell me how I can make Daymark better.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Your message' })).toHaveAttribute('placeholder', 'Tell me a little more...')
    expect(document.querySelector('.feedback-overlay')?.parentElement).toBe(document.body)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog', { name: 'Send feedback' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes the feedback sheet with Escape', () => {
    renderProfile()
    fireEvent.click(screen.getByRole('button', { name: 'Feedback' }))

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'Send feedback' })).not.toBeInTheDocument()
  })

  it('opens a GitHub issue draft with the selected category, title, and message', () => {
    renderProfile()
    fireEvent.click(screen.getByRole('button', { name: 'Feedback' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Idea' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Add a weekly & monthly view' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Your message' }), { target: { value: 'A weekly overview would help me plan.' } })

    const form = screen.getByRole('dialog').querySelector('form')
    expect(form).toHaveAttribute('action', 'https://github.com/P-pyy/daymark/issues/new')
    expect(form).toHaveAttribute('method', 'get')
    expect(form).toHaveAttribute('target', '_blank')
    expect(form).toHaveAttribute('rel', 'noreferrer')
    expect(form?.querySelector('input[name="title"]')).toHaveValue('Add a weekly & monthly view')
    expect(form?.querySelector('input[name="body"]')).toHaveValue('**Category:** Idea\n\nA weekly overview would help me plan.')
    const serializedFields = new URLSearchParams()
    new FormData(form!).forEach((value, name) => serializedFields.append(name, String(value)))
    expect(serializedFields.toString()).toContain('title=Add+a+weekly+%26+monthly+view')
    expect(serializedFields.get('body')).toBe('**Category:** Idea\n\nA weekly overview would help me plan.')

    fireEvent.submit(form!)

    expect(screen.getByRole('status')).toHaveTextContent('Your GitHub draft is open in a new tab.')
  })

  it('rejects whitespace-only feedback instead of opening an empty issue draft', () => {
    renderProfile()
    fireEvent.click(screen.getByRole('button', { name: 'Feedback' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: '   ' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Your message' }), { target: { value: '  ' } })

    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)

    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a title and describe your feedback.')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('opens the edit screen and saves a device-local display name', async () => {
    renderProfile()

    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }))
    expect(await screen.findByRole('heading', { name: 'Edit profile' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Display name/ })).toHaveValue('')

    fireEvent.change(screen.getByRole('textbox', { name: /Display name/ }), { target: { value: 'Mira Day' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('button', { name: 'Edit profile' })).toBeInTheDocument()
    expect(screen.getByText('Mira Day')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(profileKey) || '{}')).toEqual({ displayName: 'Mira Day' })
  })

  it('saves signed-in display names to account metadata', async () => {
    const onUpdateProfileName = vi.fn().mockResolvedValue(undefined)
    renderProfile({
      isSignedIn: true,
      profileName: 'Google Name',
      profileScope: 'user-1',
      onUpdateProfileName,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }))
    const nameInput = await screen.findByRole('textbox', { name: /Display name/ })
    fireEvent.change(nameInput, { target: { value: 'Mira Day' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onUpdateProfileName).toHaveBeenCalledWith('Mira Day'))
    await waitFor(() => expect(screen.getByText('Mira Day')).toBeInTheDocument())
    expect(localStorage.getItem('daymark.profile.v1.user-1')).toBeNull()
  })

  it('saves and removes a selected local profile photo', async () => {
    renderProfile({ profileName: 'Mira Day' })

    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }))
    const nameInput = await screen.findByRole('textbox', { name: /Display name/ })
    const image = new File(['small image'], 'portrait.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Upload profile photo'), { target: { files: [image] } })
    await screen.findByRole('button', { name: 'Remove profile photo' })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('button', { name: 'Edit profile' })

    const saved = JSON.parse(localStorage.getItem(profileKey) || '{}')
    expect(saved.avatarDataUrl).toMatch(/^data:image\/png;base64,/)
    expect(nameInput).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }))
    await screen.findByRole('button', { name: 'Remove profile photo' })
    fireEvent.click(screen.getByRole('button', { name: 'Remove profile photo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(JSON.parse(localStorage.getItem(profileKey) || '{}')).toEqual({
      displayName: 'Mira Day',
      avatarDataUrl: null,
    }))
  })

  it('keeps the edit screen open and reports account-save failures', async () => {
    renderProfile({
      isSignedIn: true,
      profileName: 'Google Name',
      profileScope: 'user-1',
      onUpdateProfileName: vi.fn().mockRejectedValue(new Error('Profile update failed.')),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }))
    fireEvent.change(await screen.findByRole('textbox', { name: /Display name/ }), { target: { value: 'Mira Day' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Profile update failed.')
    expect(screen.getByRole('heading', { name: 'Edit profile' })).toBeInTheDocument()
    expect(localStorage.getItem('daymark.profile.v1.user-1')).toBeNull()
  })
})
