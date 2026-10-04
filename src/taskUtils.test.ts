import { describe, expect, it } from 'vitest'
import type { Task } from './taskTypes'
import { getDaysUntilDue, getLocalDateKey, getTaskDueStatus, isTaskDueToday, sortTasks } from './taskUtils'

function makeTask(id: string, createdAt: number, options: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    completed: false,
    priority: 'Normal',
    dueDate: '',
    category: 'Work',
    createdAt,
    ...options,
  }
}

describe('sortTasks', () => {
  const tasks = [
    makeTask('old-undated', 1),
    makeTask('normal-dated', 2, { dueDate: '2026-10-06' }),
    makeTask('high-dated', 3, { dueDate: '2026-10-05', priority: 'High' }),
    makeTask('low-undated', 4, { priority: 'Low' }),
  ]

  it('sorts newest first by default order without mutating its input', () => {
    const original = [...tasks]

    expect(sortTasks(tasks, 'newest').map((task) => task.id)).toEqual(['low-undated', 'high-dated', 'normal-dated', 'old-undated'])
    expect(tasks).toEqual(original)
  })

  it('sorts oldest first', () => {
    expect(sortTasks(tasks, 'oldest').map((task) => task.id)).toEqual(['old-undated', 'normal-dated', 'high-dated', 'low-undated'])
  })

  it('sorts dated tasks chronologically and keeps undated tasks at the end', () => {
    expect(sortTasks(tasks, 'due-date').map((task) => task.id)).toEqual(['high-dated', 'normal-dated', 'low-undated', 'old-undated'])
  })

  it('sorts by existing priority values from High to Low, newest first within ties', () => {
    expect(sortTasks(tasks, 'priority').map((task) => task.id)).toEqual(['high-dated', 'normal-dated', 'old-undated', 'low-undated'])
  })
})

describe('local task dates', () => {
  const lateToday = new Date(2026, 9, 4, 23, 55)

  it('uses the local calendar date key', () => {
    expect(getLocalDateKey(lateToday)).toBe('2026-10-04')
    expect(isTaskDueToday({ dueDate: '2026-10-04' }, lateToday)).toBe(true)
    expect(isTaskDueToday({ dueDate: '2026-10-05' }, lateToday)).toBe(false)
    expect(isTaskDueToday({ dueDate: '' }, lateToday)).toBe(false)
  })

  it.each([
    ['', false, 'none'],
    ['2026-10-04', false, 'today'],
    ['2026-10-03', false, 'overdue'],
    ['2026-10-05', false, 'upcoming'],
    ['2026-10-03', true, 'completed'],
  ] as const)('classifies due date %s (completed: %s) as %s', (dueDate, completed, expected) => {
    expect(getTaskDueStatus(dueDate, completed, lateToday)).toBe(expected)
  })

  it('calculates relative days from local midnights and returns null for undated tasks', () => {
    expect(getDaysUntilDue('2026-10-03', lateToday)).toBe(-1)
    expect(getDaysUntilDue('2026-10-04', lateToday)).toBe(0)
    expect(getDaysUntilDue('2026-10-05', lateToday)).toBe(1)
    expect(getDaysUntilDue('', lateToday)).toBeNull()
  })
})