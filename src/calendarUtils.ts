import { getLocalDateKey } from './taskUtils'

export interface CalendarDay {
  date: Date
  dateKey: string
  inCurrentMonth: boolean
}

export function getCalendarDays(month: Date): CalendarDay[] {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const firstCell = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - firstDay.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell.getFullYear(), firstCell.getMonth(), firstCell.getDate() + index)
    return {
      date,
      dateKey: getLocalDateKey(date),
      inCurrentMonth: date.getMonth() === month.getMonth(),
    }
  })
}

export function shiftCalendarMonth(month: Date, offset: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + offset, 1)
}

export function formatCalendarMonth(month: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month)
}
