import { useEffect } from 'react'

// Module-level ref count: the background page (documentElement/body — `<main>` isn't
// height-constrained so it never scrolls internally; the viewport itself scrolls) must
// stay frozen for as long as *any* sheet/dialog is open, including nested ones.
let lockCount = 0
let previousBodyOverflow = ''
let previousHtmlOverflow = ''

function lockScroll() {
  if (lockCount === 0) {
    previousBodyOverflow = document.body.style.overflow
    previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
  }
  lockCount++
}

function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    document.body.style.overflow = previousBodyOverflow
    document.documentElement.style.overflow = previousHtmlOverflow
  }
}

/**
 * Ref-counted page-scroll lock for modal sheets/dialogs (feature 029 US4): freezes the
 * background while any sheet/dialog is open and restores the prior overflow exactly when
 * the last one closes. Ref-counting means nested sheets (e.g. Snooze opened from Task
 * detail) don't fight over a single overflow toggle, and the effect cleanup guarantees
 * restore even on rapid open/close or an abnormal unmount.
 */
export function useScrollLock() {
  useEffect(() => {
    lockScroll()
    return unlockScroll
  }, [])
}
