import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowCounterClockwise,
  BookOpen,
  Briefcase,
  CheckCircle,
  HouseLine,
  ListChecks,
  MagnifyingGlass,
  Moon,
  Plus,
  Sun,
  User,
  X,
} from '@phosphor-icons/react'
import { TaskComposerDialog } from './TaskComposerDialog'
import { TaskDetailsDialog } from './TaskDetailsDialog'
import { TaskItem } from './TaskItem'
import { readTasksWithStatus, writeTasks } from './taskStorage'
import { categories, type Category, type Priority, type Task } from './taskTypes'
import { getLocalDateKey, isTaskDueToday, sortTasks, type TaskSortOrder } from './taskUtils'
import heroIllustration from '../design-reference/stitch/cute_friendly_minimalist_vector_sticker_illustration_on_a_soft_warm_cream/screen.png'
import './TodoReference.css'

type TaskFilter = 'All' | 'Active' | 'Completed'
type CategoryFilter = Category | 'All' | 'Today'
type ThemePreference = 'system' | 'light' | 'dark'
type ResolvedTheme = 'light' | 'dark'
type AppScreen = 'welcome' | 'categories' | 'tasks'
type TaskStorageIssue = 'load' | 'save'

const splashStorageKey = 'daymark.splash.seen.v1'
const themeStorageKey = 'daymark.theme.preference.v1'
const categoryStorageKey = 'daymark.category.filter.v1'
const onboardingStorageKey = 'daymark.onboarding.complete.v1'

function shouldShowSplash() {
  try {
    return sessionStorage.getItem(splashStorageKey) !== 'seen'
  } catch {
    return true
  }
}

function readThemePreference(): ThemePreference {
  try {
    const preference = localStorage.getItem(themeStorageKey)
    return preference === 'light' || preference === 'dark' ? preference : 'system'
  } catch {
    return 'system'
  }
}

function readCategoryFilter(): CategoryFilter {
  try {
    const category = localStorage.getItem(categoryStorageKey)
    return category === 'All' || category === 'Today' || categories.includes(category as Category)
      ? category as CategoryFilter
      : 'Personal'
  } catch {
    return 'Personal'
  }
}

function readInitialScreen(hasTasks: boolean): AppScreen {
  try {
    return localStorage.getItem(onboardingStorageKey) === 'complete' || hasTasks
      ? 'tasks'
      : 'welcome'
  } catch {
    return 'welcome'
  }
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function rememberSplash() {
  try {
    sessionStorage.setItem(splashStorageKey, 'seen')
  } catch {
    return
  }
}

function storeThemePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') localStorage.removeItem(themeStorageKey)
    else localStorage.setItem(themeStorageKey, preference)
  } catch {
    return
  }
}

const categoryIcons = {
  Work: Briefcase,
  Personal: User,
  Home: HouseLine,
  Learning: BookOpen,
}

interface ThemeToggleProps {
  theme: ResolvedTheme
  onToggle: () => void
  className?: string
}

function ThemeToggle({ theme, onToggle, className = 'screen-icon-button theme-toggle' }: ThemeToggleProps) {
  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      className={className}
      type="button"
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      aria-pressed={theme === 'dark'}
      onClick={onToggle}
    >
      {theme === 'dark' ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
    </button>
  )
}

