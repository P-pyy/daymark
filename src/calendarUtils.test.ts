import { describe, expect, it } from 'vitest'
import { formatCalendarMonth, getCalendarDays, shiftCalendarMonth } from './calendarUtils'

describe('calendar date helpers', () => {
  it('returns a Sunday-first six-week grid using local date keys', () => {
    const days = getCalendarDays(new Date(2026, 9, 5))

    expect(days).toHaveLength(42)
    expect(days[0].dateKey).toBe('2026-09-27')
    expect(days[0].date.getDay()).toBe(0)
    expect(days[8].dateKey).toBe('2026-10-05')
    expect(days[8].inCurrentMonth).toBe(true)
    expect(days[0].inCurrentMonth).toBe(false)
  })

  it('moves across year boundaries without changing the day-grid contract', () => {
    expect(shiftCalendarMonth(new Date(2026, 11, 16), 1)).toEqual(new Date(2027, 0, 1))
    expect(shiftCalendarMonth(new Date(2026, 0, 20), -1)).toEqual(new Date(2025, 11, 1))
    expect(formatCalendarMonth(new Date(2026, 9, 1), 'en-US')).toBe('October 2026')
  })
})
