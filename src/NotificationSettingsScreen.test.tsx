import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from './locale'
import { NotificationSettingsScreen } from './NotificationSettingsScreen'

function renderSettings(overrides: Partial<React.ComponentProps<typeof NotificationSettingsScreen>> = {}) {
  const props = {
    permission: 'default' as const,
    browserAlertsEnabled: false,
    error: null,
    onSave: vi.fn().mockResolvedValue(true),
    onCancel: vi.fn(),
    ...overrides,
  }
  render(<LocaleProvider><NotificationSettingsScreen {...props} /></LocaleProvider>)
  return props
}

describe('NotificationSettingsScreen', () => {
  it('shows the supported Daymark reminder settings and notifications navigation', () => {
    renderSettings()

    expect(screen.getByRole('heading', { name: 'Notification settings' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'On this device' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Push notifications' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('Due-today task reminders')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('saves the browser alert preference and returns only after a successful save', async () => {
    const props = renderSettings()
    fireEvent.click(screen.getByRole('switch', { name: 'Push notifications' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(props.onSave).toHaveBeenCalledWith(true)
    await screen.findByRole('heading', { name: 'Notification settings' })
    expect(props.onCancel).toHaveBeenCalledOnce()
  })

  it('keeps the screen open when saving fails', async () => {
    const props = renderSettings({ onSave: vi.fn().mockResolvedValue(false) })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByRole('heading', { name: 'Notification settings' })
    expect(props.onCancel).not.toHaveBeenCalled()
  })

  it('does not allow browser alerts when the browser blocks them', () => {
    renderSettings({ permission: 'denied', browserAlertsEnabled: true })

    expect(screen.getByRole('switch', { name: 'Push notifications' })).toBeDisabled()
    expect(screen.getByText(/Notifications are blocked/)).toBeInTheDocument()
  })
})
