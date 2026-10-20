import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarBlank, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { formatCalendarMonth, getCalendarDays, shiftCalendarMonth } from '../calendar/calendarUtils'
import { getLocalDateKey } from './taskUtils'
import { useLocale } from '../../shared/locale'
import './date-picker.css'

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return value && year && month && day ? new Date(year, month - 1, day) : null
}

export function DatePicker({ value, onChange, className = '' }: DatePickerProps) {
  const { language, translate: t } = useLocale()
  const locale = language === 'fil' ? 'fil-PH' : 'en'
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number; maxHeight: number } | null>(null)
  const selectedDate = parseDateKey(value)
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initialDate = selectedDate ?? new Date()
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
  })
  const days = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth])
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, day) => new Intl.DateTimeFormat(locale, { weekday: 'short' })
    .format(new Date(2024, 0, 7 + day))), [locale])
  const today = getLocalDateKey(new Date())
  const selectedLabel = selectedDate
    ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(selectedDate)
    : t('Select a date')

  useEffect(() => {
    if (!isOpen) return

    const syncPosition = () => {
      const trigger = triggerRef.current
      const popover = popoverRef.current
      if (!trigger || !popover) return

      const rect = trigger.getBoundingClientRect()
      const viewport = window.visualViewport
      const viewportTop = viewport?.offsetTop ?? 0
      const viewportLeft = viewport?.offsetLeft ?? 0
      const viewportHeight = viewport?.height ?? window.innerHeight
      const viewportWidth = viewport?.width ?? window.innerWidth
      popover.style.maxHeight = `${Math.max(160, viewportHeight - 16)}px`
      const width = popover.getBoundingClientRect().width
      const height = popover.getBoundingClientRect().height
      const left = Math.max(viewportLeft + 12, Math.min(rect.left, viewportLeft + viewportWidth - width - 12))
      const below = rect.bottom + 8
      const maxTop = viewportTop + viewportHeight - height - 8
      const top = below + height <= viewportTop + viewportHeight - 8
        ? below
        : Math.max(viewportTop + 8, Math.min(rect.top - height - 8, maxTop))

      setPosition({ top, left, maxHeight: Math.max(160, viewportHeight - 16) })
    }

    syncPosition()
    window.addEventListener('resize', syncPosition)
    window.addEventListener('scroll', syncPosition, true)
    window.visualViewport?.addEventListener('resize', syncPosition)
    window.visualViewport?.addEventListener('scroll', syncPosition)

    return () => {
      window.removeEventListener('resize', syncPosition)
      window.removeEventListener('scroll', syncPosition, true)
      window.visualViewport?.removeEventListener('resize', syncPosition)
      window.visualViewport?.removeEventListener('scroll', syncPosition)
    }
  }, [isOpen, visibleMonth])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && !triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setIsOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  function selectDate(dateKey: string) {
    onChange(dateKey)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div className={`date-picker ${className}`.trim()}>
      <button
        ref={triggerRef}
        className="date-picker-trigger"
        type="button"
        aria-label={t('Due date')}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => {
          if (!isOpen) {
            const date = parseDateKey(value) ?? new Date()
            setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1))
          }
          setPosition(null)
          setIsOpen((open) => !open)
        }}
      >
        <span>{selectedLabel}</span>
        <CalendarBlank size={16} weight="duotone" aria-hidden="true" />
      </button>
      {isOpen && createPortal(
        <div
          ref={popoverRef}
          className="date-picker-popover"
          role="dialog"
          aria-label={formatCalendarMonth(visibleMonth, locale)}
          style={{ top: position?.top ?? -10000, left: position?.left ?? -10000, maxHeight: position?.maxHeight, visibility: position ? 'visible' : 'hidden' }}
        >
          <div className="date-picker-header">
            <h2>{formatCalendarMonth(visibleMonth, locale)}</h2>
            <div className="date-picker-month-actions">
              <button type="button" aria-label={t('Previous month')} onClick={() => setVisibleMonth((month) => shiftCalendarMonth(month, -1))}>
                <CaretLeft size={16} weight="bold" aria-hidden="true" />
              </button>
              <button type="button" aria-label={t('Next month')} onClick={() => setVisibleMonth((month) => shiftCalendarMonth(month, 1))}>
                <CaretRight size={16} weight="bold" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="date-picker-grid" role="group" aria-label={formatCalendarMonth(visibleMonth, locale)}>
            <div className="date-picker-weekdays" aria-hidden="true">
              {weekdays.map((weekday, index) => <span key={`${weekday}-${index}`}>{weekday}</span>)}
            </div>
            {Array.from({ length: 6 }, (_, weekIndex) => (
              <div className="date-picker-week" key={weekIndex}>
                {days.slice(weekIndex * 7, weekIndex * 7 + 7).map(({ date, dateKey, inCurrentMonth }) => {
                  const dateLabel = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
                  return (
                    <button
                      type="button"
                      className={`date-picker-day${inCurrentMonth ? '' : ' is-outside'}${dateKey === value ? ' is-selected' : ''}${dateKey === today ? ' is-today' : ''}`}
                      key={dateKey}
                      aria-label={dateLabel}
                      aria-pressed={dateKey === value}
                      onClick={() => selectDate(dateKey)}
                    >
                      {date.getDate()}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <div className="date-picker-footer">
            <button type="button" onClick={() => selectDate('')}>{t('Clear')}</button>
            <button type="button" onClick={() => selectDate(today)}>{t('Today')}</button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
