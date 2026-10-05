import type { Task } from './taskTypes'

const storageKey = 'daymark.tasks.v1'

export interface TaskStorageReadResult {
  tasks: Task[]
  failed: boolean
}

export function readTasksWithStatus(): TaskStorageReadResult {
  try {
    const storedTasks = localStorage.getItem(storageKey)
    if (!storedTasks) return { tasks: [], failed: false }

    const parsedTasks: unknown = JSON.parse(storedTasks)
    if (!Array.isArray(parsedTasks)) return { tasks: [], failed: true }

    const validTasks = parsedTasks.filter(isTask)
    const tasks = validTasks.map(normalizeTask)
    return { tasks, failed: tasks.length !== parsedTasks.length }
  } catch {
    return { tasks: [], failed: true }
  }
}

export function writeTasks(tasks: Task[]): boolean {
  try {
    localStorage.setItem(storageKey, JSON.stringify(tasks))
    return true
  } catch {
    return false
  }
}

export function isTask(value: unknown): value is Task {
  if (!value || typeof value !== 'object') return false
  const task = value as Partial<Task>
  return (
    typeof task.id === 'string' &&
    typeof task.title === 'string' &&
    typeof task.completed === 'boolean' &&
    (task.priority === 'Low' || task.priority === 'Normal' || task.priority === 'High') &&
    typeof task.dueDate === 'string' &&
    (task.category === 'Work' || task.category === 'Personal' || task.category === 'Home' || task.category === 'Learning') &&
    typeof task.createdAt === 'number' &&
    Number.isFinite(task.createdAt) &&
    (task.updatedAt === undefined || (typeof task.updatedAt === 'number' && Number.isFinite(task.updatedAt))) &&
    (task.notes === undefined || typeof task.notes === 'string') &&
    (task.subtasks === undefined || (Array.isArray(task.subtasks) && task.subtasks.every(isSubtask))) &&
    (task.favorite === undefined || typeof task.favorite === 'boolean')
  )
}

function isSubtask(value: unknown): value is NonNullable<Task['subtasks']>[number] {
  if (!value || typeof value !== 'object') return false
  const subtask = value as { id?: unknown; title?: unknown; completed?: unknown }
  return typeof subtask.id === 'string' && typeof subtask.title === 'string' && typeof subtask.completed === 'boolean'
}

export function normalizeTask(task: Task): Task {
  return {
    ...task,
    notes: task.notes ?? '',
    subtasks: (task.subtasks ?? []).map((subtask) => ({ ...subtask })),
    favorite: task.favorite ?? false,
  }
}