import { beforeEach, describe, expect, it } from 'vitest'
import type { Json } from './supabaseClient'
import type { Task } from './taskTypes'
import {
  addTaskTombstones,
  clearLocalAccountTasks,
  mergeTaskLists,
  readTaskTombstones,
  taskFromRecord,
} from './taskSync'

const task: Task = {
  id: 'task-1',
  title: 'Draft the weekly plan',
  completed: false,
  priority: 'Normal',
  dueDate: '',
  category: 'Work',
  createdAt: 100,
  updatedAt: 200,
}

beforeEach(() => {
  localStorage.clear()
})

describe('task synchronization helpers', () => {
  it('prefers the most recently edited task version', () => {
    const local = { ...task, title: 'Local edit', updatedAt: 300 }
    const remote = { ...task, title: 'Remote edit', updatedAt: 250 }

    expect(mergeTaskLists([local], [remote], [], [])).toEqual([local])
    expect(mergeTaskLists([{ ...local, updatedAt: 200 }], [remote], [], [])).toEqual([remote])
  })

  it('keeps a newer deletion unless a later task edit restores it', () => {
    const localDelete = [{ id: task.id, updatedAt: 300 }]
    const remoteDelete = [{ id: task.id, updatedAt: 250 }]

    expect(mergeTaskLists([], [task], localDelete, [])).toEqual([])
    expect(mergeTaskLists([{ ...task, updatedAt: 400 }], [], [], remoteDelete)).toEqual([{ ...task, updatedAt: 400 }])
    expect(mergeTaskLists([{ ...task, updatedAt: 200 }], [], [], remoteDelete)).toEqual([])
  })

  it('persists tombstones and rejects malformed sync data without overwriting it', () => {
    expect(addTaskTombstones([task.id], 500)).toEqual([{ id: task.id, updatedAt: 500 }])
    expect(readTaskTombstones()).toEqual([{ id: task.id, updatedAt: 500 }])

    localStorage.setItem('daymark.task-deletions.v1', '{"invalid":true}')
    expect(() => readTaskTombstones()).toThrow(/Saved task sync data is invalid/)
    expect(localStorage.getItem('daymark.task-deletions.v1')).toBe('{"invalid":true}')
  })

  it('normalizes cloud task records and preserves their server edit timestamp', () => {
    const payload = JSON.parse(JSON.stringify(task)) as Json
    expect(taskFromRecord({
      id: task.id,
      payload,
      updated_at: 600,
      is_deleted: false,
    })).toEqual({ ...task, updatedAt: 600, notes: '', subtasks: [] })
  })

  it('clears account task cache and tombstones without clearing preferences', () => {
    localStorage.setItem('daymark.tasks.v1', JSON.stringify([task]))
    localStorage.setItem('daymark.task-deletions.v1', JSON.stringify([{ id: task.id, updatedAt: 500 }]))
    localStorage.setItem('daymark.theme.preference.v1', 'dark')

    expect(clearLocalAccountTasks()).toBe(true)
    expect(localStorage.getItem('daymark.tasks.v1')).toBeNull()
    expect(localStorage.getItem('daymark.task-deletions.v1')).toBeNull()
    expect(localStorage.getItem('daymark.theme.preference.v1')).toBe('dark')
  })
})
