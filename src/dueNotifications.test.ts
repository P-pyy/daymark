import { beforeEach, describe, expect, it } from 'vitest'
import { createDueNotifications, dueNotificationsStorageKey, readDueNotifications, writeDueNotifications, type DueNotification } from './dueNotifications'
import type { Task } from './taskTypes'

const dueTodayTask: Task = {
  id: 'task-1',
  title: 'Water the seedlings',
  completed: false,
  priority: 'Normal',
  dueDate: '2026-10-05',
  category: 'Home',
  createdAt: 100,
}

describe('due date notifications', () => {
  beforeEach(() => localStorage.clear())

  it('creates one reminder for each active task due on app-open date', () => {
    const tasks = [
      dueTodayTask,
      { ...dueTodayTask, id: 'task-2', title: 'Finished', completed: true },
      { ...dueTodayTask, id: 'task-3', dueDate: '2026-10-06' },
    ]

    const created = createDueNotifications(tasks, [], '2026-10-05', 200)

    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      id: 'task-1@2026-10-05',
      taskId: 'task-1',
      taskTitle: 'Water the seedlings',
      read: false,
      browserNotified: false,
    })
  })

  it('does not duplicate an existing reminder for the same task and date', () => {
    const existing = createDueNotifications([dueTodayTask], [], '2026-10-05', 200)

    expect(createDueNotifications([dueTodayTask], existing, '2026-10-05', 300)).toEqual(existing)
    expect(createDueNotifications([{ ...dueTodayTask, dueDate: '2026-10-06' }], existing, '2026-10-06', 300)).toHaveLength(2)
  })

  it('persists reminders and leaves malformed data unchanged', () => {
    const notifications = createDueNotifications([dueTodayTask], [], '2026-10-05', 200)
    expect(writeDueNotifications(notifications)).toBe(true)
    expect(readDueNotifications()).toEqual({ notifications, failed: false })

    localStorage.setItem(dueNotificationsStorageKey, '{invalid')
    const malformedRead = readDueNotifications()
    expect(malformedRead).toEqual({ notifications: [], failed: true })
    expect(localStorage.getItem(dueNotificationsStorageKey)).toBe('{invalid')
  })

  it('accepts existing records without browser delivery metadata', () => {
    const legacyNotification = {
      id: 'task-1@2026-10-05',
      taskId: 'task-1',
      taskTitle: 'Water the seedlings',
      dueDate: '2026-10-05',
      createdAt: 200,
      read: false,
    }
    localStorage.setItem(dueNotificationsStorageKey, JSON.stringify([legacyNotification satisfies Omit<DueNotification, 'browserNotified'>]))

    expect(readDueNotifications()).toEqual({
      notifications: [{ ...legacyNotification, browserNotified: false }],
      failed: false,
    })
  })
})
