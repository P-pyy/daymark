import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { categories, type Category, type Task } from './features/tasks/taskTypes'

vi.mock('./shared/supabaseClient', () => ({ supabase: null }))

const tasksStorageKey = 'daymark.tasks.v1'
const categoryStorageKey = 'daymark.category.filter.v1'
const splashStorageKey = 'daymark.splash.seen.v1'
const guidedTourStorageKey = 'daymark.guided-tour.seen.v1'
const themeStorageKey = 'daymark.theme.preference.v1'

function dateKey(offset = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function makeTask(
  title: string,
  options: Partial<Omit<Task, 'id' | 'title' | 'createdAt'>> & { category?: Category; createdAt?: number } = {},
): Task {
  return {
    id: `id-${title.toLowerCase().replaceAll(' ', '-')}`,
    title,
    completed: false,
    priority: 'Normal',
    dueDate: '',
    category: 'Work',
    createdAt: 1_790_856_000_000,
    ...options,
  }
}

function expectTaskListOrder(titles: string[]) {
  const rows = screen.getAllByRole('listitem')
  expect(rows).toHaveLength(titles.length)
  titles.forEach((title, index) => {
    expect(within(rows[index]).getByText(title, { exact: true })).toBeInTheDocument()
  })
}

function renderTasks(tasks: Task[] = [], category: Category | 'All' = 'All') {
  localStorage.setItem(tasksStorageKey, JSON.stringify(tasks))
  localStorage.setItem(categoryStorageKey, category)
  sessionStorage.setItem(splashStorageKey, 'seen')
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'created-task-id') })
  const view = render(<App />)
  const dashboard = screen.getByRole('region', { name: /Task categories|Mga kategorya ng gawain/ })
  const target = category === 'All'
    ? dashboard.querySelector<HTMLButtonElement>('.today-dashboard-copy .today-tasks-link')
    : dashboard.querySelectorAll<HTMLButtonElement>('.category-card')[categories.indexOf(category)]
  if (!target) throw new Error(`Could not find the dashboard entry for ${category}`)
  fireEvent.click(target)
  return view
}

function startApp() {
  sessionStorage.setItem(splashStorageKey, 'seen')
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'created-task-id') })
  return render(<App />)
}

function openDashboard() {
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Today' }))
}

function openAllTasksFromDashboard() {
  fireEvent.click(within(screen.getByRole('region', { name: 'Task categories' })).getByRole('button', { name: 'View all tasks' }))
}

function chooseCategoryFromDashboard(category: Category) {
  openDashboard()
  fireEvent.click(within(screen.getByRole('region', { name: 'Task categories' })).getByRole('button', { name: new RegExp(`^${category}`) }))
}

function openAllTasks() {
  openDashboard()
  openAllTasksFromDashboard()
}

function openTaskComposer() {
  fireEvent.click(within(screen.getByRole('complementary', { name: 'Daymark navigation' })).getByRole('button', { name: 'Add a task' }))
}

function openTaskDetails(title: string) {
  fireEvent.click(screen.getByRole('button', { name: `Open details for “${title}”` }))
}

function openDashboardComposer() {
  fireEvent.click(within(screen.getByRole('region', { name: 'Task categories' })).getByRole('button', { name: 'Plan a new task' }))
}

