import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowLeft,
  Bell,
  BookOpenText,
  Briefcase,
  CalendarBlank,
  CalendarDots,
  Check,
  HouseLine,
  Sun,
  User,
  UserCircle,
} from '@phosphor-icons/react'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/500.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import './categories-concept.css'

const categories = [
  {
    name: 'Work',
    detail: 'Projects and plans',
    icon: Briefcase,
    color: 'work',
    tasks: [
      { title: 'Send the project outline', timing: 'Today' },
      { title: 'Review homepage notes', timing: 'Tomorrow' },
      { title: 'Plan next week', timing: 'This week' },
    ],
  },
  {
    name: 'Personal',
    detail: 'Time for yourself',
    icon: User,
    color: 'personal',
    tasks: [
      { title: 'Book a dentist appointment', timing: 'Today' },
      { title: 'Pick up a few groceries', timing: 'Tomorrow' },
    ],
  },
  {
    name: 'Home',
    detail: 'Little things at home',
    icon: HouseLine,
    color: 'home',
    tasks: [{ title: 'Water the balcony plants', timing: 'Today' }],
  },
  {
    name: 'Learning',
    detail: 'Ideas to explore',
    icon: BookOpenText,
    color: 'learning',
    tasks: [
      { title: 'Finish the next chapter', timing: 'Today' },
      { title: 'Practice Spanish', timing: 'This week' },
    ],
  },
] as const

type CategoryName = (typeof categories)[number]['name']

const allTasks = categories.flatMap((category) =>
  category.tasks.map((task, index) => ({
    ...task,
    id: `${category.name}-${index}`,
    category: category.name,
    color: category.color,
  })),
)

const navigation = [
  { label: 'Today', icon: Sun },
  { label: 'Calendar', icon: CalendarDots },
  { label: 'Notifications', icon: Bell },
  { label: 'Profile', icon: UserCircle },
]

