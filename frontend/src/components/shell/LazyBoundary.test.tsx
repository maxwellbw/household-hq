import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LazyBoundary } from './LazyBoundary'

function DummyComponent({ label }: { label: string }) {
  return <div>{label} loaded</div>
}

describe('LazyBoundary', () => {
  it('renders the fallback while the chunk is loading, then the real component once it resolves', async () => {
    let resolveImport: (value: { default: typeof DummyComponent }) => void = () => {}
    const loader = () =>
      new Promise<{ default: typeof DummyComponent }>((resolve) => {
        resolveImport = resolve
      })

    render(<LazyBoundary label="Calendar" loader={loader} componentProps={{ label: 'Calendar' }} />)

    expect(screen.getByText(/loading calendar/i)).toBeInTheDocument()

    resolveImport({ default: DummyComponent })

    await waitFor(() => expect(screen.getByText('Calendar loaded')).toBeInTheDocument())
  })

  it('shows a retryable, area-scoped error when the chunk fails to load, and retry re-attempts the import', async () => {
    const user = userEvent.setup()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    let attempt = 0
    const loader = () => {
      attempt += 1
      if (attempt === 1) {
        return Promise.reject(new Error('Failed to fetch dynamically imported module'))
      }
      return Promise.resolve({ default: DummyComponent })
    }

    render(<LazyBoundary label="More" loader={loader} componentProps={{ label: 'More' }} />)

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText(/couldn't load more/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() => expect(screen.getByText('More loaded')).toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    consoleErrorSpy.mockRestore()
  })
})
