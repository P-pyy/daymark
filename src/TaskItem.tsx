import { useState, type FormEvent } from 'react'
import { Check, Heart, Info, ListChecks, PencilSimple, Trash, X } from '@phosphor-icons/react'
import { categories, type Category, type Priority, type Task } from './taskTypes'
import { getDaysUntilDue, getTaskDueStatus } from './taskUtils'
import { useLocale } from './locale'

interface TaskItemProps {
  task: Task
  onToggle: (task: Task) => void
  onToggleFavorite: (task: Task) => void
  onUpdate: (task: Task) => void
  onDelete: (task: Task) => void
  onOpenDetails: (task: Task, trigger: HTMLButtonElement) => void
}

function formatDueDate(value: string, daysUntil: number | null, locale: string, t: (text: string) => string) {
  if (daysUntil === 0) return t('Today')
  if (daysUntil === 1) return t('Tomorrow')
  if (daysUntil !== null && daysUntil > 1 && daysUntil <= 3) return `${t('In')} ${daysUntil} ${t('days')}`

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date)
}

export function TaskItem({ task, onToggle, onToggleFavorite, onUpdate, onDelete, onOpenDetails }: TaskItemProps) {
  const { language, translate: t } = useLocale()
  const intlLocale = language === 'fil' ? 'fil-PH' : 'en'
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
  const dueLabel = task.dueDate ? formatDueDate(task.dueDate, dueInDays, intlLocale, t) : t('No due date')
  const dueDescription = dueStatus === 'none'
    ? t('No due date')
    : dueStatus === 'completed'
      ? `${dueLabel} - ${t('completed')}`
      : dueStatus === 'overdue'
        ? `${dueLabel} - ${t('overdue')}`
        : dueStatus === 'today'
          ? `${dueLabel} - ${t('due today')}`
          : dueInDays !== null && dueInDays <= 3
            ? `${dueLabel} - ${t('due soon')}`
            : `${dueLabel} - ${t('upcoming')}`
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
          <label className="sr-only" htmlFor={`edit-title-${task.id}`}>{t('Task name')}</label>
          <input id={`edit-title-${task.id}`} className="edit-title-input" type="text" value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} required />
          <div className="edit-options">
            <label><span className="sr-only">{t('Category')}</span><select value={category} onChange={(event) => setCategory(event.target.value as Category)}>{categories.map((option) => <option key={option} value={option}>{t(option)}</option>)}</select></label>
            <label><span className="sr-only">{t('Priority')}</span><select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}><option value="Low">{t('Low')}</option><option value="Normal">{t('Normal')}</option><option value="High">{t('High')}</option></select></label>
            <label><span className="sr-only">{t('Due date')}</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
            <div className="edit-actions">
              <button className="icon-button edit-save" type="submit" aria-label={t('Save task changes')} title={t('Save changes')}><Check size={17} weight="bold" aria-hidden="true" /></button>
              <button className="icon-button" type="button" aria-label={t('Cancel editing')} title={t('Cancel')} onClick={cancelEdit}><X size={17} aria-hidden="true" /></button>
            </div>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className={`task-row ${task.completed ? 'is-completed' : ''}`}>
      <button className="task-check" type="button" aria-label={`${t(task.completed ? 'Restore' : 'Complete')} “${task.title}”`} title={t(task.completed ? 'Restore task' : 'Complete task')} aria-pressed={task.completed} onClick={() => onToggle(task)}>
        {task.completed ? <Check size={13} weight="bold" aria-hidden="true" /> : <span className="checkbox-square" aria-hidden="true" />}
      </button>
      <div className="task-copy">
        <button className="task-title task-details-trigger" type="button" aria-label={`${t('Open details for')} “${task.title}”`} title={t('Open task details')} onClick={(event) => onOpenDetails(task, event.currentTarget)}>{task.title}<Info size={14} aria-hidden="true" /></button>
        <div className="task-metadata">
          <span className="task-category">{t(task.category)}</span>
          <span className={`priority-label priority-${task.priority.toLowerCase()}`}>{t(task.priority)}</span>
          {subtasks.length > 0 && (
            <span className="checklist-progress" role="img" aria-label={`${completedSubtaskCount} ${t('of')} ${subtasks.length} ${t('checklist items completed')}`}>
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
        <button
          className={`icon-button favorite-button ${task.favorite ? 'is-favorite' : ''}`}
          type="button"
          aria-label={`${t(task.favorite ? 'Remove' : 'Add')} “${task.title}” ${t(task.favorite ? 'from' : 'to')} ${t('favorites')}`}
          aria-pressed={Boolean(task.favorite)}
          title={t(task.favorite ? 'Remove from favorites' : 'Add to favorites')}
          onClick={() => onToggleFavorite(task)}
        >
          <Heart size={17} weight={task.favorite ? 'fill' : 'regular'} aria-hidden="true" />
        </button>
        <button className="icon-button" type="button" aria-label={`${t('Edit')} “${task.title}”`} title={t('Edit task')} onClick={() => setIsEditing(true)}><PencilSimple size={17} aria-hidden="true" /></button>
        <button className="icon-button delete-button" type="button" aria-label={`${t('Delete')} “${task.title}”`} title={t('Delete task')} onClick={() => onDelete(task)}><Trash size={17} aria-hidden="true" /></button>
      </div>
    </li>
  )
}