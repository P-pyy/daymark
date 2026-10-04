import { useState, type FormEvent } from 'react'
import { BookOpen, Briefcase, HouseLine, Plus, User, X } from '@phosphor-icons/react'
import { categories, type Category, type Priority } from './taskTypes'

const categoryIcons = {
  Work: Briefcase,
  Personal: User,
  Home: HouseLine,
  Learning: BookOpen,
}

interface TaskComposerProps {
  onAdd: (title: string, priority: Priority, dueDate: string, category: Category) => void
  onClose?: () => void
  initialCategory?: Category
  initialDueDate?: string
}

export function TaskComposer({ onAdd, onClose, initialCategory = 'Work', initialDueDate = '' }: TaskComposerProps) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority>('Normal')
  const [dueDate, setDueDate] = useState(initialDueDate)
  const [category, setCategory] = useState<Category>(initialCategory)

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return
    onAdd(trimmedTitle, priority, dueDate, category)
    setTitle('')
  }

  return (
    <form className="task-composer" onSubmit={submitTask}>
      <div className="composer-title-row">
        <div className="composer-heading-group">
          <h2 className="composer-heading" id="composer-heading">Create New Task</h2>
          <span className="composer-badge">Quick Add</span>
        </div>
        {onClose && (
          <button className="composer-close" type="button" aria-label="Close add task form" onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="composer-input-row">
        <label className="sr-only" htmlFor="new-task-title">Task name</label>
        <input
          id="new-task-title"
          className="composer-title-input"
          type="text"
          name="task-title"
          autoFocus
          autoComplete="off"
          maxLength={160}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g., Review project proposal with team"
          required
        />
      </div>
      <div className="composer-options">
        <fieldset className="composer-choice-group">
          <legend>Category</legend>
          <div className="composer-pill-list category-pill-list">
            {categories.map((option) => {
              const Icon = categoryIcons[option]
              return (
                <button className={`composer-pill ${category === option ? 'is-selected' : ''}`} type="button" key={option} aria-pressed={category === option} onClick={() => setCategory(option)}>
                  <Icon size={16} weight="duotone" aria-hidden="true" />{option}
                </button>
              )
            })}
          </div>
        </fieldset>
        <fieldset className="composer-choice-group">
          <legend>Priority</legend>
          <div className="composer-pill-list priority-pill-list">
            {(['Low', 'Normal', 'High'] as const).map((option) => (
              <button className={`composer-pill priority-choice priority-${option.toLowerCase()} ${priority === option ? 'is-selected' : ''}`} type="button" key={option} aria-pressed={priority === option} onClick={() => setPriority(option)}>
                <span className={`priority-dot priority-${option.toLowerCase()}`} aria-hidden="true" />{option}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="composer-option date-option">
          <span>Due date</span>
          <input type="date" name="task-due-date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </label>
      </div>
      <div className="composer-footer">
        {onClose && <button className="composer-cancel" type="button" onClick={onClose}>Cancel</button>}
        <button className="add-task-button" type="submit" aria-label="Add task" disabled={!title.trim()}>
          <span>Add task</span><Plus size={19} weight="bold" aria-hidden="true" />
        </button>
      </div>
    </form>
  )
}