import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

interface ToastMessage {
  id: number
  text: string
}

interface ToastContextValue {
  show: (text: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

/** DESIGN.md "quiet celebration": a warm toast, no confetti, auto-dismissing. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const show = useCallback((text: string) => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, text }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 sm:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto rounded-control bg-ink px-4 py-2 text-sm text-surface shadow-card motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
          >
            {t.text}
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
