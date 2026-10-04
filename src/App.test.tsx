import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { type Category, type Task } from './taskTypes'

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
  fireEvent.click(within(screen.getByRole('region', { name: 'Task categories' })).getByRole('button', { name: /^Today/ }))
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
  fireEvent.click(within(screen.getByRole('region', { name: 'Task categories' })).getByRole('button', { name: 'Add a task' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'Manage' }))

    expect(screen.getByRole('main', { name: 'Daymark task planner' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No tasks yet' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Task categories' })).not.toBeInTheDocument()
  })

  it('opens Settings from the bottom navigation and updates the saved appearance preference', () => {
    renderTasks()

    const navigation = within(screen.getByRole('navigation', { name: 'Primary' }))
    expect(navigation.queryByRole('button', { name: /Theme/ })).not.toBeInTheDocument()
    const settingsButton = navigation.getByRole('button', { name: 'Settings' })
    fireEvent.click(settingsButton)

    const dialog = screen.getByRole('dialog', { name: 'Settings' })
    const darkOption = within(dialog).getByRole('radio', { name: /Dark/ })
    const systemOption = within(dialog).getByRole('radio', { name: /System/ })
    expect(systemOption).toBeChecked()
    expect(within(dialog).getByText(/sync to your account/)).toBeInTheDocument()
    expect(systemOption).toHaveFocus()
    fireEvent.click(darkOption)

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem(themeStorageKey)).toBe('dark')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument()
    expect(settingsButton).toHaveFocus()

    fireEvent.click(within(screen.getByRole('region', { name: 'Task categories' })).getByRole('button', { name: 'Switch to light theme' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(localStorage.getItem(themeStorageKey)).toBe('light')

    fireEvent.click(settingsButton)
    const reopenedDialog = screen.getByRole('dialog', { name: 'Settings' })
    fireEvent.click(within(reopenedDialog).getByRole('radio', { name: /System/ }))
    expect(localStorage.getItem(themeStorageKey)).toBeNull()
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })

  it('opens the profile from the dashboard avatar and explains missing account setup', () => {
    renderTasks()

    const profileButton = screen.getByRole('button', { name: 'Sign in with Google' })
    fireEvent.click(profileButton)

    const dialog = screen.getByRole('dialog', { name: 'Profile' })
    expect(within(dialog).getByRole('heading', { name: 'Profile setup is needed' })).toBeInTheDocument()
    expect(within(dialog).getByText(/Supabase project and Google sign-in configuration/)).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(profileButton).toHaveFocus()
  })

  it('opens the profile from Settings', () => {
    renderTasks()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Settings' }))

    const settingsDialog = screen.getByRole('dialog', { name: 'Settings' })
    fireEvent.click(within(settingsDialog).getByRole('button', { name: 'Connect Google account' }))

    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument()
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
    }])
    expect(screen.queryByRole('button', { name: 'Retry save' })).not.toBeInTheDocument()
  })
})