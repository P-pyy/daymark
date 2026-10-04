import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowCounterClockwise,
  BookOpen,
  Briefcase,
  CheckCircle,
  GearSix,
  HouseLine,
  ListChecks,
  MagnifyingGlass,
  Moon,
  Plus,
  Sun,
  User,
  X,
} from '@phosphor-icons/react'
import type { Session, User as SupabaseUser } from '@supabase/supabase-js'
import { AccountDialog, type AccountSyncState } from './AccountDialog'
import { TaskComposerDialog } from './TaskComposerDialog'
import { TaskDetailsDialog } from './TaskDetailsDialog'
import { TaskItem } from './TaskItem'
import { SettingsDialog, type ThemePreference } from './SettingsDialog'
import { readTasksWithStatus, writeTasks } from './taskStorage'
import { addTaskTombstones, clearLocalAccountTasks, mergeTaskLists, readTaskTombstones, removeTaskTombstone, synchronizeTaskSet, taskFromRecord, writeTaskTombstones } from './taskSync'
import { supabase } from './supabaseClient'
import { categories, type Category, type Priority, type Task } from './taskTypes'
import { getLocalDateKey, isTaskDueToday, sortTasks, type TaskSortOrder } from './taskUtils'
import heroIllustration from './assets/daymark-welcome-illustration.png'
import './TodoReference.css'

type TaskFilter = 'All' | 'Active' | 'Completed'
type CategoryFilter = Category | 'All' | 'Today'
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