export default function CategoriesConceptScreen() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryName | null>('Work')
  const [showCategories, setShowCategories] = useState(false)
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(() => new Set())
  const selected = categories.find((category) => category.name === selectedCategory)
  const activeTasks = selected
    ? allTasks.filter((task) => task.category === selected.name)
    : allTasks
  const remainingCount = activeTasks.filter((task) => !completedTasks.has(task.id)).length

  function toggleTask(taskId: string) {
    setCompletedTasks((current) => {
      const next = new Set(current)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  function openCategory(categoryName: CategoryName | null) {
    setSelectedCategory(categoryName)
    setShowCategories(false)
  }

  return (
    <main className="categories-concept-page">
      <header className={`categories-concept-header${showCategories ? '' : ' is-detail'}`}>
        <div className="categories-concept-topline">
          <button className="categories-concept-notifications" type="button" aria-label="Notifications">
            <Bell size={19} weight="duotone" aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>

        {showCategories ? (
          <div className="categories-concept-intro">
            <div>
              <p className="categories-concept-eyebrow">A place for every plan</p>
              <h1>Your categories</h1>
              <p className="categories-concept-subtitle">Little lists for all the things on your mind.</p>
            </div>
            <img src="/daymark-categories-mascot.svg" alt="" aria-hidden="true" />
          </div>
        ) : (
          <div className="categories-concept-detail-intro">
            <button className="categories-concept-back" type="button" onClick={() => setShowCategories(true)}>
              <ArrowLeft size={17} weight="bold" aria-hidden="true" />
              <span>All categories</span>
            </button>
            <div className="categories-concept-detail-title">
              {selected ? (
                <span className={`categories-concept-detail-icon category-${selected.color}`}>
                  <selected.icon size={24} weight="duotone" aria-hidden="true" />
                </span>
              ) : (
                <span className="categories-concept-detail-icon is-all">
                  <CalendarBlank size={24} weight="duotone" aria-hidden="true" />
                </span>
              )}
              <div>
                <p className="categories-concept-eyebrow">{selected?.detail ?? 'Everything on your list'}</p>
                <h1>{selected?.name ?? 'All tasks'}</h1>
                <p className="categories-concept-subtitle">
                  {remainingCount === 0 ? 'You’re all caught up.' : `${remainingCount} ${remainingCount === 1 ? 'task' : 'tasks'} left`}
                </p>
              </div>
            </div>
            <img src="/daymark-categories-mascot.svg" alt="" aria-hidden="true" />
          </div>
        )}
      </header>

      {showCategories ? (
        <section className="categories-concept-content" aria-labelledby="categories-concept-heading">
          <div className="categories-concept-section-heading">
            <div>
              <h2 id="categories-concept-heading">Your little lists</h2>
              <p>Choose a list to open its tasks.</p>
            </div>
            <span className="categories-concept-list-count">{categories.length} lists</span>
          </div>

          <div className="categories-concept-grid">
            {categories.map(({ name, detail, icon: Icon, color }) => {
              const count = allTasks.filter((task) => task.category === name && !completedTasks.has(task.id)).length
              return (
                <button
                  className={`categories-concept-card category-${color}`}
                  type="button"
                  key={name}
                  onClick={() => openCategory(name)}
                >
                  <span className="categories-concept-card-top">
                    <span className="categories-concept-icon"><Icon size={24} weight="duotone" aria-hidden="true" /></span>
                    <span className="categories-concept-count">{count}</span>
                  </span>
                  <span className="categories-concept-card-name">{name}</span>
                  <span className="categories-concept-card-detail">{detail}</span>
                  <span className="categories-concept-card-tasks">{count} {count === 1 ? 'task' : 'tasks'} left</span>
                </button>
              )
            })}
          </div>

          <button className="categories-concept-all-tasks" type="button" onClick={() => openCategory(null)}>
            <span className="categories-concept-all-icon" aria-hidden="true">
              <CalendarBlank size={20} weight="duotone" />
            </span>
            <span className="categories-concept-all-copy">
              <strong>All tasks</strong>
              <small>{allTasks.length} tasks across your lists</small>
            </span>
            <span className="categories-concept-all-link">View all</span>
          </button>
        </section>
      ) : (
        <section className="categories-concept-content categories-concept-task-content" aria-labelledby="categories-concept-task-heading">
          <div className="categories-concept-section-heading">
            <div>
              <h2 id="categories-concept-task-heading">{remainingCount === 0 ? 'All done for now' : 'Up next'}</h2>
              <p>{selected?.detail ?? 'A little progress goes a long way.'}</p>
            </div>
            <span className="categories-concept-list-count">{remainingCount} to do</span>
          </div>

          <div className="categories-concept-task-list">
            {activeTasks.length > 0 ? activeTasks.map((task) => {
              const isCompleted = completedTasks.has(task.id)
              return (
                <article className={`categories-concept-task${isCompleted ? ' is-complete' : ''}`} key={task.id}>
                  <button
                    className="categories-concept-task-check"
                    type="button"
                    aria-label={`${isCompleted ? 'Mark' : 'Complete'} ${task.title}`}
                    aria-pressed={isCompleted}
                    onClick={() => toggleTask(task.id)}
                  >
                    {isCompleted && <Check size={15} weight="bold" aria-hidden="true" />}
                  </button>
                  <div className="categories-concept-task-copy">
                    <strong>{task.title}</strong>
                    <span>{task.timing}</span>
                  </div>
                  {!selected && (
                    <span className={`categories-concept-task-category category-${task.color}`}>
                      {task.category}
                    </span>
                  )}
                </article>
              )
            }) : (
              <div className="categories-concept-empty">
                <span className="categories-concept-empty-icon" aria-hidden="true">
                  <Check size={22} weight="bold" />
                </span>
                <strong>Everything is checked off</strong>
                <span>Enjoy a little breathing room.</span>
              </div>
            )}
          </div>
        </section>
      )}

      <nav className="categories-concept-nav" aria-label="Primary">
        {navigation.map(({ label, icon: Icon }) => (
          <span className={`categories-concept-nav-item${label === 'Today' ? ' is-current' : ''}`} aria-current={label === 'Today' ? 'page' : undefined} key={label}>
            <Icon size={20} weight={label === 'Today' ? 'fill' : 'regular'} aria-hidden="true" />
            <small>{label}</small>
          </span>
        ))}
      </nav>
    </main>
  )
}

createRoot(document.getElementById('categories-concept-root')!).render(<CategoriesConceptScreen />)
