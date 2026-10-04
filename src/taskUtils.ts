import type { Task } from './taskTypes'

export type TaskSortOrder = 'newest' | 'oldest' | 'due-date' | 'priority'
export type TaskDueStatus = 'none' | 'today' | 'overdue' | 'upcoming' | 'completed'

const priorityOrder = { High: 0, Normal: 1, Low: 2 } as const

export function getLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isTaskDueToday(task: Pick<Task, 'dueDate'>, now = new Date()) {
  return Boolean(task.dueDate) && task.dueDate === getLocalDateKey(now)
}

export function getDaysUntilDue(dueDate: string, now = new Date()): number | null {
  if (!dueDate) return null
  const [year, month, day] = dueDate.split('-').map(Number)
  if (!year || !month || !day) return null

  const dueDay = new Date(year, month - 1, day)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (Number.isNaN(dueDay.getTime())) return null
  return Math.round((dueDay.getTime() - today.getTime()) / 86_400_000)
}

export function getTaskDueStatus(dueDate: string, completed: boolean, now = new Date()): TaskDueStatus {
  if (!dueDate) return 'none'
  if (completed) return 'completed'

  const daysUntilDue = getDaysUntilDue(dueDate, now)
  if (daysUntilDue === null) return 'upcoming'
  if (daysUntilDue < 0) return 'overdue'
  return daysUntilDue === 0 ? 'today' : 'upcoming'
}

export function sortTasks(tasks: readonly Task[], sortOrder: TaskSortOrder): Task[] {
  const newestFirst = (left: Task, right: Task) => right.createdAt - left.createdAt

  switch (sortOrder) {
    case 'oldest':
      return [...tasks].sort((left, right) => left.createdAt - right.createdAt)
    case 'due-date':
      return [...tasks].sort((left, right) => {
        if (!left.dueDate) return right.dueDate ? 1 : newestFirst(left, right)
        if (!right.dueDate) return -1
        return left.dueDate < right.dueDate ? -1 : left.dueDate > right.dueDate ? 1 : newestFirst(left, right)
      })
    case 'priority':
      return [...tasks].sort((left, right) => priorityOrder[left.priority] - priorityOrder[right.priority] || newestFirst(left, right))
    case 'newest':
      return [...tasks].sort(newestFirst)
  }
}