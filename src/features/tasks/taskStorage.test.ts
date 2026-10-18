import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task } from './taskTypes'
import { readTasksWithStatus, writeTasks } from './taskStorage'

const storageKey = 'daymark.tasks.v1'

const validTask: Task = {
  id: 'task-1',
  title: 'Review proposal',
  completed: false,
  priority: 'High',
  dueDate: '2026-10-01',
  category: 'Work',
  createdAt: 1_790_856_000_000,
  notes: '',
  subtasks: [],
  favorite: false,
}

const legacyTask = {
  id: 'legacy-task',
  title: 'Existing seven-field task',
  completed: true,
  priority: 'Normal' as const,
  dueDate: '2026-10-01',
  category: 'Personal' as const,
  createdAt: 1_790_856_000_001,
}

describe('taskStorage', () => {
  beforeEach(() => localStorage.clear())

  it('returns an empty successful result when storage is missing', () => {
    expect(readTasksWithStatus()).toEqual({ tasks: [], failed: false })
  })

  it('reads an empty task array', () => {
    localStorage.setItem(storageKey, '[]')
    expect(readTasksWithStatus()).toEqual({ tasks: [], failed: false })
  })

  it('reads valid task records without changing their schema', () => {
    const tasks = [validTask]
    localStorage.setItem(storageKey, JSON.stringify(tasks))

    expect(readTasksWithStatus()).toEqual({ tasks, failed: false })
  })

  it('loads legacy seven-field records with empty details without rewriting storage', () => {
    const legacyJson = JSON.stringify([legacyTask])
    localStorage.setItem(storageKey, legacyJson)

    expect(readTasksWithStatus()).toEqual({
      tasks: [{ ...legacyTask, notes: '', subtasks: [], favorite: false }],
      failed: false,
    })
    expect(localStorage.getItem(storageKey)).toBe(legacyJson)
  })

  it('reports malformed JSON and preserves the unreadable value', () => {
    const malformed = '{not valid JSON'
    localStorage.setItem(storageKey, malformed)

    expect(readTasksWithStatus()).toEqual({ tasks: [], failed: true })
    expect(localStorage.getItem(storageKey)).toBe(malformed)
  })

  it.each([
    ['missing id', { ...validTask, id: undefined }],
    ['missing title', { ...validTask, title: undefined }],
    ['invalid completion type', { ...validTask, completed: 'false' }],
    ['invalid priority', { ...validTask, priority: 'Urgent' }],
    ['invalid due-date type', { ...validTask, dueDate: null }],
    ['invalid category', { ...validTask, category: 'Errands' }],
    ['invalid createdAt type', { ...validTask, createdAt: '1' }],
    ['invalid notes type', { ...validTask, notes: 2 }],
    ['invalid checklist item', { ...validTask, subtasks: [{ id: 'sub-1', title: 'Check', completed: 'false' }] }],
    ['invalid favorite type', { ...validTask, favorite: 'true' }],
  ])('rejects records with %s', (_description, invalidTask) => {
    localStorage.setItem(storageKey, JSON.stringify([invalidTask]))

    expect(readTasksWithStatus()).toEqual({ tasks: [], failed: true })
  })

  it('returns valid records and reports rejected records in mixed data', () => {
    localStorage.setItem(storageKey, JSON.stringify([validTask, { ...validTask, completed: 0 }]))

    expect(readTasksWithStatus()).toEqual({ tasks: [validTask], failed: true })
  })

  it('reports a read failure without attempting to replace stored data', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError')
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    expect(readTasksWithStatus()).toEqual({ tasks: [], failed: true })
    expect(getItem).toHaveBeenCalledWith(storageKey)
    expect(setItem).not.toHaveBeenCalled()
  })

  it('reports a write failure without throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })

    expect(writeTasks([validTask])).toBe(false)
  })

  it('writes and rereads valid tasks under the existing v1 key', () => {
    expect(writeTasks([validTask])).toBe(true)
    expect(localStorage.getItem(storageKey)).toBe(JSON.stringify([validTask]))
    expect(readTasksWithStatus()).toEqual({ tasks: [validTask], failed: false })
  })
})