function App() {
  const [storedTaskState] = useState(readTasksWithStatus)
  const [showSplash, setShowSplash] = useState(shouldShowSplash)
  const [splashLeaving, setSplashLeaving] = useState(false)
  const [screen, setScreen] = useState<AppScreen>(() => readInitialScreen(storedTaskState.tasks.length > 0))
  const [activeNavigation, setActiveNavigation] = useState<'today' | 'categories' | 'search'>(screen === 'tasks' ? 'categories' : 'today')
  const [themePreference, setThemePreference] = useState<ThemePreference>(readThemePreference)
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme)
  const [tasks, setTasks] = useState<Task[]>(storedTaskState.tasks)
  const [taskStorageIssue, setTaskStorageIssue] = useState<TaskStorageIssue | null>(storedTaskState.failed ? 'load' : null)
  const [filter, setFilter] = useState<TaskFilter>('All')
  const [sortOrder, setSortOrder] = useState<TaskSortOrder>('newest')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(readCategoryFilter)
  const [query, setQuery] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [detailsTaskId, setDetailsTaskId] = useState<string | null>(null)
  const composerTriggerRef = useRef<HTMLElement | null>(null)
  const detailsTriggerRef = useRef<HTMLButtonElement | null>(null)
  const taskSearchRef = useRef<HTMLInputElement>(null)
  const composerWasOpen = useRef(false)
  const detailsWasOpen = useRef(false)
  const [guidedTour, setGuidedTour] = useState(false)
  const [completedExpanded, setCompletedExpanded] = useState(true)
  const [undoTask, setUndoTask] = useState<{ task: Task; index: number } | null>(null)
  const [clearConfirmation, setClearConfirmation] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const theme = themePreference === 'system' ? systemTheme : themePreference
  const modalOpen = composerOpen || detailsTaskId !== null

  function toggleTheme() {
    setThemePreference(theme === 'dark' ? 'light' : 'dark')
  }

  function saveTasks(nextTasks: Task[]) {
    setTasks(nextTasks)
    if (taskStorageIssue === 'load') return
    setTaskStorageIssue(writeTasks(nextTasks) ? null : 'save')
  }

  function retryTaskStorage() {
    if (taskStorageIssue === 'load') {
      window.location.reload()
      return
    }
    setTaskStorageIssue(writeTasks(tasks) ? null : 'save')
  }

  useEffect(() => {
    if (activeNavigation === 'search') taskSearchRef.current?.focus()
  }, [activeNavigation])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || modalOpen) return

      const target = event.target
      if (target instanceof HTMLElement && (
        target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || target.isContentEditable
        || target.closest('[contenteditable="true"]')
      )) return

      if (event.key.toLowerCase() === 'n') {
        event.preventDefault()
        const activeElement = document.activeElement
        composerTriggerRef.current = activeElement instanceof HTMLElement && activeElement !== document.body && activeElement.tabIndex >= 0
          ? activeElement
          : null
        setComposerOpen(true)
      } else if (event.key === '/' && screen === 'tasks' && taskSearchRef.current) {
        event.preventDefault()
        taskSearchRef.current.focus()
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [modalOpen, screen])

  useEffect(() => {
    if (!composerOpen) {
      if (composerWasOpen.current) {
        composerWasOpen.current = false
        composerTriggerRef.current?.focus()
      }
      return
    }

    composerWasOpen.current = true
  }, [composerOpen])

  useEffect(() => {
    if (detailsTaskId !== null) {
      detailsWasOpen.current = true
      return
    }

    if (detailsWasOpen.current) {
      detailsWasOpen.current = false
      detailsTriggerRef.current?.focus()
      detailsTriggerRef.current = null
    }
  }, [detailsTaskId])

  useEffect(() => {
    try {
      localStorage.setItem(categoryStorageKey, categoryFilter)
    } catch {
      return
    }
  }, [categoryFilter])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handleSystemThemeChange)
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
  }, [])

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    storeThemePreference(themePreference)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#262720' : '#fcfaf6')
  }, [theme, themePreference])

  useEffect(() => {
    if (!showSplash) return

    rememberSplash()

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const leaveTimer = window.setTimeout(() => setSplashLeaving(true), reducedMotion ? 500 : 1120)
    const hideTimer = window.setTimeout(() => setShowSplash(false), reducedMotion ? 520 : 1410)

    return () => {
      window.clearTimeout(leaveTimer)
      window.clearTimeout(hideTimer)
    }
  }, [showSplash])

  const now = new Date()
  const todayDateKey = getLocalDateKey(now)
  const todayTasks = tasks.filter((task) => isTaskDueToday(task, now))
  const todayActiveCount = todayTasks.filter((task) => !task.completed).length
  const todayCompletedCount = todayTasks.filter((task) => task.completed).length
  const matchesCategory = (task: Task) => categoryFilter === 'All'
    || (categoryFilter === 'Today' ? isTaskDueToday(task, now) : task.category === categoryFilter)
  const scopedCompletedCount = tasks.filter(
    (task) => task.completed && matchesCategory(task),
  ).length
  const categoryTasks = tasks.filter(matchesCategory)
  const activeInCategoryCount = categoryTasks.filter((task) => !task.completed).length
  const filteredTasks = tasks.filter((task) => {
    const matchesStatus = filter === 'All' || (filter === 'Active' ? !task.completed : task.completed)
    const searchableText = [task.title, task.category, task.notes ?? '', ...(task.subtasks ?? []).map((subtask) => subtask.title)].join(' ')
    const matchesSearch = searchableText
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase())
    return matchesStatus && matchesCategory(task) && matchesSearch
  })
  const visibleTasks = sortTasks(filteredTasks, sortOrder)
  const heading = categoryFilter === 'All' ? 'All tasks' : categoryFilter
  const detailsTask = detailsTaskId === null ? null : tasks.find((task) => task.id === detailsTaskId) ?? null
  const activeVisibleTasks = visibleTasks.filter((task) => !task.completed)
  const completedVisibleTasks = visibleTasks.filter((task) => task.completed)
  const completionPercentage = todayTasks.length === 0 ? 0 : Math.round((todayCompletedCount / todayTasks.length) * 100)
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  }).format(now)

  function addTask(title: string, priority: Priority, dueDate: string, category: Category) {
    const task: Task = {
      id: crypto.randomUUID(), title, priority, dueDate, category,
      completed: false, createdAt: Date.now(), notes: '', subtasks: [],
    }
    saveTasks([task, ...tasks])
    setFilter('All')
    const keepTodayScope = dueDate === todayDateKey && (categoryFilter === 'Today' || screen === 'categories')
    setCategoryFilter(keepTodayScope ? 'Today' : 'All')
    setQuery('')
    setAnnouncement(`Added ${title}`)
    setUndoTask(null)
    setComposerOpen(false)
  }

  function openTodayDashboard() {
    setCategoryFilter('Today')
    setFilter('All')
    setQuery('')
    setScreen('categories')
    setActiveNavigation('today')
    try {
      localStorage.setItem(onboardingStorageKey, 'complete')
    } catch {
      return
    }
  }

  function selectCategory(category: CategoryFilter) {
    setCategoryFilter(category)
    setFilter('All')
    setQuery('')
    setScreen('tasks')
    setActiveNavigation('categories')
    try {
      localStorage.setItem(onboardingStorageKey, 'complete')
    } catch {
      return
    }
  }

  function updateTask(updatedTask: Task) {
    saveTasks(tasks.map((task) => task.id === updatedTask.id ? updatedTask : task))
    setAnnouncement(`Updated ${updatedTask.title}`)
  }

  function openTaskDetails(task: Task, trigger: HTMLButtonElement) {
    detailsTriggerRef.current = trigger
    setDetailsTaskId(task.id)
  }

  function saveTaskDetails(updatedTask: Task) {
    updateTask(updatedTask)
    setDetailsTaskId(null)
  }

  function toggleTask(task: Task) {
    const completed = !task.completed
    saveTasks(tasks.map((item) => item.id === task.id ? { ...item, completed } : item))
    setAnnouncement(`${completed ? 'Completed' : 'Restored'} ${task.title}`)
  }

  function deleteTask(task: Task) {
    const index = tasks.findIndex((item) => item.id === task.id)
    saveTasks(tasks.filter((item) => item.id !== task.id))
    setUndoTask({ task, index })
    setAnnouncement(`Deleted ${task.title}. Undo is available.`)
    setClearConfirmation(false)
  }

  function undoDelete() {
    if (!undoTask) return
    const restoredTasks = [...tasks]
    restoredTasks.splice(undoTask.index, 0, undoTask.task)
    saveTasks(restoredTasks)
    setAnnouncement(`Restored ${undoTask.task.title}`)
    setUndoTask(null)
  }

  function clearCompleted() {
    saveTasks(tasks.filter((task) => !task.completed || !matchesCategory(task)))
    setAnnouncement(`Removed ${scopedCompletedCount} completed tasks`)
    setClearConfirmation(false)
    setUndoTask(null)
  }

  const emptyState = query.trim()
    ? {
        title: 'No tasks match your search',
        message: `Nothing matches “${query.trim()}”. Try a shorter search or clear it.`,
      }
    : categoryFilter === 'Today' && categoryTasks.length === 0
      ? {
          title: 'No tasks due today',
          message: 'Tasks due on your local calendar date will appear here.',
        }
      : categoryFilter !== 'All' && categoryTasks.length === 0
      ? {
          title: `No tasks in ${categoryFilter}`,
          message: `Add a ${categoryFilter.toLowerCase()} task, or choose another category.`,
        }
      : filter === 'Completed'
        ? {
            title: 'No completed tasks',
            message: 'Check off a task and it will be collected here.',
          }
        : filter === 'Active' && activeInCategoryCount === 0
          ? {
              title: 'No active tasks',
              message: categoryTasks.length === 0
                ? 'Add a task to give your day a starting point.'
                : 'Your completed tasks are still here if you need to restore one.',
            }
          : tasks.length === 0 && categoryFilter === 'All'
            ? {
                title: 'No tasks yet',
                message: 'Add one small thing to get started.',
              }
            : {
                title: 'Nothing here just yet',
                message: 'Choose another category or add a new task.',
              }
  const canResetEmptyState = Boolean(query || categoryFilter !== 'All' || filter !== 'All')

  return (
    <div className="app-shell reference-shell">
      <a className="skip-link" href="#main-content" aria-hidden={showSplash || modalOpen} tabIndex={showSplash || modalOpen ? -1 : 0}>Skip to tasks</a>
      <main
        className={`app-stage flow-${screen}`}
        id="main-content"
        aria-label={screen === 'welcome' ? 'Welcome to Daymark' : screen === 'categories' ? 'Choose a task category' : 'Daymark task planner'}
        aria-hidden={showSplash}
        inert={showSplash}
      >
        {taskStorageIssue && (
          <aside className="storage-notice" role="status" aria-live="polite" inert={modalOpen}>
            <p>{taskStorageIssue === 'load'
              ? "Saved tasks couldn't be loaded. Check browser storage, then reload; changes may not persist."
              : "Changes couldn't be saved. Your tasks remain in this tab; check browser storage and retry."}</p>
            <button type="button" onClick={retryTaskStorage}>
              {taskStorageIssue === 'load' ? 'Reload' : 'Retry save'}
            </button>
          </aside>
        )}
        <section className="device category-device" aria-label="Task categories" inert={modalOpen}>
          <div className="device-screen category-screen">
            <header className="category-screen-header">
              <div className="screen-topline">
                <span className="screen-date">{dateLabel}</span>
                <div className="category-screen-actions">
                  <ThemeToggle theme={theme} onToggle={toggleTheme} />
                  <span className="greeting-portrait" aria-hidden="true"><User size={22} weight="fill" /></span>
                </div>
              </div>
              <div className="greeting-row">
                <div>
                  <p className="screen-greeting"><span aria-hidden="true">‹</span> A fresh start</p>
                  <h2>Today</h2>
                  <p className="today-subtitle">You have <strong>{todayActiveCount} {todayActiveCount === 1 ? 'task' : 'tasks'}</strong> due today</p>
                </div>
              </div>
              <button className="quick-intake" type="button" onClick={(event) => { composerTriggerRef.current = event.currentTarget; setComposerOpen(true) }}>
                <span className="quick-intake-copy"><Plus size={20} aria-hidden="true" />Plan a new thought or task...</span>
                <span className="quick-intake-submit" aria-hidden="true">›</span>
              </button>
            </header>
            <div className="dashboard-category-heading">
              <div><h2>Categories</h2><span>5 lists</span></div>
              <button type="button" onClick={() => selectCategory('All')}>Manage <span aria-hidden="true">›</span></button>
            </div>
            <div className="category-cards">
              <button
                className={`category-card today-card ${categoryFilter === 'Today' ? 'is-current' : ''}`}
                type="button"
                aria-current={categoryFilter === 'Today' ? 'page' : undefined}
                onClick={() => selectCategory('Today')}
              >
                <span className="category-card-icon today-icon"><Sun size={28} weight="duotone" aria-hidden="true" /></span>
                <span className="category-card-copy"><strong>Today</strong><small>{todayActiveCount} {todayActiveCount === 1 ? 'task' : 'tasks'}</small></span>
                <span className="category-card-count">{todayActiveCount}</span>
              </button>
              {categories.map((category) => {
                const Icon = categoryIcons[category]
                const count = tasks.filter((task) => task.category === category && !task.completed).length
                return (
                  <button
                    className={`category-card ${categoryFilter === category ? 'is-current' : ''}`}
                    type="button"
                    key={category}
                    aria-current={categoryFilter === category ? 'page' : undefined}
                    onClick={() => selectCategory(category)}
                  >
                    <span className={`category-card-icon icon-${category.toLowerCase()}`}><Icon size={25} weight="duotone" aria-hidden="true" /></span>
                    <span className="category-card-copy"><strong>{category}</strong><small>{count} {count === 1 ? 'task' : 'tasks'}</small></span>
                    <span className="category-card-count">{count}</span>
                  </button>
                )
              })}
            </div>
            <section className="dashboard-progress" aria-label="Daily progress">
              <div className="dashboard-progress-heading">
                <h2><CheckCircle size={20} weight="duotone" aria-hidden="true" />Daily Progress</h2>
                <span>{completionPercentage}% Done</span>
              </div>
              <div className="dashboard-progress-content">
                <div className="dashboard-progress-ring" style={{ '--progress': `${completionPercentage}%` } as React.CSSProperties}>
                  <span>{todayCompletedCount}/{todayTasks.length}</span>
                </div>
                <div>
                  <strong>{todayCompletedCount} of {todayTasks.length} tasks finished today</strong>
                  <p>“Small steps every morning lead to quiet afternoons.”</p>
                </div>
              </div>
            </section>
            <section className="focus-ritual" aria-label="Morning focus ritual">
              <span className="focus-ritual-icon"><Sun size={20} weight="duotone" aria-hidden="true" /></span>
              <span className="focus-ritual-copy"><strong>Morning Focus Ritual</strong><small>Breathe, sip, and finish one important item</small></span>
              <button type="button" onClick={() => { setScreen('tasks'); setActiveNavigation('categories') }}>Begin</button>
            </section>
            <button className="dashboard-fab" type="button" aria-label="Add a task" onClick={(event) => { composerTriggerRef.current = event.currentTarget; setComposerOpen(true) }}><Plus size={26} weight="bold" aria-hidden="true" /></button>
          </div>
        </section>

        <section className="device intro-device" aria-label="Daymark introduction" inert={modalOpen}>
          <div className="device-screen intro-screen">
            <ThemeToggle theme={theme} onToggle={toggleTheme} className="screen-icon-button theme-toggle intro-theme-toggle" />
            <div className="organize-art" aria-hidden="true">
              <span className="art-sun" />
              <img className="welcome-illustration" src={heroIllustration} alt="" />
              <span className="welcome-sun-badge"><Sun size={20} weight="fill" aria-hidden="true" /></span>
              <span className="welcome-calm-badge"><CheckCircle size={17} weight="fill" aria-hidden="true" />100% Calm</span>
            </div>
            <div className="intro-copy">
              <span className="intro-wordmark"><img src="/daymark-logo.svg" alt="Daymark" /></span>
              <h1>Get organized, one thing at a time</h1>
              <p>A simple, calm place for your daily plans, so you can make room for what matters.</p>
              <div className="welcome-mode-selector" role="group" aria-label="Choose your welcome mode">
                <button className={!guidedTour ? 'is-selected' : ''} type="button" aria-pressed={!guidedTour} onClick={() => setGuidedTour(false)}>Quick Start</button>
                <button className={guidedTour ? 'is-selected' : ''} type="button" aria-pressed={guidedTour} onClick={() => setGuidedTour(true)}>Guided Tour</button>
              </div>
              <button className="get-started-button" type="button" onClick={openTodayDashboard}>
                Get started<Plus size={16} weight="bold" aria-hidden="true" />
              </button>
              <div className="welcome-category-chips" aria-label="Example categories">
                <span><Sun size={14} weight="fill" aria-hidden="true" />Today</span>
                <span><User size={14} aria-hidden="true" />Personal</span>
                <span><HouseLine size={14} aria-hidden="true" />Home</span>
              </div>
              <p className="welcome-footnote">Free forever for personal focus <span aria-hidden="true">·</span> Tap to explore</p>
            </div>
          </div>
        </section>

        <section className="device tasks-device" aria-label="Your task list" inert={modalOpen}>
          <div className="device-screen tasks-screen">
            <header className="tasks-screen-header">
              <div className="screen-action-row">
                <button
                  className="screen-icon-button"
                  type="button"
                  aria-label="Back to categories"
                  onClick={openTodayDashboard}
                >
                  <ArrowLeft size={20} aria-hidden="true" />
                </button>
                <span className="screen-date">{dateLabel}</span>
                <ThemeToggle theme={theme} onToggle={toggleTheme} />
              </div>
              <div className="tasks-screen-title-row">
                <span className="task-title-avatar" aria-hidden="true"><User size={27} weight="fill" /></span>
                <div className="tasks-screen-titles">
                  <p>{categoryFilter === 'Today'
                    ? `${activeInCategoryCount} active today`
                    : `Category · ${activeInCategoryCount} ${activeInCategoryCount === 1 ? 'task' : 'tasks'} active`}</p>
                  <h1>{heading}</h1>
                </div>
              </div>
            </header>

            <div className="tasks-screen-body">
              <nav className="mobile-categories" aria-label="Task categories">
                <button type="button" className={categoryFilter === 'Today' ? 'is-current' : ''} aria-current={categoryFilter === 'Today' ? 'page' : undefined} onClick={() => { setCategoryFilter('Today'); setFilter('All'); setQuery(''); setActiveNavigation('categories') }}>Today</button>
                {categories.map((category) => (
                  <button type="button" className={categoryFilter === category ? 'is-current' : ''} aria-current={categoryFilter === category ? 'page' : undefined} key={category} onClick={() => { setCategoryFilter(category); setFilter('All'); setQuery(''); setActiveNavigation('categories') }}>{category}</button>
                ))}
              </nav>

              <div className="task-controls">
                <div className="filter-group" role="group" aria-label="Filter tasks">
                  {(['All', 'Active', 'Completed'] as const).map((option) => (
                    <button
                      className={`filter-button ${filter === option ? 'is-active' : ''}`}
                      type="button"
                      key={option}
                      aria-pressed={filter === option}
                      onClick={() => setFilter(option)}
                    >
                      {option === 'Completed' ? 'Done' : option}
                      {option === 'Completed' && scopedCompletedCount > 0 && <span className="filter-count">{scopedCompletedCount}</span>}
                    </button>
                  ))}
                </div>
                <label className="sort-field">
                  <span>Sort</span>
                  <select aria-label="Sort tasks" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as TaskSortOrder)}>
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="due-date">Due date</option>
                    <option value="priority">Priority</option>
                  </select>
                </label>
                <label className="search-field">
                  <MagnifyingGlass size={16} aria-hidden="true" />
                  <span className="sr-only">Search tasks</span>
                  <input ref={taskSearchRef} type="search" name="task-search" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search tasks in ${heading}...`} />
                  {query && <button className="search-clear" type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={14} aria-hidden="true" /></button>}
                </label>
              </div>

              <div className="task-list-heading">
                <h2 id="task-list-heading">{filter === 'All' ? 'Your list' : `${filter} tasks`}<span>{visibleTasks.length}</span></h2>
                {scopedCompletedCount > 0 && <button className="clear-completed" type="button" onClick={() => setClearConfirmation((showing) => !showing)}>Clear done</button>}
              </div>

              {clearConfirmation && (
                <div className="confirm-strip" role="alert">
                  <span>Remove {scopedCompletedCount} completed {scopedCompletedCount === 1 ? 'task' : 'tasks'}?</span>
                  <div className="confirm-actions">
                    <button className="text-action destructive-action" type="button" onClick={clearCompleted}>Clear</button>
                    <button className="text-action" type="button" onClick={() => setClearConfirmation(false)}>Keep</button>
                  </div>
                </div>
              )}

              {visibleTasks.length > 0 ? (
                <>
                  <ul className="task-list">
                    {(filter === 'All' ? activeVisibleTasks : visibleTasks).map((task) => <TaskItem key={task.id} task={task} onToggle={toggleTask} onUpdate={updateTask} onDelete={deleteTask} onOpenDetails={openTaskDetails} />)}
                  </ul>
                  {filter === 'All' && completedVisibleTasks.length > 0 && (
                    <section className="completed-task-group">
                      <button className="completed-group-toggle" type="button" aria-expanded={completedExpanded} onClick={() => setCompletedExpanded((expanded) => !expanded)}>
                        <span>Completed <strong>{completedVisibleTasks.length} done</strong></span>
                        <span className={completedExpanded ? 'completed-chevron is-expanded' : 'completed-chevron'} aria-hidden="true">⌄</span>
                      </button>
                      {completedExpanded && (
                        <ul className="task-list completed-task-list">
                          {completedVisibleTasks.map((task) => <TaskItem key={task.id} task={task} onToggle={toggleTask} onUpdate={updateTask} onDelete={deleteTask} onOpenDetails={openTaskDetails} />)}
                        </ul>
                      )}
                    </section>
                  )}
                </>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon" aria-hidden="true"><ListChecks size={24} weight="duotone" /></span>
                  <h3>{emptyState.title}</h3>
                  <p>{emptyState.message}</p>
                  {canResetEmptyState && <button className="empty-reset" type="button" onClick={() => { setQuery(''); setCategoryFilter('All'); setFilter('All') }}>Show all tasks</button>}
                </div>
              )}

              {undoTask && (
                <div className="undo-toast">
                  <p role="status">Task deleted</p>
                  <button className="undo-button" type="button" onClick={undoDelete}><ArrowCounterClockwise size={15} aria-hidden="true" />Undo</button>
                </div>
              )}

              <div className="phone-progress" role="group" aria-label={`${categoryTasks.length} total, ${activeInCategoryCount} active, ${scopedCompletedCount} completed`}>
                <span><CheckCircle size={16} weight="duotone" aria-hidden="true" />{categoryTasks.length} total, {activeInCategoryCount} active, {scopedCompletedCount} done</span>
                <progress value={scopedCompletedCount} max={Math.max(categoryTasks.length, 1)} aria-label={`${scopedCompletedCount} of ${categoryTasks.length} tasks completed`} />
              </div>

              <button className="add-task-fab" type="button" aria-label="Add a task" onClick={(event) => { composerTriggerRef.current = event.currentTarget; setComposerOpen(true) }}>
                {composerOpen ? <X size={24} weight="bold" aria-hidden="true" /> : <Plus size={26} weight="bold" aria-hidden="true" />}
              </button>
            </div>
          </div>
        </section>
        {screen !== 'welcome' && (
          <nav className="bottom-tab-bar" aria-label="Primary" inert={modalOpen}>
            <button type="button" className={activeNavigation === 'today' ? 'is-current' : ''} aria-current={activeNavigation === 'today' ? 'page' : undefined} onClick={openTodayDashboard}><Sun size={21} weight="duotone" aria-hidden="true" /><span>Today</span></button>
            <button type="button" className={activeNavigation === 'categories' ? 'is-current' : ''} aria-current={activeNavigation === 'categories' ? 'page' : undefined} onClick={() => selectCategory('All')}><ListChecks size={21} aria-hidden="true" /><span>Categories</span></button>
            <button type="button" className={activeNavigation === 'search' ? 'is-current' : ''} aria-current={activeNavigation === 'search' ? 'page' : undefined} onClick={() => { setScreen('tasks'); setActiveNavigation('search') }}><MagnifyingGlass size={21} aria-hidden="true" /><span>Search</span></button>
            <button type="button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={toggleTheme}><Moon size={21} aria-hidden="true" /><span>Theme</span></button>
          </nav>
        )}
        {composerOpen && (
          <TaskComposerDialog
            onAdd={addTask}
            onClose={() => setComposerOpen(false)}
            initialCategory={categoryFilter === 'All' || categoryFilter === 'Today' ? 'Work' : categoryFilter}
            initialDueDate={screen === 'categories' || categoryFilter === 'Today' ? todayDateKey : ''}
          />
        )}
        {detailsTask && (
          <TaskDetailsDialog
            task={detailsTask}
            onSave={saveTaskDetails}
            onClose={() => setDetailsTaskId(null)}
          />
        )}
      </main>
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      {showSplash && (
        <div className={`launch-splash ${splashLeaving ? 'is-leaving' : ''}`} role="status" aria-live="polite" aria-label="Opening Daymark">
          <div className="launch-lockup">
            <span className="launch-mark" aria-hidden="true"><ListChecks size={42} weight="bold" /></span>
            <span className="launch-name">daymark</span>
            <span className="launch-caption">A little more room for your day.</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
