import { Bell, CaretLeft, CaretRight, Plus, Sun } from '@phosphor-icons/react'
import { formatCalendarMonth, getCalendarDays } from './calendarUtils'
import { TaskItem } from './TaskItem'
import type { Task } from './taskTypes'
import { useLocale } from './locale'

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
    <section className="calendar-page" aria-labelledby="calendar-heading">
      <header className="feature-page-header calendar-page-header">
        <div className="feature-page-copy">
          <span className="page-eyebrow"><Sun size={16} weight="fill" aria-hidden="true" /> {t('Make room for today')}</span>
          <h1 id="calendar-heading">{t('Your calendar')}</h1>
          <p>{t('See what’s coming, one day at a time.')}</p>
        </div>
        <div className="calendar-header-actions">
          <button
            className="screen-icon-button notification-shortcut"
            type="button"
            aria-label={`${t('Notifications')}${unreadCount ? `, ${unreadCount} ${t('unread')}` : ''}`}
            onClick={onOpenReminders}
          >
            <Bell size={20} aria-hidden="true" />
            {unreadCount > 0 && <span className="notification-badge" aria-hidden="true">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          <button className="calendar-add-button" type="button" onClick={(event) => onAddTask(event.currentTarget)}>
            <Plus size={18} weight="bold" aria-hidden="true" /><span>{t('Add a task')}</span>
          </button>
        </div>
      </header>

      <div className="calendar-layout">
        <section className="calendar-month-panel" aria-label={t('Choose a day')}>
          <div className="calendar-month-toolbar">
            <h2>{formatCalendarMonth(month, intlLocale)}</h2>
            <div className="calendar-month-actions">
              <button className="calendar-today-button" type="button" onClick={() => onSelectDate(todayDate)}>{t('Today')}</button>
              <button className="calendar-arrow-button" type="button" aria-label={t('Previous month')} onClick={() => onMonthChange(-1)}>
                <CaretLeft size={17} weight="bold" aria-hidden="true" />
              </button>
              <button className="calendar-arrow-button" type="button" aria-label={t('Next month')} onClick={() => onMonthChange(1)}>
                <CaretRight size={17} weight="bold" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="calendar-grid" role="grid" aria-label={formatCalendarMonth(month, intlLocale)}>
            <div className="calendar-weekdays" role="row">
              {weekdayNames.map((weekday) => (
                <span className="calendar-weekday" role="columnheader" key={weekday}>{weekday}</span>
              ))}
            </div>
            {Array.from({ length: 6 }, (_, weekIndex) => (
              <div className="calendar-week" role="row" key={weekIndex}>
                {days.slice(weekIndex * 7, weekIndex * 7 + 7).map(({ date, dateKey, inCurrentMonth }) => {
                  const dateTasks = tasks.filter((task) => task.dueDate === dateKey)
                  const activeCount = dateTasks.filter((task) => !task.completed).length
                  const dateLabel = new Intl.DateTimeFormat(intlLocale, { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
                  const markers = [...new Set(dateTasks.map((task) => task.category))]

                  return (
                    <button
                      className={`calendar-day ${inCurrentMonth ? '' : 'is-outside-month'} ${selectedDate === dateKey ? 'is-selected' : ''} ${todayDate === dateKey ? 'is-today' : ''}`}
                      type="button"
                      role="gridcell"
                      key={dateKey}
                      aria-label={`${dateLabel}, ${dateTasks.length} ${dateTasks.length === 1 ? t('task') : t('tasks')}${activeCount ? `, ${activeCount} ${t('Active')}` : ''}`}
                      aria-pressed={selectedDate === dateKey}
                      onClick={() => onSelectDate(dateKey)}
                    >
                      <span className="calendar-day-number">{date.getDate()}</span>
                      {dateTasks.length > 0 && (
                        <span className="calendar-day-markers" aria-hidden="true">
                          {markers.slice(0, 3).map((category) => <i className={categoryMarkerClass[category]} key={category} />)}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <ul className="calendar-legend" aria-label={t('Task categories')}>
            <li><i className="calendar-dot-work" aria-hidden="true" />{t('Work')}</li>
            <li><i className="calendar-dot-personal" aria-hidden="true" />{t('Personal')}</li>
            <li><i className="calendar-dot-home" aria-hidden="true" />{t('Home')}</li>
            <li><i className="calendar-dot-learning" aria-hidden="true" />{t('Learning')}</li>
          </ul>
        </section>

        <section className="calendar-day-panel" aria-labelledby="calendar-day-heading">
          <div className="calendar-day-heading-row">
            <div>
              <span className="page-eyebrow">{selectedDate === todayDate ? t('A little space for today') : t('Your plans')}</span>
              <h2 id="calendar-day-heading">{formatSelectedDate(selectedDate, intlLocale)}</h2>
            </div>
            <span className="calendar-task-count">{dayTasks.length} {dayTasks.length === 1 ? t('task') : t('tasks')}</span>
          </div>
          {dayTasks.length > 0 ? (
            <ul className="task-list calendar-task-list">
              {dayTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={onToggleTask}
                  onToggleFavorite={onToggleFavorite}
                  onUpdate={onUpdateTask}
                  onDelete={onDeleteTask}
                  onOpenDetails={onOpenTask}
                />
              ))}
            </ul>
          ) : (
            <div className="calendar-empty-state">
              <img src="/daymark-empty-calendar.svg" alt="" aria-hidden="true" />
              <h3>{t('A clear little corner')}</h3>
              <p>{t('Nothing planned for this day. Add a task whenever you’re ready.')}</p>
              <button className="calendar-empty-add" type="button" onClick={(event) => onAddTask(event.currentTarget)}>
                <Plus size={17} weight="bold" aria-hidden="true" /> {t('Plan this day')}
              </button>
            </div>
          )}
        </section>
      </div>
    </section>
  )
}
