import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Check, Plus, Trash, X } from '@phosphor-icons/react'
import { categories, MAX_SUBTASK_TITLE_LENGTH, MAX_TASK_NOTES_LENGTH, type Category, type Priority, type Subtask, type Task } from './taskTypes'

interface TaskDetailsDialogProps {
  task: Task
  onSave: (task: Task) => void
  onClose: () => void
}

export function TaskDetailsDialog({ task, onSave, onClose }: TaskDetailsDialogProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const [title, setTitle] = useState(task.title)
  const [category, setCategory] = useState<Category>(task.category)
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [dueDate, setDueDate] = useState(task.dueDate)
  const [notes, setNotes] = useState(task.notes ?? '')
  const [subtasks, setSubtasks] = useState<Subtask[]>(() => (task.subtasks ?? []).map((subtask) => ({ ...subtask })))
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const completedSubtasks = subtasks.filter((subtask) => subtask.completed).length

  useEffect(() => {
    const handleKeydown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return
      const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ))
      if (focusableElements.length === 0) {
        event.preventDefault()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const focusIsOutsideDialog = !dialog.contains(document.activeElement)
      if (event.shiftKey && (document.activeElement === firstElement || focusIsOutsideDialog)) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && (document.activeElement === lastElement || focusIsOutsideDialog)) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [onClose])

  function addSubtask() {
    const trimmedTitle = newSubtaskTitle.trim()
    if (!trimmedTitle) return
    setSubtasks((current) => [...current, {
      id: crypto.randomUUID(),
      title: trimmedTitle,
      completed: false,
    }])
    setNewSubtaskTitle('')
  }

  function handleNewSubtaskKeydown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    addSubtask()
  }

  function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle || subtasks.some((subtask) => !subtask.title.trim())) return

    onSave({
      ...task,
      title: trimmedTitle,
      category,
      priority,
      dueDate,
      notes,
      subtasks: subtasks.map((subtask) => ({ ...subtask, title: subtask.title.trim() })),
    })
    onClose()
  }

  return (
    <div className="composer-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} className="composer-sheet task-details-sheet" role="dialog" aria-modal="true" aria-labelledby="task-details-heading">
        <form className="task-details-form" onSubmit={saveDetails}>
          <div className="composer-title-row">
            <div className="composer-heading-group">
              <h2 className="composer-heading" id="task-details-heading">Task details</h2>
              <span className="composer-badge">{task.title}</span>
            </div>
            <button className="composer-close" type="button" aria-label="Close task details" onClick={onClose}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <label className="details-field">
            <span>Task name</span>
            <input autoFocus type="text" maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>

          <div className="details-options">
            <label className="details-field">
              <span>Category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value as Category)}>
                {categories.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="details-field">
              <span>Priority</span>
              <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
                <option value="Low">Low</option>
                <option value="Normal">Normal</option>
                <option value="High">High</option>
              </select>
            </label>
            <label className="details-field details-date-field">
              <span>Due date</span>
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </label>
          </div>

          <label className="details-field notes-field">
            <span>Notes <small>(optional, {MAX_TASK_NOTES_LENGTH} characters max)</small></span>
            <textarea maxLength={MAX_TASK_NOTES_LENGTH} value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
          </label>

          <section className="task-checklist" aria-labelledby="task-checklist-heading">
            <div className="task-checklist-heading">
              <h3 id="task-checklist-heading">Checklist</h3>
              {subtasks.length > 0 && (
                <span role="status" aria-live="polite">{completedSubtasks} of {subtasks.length} completed</span>
              )}
            </div>
            {subtasks.length > 0 ? (
              <ul className="task-subtask-list">
                {subtasks.map((subtask, index) => (
                  <li className={`task-subtask-row ${subtask.completed ? 'is-completed' : ''}`} key={subtask.id}>
                    <button
                      className="task-subtask-check"
                      type="button"
                      aria-label={`${subtask.completed ? 'Restore' : 'Complete'} checklist item “${subtask.title}”`}
                      aria-pressed={subtask.completed}
                      onClick={() => setSubtasks((current) => current.map((item) => item.id === subtask.id ? { ...item, completed: !item.completed } : item))}
                    >
                      {subtask.completed && <Check size={14} weight="bold" aria-hidden="true" />}
                    </button>
                    <label className="sr-only" htmlFor={`subtask-title-${task.id}-${subtask.id}`}>Checklist item {index + 1}</label>
                    <input
                      id={`subtask-title-${task.id}-${subtask.id}`}
                      className="task-subtask-title"
                      type="text"
                      maxLength={MAX_SUBTASK_TITLE_LENGTH}
                      value={subtask.title}
                      onChange={(event) => setSubtasks((current) => current.map((item) => item.id === subtask.id ? { ...item, title: event.target.value } : item))}
                      required
                    />
                    <button
                      className="icon-button delete-button task-subtask-delete"
                      type="button"
                      aria-label={`Delete checklist item “${subtask.title}”`}
                      title="Delete checklist item"
                      onClick={() => setSubtasks((current) => current.filter((item) => item.id !== subtask.id))}
                    >
                      <Trash size={16} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="task-checklist-empty">No checklist items yet.</p>
            )}

            <div className="task-subtask-add">
              <label className="sr-only" htmlFor={`new-subtask-${task.id}`}>New checklist item</label>
              <input
                id={`new-subtask-${task.id}`}
                type="text"
                maxLength={MAX_SUBTASK_TITLE_LENGTH}
                value={newSubtaskTitle}
                onChange={(event) => setNewSubtaskTitle(event.target.value)}
                onKeyDown={handleNewSubtaskKeydown}
                placeholder="Add a checklist item"
              />
              <button className="subtask-add-button" type="button" disabled={!newSubtaskTitle.trim()} onClick={addSubtask}>
                <Plus size={17} aria-hidden="true" />Add item
              </button>
            </div>
          </section>

          <div className="composer-footer">
            <button className="composer-cancel" type="button" onClick={onClose}>Cancel</button>
            <button className="add-task-button" type="submit" aria-label="Save task details">
              <span>Save changes</span><Check size={18} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}