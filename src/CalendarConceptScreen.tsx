import { useMemo, useState, type FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Bell,
  BookOpenText,
  Briefcase,
  CalendarBlank,
  CalendarDots,
  CaretLeft,
  CaretRight,
  Check,
  House,
  Plus,
  SquaresFour,
  Sun,
  UserCircle,
  User,
  X,
} from '@phosphor-icons/react'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/500.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import './calendar-concept.css'

type ConceptCategory = 'Work' | 'Personal' | 'Home' | 'Learning'

interface ConceptTask {
  id: string
  title: string
  category: ConceptCategory
  dueDate: string
  completed: boolean
}

const categoryDetails: Record<ConceptCategory, { color: string; label: string; icon: typeof Briefcase }> = {
  Work: { color: 'work', label: 'Work', icon: Briefcase },
  Personal: { color: 'personal', label: 'Personal', icon: User },
  Home: { color: 'home', label: 'Home', icon: House },
  Learning: { color: 'learning', label: 'Learning', icon: BookOpenText },
}

const navigationItems = [
  { label: 'Today', icon: Sun },
  { label: 'Calendar', icon: CalendarDots },
  { label: 'Categories', icon: SquaresFour },
  { label: 'Profile', icon: UserCircle },
]

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)
}

function createSampleTasks(today: Date): ConceptTask[] {
  return [
    { id: 'sample-1', title: 'Review project notes', category: 'Work', dueDate: dateKey(today), completed: false },
    { id: 'sample-2', title: 'Pick up something sweet', category: 'Personal', dueDate: dateKey(today), completed: true },
    { id: 'sample-3', title: 'Send the follow-up', category: 'Work', dueDate: dateKey(addDays(today, 2)), completed: false },
    { id: 'sample-4', title: 'Tidy one little corner', category: 'Home', dueDate: dateKey(addDays(today, 4)), completed: false },
    { id: 'sample-5', title: 'Read a few pages', category: 'Learning', dueDate: dateKey(addDays(today, 6)), completed: false },
  ]
}

function formatSelectedDate(date: Date) {
  return new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(date)
}

