import { Bell, CalendarBlank, CaretLeft, CaretRight, Plus } from '@phosphor-icons/react'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/500.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import { formatCalendarMonth, getCalendarDays } from './calendarUtils'
import { TaskItem } from '../tasks/TaskItem'
import type { Task } from '../tasks/taskTypes'
import { useLocale } from '../../shared/locale'
import './calendar-screen.css'

interface CalendarScreenProps {
  tasks: Task[]
  selectedDate: string
  month: Date
  todayDate: string
  onMonthChange: (offset: number) => void
  onSelectDate: (dateKey: string) => void
  onOpenTask: (task: Task, trigger: HTMLButtonElement) => void
  onToggleTask: (task: Task) => void
  onToggleFavorite: (task: Task) => void
  onUpdateTask: (task: Task) => void
  onDeleteTask: (task: Task) => void
  unreadCount: number
  onOpenReminders: () => void
  onAddTask: (trigger: HTMLButtonElement) => void
}

const categoryMarkerClass: Record<Task['category'], string> = {
  Work: 'calendar-dot-work',
  Personal: 'calendar-dot-personal',
  Home: 'calendar-dot-home',
  Learning: 'calendar-dot-learning',
}

function formatSelectedDate(dateKey: string, locale: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' })
    .format(new Date(year, month - 1, day))
}