function getCurrentTimestamp() {
  return Date.now()
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
  const tasksRef = useRef(tasks)
  const [taskStorageIssue, setTaskStorageIssue] = useState<TaskStorageIssue | null>(storedTaskState.failed ? 'load' : null)
  const [filter, setFilter] = useState<TaskFilter>('All')
  const [sortOrder, setSortOrder] = useState<TaskSortOrder>('newest')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(readCategoryFilter)
  const [query, setQuery] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [accountUser, setAccountUser] = useState<SupabaseUser | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [syncState, setSyncState] = useState<AccountSyncState>('idle')
  const [syncError, setSyncError] = useState<string | null>(null)
  const [loginNoticeError, setLoginNoticeError] = useState<string | null>(null)
  const [detailsTaskId, setDetailsTaskId] = useState<string | null>(null)
  const composerTriggerRef = useRef<HTMLElement | null>(null)
  const settingsTriggerRef = useRef<HTMLButtonElement | null>(null)
  const accountTriggerRef = useRef<HTMLButtonElement | null>(null)
  const manualSignOutRef = useRef(false)
  const syncStateRef = useRef(syncState)
  const sentLoginNoticeTokens = useRef(new Set<string>())
  const syncNowRef = useRef<() => void>(() => undefined)
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
  const modalOpen = composerOpen || settingsOpen || accountOpen || detailsTaskId !== null

  function toggleTheme() {
    setThemePreference(theme === 'dark' ? 'light' : 'dark')
  }

  function saveTasks(nextTasks: Task[]) {
    tasksRef.current = nextTasks
    setTasks(nextTasks)
    if (taskStorageIssue === 'load') return
    setTaskStorageIssue(writeTasks(nextTasks) ? null : 'save')
    if (accountUser) setSyncState('syncing')
  }

  function retryTaskStorage() {
    if (taskStorageIssue === 'load') {
      window.location.reload()
      return
    }

    setTaskStorageIssue(writeTasks(tasks) ? null : 'save')
  }

  async function signInWithGoogle() {
    if (!supabase) throw new Error('Profile sign-in is not configured yet.')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        scopes: 'openid email profile',
      },
    })
    if (error) throw error
  }

  async function signOut() {
    if (!supabase) throw new Error('Profile sign-in is not configured yet.')
    if (syncState !== 'synced') throw new Error('Reconnect and sync pending changes before signing out.')
    const previousTasks = tasksRef.current
    if (!clearLocalAccountTasks()) throw new Error('Could not clear this device’s account task cache. You are still signed in.')
    tasksRef.current = []
    setTasks([])
    manualSignOutRef.current = true
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      manualSignOutRef.current = false
      tasksRef.current = previousTasks
      setTasks(previousTasks)
      if (!writeTasks(previousTasks)) {
        setTaskStorageIssue('save')
        setSyncError('Sign-out failed and this device could not restore the task cache.')
        setSyncState('error')
      }
      throw error
    }
  }

  const sendLoginNotice = useCallback(async (session: Session) => {
    if (!supabase || sentLoginNoticeTokens.current.has(session.access_token)) return
    sentLoginNoticeTokens.current.add(session.access_token)
    try {
      const { error } = await supabase.functions.invoke('send-login-notice', { body: {} })
      setLoginNoticeError(error
        ? 'The sign-in email could not be sent. Check the email service configuration, then retry.'
        : null)
    } catch {
      setLoginNoticeError('The sign-in email could not be sent. Check the email service configuration, then retry.')
    }
  }, [])

  function retryLoginNotice() {
    if (!supabase || !accountUser) return
    void supabase.functions.invoke('send-login-notice', { body: {} }).then(({ error }) => {
      setLoginNoticeError(error
        ? 'The sign-in email could not be sent. Check the email service configuration, then retry.'
        : null)
    }).catch(() => {
      setLoginNoticeError('The sign-in email could not be sent. Check the email service configuration, then retry.')
    })
  }

  function openAccount(trigger?: HTMLButtonElement) {
    accountTriggerRef.current = trigger ?? null
    setSettingsOpen(false)
    setAccountOpen(true)
  }

  useEffect(() => {
    syncStateRef.current = syncState
  }, [syncState])

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
    if (settingsOpen) return
    settingsTriggerRef.current?.focus()
    settingsTriggerRef.current = null
  }, [settingsOpen])

  useEffect(() => {
    if (accountOpen) return
    accountTriggerRef.current?.focus()
    accountTriggerRef.current = null
  }, [accountOpen])

  useEffect(() => {
    if (!supabase) return

    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'SIGNED_OUT') {
        const wasManualSignOut = manualSignOutRef.current
        manualSignOutRef.current = false
        if (wasManualSignOut && !clearLocalAccountTasks()) {
          setSyncError('Could not clear account task data from this device.')
          setSyncState('error')
        } else if (!wasManualSignOut && syncStateRef.current !== 'synced') {
          setSyncError('Your session ended before pending changes synced. Your local tasks were kept on this device.')
          setSyncState('error')
        } else {
          if (!wasManualSignOut && !clearLocalAccountTasks()) {
            setSyncError('Could not clear account task data from this device.')
            setSyncState('error')
          } else {
            tasksRef.current = []
            setTasks([])
            setSyncState('idle')
          }
        }
        setAccountUser(null)
        return
      }
      if (session) {
        setAccountUser(session.user)
        if (event === 'SIGNED_IN') void sendLoginNotice(session)
      }
      setAuthReady(true)
    })

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) {
        setSyncError('Could not restore your sign-in session. Check your connection and try again.')
        setSyncState('error')
      }
      setAccountUser(data.session?.user ?? null)
      setAuthReady(true)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [sendLoginNotice])

  useEffect(() => {
    if (!supabase || !authReady || !accountUser) {
      syncNowRef.current = () => undefined
      return
    }
    const client = supabase

    let active = true
    let syncing = false
    let rerun = false
    const synchronize = async () => {
      if (syncing) {
        rerun = true
        return
      }
      syncing = true
      setSyncState('syncing')
      setSyncError(null)
      try {
        if (taskStorageIssue === 'load') {
          throw new Error('Stored tasks could not be read safely. Reload the app before syncing.')
        }
        const localSnapshot = tasksRef.current
        const tombstoneSnapshot = readTaskTombstones()
        const result = await synchronizeTaskSet(accountUser.id, localSnapshot, tombstoneSnapshot)
        if (!active) return
        const currentTombstones = readTaskTombstones()
        const changedWhileSyncing = !sameTaskLists(localSnapshot, tasksRef.current)
          || !sameTombstones(tombstoneSnapshot, currentTombstones)
        const merged = changedWhileSyncing
          ? mergeTaskLists(tasksRef.current, result.tasks, currentTombstones, result.deletedTasks)
          : result.tasks
        if (!sameTaskLists(tasksRef.current, merged)) {
          tasksRef.current = merged
          setTasks(merged)
          const saved = writeTasks(merged)
          setTaskStorageIssue(saved ? null : 'save')
          if (!saved) throw new Error('Tasks synced, but the updated task list could not be saved on this device.')
        }
        const pendingTombstones = currentTombstones.filter((current) => {
          const synced = tombstoneSnapshot.find((snapshot) => snapshot.id === current.id)
          return !synced || synced.updatedAt !== current.updatedAt
        })
        if (!writeTaskTombstones(pendingTombstones)) {
          throw new Error('Synced tasks, but could not clear the local sync queue.')
        }
        setSyncState(changedWhileSyncing ? 'syncing' : 'synced')
        if (changedWhileSyncing) rerun = true
      } catch (error) {
        if (!active) return
        setSyncError(error instanceof Error ? error.message : 'Task sync failed. Please try again.')
        setSyncState(navigator.onLine ? 'error' : 'offline')
      } finally {
        syncing = false
        if (rerun && active) {
          rerun = false
          void synchronize()
        }
      }
    }
    syncNowRef.current = () => { void synchronize() }
    void synchronize()

    const channel = client
      .channel(`tasks:${accountUser.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `owner_id=eq.${accountUser.id}`,
      }, (event) => {
        try {
          const record = event.new as unknown as Parameters<typeof taskFromRecord>[0]
          if (typeof record.id !== 'string' || typeof record.updated_at !== 'number' || typeof record.is_deleted !== 'boolean') return
          const incomingTask = taskFromRecord(record)
          const currentTasks = tasksRef.current
          const currentTask = currentTasks.find((task) => task.id === record.id)
          const currentTombstone = readTaskTombstones().find((item) => item.id === record.id)
          const localUpdatedAt = currentTombstone?.updatedAt ?? (currentTask?.updatedAt ?? currentTask?.createdAt ?? -1)
          if (record.updated_at <= localUpdatedAt) return

          const nextTasks = incomingTask
            ? [...currentTasks.filter((task) => task.id !== record.id), incomingTask].sort((a, b) => b.createdAt - a.createdAt)
            : currentTasks.filter((task) => task.id !== record.id)
          if (record.is_deleted) {
            addTaskTombstones([record.id], record.updated_at)
          } else {
            removeTaskTombstone(record.id)
          }
          tasksRef.current = nextTasks
          setTasks(nextTasks)
          if (!writeTasks(nextTasks)) {
            setSyncError('A change arrived from another device but could not be saved on this device.')
            setSyncState('error')
          }
        } catch (error) {
          setSyncError(error instanceof Error ? error.message : 'A change from another device could not be applied.')
          setSyncState('error')
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          syncNowRef.current()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setSyncError('Live task updates are unavailable. Daymark will retry during the next sync.')
          setSyncState('error')
        }
      })

    const handleOnline = () => syncNowRef.current()
    const handleOffline = () => {
      setSyncError('Your changes are saved on this device and will sync when you reconnect.')
      setSyncState('offline')
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      active = false
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      syncNowRef.current = () => undefined
      void client.removeChannel(channel)
    }
  }, [accountUser, authReady, taskStorageIssue])

  useEffect(() => {
    if (!authReady || !accountUser) return
    const retryTimer = window.setTimeout(() => syncNowRef.current(), 350)
    return () => window.clearTimeout(retryTimer)
  }, [tasks, accountUser, authReady])

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
    const createdAt = getCurrentTimestamp()
    const task: Task = {
      id: crypto.randomUUID(), title, priority, dueDate, category,
      completed: false, createdAt, updatedAt: createdAt, notes: '', subtasks: [],
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
    saveTasks(tasks.map((task) => task.id === updatedTask.id
      ? { ...updatedTask, updatedAt: Math.max(getCurrentTimestamp(), (task.updatedAt ?? task.createdAt) + 1) }
      : task))
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
    saveTasks(tasks.map((item) => item.id === task.id
      ? { ...item, completed, updatedAt: Math.max(getCurrentTimestamp(), (item.updatedAt ?? item.createdAt) + 1) }
      : item))
    setAnnouncement(`${completed ? 'Completed' : 'Restored'} ${task.title}`)
  }

  function deleteTask(task: Task) {
    const index = tasks.findIndex((item) => item.id === task.id)
    if (accountUser) {
      try {
        addTaskTombstones([task.id], Math.max(getCurrentTimestamp(), (task.updatedAt ?? task.createdAt) + 1))
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : 'Could not queue the task deletion for sync.')
        setSyncState('error')
        return
      }
    }
    saveTasks(tasks.filter((item) => item.id !== task.id))
    setUndoTask({ task, index })
    setAnnouncement(`Deleted ${task.title}. Undo is available.`)
    setClearConfirmation(false)
  }

  function undoDelete() {
    if (!undoTask) return
    if (accountUser) {
      try {
        removeTaskTombstone(undoTask.task.id)
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : 'Could not restore this task safely.')
        setSyncState('error')
        return
      }
    }
    const restoredTasks = [...tasks]
    restoredTasks.splice(undoTask.index, 0, accountUser
      ? { ...undoTask.task, updatedAt: Math.max(getCurrentTimestamp(), (undoTask.task.updatedAt ?? undoTask.task.createdAt) + 1) }
      : undoTask.task)
    saveTasks(restoredTasks)
    setAnnouncement(`Restored ${undoTask.task.title}`)
    setUndoTask(null)
  }

  function clearCompleted() {
    if (accountUser) {
      try {
        const completedTasks = tasks.filter((task) => task.completed && matchesCategory(task))
        const latestTaskTimestamp = Math.max(...completedTasks.map((task) => task.updatedAt ?? task.createdAt))
        addTaskTombstones(
          completedTasks.map((task) => task.id),
          Math.max(getCurrentTimestamp(), latestTaskTimestamp + 1),
        )
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : 'Could not queue completed task deletions for sync.')
        setSyncState('error')
        return
      }
    }
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
                  <button
                    className="greeting-portrait"
                    type="button"
                    aria-label={accountUser ? 'Open profile' : 'Sign in with Google'}
                    aria-haspopup="dialog"
                    onClick={(event) => openAccount(event.currentTarget)}
                  >
                    {typeof (accountUser?.user_metadata.avatar_url ?? accountUser?.user_metadata.picture) === 'string'
                      ? <img src={String(accountUser?.user_metadata.avatar_url ?? accountUser?.user_metadata.picture)} alt="" referrerPolicy="no-referrer" />
                      : <User size={22} weight="fill" aria-hidden="true" />}
                  </button>
                </div>
              </div>
              <div className="greeting-row">
                <div>
                  <p className="screen-greeting"><ArrowLeft size={16} weight="bold" aria-hidden="true" />A fresh start</p>
                  <h2>Today</h2>
                  <p className="today-subtitle">You have <strong>{todayActiveCount} {todayActiveCount === 1 ? 'task' : 'tasks'}</strong> due today</p>
                </div>
              </div>
              <button className="quick-intake" type="button" onClick={(event) => { composerTriggerRef.current = event.currentTarget; setComposerOpen(true) }}>
                <span className="quick-intake-copy"><Plus size={20} aria-hidden="true" />Plan a new thought or task...</span>
                <span className="quick-intake-submit" aria-hidden="true"><ArrowRight size={19} weight="bold" /></span>
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
            <button type="button" aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={(event) => { settingsTriggerRef.current = event.currentTarget; setSettingsOpen(true) }}><GearSix size={21} aria-hidden="true" /><span>Settings</span></button>
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
        {settingsOpen && (
          <SettingsDialog
            themePreference={themePreference}
            onThemePreferenceChange={setThemePreference}
            onManageAccount={() => openAccount(settingsTriggerRef.current ?? undefined)}
            isSignedIn={Boolean(accountUser)}
            accountEmail={accountUser?.email ?? null}
            syncState={syncState}
            onSignOut={async () => {
              await signOut()
              setSettingsOpen(false)
            }}
            onClose={() => setSettingsOpen(false)}
          />
        )}
        {accountOpen && (
          <AccountDialog
            configured={Boolean(supabase)}
            user={accountUser}
            syncState={syncState}
            syncError={syncError}
            loginNoticeError={loginNoticeError}
            onSignIn={signInWithGoogle}
            onSignOut={signOut}
            onRetrySync={() => syncNowRef.current()}
            onRetryLoginNotice={retryLoginNotice}
            onClose={() => setAccountOpen(false)}
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

function sameTaskLists(left: Task[], right: Task[]) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function sameTombstones(left: ReturnType<typeof readTaskTombstones>, right: ReturnType<typeof readTaskTombstones>) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export default App
