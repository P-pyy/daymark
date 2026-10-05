import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { categories, type Category, type Task } from './taskTypes'

vi.mock('./supabaseClient', () => ({ supabase: null }))

const tasksStorageKey = 'daymark.tasks.v1'
const categoryStorageKey = 'daymark.category.filter.v1'
const onboardingStorageKey = 'daymark.onboarding.complete.v1'
const splashStorageKey = 'daymark.splash.seen.v1'
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

function renderTasks(tasks: Task[] = [], category: Category | 'All' | 'Today' = 'All') {
  localStorage.setItem(tasksStorageKey, JSON.stringify(tasks))
  localStorage.setItem(categoryStorageKey, category)
  localStorage.setItem(onboardingStorageKey, 'complete')
  sessionStorage.setItem(splashStorageKey, 'seen')
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'created-task-id') })
  return render(<App />)
}

function startWelcome() {
  sessionStorage.setItem(splashStorageKey, 'seen')
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'created-task-id') })
  return render(<App />)
}

function openDashboard() {
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Today' }))
}

function chooseTodayCategory() {
  fireEvent.click(within(screen.getByRole('region', { name: 'Task categories' })).getByRole('button', { name: "View today's tasks" }))
}

function chooseCategoryFromDashboard(category: Category) {
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Categories' }))
  fireEvent.click(within(screen.getByRole('region', { name: 'Task categories' })).getByRole('button', { name: new RegExp(`^${category}`) }))
}

function openTaskComposer() {
  fireEvent.click(within(screen.getByRole('region', { name: 'Your task list' })).getByRole('button', { name: 'Add a task' }))
}

function openTaskDetails(title: string) {
  fireEvent.click(screen.getByRole('button', { name: `Open details for “${title}”` }))
}