export default function CalendarConceptScreen() {
  const today = useMemo(() => new Date(), [])
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(() => dateKey(today))
  const [tasks, setTasks] = useState(() => createSampleTasks(today))
  const [composerOpen, setComposerOpen] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskCategory, setTaskCategory] = useState<ConceptCategory>('Personal')
  const [notice, setNotice] = useState('')

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const firstCell = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay())
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(firstCell.getFullYear(), firstCell.getMonth(), firstCell.getDate() + index)
      return { date, key: dateKey(date), inMonth: date.getMonth() === month.getMonth() }
    })
  }, [month])

  const selectedDateObject = useMemo(() => {
    const [year, monthNumber, day] = selectedDate.split('-').map(Number)
    return new Date(year, monthNumber - 1, day)
  }, [selectedDate])
  const dayTasks = tasks.filter((task) => task.dueDate === selectedDate)
  const monthTitle = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(month)
  const weekdayLabels = Array.from({ length: 7 }, (_, index) => (
    new Intl.DateTimeFormat('en', { weekday: 'short' }).format(new Date(2024, 0, 7 + index))
  ))

  function changeMonth(offset: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  function selectToday() {
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(dateKey(today))
  }

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = taskTitle.trim()
    if (!title) return
    setTasks((current) => [...current, {
      id: `sample-${Date.now()}`,
      title,
      category: taskCategory,
      dueDate: selectedDate,
      completed: false,
    }])
    setTaskTitle('')
    setComposerOpen(false)
  }

  return (
    <div className="calendar-concept-page">
      <header className="concept-header">
        <div className="concept-topline">
          <span className="concept-date"><CalendarBlank size={14} weight="duotone" aria-hidden="true" />{formatSelectedDate(today)}</span>
          <button
            className="concept-icon-button"
            type="button"
            aria-label="Notifications"
            onClick={() => setNotice('Your reminders are ready in Notifications.')}
          >
            <Bell size={19} weight="duotone" aria-hidden="true" />
            <span className="concept-unread-dot" aria-hidden="true" />
          </button>
        </div>
        <div className="concept-heading">
          <div>
            <h1>Calendar</h1>
            <p className="concept-subtitle">Your month at a glance.</p>
          </div>
          <img className="concept-mascot" src="/daymark-calendar-mascot.svg" alt="" aria-hidden="true" />
        </div>
      </header>

      <main className="concept-main">
        <section className="concept-month-panel" aria-label="Choose a day">
          <span className="concept-calendar-binding" aria-hidden="true" />
          <div className="concept-month-toolbar">
            <div>
              <h2>{monthTitle}</h2>
            </div>
            <div className="concept-month-actions">
              <button className="concept-today-button" type="button" onClick={selectToday}>Today</button>
              <button className="concept-arrow-button" type="button" aria-label="Previous month" onClick={() => changeMonth(-1)}>
                <CaretLeft size={16} weight="bold" aria-hidden="true" />
              </button>
              <button className="concept-arrow-button" type="button" aria-label="Next month" onClick={() => changeMonth(1)}>
                <CaretRight size={16} weight="bold" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="concept-calendar-grid" role="grid" aria-label={monthTitle}>
            <div className="concept-weekdays" role="row">
              {weekdayLabels.map((label) => <span role="columnheader" key={label}>{label}</span>)}
            </div>
            <div className="concept-days">
              {Array.from({ length: 6 }, (_, weekIndex) => (
                <div className="concept-week" role="row" key={weekIndex}>
                  {days.slice(weekIndex * 7, weekIndex * 7 + 7).map(({ date, key, inMonth }) => {
                    const dayCategories = [...new Set(tasks.filter((task) => task.dueDate === key).map((task) => task.category))]
                    const isSelected = key === selectedDate
                    const isToday = key === dateKey(today)
                    return (
                      <button
                        className={`concept-day${inMonth ? '' : ' is-outside'}${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
                        type="button"
                        role="gridcell"
                        aria-label={`${formatSelectedDate(date)}, ${tasks.filter((task) => task.dueDate === key).length} tasks`}
                        aria-pressed={isSelected}
                        key={key}
                        onClick={() => setSelectedDate(key)}
                      >
                        <span className="concept-day-number">{date.getDate()}</span>
                        <span className="concept-day-dots" aria-hidden="true">
                          {dayCategories.slice(0, 3).map((category) => (
                            <i className={`category-dot-${categoryDetails[category].color}`} key={category} />
                          ))}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="concept-legend" aria-label="Task categories">
            {(Object.keys(categoryDetails) as ConceptCategory[]).map((category) => (
              <span key={category}><i className={`category-dot-${categoryDetails[category].color}`} />{categoryDetails[category].label}</span>
            ))}
          </div>
        </section>

        <section className={`concept-agenda${dayTasks.length === 0 ? ' is-empty' : ''}`} aria-labelledby="concept-agenda-title">
          {dayTasks.length > 0 ? (
            <>
              <div className="concept-agenda-heading">
                <h2 id="concept-agenda-title">{formatSelectedDate(selectedDateObject)}</h2>
                <span className="concept-task-count">{dayTasks.length} {dayTasks.length === 1 ? 'task' : 'tasks'}</span>
              </div>
              <ul className="concept-task-list">
                {dayTasks.map((task) => {
                  const category = categoryDetails[task.category]
                  const CategoryIcon = category.icon
                  return (
                    <li className={`concept-task${task.completed ? ' is-complete' : ''}`} key={task.id}>
                      <span className={`concept-task-icon tint-${category.color}`}><CategoryIcon size={17} weight="duotone" aria-hidden="true" /></span>
                      <span className="concept-task-copy">
                        <strong>{task.title}</strong>
                        <small>{category.label}</small>
                      </span>
                      <button
                        className="concept-check-button"
                        type="button"
                        aria-label={`${task.completed ? 'Mark' : 'Complete'} ${task.title}`}
                        aria-pressed={task.completed}
                        onClick={() => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed: !item.completed } : item))}
                      >
                        {task.completed && <Check size={14} weight="bold" aria-hidden="true" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <div className="concept-empty-day">
              <div className="concept-empty-day-heading">
                <div>
                  <p>{selectedDate === dateKey(today) ? 'A little space for today' : 'A little space for your plans'}</p>
                  <h2 id="concept-agenda-title">{formatSelectedDate(selectedDateObject)}</h2>
                </div>
                <span className="concept-task-count">0 tasks</span>
              </div>
              <div className="concept-empty-state">
                <img src="/daymark-calendar-empty-concept.svg" alt="" aria-hidden="true" />
                <h3>A clear little corner</h3>
                <p>Nothing planned for this day. Add a task whenever you’re ready.</p>
                <button type="button" onClick={() => setComposerOpen(true)}>
                  <Plus size={15} weight="bold" aria-hidden="true" />
                  Plan this day
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      <button className="concept-add-button" type="button" aria-label="Add a task" onClick={() => setComposerOpen(true)}>
        <Plus size={23} weight="bold" aria-hidden="true" />
      </button>

      <nav className="concept-bottom-nav" aria-label="Primary">
        {navigationItems.map(({ label, icon: Icon }) => (
          <span className={`concept-nav-item${label === 'Calendar' ? ' is-current' : ''}`} aria-current={label === 'Calendar' ? 'page' : undefined} key={label}>
            <Icon size={20} weight={label === 'Calendar' ? 'fill' : 'regular'} aria-hidden="true" />
            <small>{label}</small>
          </span>
        ))}
      </nav>

      {notice && (
        <div className="concept-toast" role="status">
          {notice}
          <button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><X size={14} aria-hidden="true" /></button>
        </div>
      )}

      {composerOpen && (
        <div className="concept-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setComposerOpen(false) }}>
          <section className="concept-modal" role="dialog" aria-modal="true" aria-labelledby="concept-modal-title">
            <div className="concept-modal-heading">
              <div>
                <p>Add to {formatSelectedDate(selectedDateObject)}</p>
                <h2 id="concept-modal-title">A new little plan</h2>
              </div>
              <button type="button" aria-label="Close" onClick={() => setComposerOpen(false)}><X size={18} aria-hidden="true" /></button>
            </div>
            <form onSubmit={addTask}>
              <label htmlFor="concept-task-title">Task</label>
              <input id="concept-task-title" autoFocus value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="What would you like to do?" required />
              <label htmlFor="concept-task-category">Category</label>
              <select id="concept-task-category" value={taskCategory} onChange={(event) => setTaskCategory(event.target.value as ConceptCategory)}>
                {(Object.keys(categoryDetails) as ConceptCategory[]).map((category) => <option key={category}>{category}</option>)}
              </select>
              <div className="concept-modal-actions">
                <button className="concept-cancel-button" type="button" onClick={() => setComposerOpen(false)}>Cancel</button>
                <button className="concept-save-button" type="submit">Add task</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

createRoot(document.getElementById('calendar-concept-root')!).render(<CalendarConceptScreen />)
