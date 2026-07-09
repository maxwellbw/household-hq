import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

/**
 * Modal-dialog keyboard a11y (WCAG 2.1.2 / 2.4.3): Escape to close, Tab is
 * trapped inside the dialog, focus lands inside on open and is restored to
 * the previously-focused element on close. Attach `ref` to the dialog panel.
 */
export function useDialogA11y(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const panel = ref.current
    const previouslyFocused = document.activeElement as HTMLElement | null

    // Focus the first focusable control (autoFocus wins if it already grabbed it).
    if (panel && !panel.contains(document.activeElement)) {
      const first = panel.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? panel).focus()
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      )
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previouslyFocused?.focus?.()
    }
  }, [ref, onClose])
}
