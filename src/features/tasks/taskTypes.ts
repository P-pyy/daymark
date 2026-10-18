export const categories = ['Work', 'Personal', 'Home', 'Learning'] as const

export type Category = (typeof categories)[number]
export type Priority = 'Low' | 'Normal' | 'High'

export const MAX_TASK_NOTES_LENGTH = 2000
export const MAX_SUBTASK_TITLE_LENGTH = 160

export interface Subtask {
  id: string
  title: string
  completed: boolean
}

export interface Task {
  id: string
  title: string
  completed: boolean
  priority: Priority
  dueDate: string
  category: Category
  createdAt: number
  updatedAt?: number
  notes?: string
  subtasks?: Subtask[]
  favorite?: boolean
}