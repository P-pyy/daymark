import { useEffect, useRef } from 'react'
import { TaskComposer } from './TaskComposer'
import type { Category, Priority } from './taskTypes'

interface TaskComposerDialogProps {
  onAdd: (title: string, priority: Priority, dueDate: string, category: Category) => void
  onClose: () => void
  initialCategory: Category
  initialDueDate: string
}

export function TaskComposerDialog({ onAdd, onClose, initialCategory, initialDueDate }: TaskComposerDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const isTouchLayout = window.matchMedia?.('(max-width: 700px), (pointer: coarse)').matches ?? false
    const initialFocus = isTouchLayout
      ? dialog
      : dialog.querySelector<HTMLElement>('input:not([disabled])')
    initialFocus?.focus()
  }, [])

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
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

  useEffect(() => {
    const overlay = overlayRef.current
    const viewport = window.visualViewport
    if (!overlay || !viewport) return

    const syncViewport = () => {
      overlay.style.setProperty('--composer-viewport-height', `${viewport.height}px`)
      overlay.style.setProperty('--composer-viewport-offset-top', `${viewport.offsetTop}px`)
    }

    syncViewport()
    viewport.addEventListener('resize', syncViewport)
    viewport.addEventListener('scroll', syncViewport)
    window.addEventListener('resize', syncViewport)

    return () => {
      viewport.removeEventListener('resize', syncViewport)
      viewport.removeEventListener('scroll', syncViewport)
      window.removeEventListener('resize', syncViewport)
    }
  }, [])

  return (
    <div ref={overlayRef} className="composer-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} className="composer-sheet" role="dialog" aria-modal="true" aria-labelledby="composer-heading" tabIndex={-1}>
        <TaskComposer
          onAdd={onAdd}
          onClose={onClose}
          initialCategory={initialCategory}
          initialDueDate={initialDueDate}
        />
      </section>
    </div>
  )
}