import { useEffect, useRef } from 'react'

/**
 * Sheet-level Back handling for the dog-walk planner (feature 033 US4, FR-013, research R4)
 * — no URL routing (F-26 resolution), just enough history plumbing that the browser/device
 * Back control closes the sheet instead of exiting the app. While `open`, pushes one
 * `{hqSheet: 'planner'}` history entry and closes via a `popstate` listener; the returned
 * `close()` calls `history.back()` so Back and the sheet's own ✕/scrim stay in sync, except
 * when this hook's own push never happened (cold-start guard below) — then `close()` calls
 * `onClose` directly rather than navigating past unrelated history.
 *
 * Scoped to the planner only — not a generic dialog-history hook (research R4).
 */
export function useSheetHistory(open: boolean, onClose: () => void) {
  const pushedRef = useRef(false)

  useEffect(() => {
    if (!open) return

    // Cold-start guard: if the current entry is already flagged as the planner sheet (e.g. a
    // duplicate effect run finds its own prior push still on top), don't stack a second entry
    // — that would need two Backs to leave the sheet and leave a confusing behind-state.
    const alreadyTop = (window.history.state as { hqSheet?: string } | null)?.hqSheet === 'planner'
    if (!alreadyTop) {
      window.history.pushState({ hqSheet: 'planner' }, '')
      pushedRef.current = true
    }

    function onPopState() {
      onClose()
    }

    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function close() {
    if (pushedRef.current) {
      pushedRef.current = false
      window.history.back()
    } else {
      onClose()
    }
  }

  return { close }
}
