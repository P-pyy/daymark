import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react'
import { useLocale } from '../../shared/locale'

interface GuidedTourProps {
  onFinish: () => void
}

interface TourTarget {
  x: number
  y: number
  width: number
  height: number
  viewportWidth: number
  viewportHeight: number
}

const tourSteps = [
  {
    title: 'A clear view of today',
    description: 'See what is due today and keep your next small step in view.',
    target: '.today-dashboard-greeting',
  },
  {
    title: 'Add tasks as they come to mind',
    description: 'Create a task here, then choose its category, priority, and an optional due date.',
    target: '.quick-intake',
  },
  {
    title: 'Keep plans in categories',
    description: 'Choose Work, Personal, Home, or Learning to open the tasks in that category.',
    target: '.category-cards',
  },
  {
    title: 'Find the rest of Daymark',
    description: 'Use the navigation to open your calendar and reminders. Your profile holds language and appearance settings.',
    target: '.desktop-primary-navigation, .bottom-tab-bar',
  },
] as const

export function GuidedTour({ onFinish }: GuidedTourProps) {
  const { translate: t } = useLocale()
  const [stepIndex, setStepIndex] = useState(0)
  const [target, setTarget] = useState<TourTarget | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const step = tourSteps[stepIndex]
  const cardWidth = Math.min(380, Math.max(280, (target?.viewportWidth ?? window.innerWidth) - 32))
  const cardHeightEstimate = 340
  const left = target
    ? Math.max(16, Math.min(target.x + target.width / 2 - cardWidth / 2, target.viewportWidth - cardWidth - 16))
    : Math.max(16, (window.innerWidth - cardWidth) / 2)
  const preferredTop = target ? target.y + target.height + 16 : (window.innerHeight - cardHeightEstimate) / 2
  const top = target
    ? Math.max(16, Math.min(
      preferredTop + cardHeightEstimate > target.viewportHeight - 16
        ? target.y - cardHeightEstimate - 16
        : preferredTop,
      target.viewportHeight - cardHeightEstimate - 16,
    ))
    : Math.max(16, preferredTop)

  useLayoutEffect(() => {
    const updateTarget = () => {
      const targetSelector = step.target.includes(',')
        ? window.matchMedia('(min-width: 1024px)').matches ? '.desktop-primary-navigation' : '.bottom-tab-bar'
        : step.target
      const element = document.querySelector<HTMLElement>(targetSelector)
      if (!element) {
        setTarget(null)
        return
      }

      const rect = element.getBoundingClientRect()
      setTarget({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      })
    }

    updateTarget()
    window.addEventListener('resize', updateTarget)
    return () => window.removeEventListener('resize', updateTarget)
  }, [step.target])

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    dialogRef.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus()

    return () => {
      const previousFocus = previousFocusRef.current
      if (previousFocus?.isConnected) window.requestAnimationFrame(() => previousFocus.focus())
    }
  }, [])

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onFinish()
      return
    }
    if (event.key !== 'Tab' || !dialogRef.current) return

    const buttons = [...dialogRef.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
    const firstButton = buttons[0]
    const lastButton = buttons[buttons.length - 1]
    if (event.shiftKey && document.activeElement === firstButton) {
      event.preventDefault()
      lastButton?.focus()
    } else if (!event.shiftKey && document.activeElement === lastButton) {
      event.preventDefault()
      firstButton?.focus()
    }
  }

  function showPreviousStep() {
    setStepIndex((current) => Math.max(0, current - 1))
  }

  function showNextStep() {
    if (stepIndex === tourSteps.length - 1) {
      onFinish()
      return
    }
    setStepIndex((current) => Math.min(tourSteps.length - 1, current + 1))
  }

  return createPortal(
    <div className="guided-tour-layer">
      {target ? (
        <svg
          className="guided-tour-scrim"
          width={target.viewportWidth}
          height={target.viewportHeight}
          viewBox={`0 0 ${target.viewportWidth} ${target.viewportHeight}`}
          aria-hidden="true"
        >
          <defs>
            <mask id="guided-tour-target-mask">
              <rect width={target.viewportWidth} height={target.viewportHeight} fill="white" />
              <rect
                x={Math.max(0, target.x - 8)}
                y={Math.max(0, target.y - 8)}
                width={target.width + 16}
                height={target.height + 16}
                rx="14"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width={target.viewportWidth}
            height={target.viewportHeight}
            fill="rgba(55, 38, 47, 0.56)"
            mask="url(#guided-tour-target-mask)"
          />
        </svg>
      ) : <div className="guided-tour-scrim-fallback" aria-hidden="true" />}
      <div
        ref={dialogRef}
        className="guided-tour-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-tour-title"
        aria-describedby="guided-tour-description"
        onKeyDown={handleKeyDown}
        style={{ left, top }}
      >
        <div className="guided-tour-progress">
          <span>{t('Getting to know Daymark')}</span>
          <span>{stepIndex + 1} {t('of')} {tourSteps.length}</span>
        </div>
        <h2 id="guided-tour-title">{t(step.title)}</h2>
        <p id="guided-tour-description">{t(step.description)}</p>
        <div className="guided-tour-actions">
          <button className="guided-tour-previous" type="button" onClick={showPreviousStep} disabled={stepIndex === 0}>
            <ArrowLeft size={16} aria-hidden="true" />
            {t('Previous')}
          </button>
          <button className="guided-tour-skip" type="button" onClick={onFinish}>{t('Skip tour')}</button>
          <button className="guided-tour-next" type="button" onClick={showNextStep}>
            {t(stepIndex === tourSteps.length - 1 ? 'Finish tour' : 'Next')}
            {stepIndex < tourSteps.length - 1 && <ArrowRight size={16} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
