import { useState, type FormEvent } from 'react'
import { Check, Info, ListChecks, PencilSimple, Trash, X } from '@phosphor-icons/react'
import { categories, type Category, type Priority, type Task } from './taskTypes'
import { getDaysUntilDue, getTaskDueStatus } from './taskUtils'

interface TaskItemProps {
  task: Task
  onToggle: (task: Task) => void
  onUpdate: (task: Task) => void
  onDelete: (task: Task) => void
  onOpenDetails: (task: Task, trigger: HTMLButtonElement) => void
}

function formatDueDate(value: string, daysUntil: number | null) {
  if (daysUntil === 0) return 'Today'
  if (daysUntil === 1) return 'Tomorrow'
  if (daysUntil !== null && daysUntil > 1 && daysUntil <= 3) return `In ${daysUntil} days`

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

export function TaskItem({ task, onToggle, onUpdate, onDelete, onOpenDetails }: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [dueDate, setDueDate] = useState(task.dueDate)
  const [category, setCategory] = useState<Category>(task.category)
  const now = new Date()
  const dueInDays = getDaysUntilDue(task.dueDate, now)
  const dueStatus = getTaskDueStatus(task.dueDate, task.completed, now)
  const dueState = dueStatus === 'none'
    ? 'is-no-date'
    : dueStatus === 'completed'
      ? 'is-completed-due'
      : dueStatus === 'overdue'
        ? 'is-overdue'
        : dueStatus === 'today'
          ? 'is-due-today'
          : dueInDays !== null && dueInDays <= 3
            ? 'is-due-soon'
            : 'is-upcoming'
  const dueLabel = task.dueDate ? formatDueDate(task.dueDate, dueInDays) : 'No due date'
  const dueDescription = dueStatus === 'none'
    ? 'No due date'
    : dueStatus === 'completed'
      ? `${dueLabel} - completed`
      : dueStatus === 'overdue'
        ? `${dueLabel} - overdue`
        : dueStatus === 'today'
          ? `${dueLabel} - due today`
          : dueInDays !== null && dueInDays <= 3
            ? `${dueLabel} - due soon`
            : `${dueLabel} - upcoming`
  const subtasks = task.subtasks ?? []
  const completedSubtaskCount = subtasks.filter((subtask) => subtask.completed).length

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return
    onUpdate({ ...task, title: trimmedTitle, priority, dueDate, category })
    setIsEditing(false)
  }

  function cancelEdit() {
    setTitle(task.title)
    setPriority(task.priority)
    setDueDate(task.dueDate)
    setCategory(task.category)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <li className="task-row editing-row">
        <form className="edit-task-form" onSubmit={saveEdit}>
          <label className="sr-only" htmlFor={`edit-title-${task.id}`}>Task name</label>
          <input id={`edit-title-${task.id}`} className="edit-title-input" type="text" value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} required />
          <div className="edit-options">
            <label><span className="sr-only">Category</span><select value={category} onChange={(event) => setCategory(event.target.value as Category)}>{categories.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
            <label><span className="sr-only">Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}><option value="Low">Low</option><option value="Normal">Normal</option><option value="High">High</option></select></label>
            <label><span className="sr-only">Due date</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
            <div className="edit-actions">
              <button className="icon-button edit-save" type="submit" aria-label="Save task changes" title="Save changes"><Check size={17} weight="bold" aria-hidden="true" /></button>
              <button className="icon-button" type="button" aria-label="Cancel editing" title="Cancel" onClick={cancelEdit}><X size={17} aria-hidden="true" /></button>
            </div>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className={`task-row ${task.completed ? 'is-completed' : ''}`}>
      <button className="task-check" type="button" aria-label={`${task.completed ? 'Restore' : 'Complete'} “${task.title}”`} title={task.completed ? 'Restore task' : 'Complete task'} aria-pressed={task.completed} onClick={() => onToggle(task)}>
        {task.completed ? <Check size={13} weight="bold" aria-hidden="true" /> : <span className="checkbox-square" aria-hidden="true" />}
      </button>
      <div className="task-copy">
        <button className="task-title task-details-trigger" type="button" aria-label={`Open details for “${task.title}”`} title="Open task details" onClick={(event) => onOpenDetails(task, event.currentTarget)}>{task.title}<Info size={14} aria-hidden="true" /></button>
        <div className="task-metadata">
          <span className="task-category">{task.category}</span>
          <span className={`priority-label priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
          {subtasks.length > 0 && (
            <span className="checklist-progress" role="img" aria-label={`${completedSubtaskCount} of ${subtasks.length} checklist items completed`}>
              <ListChecks size={14} aria-hidden="true" />{completedSubtaskCount}/{subtasks.length}
            </span>
          )}
          {task.dueDate ? (
            <time className={`due-label ${dueState}`} dateTime={task.dueDate} aria-label={dueDescription} title={dueDescription}>
              {dueLabel}
            </time>
          ) : (
            <span className={`due-label ${dueState}`}>{dueLabel}</span>
          )}
        </div>
      </div>
      <div className="task-actions">
        <button className="icon-button" type="button" aria-label={`Edit “${task.title}”`} title="Edit task" onClick={() => setIsEditing(true)}><PencilSimple size={17} aria-hidden="true" /></button>
        <button className="icon-button delete-button" type="button" aria-label={`Delete “${task.title}”`} title="Delete task" onClick={() => onDelete(task)}><Trash size={17} aria-hidden="true" /></button>
      </div>
    </li>
  )
}