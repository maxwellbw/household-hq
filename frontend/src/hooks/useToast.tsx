import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ToastAction {
  label: string
  onAction: () => void
}

interface ToastMessage {
  id: number
  text: string
  action?: ToastAction
}

interface ToastContextValue {
  show: (text: string) => void
  /** Undo toast (feature 032 US3, contract C3): single live slot — a second call before the
   *  window lapses finalizes (silently dismisses) the previous one instead of stacking. */
  showUndo: (text: string, onUndo: () => void, windowMs?: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)
const DEFAULT_UNDO_WINDOW_MS = 6000

let nextId = 0

/** DESIGN.md "quiet celebration": a warm toast, no confetti, auto-dismissing. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const undoIdRef = useRef<number | null>(null)

  const show = useCallback((text: string) => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, text }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000)
  }, [])

  const showUndo = useCallback((text: string, onUndo: () => void, windowMs = DEFAULT_UNDO_WINDOW_MS) => {
    if (undoIdRef.current !== null) {
      const staleId = undoIdRef.current
      setToasts((prev) => prev.filter((t) => t.id !== staleId))
    }
    const id = nextId++
    undoIdRef.current = id
    const dismiss = () => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      if (undoIdRef.current === id) undoIdRef.current = null
    }
    setToasts((prev) => [
      ...prev,
      {
        id,
        text,
        action: {
          label: 'Undo',
          onAction: () => {
            dismiss()
            onUndo()
          },
        },
      },
    ])
    setTimeout(dismiss, windowMs)
  }, [])

  return (
    <ToastContext.Provider value={{ show, showUndo }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 sm:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-center gap-3 rounded-control bg-ink px-4 py-2 text-sm text-surface shadow-card motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
          >
            <span>{t.text}</span>
            {t.action && (
              <button
                type="button"
                onClick={t.action.onAction}
                className="min-h-[44px] shrink-0 rounded-control px-1 font-semibold text-surface underline decoration-2 underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
