import type { Task } from './taskTypes'

export const dueNotificationsStorageKey = 'daymark.due-notifications.v1'

export interface DueNotification {
  id: string
  taskId: string
  taskTitle: string
  dueDate: string
  createdAt: number
  read: boolean
  browserNotified: boolean
}

export interface DueNotificationReadResult {
  notifications: DueNotification[]
  failed: boolean
}

export function readDueNotifications(): DueNotificationReadResult {
  try {
    const stored = localStorage.getItem(dueNotificationsStorageKey)
    if (!stored) return { notifications: [], failed: false }

    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.every(isDueNotification)) {
      return { notifications: [], failed: true }
    }
    return { notifications: parsed.map(normalizeDueNotification), failed: false }
  } catch {
    return { notifications: [], failed: true }
  }
}

export function writeDueNotifications(notifications: DueNotification[]): boolean {
  try {
    localStorage.setItem(dueNotificationsStorageKey, JSON.stringify(notifications))
    return true
  } catch {
    return false
  }
}

export function createDueNotifications(
  tasks: Task[],
  existing: DueNotification[],
  dateKey: string,
  createdAt: number,
): DueNotification[] {
  const existingIds = new Set(existing.map((notification) => notification.id))
  const newNotifications = tasks
    .filter((task) => !task.completed && task.dueDate === dateKey)
    .filter((task) => !existingIds.has(`${task.id}@${dateKey}`))
    .map((task): DueNotification => ({
      id: `${task.id}@${dateKey}`,
      taskId: task.id,
      taskTitle: task.title,
      dueDate: dateKey,
      createdAt,
      read: false,
      browserNotified: false,
    }))

  return [...newNotifications, ...existing]
}

export function isDueNotification(value: unknown): value is DueNotification {
  if (!value || typeof value !== 'object') return false
  const notification = value as Partial<DueNotification>
  return typeof notification.id === 'string'
    && typeof notification.taskId === 'string'
    && typeof notification.taskTitle === 'string'
    && typeof notification.dueDate === 'string'
    && typeof notification.createdAt === 'number'
    && Number.isFinite(notification.createdAt)
    && typeof notification.read === 'boolean'
    && (notification.browserNotified === undefined || typeof notification.browserNotified === 'boolean')
}

export function normalizeDueNotification(notification: DueNotification): DueNotification {
  return { ...notification, browserNotified: notification.browserNotified ?? false }
}
