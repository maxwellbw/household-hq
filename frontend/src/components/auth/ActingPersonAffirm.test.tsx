import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActingPersonAffirm } from './ActingPersonAffirm'

const setActingPersonMock = vi.fn()

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ setActingPerson: setActingPersonMock }),
}))

describe('ActingPersonAffirm', () => {
  beforeEach(() => {
    setActingPersonMock.mockClear()
  })

  it('shows the restored person', () => {
    render(<ActingPersonAffirm person="max" />)
    expect(screen.getByText('Max')).toBeInTheDocument()
  })

  it('switches acting person on tap and hides itself', async () => {
    const user = userEvent.setup()
    render(<ActingPersonAffirm person="max" />)

    await user.click(screen.getByRole('button', { name: /switch to jaz/i }))

    expect(setActingPersonMock).toHaveBeenCalledWith('jaz')
    expect(screen.queryByText('Max')).not.toBeInTheDocument()
  })

  it('dismisses without switching person', async () => {
    const user = userEvent.setup()
    render(<ActingPersonAffirm person="jaz" />)

    await user.click(screen.getByRole('button', { name: /dismiss/i }))

    expect(setActingPersonMock).not.toHaveBeenCalled()
    expect(screen.queryByText('Jaz')).not.toBeInTheDocument()
  })
})