function selectDueDate(container: HTMLElement, value: string) {
  const [year, month, day] = value.split('-').map(Number)
  const label = new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' })
    .format(new Date(year, month - 1, day))
  fireEvent.click(within(container).getByRole('button', { name: 'Due date' }))
  fireEvent.click(screen.getByRole('button', { name: label }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

beforeEach(() => {
  localStorage.setItem(guidedTourStorageKey, 'seen')
})

describe('Daymark task UI', () => {
  it('shows the first-launch tour over the Today dashboard and persists a skip', () => {
    localStorage.removeItem(guidedTourStorageKey)
    startApp()

    expect(screen.getByRole('main', { name: 'Choose a task category' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Task categories' })).toBeInTheDocument()
    expect(screen.queryByRole('main', { name: 'Welcome to Daymark' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'A clear view of today' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('dialog', { name: 'Add tasks as they come to mind' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(screen.getByRole('dialog', { name: 'A clear view of today' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(localStorage.getItem(guidedTourStorageKey)).toBe('seen')
  })

  it('finishes the guided tour and does not show it again on a returning launch', () => {
    localStorage.removeItem(guidedTourStorageKey)
    const app = startApp()

    for (const title of [
      'Add tasks as they come to mind',
      'Keep plans in categories',
      'Find the rest of Daymark',
    ]) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument()
    }
    fireEvent.click(screen.getByRole('button', { name: 'Finish tour' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(localStorage.getItem(guidedTourStorageKey)).toBe('seen')

    app.unmount()
    startApp()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the Today dashboard for returning users even when Today was the last task-list scope', () => {
    localStorage.setItem(tasksStorageKey, JSON.stringify([makeTask('Due today', { dueDate: dateKey() })]))
    localStorage.setItem(categoryStorageKey, 'Today')
    sessionStorage.setItem(splashStorageKey, 'seen')

    render(<App />)

    expect(screen.getByRole('main', { name: 'Choose a task category' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Task categories' })).toBeInTheDocument()
  })

  it('returns the Today dashboard scroll position to the top when reopening the tab', () => {
    startApp()
    const dashboard = screen.getByRole('region', { name: 'Task categories' })
    const scrollContainer = dashboard.closest<HTMLElement>('.category-device')
    if (!scrollContainer) throw new Error('Today dashboard scroll container is missing')
    scrollContainer.scrollTop = 48

    const navigation = within(screen.getByRole('navigation', { name: 'Primary' }))
    fireEvent.click(navigation.getByRole('button', { name: 'Calendar' }))
    fireEvent.click(navigation.getByRole('button', { name: 'Today' }))

    expect(scrollContainer.scrollTop).toBe(0)
  })

  it('navigates between screens without showing a loading screen', () => {
    renderTasks()

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Calendar' }))

    expect(screen.getByRole('main', { name: 'Daymark calendar' })).not.toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('status', { name: 'Getting things ready' })).not.toBeInTheDocument()
    expect(document.querySelector('.page-transition')).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
  })

  it('uses one primary add-task action on the Today dashboard', () => {
    renderTasks()
    openDashboard()

    const dashboard = screen.getByRole('region', { name: 'Task categories' })
    expect(within(dashboard).getByRole('button', { name: 'Plan a new task' })).toBeInTheDocument()
    expect(within(dashboard).getAllByRole('button', { name: 'View all tasks' })).toHaveLength(1)
    expect(dashboard.querySelector('.all-tasks-link')).toBeNull()
    expect(within(dashboard).getAllByRole('button', { name: /^(Work|Personal|Home|Learning)/ })).toHaveLength(categories.length)
    expect(within(dashboard).queryByRole('button', { name: 'Search tasks' })).not.toBeInTheDocument()
    expect(dashboard.querySelector('.quick-intake-submit')).toBeNull()
    expect(within(dashboard).queryByRole('button', { name: /^Today/ })).not.toBeInTheDocument()
    expect(within(dashboard).queryByRole('button', { name: 'Add a task' })).not.toBeInTheDocument()

    fireEvent.click(within(dashboard).getByRole('button', { name: 'Plan a new task' }))
    expect(screen.getByRole('dialog', { name: 'Create New Task' })).toBeInTheDocument()
  })

  it('opens the Profile screen from the bottom navigation and updates the saved appearance preference', () => {
    renderTasks()

    const navigation = within(screen.getByRole('navigation', { name: 'Primary' }))
    expect(navigation.getAllByRole('button')).toHaveLength(4)
    expect(navigation.queryByRole('button', { name: /Theme/ })).not.toBeInTheDocument()
    const settingsButton = navigation.getByRole('button', { name: 'Profile' })
    fireEvent.click(settingsButton)

    const profile = screen.getByRole('main', { name: 'Your Daymark profile' })
    const appearanceSelect = within(profile).getByRole('combobox', { name: 'Appearance' })
    expect(appearanceSelect).toHaveValue('system')
    expect(within(profile).getByText(/sync across your signed-in devices/)).toBeInTheDocument()
    expect(within(profile).queryByText(/timezone/i)).not.toBeInTheDocument()
    expect(settingsButton).toHaveAttribute('aria-current', 'page')
    expect(navigation.getAllByRole('button').map((button) => button.textContent?.trim())).toEqual([
      'Today',
      'Calendar',
      'Notifications',
      'Profile',
    ])
    fireEvent.change(appearanceSelect, { target: { value: 'dark' } })

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem(themeStorageKey)).toBe('dark')

    fireEvent.click(navigation.getByRole('button', { name: 'Today' }))
    expect(screen.getByRole('region', { name: 'Task categories' })).toBeInTheDocument()

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Profile' }))
    const settingsNavigation = within(screen.getByRole('navigation', { name: 'Primary' }))
    fireEvent.click(settingsNavigation.getByRole('button', { name: 'Notifications' }))
    expect(screen.getByRole('main', { name: 'Daymark reminders' })).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Profile' }))
    fireEvent.change(within(screen.getByRole('main', { name: 'Your Daymark profile' })).getByRole('combobox', { name: 'Appearance' }), { target: { value: 'system' } })
    expect(localStorage.getItem(themeStorageKey)).toBeNull()
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })

  it('opens the existing notification center from the primary navigation', () => {
    const task = makeTask('Primary navigation reminder', { dueDate: dateKey() })
    renderTasks([task])

    const navigation = within(screen.getByRole('navigation', { name: 'Primary' }))
    expect(navigation.getAllByRole('button').map((button) => button.textContent?.trim())).toEqual([
      'Today',
      'Calendar',
      'Notifications',
      'Profile',
    ])
    fireEvent.click(navigation.getByRole('button', { name: 'Notifications' }))

    expect(screen.getByRole('main', { name: 'Daymark reminders' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(`Open task “${task.title}”`) })).toBeInTheDocument()
    expect(navigation.getByRole('button', { name: 'Notifications' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows an account summary at the bottom of desktop navigation and opens Profile', () => {
    renderTasks()

    const desktopNavigation = within(screen.getByRole('navigation', { name: 'Daymark' }))
    expect(desktopNavigation.getAllByRole('button').map((button) => button.textContent?.trim())).toEqual([
      'Today',
      'Calendar',
      'Notifications',
    ])
    expect(within(screen.getByRole('complementary', { name: 'Daymark navigation' }))
      .queryByRole('button', { name: 'Switch to Dark theme' })).not.toBeInTheDocument()

    const profileSummary = screen.getByRole('button', { name: 'Profile, Private on this device' })
    fireEvent.click(profileSummary)

    expect(screen.getByRole('main', { name: 'Your Daymark profile' })).toBeInTheDocument()
    expect(profileSummary).toHaveAttribute('aria-current', 'page')
  })

  it('applies the selected language across navigation, calendar, and task forms', () => {
    renderTasks()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Profile' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'fil' } })

    expect(document.documentElement).toHaveAttribute('lang', 'fil')
    const navigation = screen.getByRole('navigation', { name: 'Pangunahing nabigasyon' })
    fireEvent.click(within(navigation).getByRole('button', { name: 'Kalendaryo' }))
    expect(screen.getByRole('heading', { name: 'Kalendaryo' })).toBeInTheDocument()
    const calendarRegion = screen.getByRole('region', { name: 'Kalendaryo mo' })
    fireEvent.click(within(calendarRegion).getByRole('button', { name: 'Magplano para sa araw na ito' }))

    const dialog = screen.getByRole('dialog', { name: 'Gumawa ng bagong gawain' })
    expect(within(dialog).getByText('Kategorya')).toBeInTheDocument()
    expect(within(dialog).getByText('Prayoridad')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(within(navigation).getByRole('button', { name: 'Profile' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Wika' }), { target: { value: 'en' } })
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  })

  it('restores the selected language on app startup', () => {
    localStorage.setItem('daymark.language.preference.v1', 'fil')
    renderTasks()

    expect(document.documentElement).toHaveAttribute('lang', 'fil')
    expect(screen.getByRole('navigation', { name: 'Pangunahing nabigasyon' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Lahat ng gawain' })).toBeInTheDocument()
  })

  it('opens account setup from the Profile destination', () => {
    renderTasks()

    const profileButton = within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Profile' })
    fireEvent.click(profileButton)
    fireEvent.click(within(screen.getByRole('main', { name: 'Your Daymark profile' })).getByRole('button', { name: 'Manage account' }))

    const dialog = screen.getByRole('dialog', { name: 'Profile' })
    expect(within(dialog).getByRole('heading', { name: 'Profile setup is needed' })).toBeInTheDocument()
    expect(within(dialog).getByText(/Supabase project and Google sign-in configuration/)).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Profile' })).not.toBeInTheDocument()
  })

  it('keeps one shared navigation style across Today, Profile, and Notifications', () => {
    renderTasks()
    const navigation = screen.getByRole('navigation', { name: 'Primary' })

    expect(navigation).toHaveClass('bottom-tab-bar')
    expect(navigation).not.toHaveClass('notifications-reference-nav')
    expect(within(navigation).getByRole('button', { name: 'Today' })).toHaveAttribute('aria-current', 'page')

    fireEvent.click(within(navigation).getByRole('button', { name: 'Profile' }))
    expect(navigation).toHaveClass('bottom-tab-bar')
    expect(within(navigation).getByRole('button', { name: 'Profile' })).toHaveAttribute('aria-current', 'page')

    fireEvent.click(within(navigation).getByRole('button', { name: 'Notifications' }))
    expect(navigation).toHaveClass('bottom-tab-bar')
    expect(within(navigation).getByRole('button', { name: 'Notifications' })).toHaveAttribute('aria-current', 'page')
  })

  it('keeps Profile as the active destination while account setup is open', () => {
    renderTasks()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Profile' }))

    const profile = screen.getByRole('main', { name: 'Your Daymark profile' })
    fireEvent.click(within(profile).getByRole('button', { name: 'Manage account' }))

    expect(screen.getByRole('main', { name: 'Your Daymark profile' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Profile' })).toBeInTheDocument()
  })

  it('opens the named composer, focuses the title, traps focus and restores focus on Escape', () => {
    renderTasks()
    openTaskComposer()

    const dialog = screen.getByRole('dialog', { name: 'Create New Task' })
    const titleInput = within(dialog).getByRole('textbox', { name: 'Task name' })
    const addButton = within(dialog).getByRole('button', { name: 'Add task' })
    const trigger = within(screen.getByRole('complementary', { name: 'Daymark navigation' })).getByRole('button', { name: 'Add a task' })
    expect(titleInput).toHaveAttribute('placeholder', 'e.g., Take a short walk')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('region', { name: 'Your task list' })).toHaveAttribute('inert')
    expect(screen.getByRole('navigation', { name: 'Primary' })).toHaveAttribute('inert')
    expect(within(dialog).queryByRole('button', { name: 'Close add task form' })).not.toBeInTheDocument()
    expect(titleInput).toHaveFocus()

    fireEvent.change(titleInput, { target: { value: 'Focus check' } })
    titleInput.focus()
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(addButton).toHaveFocus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(titleInput).toHaveFocus()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    openTaskComposer()
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Create New Task' })).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not focus the task input on touch layouts when opening the composer', () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query.includes('max-width: 700px') || query.includes('pointer: coarse'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    renderTasks()
    openTaskComposer()

    const dialog = screen.getByRole('dialog', { name: 'Create New Task' })
    const titleInput = within(dialog).getByRole('textbox', { name: 'Task name' })
    expect(dialog).toHaveFocus()
    expect(titleInput).not.toHaveFocus()
  })

  it('creates a task from the composer with the existing schema and Today default date', () => {
    startApp()
    openDashboardComposer()

    const dialog = screen.getByRole('dialog', { name: 'Create New Task' })
    expect(within(dialog).getByRole('button', { name: 'Due date' })).toHaveTextContent(
      new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date()),
    )
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Task name' }), { target: { value: 'Write release notes' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Personal' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'High' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add task' }))

    expect(JSON.parse(localStorage.getItem(tasksStorageKey) || '[]')).toEqual([{
      id: 'created-task-id',
      title: 'Write release notes',
      completed: false,
      priority: 'High',
      dueDate: dateKey(),
      category: 'Personal',
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
      notes: '',
      subtasks: [],
    }])
    fireEvent.click(within(screen.getByRole('region', { name: 'Task categories' })).getByRole('button', { name: /^Personal/ }))
    expect(screen.getByText('Write release notes', { exact: true })).toBeInTheDocument()
  })

  it('navigates the date picker and clears a task due date', () => {
    startApp()
    openDashboardComposer()
    const composer = screen.getByRole('dialog', { name: 'Create New Task' })
    fireEvent.click(within(composer).getByRole('button', { name: 'Due date' }))

    const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
    const nextMonthLabel = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(nextMonth)
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByRole('dialog', { name: nextMonthLabel })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

    fireEvent.change(within(composer).getByRole('textbox', { name: 'Task name' }), { target: { value: 'Take a short walk' } })
    fireEvent.click(within(composer).getByRole('button', { name: 'Add task' }))
    const [createdTask] = JSON.parse(localStorage.getItem(tasksStorageKey) || '[]') as Task[]
    expect(createdTask.dueDate).toBe('')
  })

  it('edits task fields, completes/restores, deletes and undoes in list order', () => {
    const tasks = [
      makeTask('First task', { priority: 'Low' }),
      makeTask('Second task', { category: 'Personal', dueDate: dateKey(2), priority: 'High' }),
    ]
    renderTasks(tasks)

    fireEvent.click(screen.getByRole('button', { name: 'Edit “First task”' }))
    const editInput = screen.getByRole('textbox', { name: 'Task name' })
    fireEvent.change(editInput, { target: { value: 'First task updated' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), { target: { value: 'Learning' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Priority' }), { target: { value: 'High' } })
    const editingRow = document.querySelector<HTMLElement>('.editing-row')
    if (!editingRow) throw new Error('Could not find the task being edited')
    selectDueDate(editingRow, dateKey(1))
    fireEvent.click(screen.getByRole('button', { name: 'Save task changes' }))

    const updatedTasks = JSON.parse(localStorage.getItem(tasksStorageKey) || '[]') as Task[]
    expect(updatedTasks[0]).toMatchObject({
      title: 'First task updated',
      category: 'Learning',
      priority: 'High',
      dueDate: dateKey(1),
      id: tasks[0].id,
      createdAt: tasks[0].createdAt,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Complete “First task updated”' }))
    expect(screen.getByRole('button', { name: 'Restore “First task updated”' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Restore “First task updated”' }))
    expect(screen.getByRole('button', { name: 'Complete “First task updated”' })).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'Delete “First task updated”' }))
    expect(screen.queryByText('First task updated')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getAllByRole('listitem').map((row) => row.textContent)).toEqual(expect.arrayContaining([
      expect.stringContaining('First task updated'),
      expect.stringContaining('Second task'),
    ]))
  })

  it('opens the full clean task list from the Today dashboard action', () => {
    const tasks = [
      makeTask('Active today', { dueDate: dateKey() }),
      makeTask('Completed today', { dueDate: dateKey(), completed: true, category: 'Personal' }),
      makeTask('Undated', { category: 'Home' }),
      makeTask('Future', { dueDate: dateKey(1) }),
      makeTask('Past', { dueDate: dateKey(-1) }),
    ]
    renderTasks(tasks)

    expect(screen.getByText('Active today', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Undated', { exact: true })).toBeInTheDocument()
    openDashboard()
    openAllTasksFromDashboard()
    expect(screen.getByRole('region', { name: 'Your task list' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'All tasks', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Everything on your list')).toBeInTheDocument()
    expect(document.querySelector('.clean-task-list-screen')).not.toBeNull()
    expect(document.querySelector('.clean-task-list')).not.toBeNull()
    expect(screen.queryByRole('searchbox', { name: 'Search tasks' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Filter tasks' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Sort tasks' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /total, .*active/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    for (const title of ['Active today', 'Completed today', 'Undated', 'Future', 'Past']) {
      expect(screen.getByText(title, { exact: true })).toBeInTheDocument()
    }
  })

  it('filters by category from the dashboard and keeps All tasks focused on its list', () => {
    const tasks = [
      makeTask('Review planning', { category: 'Work', dueDate: dateKey() }),
      makeTask('Read handbook', { category: 'Personal', dueDate: dateKey() }),
      makeTask('Tidy entryway', { category: 'Home', dueDate: dateKey() }),
    ]
    renderTasks(tasks)
    openDashboard()
    fireEvent.click(within(screen.getByRole('region', { name: 'Task categories' })).getByRole('button', { name: /^Personal/ }))
    expect(screen.getByRole('heading', { name: 'Personal' })).toBeInTheDocument()
    expect(screen.getByRole('main', { name: 'Daymark task planner' })).toBeInTheDocument()
    expect(document.querySelector('.category-task-screen')).not.toBeNull()
    expect(screen.getByText('Read handbook', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Review planning', { exact: true })).not.toBeInTheDocument()

    chooseCategoryFromDashboard('Home')
    expect(screen.getByText('Tidy entryway', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Read handbook', { exact: true })).not.toBeInTheDocument()
    chooseCategoryFromDashboard('Work')
    expect(screen.getByText('Review planning', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Tidy entryway', { exact: true })).not.toBeInTheDocument()

    openAllTasks()
    expect(screen.getByRole('heading', { name: 'All tasks', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Review planning', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Read handbook', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Tidy entryway', { exact: true })).toBeInTheDocument()
    expect(screen.queryByRole('searchbox', { name: 'Search tasks' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Filter tasks' })).not.toBeInTheDocument()

    openDashboard()
    openAllTasksFromDashboard()
    expect(screen.getByText('Read handbook', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Review planning', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Tidy entryway', { exact: true })).toBeInTheDocument()
    expect(screen.queryByRole('searchbox', { name: 'Search tasks' })).not.toBeInTheDocument()
  })

  it('keeps the selected category after creating a task from its concept view', () => {
    renderTasks()
    chooseCategoryFromDashboard('Work')
    fireEvent.keyDown(document.body, { key: 'n' })

    fireEvent.change(screen.getByRole('textbox', { name: 'Task name' }), { target: { value: 'Prepare weekly plan' } })
    fireEvent.click(screen.getByRole('button', { name: /^Add task$/ }))

    expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
    expect(screen.getByText('Prepare weekly plan', { exact: true })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Up next' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'All tasks' })).not.toBeInTheDocument()
  })

  it('shows the category concept for named lists while keeping the full planner in All tasks', () => {
    renderTasks([
      makeTask('Prepare outline'),
      makeTask('Prepare report', { completed: true }),
      makeTask('Prepare groceries', { category: 'Home' }),
    ])
    openDashboard()
    fireEvent.click(within(screen.getByRole('region', { name: 'Task categories' })).getByRole('button', { name: /^Work/ }))

    expect(document.querySelector('.category-concept-screen')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'All categories' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Up next' })).toBeInTheDocument()
    expect(screen.getByText('1 task left')).toBeInTheDocument()
    expect(screen.getByText('Prepare outline', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Prepare report', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Prepare groceries', { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByRole('searchbox', { name: 'Search tasks' })).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()

    openAllTasks()
    expect(screen.queryByRole('searchbox', { name: 'Search tasks' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Filter tasks' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Task categories' })).toBeInTheDocument()
    expect(screen.getByText('Prepare outline', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Prepare report', { exact: true })).toBeInTheDocument()
    chooseCategoryFromDashboard('Work')
    fireEvent.click(screen.getByRole('button', { name: 'All categories' }))
    expect(screen.getByRole('region', { name: 'Task categories' })).toBeInTheDocument()
  })

  it('updates category task completion and remaining count from the concept view', () => {
    renderTasks([makeTask('Finish outline')])
    chooseCategoryFromDashboard('Work')

    fireEvent.click(screen.getByRole('button', { name: 'Complete “Finish outline”' }))
    expect(screen.getByRole('heading', { name: 'All done for now' })).toBeInTheDocument()
    expect(screen.getByText('0 tasks left')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restore “Finish outline”' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows every task in one list without planner controls or changing stored records', () => {
    const tasks = [
      makeTask('Later work', { createdAt: 10, dueDate: dateKey(2) }),
      makeTask('Earlier work', { createdAt: 20, dueDate: dateKey(-1) }),
      makeTask('Done work', { createdAt: 30, dueDate: dateKey(-2), completed: true }),
      makeTask('Home task', { createdAt: 40, dueDate: dateKey(-5), category: 'Home' }),
      makeTask('Undated work', { createdAt: 50 }),
    ]
    renderTasks(tasks)
    const storedTasks = localStorage.getItem(tasksStorageKey)

    expectTaskListOrder(['Undated work', 'Home task', 'Done work', 'Earlier work', 'Later work'])
    expect(screen.queryByRole('combobox', { name: 'Sort tasks' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear done' })).not.toBeInTheDocument()
    expect(screen.queryByRole('searchbox', { name: 'Search tasks' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Filter tasks' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /total, .*active/ })).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Your task list' })).queryByRole('button', { name: 'Add a task' })).not.toBeInTheDocument()

    chooseCategoryFromDashboard('Work')
    expectTaskListOrder(['Undated work', 'Done work', 'Earlier work', 'Later work'])
    expect(screen.queryByRole('combobox', { name: 'Sort tasks' })).not.toBeInTheDocument()
    expect(localStorage.getItem(tasksStorageKey)).toBe(storedTasks)
  })

  it('labels due-date states and never marks completed overdue tasks as overdue', () => {
    renderTasks([
      makeTask('Due today', { dueDate: dateKey() }),
      makeTask('Overdue task', { dueDate: dateKey(-1) }),
      makeTask('Upcoming task', { dueDate: dateKey(5) }),
      makeTask('Undated task'),
      makeTask('Completed overdue task', { dueDate: dateKey(-1), completed: true, priority: 'High' }),
    ])

    expect(screen.getByLabelText('Today - due today').tagName).toBe('TIME')
    expect(screen.getByLabelText(/ - overdue$/)).toHaveAttribute('dateTime', dateKey(-1))
    expect(screen.getByLabelText(/ - upcoming$/)).toHaveAttribute('dateTime', dateKey(5))
    expect(screen.getByText('Undated task', { exact: true })).toBeInTheDocument()
    const completedDate = screen.getByLabelText(/ - completed$/)
    expect(completedDate.tagName).toBe('TIME')
    expect(completedDate.getAttribute('aria-label')).not.toContain('overdue')
    expect(screen.getByText('High', { exact: true })).toBeInTheDocument()
  })

  it('opens the composer with N and ignores shortcuts while editing text', () => {
    renderTasks()
    fireEvent.keyDown(document.body, { key: 'n' })

    const dialog = screen.getByRole('dialog', { name: 'Create New Task' })
    const title = within(dialog).getByRole('textbox', { name: 'Task name' })
    expect(title).toHaveFocus()
    fireEvent.keyDown(title, { key: 'n' })
    fireEvent.keyDown(title, { key: '/' })
    expect(screen.getByRole('dialog', { name: 'Create New Task' })).toBeInTheDocument()
    expect(title).toHaveFocus()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the clean task list free of planner controls and preserves shortcuts', () => {
    renderTasks()
    fireEvent.keyDown(document.body, { key: '/' })
    expect(screen.queryByRole('searchbox', { name: 'Search tasks' })).not.toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: 'n' })
    expect(screen.getByRole('dialog', { name: 'Create New Task' })).toBeInTheDocument()
    const title = screen.getByRole('textbox', { name: 'Task name' })
    fireEvent.keyDown(title, { key: 'n' })
    expect(screen.getByRole('dialog', { name: 'Create New Task' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows context-specific empty states and accurate scoped counts', () => {
    renderTasks()
    expect(screen.getByRole('heading', { name: 'No tasks yet' })).toBeInTheDocument()

    openDashboard()
    openAllTasksFromDashboard()
    expect(screen.getByRole('heading', { name: 'No tasks yet' })).toBeInTheDocument()
    expect(screen.queryByRole('searchbox', { name: 'Search tasks' })).not.toBeInTheDocument()
    openDashboard()
    chooseCategoryFromDashboard('Work')
    expect(screen.getByText('No tasks in Work', { exact: true })).toBeInTheDocument()

    openAllTasks()
    expect(screen.getByRole('heading', { name: 'No tasks yet' })).toBeInTheDocument()
    expect(screen.queryByRole('searchbox', { name: 'Search tasks' })).not.toBeInTheDocument()
  })

  it('keeps All tasks free of summary counts and shows the selected category scope', () => {
    renderTasks([
      makeTask('Active work'),
      makeTask('Completed work', { completed: true }),
      makeTask('Home item', { category: 'Home' }),
    ])
    expect(screen.queryByRole('group', { name: /total, .*active/ })).not.toBeInTheDocument()
    chooseCategoryFromDashboard('Work')
    expect(screen.getByText('1 task left')).toBeInTheDocument()
  })

  it('edits task details, plain-text notes, and an independent checklist', () => {
    const task = makeTask('Release notes', { dueDate: dateKey() })
    renderTasks([task])
    vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValueOnce('subtask-1').mockReturnValueOnce('subtask-2') })
    expect(screen.queryByRole('img', { name: /checklist items completed/ })).not.toBeInTheDocument()
    openTaskDetails(task.title)

    const dialog = screen.getByRole('dialog', { name: 'Task details' })
    const title = within(dialog).getByRole('textbox', { name: 'Task name' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('region', { name: 'Your task list' })).toHaveAttribute('inert')
    expect(title).toHaveFocus()

    fireEvent.change(title, { target: { value: 'Release notes updated' } })
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Category' }), { target: { value: 'Home' } })
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Priority' }), { target: { value: 'High' } })
    selectDueDate(dialog, dateKey(2))
    const notes = 'First line\n<script>alert(1)</script>\nLast line'
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Notes/ }), { target: { value: notes } })
    expect(within(dialog).getByText('No checklist items yet.')).toBeInTheDocument()
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'New checklist item' }), { target: { value: 'Draft outline' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add item' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Complete checklist item “Draft outline”' }))
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Checklist item 1' }), { target: { value: 'Updated outline' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'New checklist item' }), { target: { value: 'Review draft' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add item' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Complete checklist item “Review draft”' }))
    expect(within(dialog).getByRole('status')).toHaveTextContent('2 of 2 completed')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save task details' }))
    const updatedTask = (JSON.parse(localStorage.getItem(tasksStorageKey) || '[]') as Task[])[0]
    expect(updatedTask).toMatchObject({
      id: task.id,
      title: 'Release notes updated',
      completed: false,
      category: 'Home',
      priority: 'High',
      dueDate: dateKey(2),
      createdAt: task.createdAt,
      notes,
      subtasks: [
        { id: expect.any(String), title: 'Updated outline', completed: true },
        { id: expect.any(String), title: 'Review draft', completed: true },
      ],
    })
    expect(screen.getByRole('img', { name: '2 of 2 checklist items completed' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Complete “Release notes updated”' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByText('alert(1)', { exact: true })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Complete “Release notes updated”' }))
    expect(screen.getByRole('button', { name: 'Restore “Release notes updated”' })).toHaveAttribute('aria-pressed', 'true')
    expect((JSON.parse(localStorage.getItem(tasksStorageKey) || '[]') as Task[])[0].subtasks?.[0].completed).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Restore “Release notes updated”' }))

    openTaskDetails('Release notes updated')
    const reopenedDialog = screen.getByRole('dialog', { name: 'Task details' })
    expect(within(reopenedDialog).getByRole('textbox', { name: /Notes/ })).toHaveValue(notes)
    fireEvent.change(within(reopenedDialog).getByRole('textbox', { name: /Notes/ }), { target: { value: '' } })
    fireEvent.click(within(reopenedDialog).getByRole('button', { name: 'Restore checklist item “Updated outline”' }))
    fireEvent.click(within(reopenedDialog).getByRole('button', { name: 'Delete checklist item “Review draft”' }))
    expect(within(reopenedDialog).getByRole('status')).toHaveTextContent('0 of 1 completed')
    fireEvent.click(within(reopenedDialog).getByRole('button', { name: 'Save task details' }))
    const finalTask = (JSON.parse(localStorage.getItem(tasksStorageKey) || '[]') as Task[])[0]
    expect(finalTask.notes).toBe('')
    expect(finalTask.subtasks).toEqual([{ ...updatedTask.subtasks?.[0], completed: false }])
  })

  it('cancels task detail drafts and restores focus without writing', () => {
    const task = makeTask('Keep original')
    renderTasks([task])
    const originalStorage = localStorage.getItem(tasksStorageKey)
    const trigger = screen.getByRole('button', { name: 'Open details for “Keep original”' })
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Task details' })
    const title = within(dialog).getByRole('textbox', { name: 'Task name' })
    fireEvent.change(title, { target: { value: 'Unsaved title' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Notes/ }), { target: { value: 'Unsaved note' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'New checklist item' }), { target: { value: 'Unsaved checklist item' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add item' }))

    const closeButton = within(dialog).getByRole('button', { name: 'Close task details' })
    closeButton.focus()
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(within(dialog).getByRole('button', { name: 'Save task details' })).toHaveFocus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(closeButton).toHaveFocus()
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(screen.getByText('Keep original', { exact: true })).toBeInTheDocument()
    expect(localStorage.getItem(tasksStorageKey)).toBe(originalStorage)
  })

  it('restores notes and subtasks when a task with details is undone', () => {
    renderTasks([makeTask('Task with details', { notes: 'Keep this context' })])
    openTaskDetails('Task with details')
    const dialog = screen.getByRole('dialog', { name: 'Task details' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'New checklist item' }), { target: { value: 'Call supplier' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add item' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save task details' }))

    fireEvent.click(screen.getByRole('button', { name: 'Delete “Task with details”' }))
    expect(screen.queryByText('Task with details', { exact: true })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    openTaskDetails('Task with details')

    const restoredDialog = screen.getByRole('dialog', { name: 'Task details' })
    expect(within(restoredDialog).getByRole('textbox', { name: /Notes/ })).toHaveValue('Keep this context')
    expect(within(restoredDialog).getByRole('textbox', { name: 'Checklist item 1' })).toHaveValue('Call supplier')
  })

  it('shows tasks in the clean list without exposing planner controls', () => {
    renderTasks([makeTask('Insurance task', { dueDate: dateKey() })])
    expect(screen.getByText('Insurance task', { exact: true })).toBeInTheDocument()
    expect(screen.queryByRole('searchbox', { name: 'Search tasks' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Filter tasks' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Sort tasks' })).not.toBeInTheDocument()
    expect(document.querySelector('.add-task-fab')).toBeNull()
  })

  it('hides favorite actions in calendar and clean lists while keeping them in category lists', () => {
    const task = makeTask('Favorite calendar task', { dueDate: dateKey() })
    renderTasks([task, makeTask('Another task', { dueDate: dateKey() })])

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Calendar' }))
    const calendarDayPanel = screen.getByRole('main', { name: 'Daymark calendar' }).querySelector<HTMLElement>('.calendar-day-panel')
    if (!calendarDayPanel) throw new Error('Calendar day panel was not rendered')
    expect(within(calendarDayPanel).getByText('Favorite calendar task', { exact: true })).toBeInTheDocument()
    expect(within(calendarDayPanel).queryByRole('button', { name: 'Add “Favorite calendar task” to favorites' })).not.toBeInTheDocument()

    openDashboard()
    openAllTasksFromDashboard()
    expect(screen.queryByRole('button', { name: 'Add “Favorite calendar task” to favorites' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit “Favorite calendar task”' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete “Favorite calendar task”' })).toBeInTheDocument()

    chooseCategoryFromDashboard('Work')
    fireEvent.click(screen.getByRole('button', { name: 'Add “Favorite calendar task” to favorites' }))
    expect(JSON.parse(localStorage.getItem(tasksStorageKey) || '[]')).toEqual([
      expect.objectContaining({ id: task.id, favorite: true }),
      expect.objectContaining({ title: 'Another task', favorite: false }),
    ])

    expect(screen.getByRole('button', { name: 'Remove “Favorite calendar task” from favorites' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('uses the calendar empty-state action instead of a duplicate floating add button', () => {
    renderTasks()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Calendar' }))

    const calendar = screen.getByRole('main', { name: 'Daymark calendar' })
    expect(within(calendar).getByRole('button', { name: 'Plan this day' })).toBeInTheDocument()
    expect(within(calendar).queryByRole('button', { name: 'Add a task' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Your task list' })).queryByRole('button', { name: 'Add a task' })).not.toBeInTheDocument()

    fireEvent.click(within(calendar).getByRole('button', { name: 'Plan this day' }))
    expect(screen.getByRole('dialog', { name: 'Create New Task' })).toBeInTheDocument()
  })

  it('creates a due-today reminder once on open and persists the read state', () => {
    const task = makeTask('Reminder on open', { dueDate: dateKey() })
    renderTasks([task])

    const reminderKey = 'daymark.due-notifications.v1'
    const created = JSON.parse(localStorage.getItem(reminderKey) || '[]')
    expect(created).toHaveLength(1)
    expect(created[0]).toEqual(expect.objectContaining({
      id: `${task.id}@${dateKey()}`,
      taskTitle: task.title,
      dueDate: dateKey(),
      read: false,
    }))

    fireEvent.click(within(screen.getByRole('region', { name: 'Task categories' })).getByRole('button', { name: /Notifications, 1 unread/ }))
    expect(screen.getByRole('button', { name: new RegExp(`Open task “${task.title}”`) })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Unread' }))
    expect(screen.getByRole('button', { name: new RegExp(`Open task “${task.title}”`) })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Notification settings' }))
    expect(screen.getByRole('main', { name: 'Notification settings' })).toBeInTheDocument()
    expect(screen.getByText('Due-today task reminders')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(reminderKey) || '[]')[0].read).toBe(false)
  })

  it('saves the browser-alert opt-out from notification settings', async () => {
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn() })
    renderTasks()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Profile' }))
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Notifications' }))
    fireEvent.click(screen.getByRole('button', { name: 'Notification settings' }))
    const browserAlertsSwitch = screen.getByRole('switch', { name: 'Push notifications' })
    expect(browserAlertsSwitch).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(browserAlertsSwitch)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(localStorage.getItem('daymark.browser-alerts.enabled.v1')).toBe('false')
    expect(await screen.findByRole('main', { name: 'Daymark reminders' })).toBeInTheDocument()
  })

  it('shows the Daymark empty reminder illustration for all and unread filters', () => {
    renderTasks()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Profile' }))
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Notifications' }))

    expect(screen.getByRole('heading', { name: 'No notifications yet' })).toBeInTheDocument()
    expect(document.querySelector('.notifications-empty-state img')).toHaveAttribute('src', '/daymark-empty-notifications.svg')
    fireEvent.click(screen.getByRole('tab', { name: 'Unread' }))
    expect(screen.getByRole('heading', { name: 'No unread notifications' })).toBeInTheDocument()
  })

  it('marks all reminders as read from the notification center', () => {
    const task = makeTask('Mark every reminder read', { dueDate: dateKey() })
    renderTasks([task])
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Notifications' }))

    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }))

    expect(JSON.parse(localStorage.getItem('daymark.due-notifications.v1') || '[]')[0].read).toBe(true)
    fireEvent.click(screen.getByRole('tab', { name: 'Unread' }))
    expect(screen.getByText('No unread notifications')).toBeInTheDocument()
  })

  it('shows completed and active Today tasks together without planner filters', () => {
    renderTasks([
      makeTask('Active parent', { dueDate: dateKey(), subtasks: [{ id: 'done-child', title: 'Done child', completed: true }] }),
      makeTask('Completed parent', { dueDate: dateKey(), completed: true, subtasks: [{ id: 'open-child', title: 'Open child', completed: false }] }),
    ])
    expect(screen.getByText('Active parent', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Completed parent', { exact: true })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Filter tasks' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear done' })).not.toBeInTheDocument()
  })

  it('keeps completed Today tasks inline without the clear-completed control', () => {
    renderTasks([
      makeTask('Active task', { dueDate: dateKey() }),
      makeTask('Completed task', { dueDate: dateKey(), completed: true }),
    ])

    expect(screen.queryByRole('button', { name: 'Clear done' })).not.toBeInTheDocument()
    expect(screen.getByText('Completed task', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Active task', { exact: true })).toBeInTheDocument()
  })

  it('does not overwrite malformed stored tasks when the user continues in memory', () => {
    const malformed = '{not valid JSON'
    localStorage.setItem(tasksStorageKey, malformed)
    localStorage.setItem(categoryStorageKey, 'Work')
    sessionStorage.setItem(splashStorageKey, 'seen')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    render(<App />)
    expect(screen.getByText(/Saved tasks couldn't be loaded/)).toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: 'n' })
    fireEvent.change(screen.getByRole('textbox', { name: 'Task name' }), { target: { value: 'Continue offline' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }))

    expect(localStorage.getItem(tasksStorageKey)).toBe(malformed)
    expect(setItem.mock.calls.filter(([key]) => key === tasksStorageKey)).toHaveLength(0)
  })

  it('surfaces save failures and retries the current in-memory task list', () => {
    const task = makeTask('Retry persistence')
    renderTasks([task])
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Complete “Retry persistence”' }))
    expect(screen.getByText(/Changes couldn't be saved/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restore “Retry persistence”' })).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem(tasksStorageKey)).toBe(JSON.stringify([task]))

    fireEvent.click(screen.getByRole('button', { name: 'Retry save' }))
    expect(JSON.parse(localStorage.getItem(tasksStorageKey) || '[]')).toEqual([{
      ...task,
      completed: true,
      updatedAt: expect.any(Number),
      notes: '',
      subtasks: [],
      favorite: false,
    }])
    expect(screen.queryByRole('button', { name: 'Retry save' })).not.toBeInTheDocument()
  })
})