function openDashboardComposer() {
  fireEvent.click(within(screen.getByRole('region', { name: 'Task categories' })).getByRole('button', { name: 'Plan a new thought or task...' }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Daymark task UI', () => {
  it('shows the welcome and empty task states without stored tasks', () => {
    startWelcome()

    expect(screen.getByRole('main', { name: 'Welcome to Daymark' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }))
    const categoryRegion = screen.getByRole('region', { name: 'Task categories' })
    expect(screen.queryByRole('region', { name: 'Morning focus ritual' })).not.toBeInTheDocument()
    expect(within(categoryRegion).getByRole('button', { name: /^Personal/ })).toBeInTheDocument()
    expect(within(categoryRegion).queryByRole('button', { name: 'Manage' })).not.toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Categories' }))

    expect(screen.getByRole('main', { name: 'Daymark task planner' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No tasks yet' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Task categories' })).not.toBeInTheDocument()
  })

  it('uses one primary add-task action on the Today dashboard', () => {
    renderTasks()
    openDashboard()

    const dashboard = screen.getByRole('region', { name: 'Task categories' })
    expect(within(dashboard).getByRole('button', { name: 'Plan a new thought or task...' })).toBeInTheDocument()
    expect(within(dashboard).getByRole('button', { name: "View today's tasks" })).toBeInTheDocument()
    expect(within(dashboard).getAllByRole('button', { name: /^(Work|Personal|Home|Learning)/ })).toHaveLength(categories.length)
    expect(within(dashboard).queryByRole('button', { name: 'Search tasks' })).not.toBeInTheDocument()
    expect(dashboard.querySelector('.quick-intake-submit')).toBeNull()
    expect(within(dashboard).queryByRole('button', { name: /^Today/ })).not.toBeInTheDocument()
    expect(within(dashboard).queryByRole('button', { name: 'Add a task' })).not.toBeInTheDocument()

    fireEvent.click(within(dashboard).getByRole('button', { name: 'Plan a new thought or task...' }))
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
      'Calendar',
      'Favorites',
      'Notifications',
      'Profile',
    ])
    fireEvent.change(appearanceSelect, { target: { value: 'dark' } })

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem(themeStorageKey)).toBe('dark')

    fireEvent.click(navigation.getByRole('button', { name: 'Favorites' }))
    const favoritesRegion = screen.getByRole('region', { name: 'Favorite tasks' })
    const favoritesThemeToggle = favoritesRegion.querySelector<HTMLButtonElement>('.tasks-screen .theme-toggle')
    expect(favoritesThemeToggle).not.toBeNull()
    if (!favoritesThemeToggle) throw new Error('The Favorites screen theme toggle is missing.')
    fireEvent.click(favoritesThemeToggle)
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(localStorage.getItem(themeStorageKey)).toBe('light')

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Profile' }))
    const settingsNavigation = within(screen.getByRole('navigation', { name: 'Primary' }))
    fireEvent.click(settingsNavigation.getByRole('button', { name: 'Notifications' }))
    expect(screen.getByRole('main', { name: 'Daymark reminders' })).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Profile' }))
    fireEvent.change(within(screen.getByRole('main', { name: 'Your Daymark profile' })).getByRole('combobox', { name: 'Appearance' }), { target: { value: 'system' } })
    expect(localStorage.getItem(themeStorageKey)).toBeNull()
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })

  it('applies the selected language across navigation, calendar, and task forms', () => {
    renderTasks()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Profile' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'fil' } })

    expect(document.documentElement).toHaveAttribute('lang', 'fil')
    const navigation = screen.getByRole('navigation', { name: 'Pangunahing nabigasyon' })
    fireEvent.click(within(navigation).getByRole('button', { name: 'Kalendaryo' }))
    expect(screen.getByRole('heading', { name: 'Kalendaryo mo' })).toBeInTheDocument()
    const calendarRegion = screen.getByRole('region', { name: 'Kalendaryo mo' })
    fireEvent.click(within(calendarRegion).getAllByRole('button', { name: 'Magdagdag ng gawain' })[0])

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
    const closeButton = within(dialog).getByRole('button', { name: 'Close add task form' })
    const trigger = within(screen.getByRole('region', { name: 'Your task list' })).getByRole('button', { name: 'Add a task' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('region', { name: 'Your task list' })).toHaveAttribute('inert')
    expect(screen.getByRole('navigation', { name: 'Primary' })).toHaveAttribute('inert')
    expect(titleInput).toHaveFocus()

    fireEvent.change(titleInput, { target: { value: 'Focus check' } })
    closeButton.focus()
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(addButton).toHaveFocus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(closeButton).toHaveFocus()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('creates a task from the composer with the existing schema and Today default date', () => {
    startWelcome()
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }))
    openDashboardComposer()

    const dialog = screen.getByRole('dialog', { name: 'Create New Task' })
    expect(within(dialog).getByLabelText('Due date')).toHaveValue(dateKey())
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
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: dateKey(1) } })
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

  it('filters Today by local due date and preserves All/Active/Done semantics', () => {
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
    chooseTodayCategory()
    expect(screen.getByRole('heading', { name: 'Today', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Active today', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Completed today', { exact: true })).toBeInTheDocument()
    const dueToday = screen.getByLabelText('Today - due today')
    expect(dueToday.tagName).toBe('TIME')
    expect(dueToday).toHaveAttribute('dateTime', dateKey())
    expect(screen.queryByText('Undated', { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByText('Future', { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByText('Past', { exact: true })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Active' }))
    expect(screen.getByText('Active today', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Completed today', { exact: true })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Done/ }))
    expect(screen.getByText('Completed today', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Active today', { exact: true })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Categories' }))
    for (const title of ['Active today', 'Completed today', 'Undated', 'Future', 'Past']) {
      expect(screen.getByText(title, { exact: true })).toBeInTheDocument()
    }
  })

  it('filters by category from the dashboard and searches title/category case-insensitively', () => {
    const tasks = [
      makeTask('Review planning', { category: 'Work' }),
      makeTask('Read handbook', { category: 'Personal' }),
      makeTask('Tidy entryway', { category: 'Home' }),
    ]
    renderTasks(tasks)
    openDashboard()
    fireEvent.click(within(screen.getByRole('region', { name: 'Task categories' })).getByRole('button', { name: /^Personal/ }))
    expect(screen.getByRole('heading', { name: 'Personal' })).toBeInTheDocument()
    expect(screen.getByText('Read handbook', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Review planning', { exact: true })).not.toBeInTheDocument()

    chooseCategoryFromDashboard('Home')
    expect(screen.getByText('Tidy entryway', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Read handbook', { exact: true })).not.toBeInTheDocument()
    chooseCategoryFromDashboard('Work')
    expect(screen.getByText('Review planning', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Tidy entryway', { exact: true })).not.toBeInTheDocument()

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Categories' }))
    const search = screen.getByRole('searchbox', { name: 'Search tasks' })
    fireEvent.change(search, { target: { value: 'HANDBOOK' } })
    expect(screen.getByText('Read handbook', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Review planning', { exact: true })).not.toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'personal' } })
    expect(screen.getByText('Read handbook', { exact: true })).toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'no such task' } })
    expect(screen.getByRole('heading', { name: 'No tasks match your search' })).toBeInTheDocument()
  })

  it('combines search with the selected category and status filters', () => {
    renderTasks([
      makeTask('Prepare outline'),
      makeTask('Prepare report', { completed: true }),
      makeTask('Prepare groceries', { category: 'Home' }),
    ])
    openDashboard()
    fireEvent.click(within(screen.getByRole('region', { name: 'Task categories' })).getByRole('button', { name: /^Work/ }))

    const search = screen.getByRole('searchbox', { name: 'Search tasks' })
    expect(search).toHaveValue('')
    expect(screen.getByText('Prepare outline', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Prepare report', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Prepare groceries', { exact: true })).not.toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'PREPARE' } })
    expect(screen.getByText('Prepare outline', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Prepare report', { exact: true })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Active' }))
    expect(screen.getByText('Prepare outline', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Prepare report', { exact: true })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Done/ }))
    expect(screen.getByText('Prepare report', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Prepare outline', { exact: true })).not.toBeInTheDocument()
    fireEvent.change(search, { target: { value: '' } })
    expect(screen.getByText('Prepare report', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Prepare outline', { exact: true })).not.toBeInTheDocument()
  })

  it('sorts filtered tasks in the selected order without changing stored task records', () => {
    const tasks = [
      makeTask('Later work', { createdAt: 10, dueDate: dateKey(2) }),
      makeTask('Earlier work', { createdAt: 20, dueDate: dateKey(-1) }),
      makeTask('Done work', { createdAt: 30, dueDate: dateKey(-2), completed: true }),
      makeTask('Home task', { createdAt: 40, dueDate: dateKey(-5), category: 'Home' }),
      makeTask('Undated work', { createdAt: 50 }),
    ]
    renderTasks(tasks)
    const storedTasks = localStorage.getItem(tasksStorageKey)
    const sort = screen.getByRole('combobox', { name: 'Sort tasks' })

    expect(sort).toHaveValue('newest')
    expectTaskListOrder(['Undated work', 'Home task', 'Earlier work', 'Later work', 'Done work'])
    fireEvent.change(sort, { target: { value: 'due-date' } })
    expectTaskListOrder(['Home task', 'Earlier work', 'Later work', 'Undated work', 'Done work'])

    chooseCategoryFromDashboard('Work')
    const search = screen.getByRole('searchbox', { name: 'Search tasks' })
    fireEvent.change(search, { target: { value: 'work' } })
    fireEvent.click(within(screen.getByRole('group', { name: 'Filter tasks' })).getByRole('button', { name: 'Active' }))
    expectTaskListOrder(['Earlier work', 'Later work', 'Undated work'])

    fireEvent.click(within(screen.getByRole('group', { name: 'Filter tasks' })).getByRole('button', { name: /^Done/ }))
    expectTaskListOrder(['Done work'])
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

  it('focuses task search with slash and ignores N while a select or search input is focused', () => {
    renderTasks()
    fireEvent.keyDown(document.body, { key: '/' })
    const search = screen.getByRole('searchbox', { name: 'Search tasks' })
    expect(search).toHaveFocus()
    fireEvent.keyDown(search, { key: 'n' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const sort = screen.getByRole('combobox', { name: 'Sort tasks' })
    sort.focus()
    fireEvent.keyDown(sort, { key: 'n' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(sort).toHaveFocus()
  })

  it('shows context-specific empty states and accurate scoped counts', () => {
    renderTasks()
    expect(screen.getByRole('heading', { name: 'No tasks yet' })).toBeInTheDocument()

    openDashboard()
    chooseTodayCategory()
    expect(screen.getByRole('heading', { name: 'No tasks due today' })).toBeInTheDocument()
    chooseCategoryFromDashboard('Work')
    expect(screen.getByRole('heading', { name: 'No tasks in Work' })).toBeInTheDocument()

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Categories' }))
    fireEvent.click(within(screen.getByRole('group', { name: 'Filter tasks' })).getByRole('button', { name: 'Active' }))
    expect(screen.getByRole('heading', { name: 'No active tasks' })).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('group', { name: 'Filter tasks' })).getByRole('button', { name: /^Done/ }))
    expect(screen.getByRole('heading', { name: 'No completed tasks' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tasks' }), { target: { value: 'nothing' } })
    expect(screen.getByRole('heading', { name: 'No tasks match your search' })).toBeInTheDocument()
  })

  it('shows total, active, and completed counts for the selected category scope', () => {
    renderTasks([
      makeTask('Active work'),
      makeTask('Completed work', { completed: true }),
      makeTask('Home item', { category: 'Home' }),
    ])
    expect(screen.getByRole('group', { name: '3 total, 2 active, 1 completed' })).toBeInTheDocument()
    chooseCategoryFromDashboard('Work')
    expect(screen.getByRole('group', { name: '2 total, 1 active, 1 completed' })).toBeInTheDocument()
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
    fireEvent.change(within(dialog).getByLabelText('Due date'), { target: { value: dateKey(2) } })
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

  it('searches task notes and subtask titles, but not subtask IDs', () => {
    renderTasks([makeTask('Insurance task', {
      notes: 'Renew coverage in November',
      subtasks: [{ id: 'secret-subtask-id', title: 'Call the broker', completed: false }],
    })])
    const search = screen.getByRole('searchbox', { name: 'Search tasks' })

    fireEvent.change(search, { target: { value: 'coverage' } })
    expect(screen.getByText('Insurance task', { exact: true })).toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'CALL THE BROKER' } })
    expect(screen.getByText('Insurance task', { exact: true })).toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'secret-subtask-id' } })
    expect(screen.getByRole('heading', { name: 'No tasks match your search' })).toBeInTheDocument()
  })

  it('shows dated tasks on the calendar and filters favorites in the task list', () => {
    const task = makeTask('Favorite calendar task', { dueDate: dateKey() })
    renderTasks([task, makeTask('Another task')])

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Calendar' }))
    const calendarDayPanel = screen.getByRole('main', { name: 'Daymark calendar' }).querySelector<HTMLElement>('.calendar-day-panel')
    if (!calendarDayPanel) throw new Error('Calendar day panel was not rendered')
    expect(within(calendarDayPanel).getByText('Favorite calendar task', { exact: true })).toBeInTheDocument()

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Categories' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add “Favorite calendar task” to favorites' }))
    expect(JSON.parse(localStorage.getItem(tasksStorageKey) || '[]')).toEqual([
      expect.objectContaining({ id: task.id, favorite: true }),
      expect.objectContaining({ title: 'Another task', favorite: false }),
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Favorites' }))
    const favoritesRegion = screen.getByRole('region', { name: 'Favorite tasks' })
    expect(within(favoritesRegion).getByText('Favorite calendar task', { exact: true })).toBeInTheDocument()
    expect(within(favoritesRegion).queryByText('Another task', { exact: true })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Favorites' }))
    expect(screen.getByRole('region', { name: 'Your task list' })).toBeInTheDocument()
    expect(screen.getByText('Another task', { exact: true })).toBeInTheDocument()
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

  it('keeps Today and status filters based on parent task fields', () => {
    renderTasks([
      makeTask('Active parent', { dueDate: dateKey(), subtasks: [{ id: 'done-child', title: 'Done child', completed: true }] }),
      makeTask('Completed parent', { dueDate: dateKey(1), completed: true, subtasks: [{ id: 'open-child', title: 'Open child', completed: false }] }),
    ])
    openDashboard()
    chooseTodayCategory()
    expect(screen.getByText('Active parent', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Completed parent', { exact: true })).not.toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('group', { name: 'Filter tasks' })).getByRole('button', { name: 'Active' }))
    expect(screen.getByText('Active parent', { exact: true })).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Categories' }))
    fireEvent.click(within(screen.getByRole('group', { name: 'Filter tasks' })).getByRole('button', { name: /^Done/ }))
    expect(screen.getByText('Completed parent', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Active parent', { exact: true })).not.toBeInTheDocument()
  })

  it('clear-completed confirmation removes completed tasks and keeps active tasks', () => {
    renderTasks([
      makeTask('Active task'),
      makeTask('Completed task', { completed: true }),
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Clear done' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Remove 1 completed task?')
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Keep' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Completed task', { exact: true })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear done' }))
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Clear' }))

    expect(screen.getByText('Active task', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Completed task', { exact: true })).not.toBeInTheDocument()
  })

  it('does not overwrite malformed stored tasks when the user continues in memory', () => {
    const malformed = '{not valid JSON'
    localStorage.setItem(tasksStorageKey, malformed)
    localStorage.setItem(categoryStorageKey, 'Work')
    localStorage.setItem(onboardingStorageKey, 'complete')
    sessionStorage.setItem(splashStorageKey, 'seen')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    render(<App />)
    expect(screen.getByText(/Saved tasks couldn't be loaded/)).toBeInTheDocument()
    openTaskComposer()
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