export function CalendarScreen({
  tasks,
  selectedDate,
  month,
  todayDate,
  onMonthChange,
  onSelectDate,
  onOpenTask,
  onToggleTask,
  onToggleFavorite,
  onUpdateTask,
  onDeleteTask,
  unreadCount,
  onOpenReminders,
  onAddTask,
}: CalendarScreenProps) {
  const { language, translate: t } = useLocale()
  const intlLocale = language === 'fil' ? 'fil-PH' : 'en'
  const weekdayNames = Array.from({ length: 7 }, (_, day) => new Intl.DateTimeFormat(intlLocale, { weekday: 'short' })
    .format(new Date(2024, 0, 7 + day)))
  const days = getCalendarDays(month)
  const dayTasks = tasks
    .filter((task) => task.dueDate === selectedDate)
    .sort((left, right) => Number(left.completed) - Number(right.completed) || right.createdAt - left.createdAt)

  return (
    <section className="calendar-page calendar-concept" aria-label={t('Your calendar')}>
      <header className="calendar-concept-header">
        <div className="calendar-concept-topline">
          <span className="calendar-concept-date">
            <CalendarBlank size={14} weight="duotone" aria-hidden="true" />
            {formatSelectedDate(todayDate, intlLocale)}
          </span>
          <button
            className="calendar-concept-notification"
            type="button"
            aria-label={`${t('Notifications')}${unreadCount ? `, ${unreadCount} ${t('unread')}` : ''}`}
            onClick={onOpenReminders}
          >
            <Bell size={19} weight="duotone" aria-hidden="true" />
            {unreadCount > 0 && <span className="calendar-concept-unread-dot" aria-hidden="true" />}
          </button>
        </div>
        <div className="calendar-concept-heading">
          <div>
            <h1 id="calendar-heading">{t('Calendar')}</h1>
            <p>{t('Your month at a glance.')}</p>
          </div>
          <img className="calendar-concept-mascot" src="/daymark-calendar-mascot.svg" alt="" aria-hidden="true" />
        </div>
      </header>

      <div className="calendar-concept-main">
        <section className="calendar-concept-month-panel" aria-label={t('Choose a day')}>
          <span className="calendar-concept-binding" aria-hidden="true" />
          <div className="calendar-concept-month-toolbar">
            <h2>{formatCalendarMonth(month, intlLocale)}</h2>
            <div className="calendar-concept-month-actions">
              <button className="calendar-concept-today" type="button" onClick={() => onSelectDate(todayDate)}>{t('Today')}</button>
              <button className="calendar-concept-arrow" type="button" aria-label={t('Previous month')} onClick={() => onMonthChange(-1)}>
                <CaretLeft size={16} weight="bold" aria-hidden="true" />
              </button>
              <button className="calendar-concept-arrow" type="button" aria-label={t('Next month')} onClick={() => onMonthChange(1)}>
                <CaretRight size={16} weight="bold" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="calendar-concept-grid" role="grid" aria-label={formatCalendarMonth(month, intlLocale)}>
            <div className="calendar-concept-weekdays" role="row">
              {weekdayNames.map((weekday) => (
                <span role="columnheader" key={weekday}>{weekday}</span>
              ))}
            </div>
            <div className="calendar-concept-days">
              {Array.from({ length: 6 }, (_, weekIndex) => (
                <div className="calendar-concept-week" role="row" key={weekIndex}>
                  {days.slice(weekIndex * 7, weekIndex * 7 + 7).map(({ date, dateKey, inCurrentMonth }) => {
                    const dateTasks = tasks.filter((task) => task.dueDate === dateKey)
                    const activeCount = dateTasks.filter((task) => !task.completed).length
                    const dateLabel = new Intl.DateTimeFormat(intlLocale, { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
                    const markers = [...new Set(dateTasks.map((task) => task.category))]

                    return (
                      <button
                        className={`calendar-concept-day${inCurrentMonth ? '' : ' is-outside'}${selectedDate === dateKey ? ' is-selected' : ''}${todayDate === dateKey ? ' is-today' : ''}`}
                        type="button"
                        role="gridcell"
                        key={dateKey}
                        aria-label={`${dateLabel}, ${dateTasks.length} ${dateTasks.length === 1 ? t('task') : t('tasks')}${activeCount ? `, ${activeCount} ${t('Active')}` : ''}`}
                        aria-pressed={selectedDate === dateKey}
                        onClick={() => onSelectDate(dateKey)}
                      >
                        <span className="calendar-concept-day-number">{date.getDate()}</span>
                        {markers.length > 0 && (
                          <span className="calendar-concept-day-dots" aria-hidden="true">
                            {markers.slice(0, 3).map((category) => <i className={categoryMarkerClass[category]} key={category} />)}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
          <ul className="calendar-concept-legend" aria-label={t('Task categories')}>
            <li><i className="calendar-dot-work" aria-hidden="true" />{t('Work')}</li>
            <li><i className="calendar-dot-personal" aria-hidden="true" />{t('Personal')}</li>
            <li><i className="calendar-dot-home" aria-hidden="true" />{t('Home')}</li>
            <li><i className="calendar-dot-learning" aria-hidden="true" />{t('Learning')}</li>
          </ul>
        </section>

        <section className="calendar-concept-agenda calendar-day-panel" aria-labelledby="calendar-day-heading">
          {dayTasks.length > 0 ? (
            <>
              <div className="calendar-concept-agenda-heading">
                <div>
                  <p>{t(selectedDate === todayDate ? 'A little space for today' : 'Your plans')}</p>
                  <h2 id="calendar-day-heading">{formatSelectedDate(selectedDate, intlLocale)}</h2>
                </div>
                <span className="calendar-concept-task-count">{dayTasks.length} {dayTasks.length === 1 ? t('task') : t('tasks')}</span>
              </div>
              <ul className="task-list calendar-concept-task-list">
                {dayTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    calendarStyle
                    onToggle={onToggleTask}
                    onToggleFavorite={onToggleFavorite}
                    onUpdate={onUpdateTask}
                    onDelete={onDeleteTask}
                    onOpenDetails={onOpenTask}
                  />
                ))}
              </ul>
            </>
          ) : (
            <div className="calendar-concept-empty-day">
              <div className="calendar-concept-agenda-heading">
                <div>
                  <p>{t(selectedDate === todayDate ? 'A little space for today' : 'A little space for your plans')}</p>
                  <h2 id="calendar-day-heading">{formatSelectedDate(selectedDate, intlLocale)}</h2>
                </div>
                <span className="calendar-concept-task-count">0 {t('tasks')}</span>
              </div>
              <div className="calendar-concept-empty-state">
                <img src="/daymark-calendar-empty-concept.svg" alt="" aria-hidden="true" />
                <h3>{t('A clear little corner')}</h3>
                <p>{t('Nothing planned for this day. Add a task whenever you’re ready.')}</p>
                <button type="button" onClick={(event) => onAddTask(event.currentTarget)}>
                  <Plus size={15} weight="bold" aria-hidden="true" />
                  {t('Plan this day')}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  )
}
