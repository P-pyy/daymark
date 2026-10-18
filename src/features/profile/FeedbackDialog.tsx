import { useEffect, useRef, useState } from 'react'
import type { FormEvent, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Bug, Languages, Lightbulb, MessageCircle } from 'lucide-react'
import { useLocale } from '../../shared/locale'

type FeedbackCategory = 'bug' | 'idea' | 'language' | 'other'

const feedbackCategories: { value: FeedbackCategory; label: string; Icon: typeof Bug }[] = [
  { value: 'bug', label: 'Bug', Icon: Bug },
  { value: 'idea', label: 'Idea', Icon: Lightbulb },
  { value: 'language', label: 'Language', Icon: Languages },
  { value: 'other', label: 'Other', Icon: MessageCircle },
]
const categoryLabels: Record<FeedbackCategory, string> = {
  bug: 'Bug',
  idea: 'Idea',
  language: 'Language',
  other: 'Other',
}

const feedbackIssueUrl = 'https://github.com/P-pyy/daymark/issues/new'

interface FeedbackDialogProps {
  onClose: () => void
  returnFocusRef: RefObject<HTMLButtonElement | null>
}

export function FeedbackDialog({ onClose, returnFocusRef }: FeedbackDialogProps) {
  const { translate: t } = useLocale()
  const dialogRef = useRef<HTMLElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState<FeedbackCategory>('bug')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [validationError, setValidationError] = useState('')
  const [draftOpened, setDraftOpened] = useState(false)
  const issueTitle = title.trim()
  const issueBody = `**${t('Category')}:** ${t(categoryLabels[category])}\n\n${message.trim()}`

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const returnFocusElement = returnFocusRef.current
    titleInputRef.current?.focus()

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return
      const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
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
    return () => {
      window.removeEventListener('keydown', handleKeydown)
      if (returnFocusElement) returnFocusElement.focus()
      else previousFocus?.focus()
    }
  }, [onClose, returnFocusRef])

  const updateTitle = (value: string) => {
    setTitle(value)
    setValidationError('')
    setDraftOpened(false)
  }

  const updateMessage = (value: string) => {
    setMessage(value)
    setValidationError('')
    setDraftOpened(false)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (issueTitle && message.trim()) {
      setDraftOpened(true)
      return
    }

    event.preventDefault()
    setValidationError(t('Please enter a title and describe your feedback.'))
    if (!issueTitle) titleInputRef.current?.focus()
  }

  return createPortal(
    <div className="composer-overlay feedback-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} className="composer-sheet feedback-sheet" role="dialog" aria-modal="true" aria-labelledby="feedback-dialog-heading">
        <header className="feedback-dialog-header">
          <p className="feedback-dialog-eyebrow">{t('A note for Daymark')}</p>
          <h2 id="feedback-dialog-heading">{t('Send feedback')}</h2>
          <p>{t('Report a bug, share an idea, or tell me how I can make Daymark better.')}</p>
        </header>

        <form
          className="feedback-form"
          action={feedbackIssueUrl}
          method="get"
          target="_blank"
          rel="noreferrer"
          onSubmit={handleSubmit}
        >
          <fieldset className="feedback-category-field">
            <legend>{t('What is this about?')}</legend>
            <div className="feedback-category-options">
              {feedbackCategories.map(({ value, label, Icon }) => (
                <label className={`feedback-category-option${category === value ? ' is-selected' : ''}`} key={value}>
                  <input
                    type="radio"
                    name="feedback-category"
                    value={value}
                    checked={category === value}
                    onChange={() => {
                      setCategory(value)
                      setDraftOpened(false)
                    }}
                  />
                  <Icon size={17} aria-hidden="true" />
                  <span>{t(label)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="feedback-field">
            <span>{t('Title')}</span>
            <input
              ref={titleInputRef}
              type="text"
              maxLength={120}
              required
              value={title}
              onChange={(event) => updateTitle(event.target.value)}
              placeholder={t('A short summary')}
              aria-invalid={Boolean(validationError && !issueTitle)}
            />
          </label>

          <label className="feedback-field">
            <span>{t('Your message')}</span>
            <textarea
              maxLength={2000}
              required
              rows={4}
              value={message}
              onChange={(event) => updateMessage(event.target.value)}
              placeholder={t('Tell me a little more...')}
              aria-invalid={Boolean(validationError && !message.trim())}
            />
          </label>

          <input type="hidden" name="title" value={issueTitle} />
          <input type="hidden" name="body" value={issueBody} />

          <p className="feedback-form-note">
            {t('Sending opens a prefilled GitHub issue draft in a new tab. You can review it before posting.')}
          </p>
          {validationError && <p className="feedback-form-message is-error" role="alert">{validationError}</p>}
          {draftOpened && (
            <p className="feedback-form-message" role="status">
              {t('Your GitHub draft is open in a new tab. Review and submit it there.')}
            </p>
          )}

          <div className="feedback-form-actions">
            <button className="feedback-submit-button" type="submit">{t('Send feedback')}</button>
            <button className="feedback-cancel-button" type="button" onClick={onClose}>{t('Cancel')}</button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  )
}
