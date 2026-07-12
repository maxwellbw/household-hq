import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { AckNotices } from './AckNotices'
import type { AckNotice } from '@/lib/ackNotices'

beforeEach(() => {
  localStorage.clear()
})

const notice: AckNotice = { key: 't1:2026-07-11T09:00', taskId: 't1', taskTitle: 'Pick up the dog', assignee: 'max' }

describe('AckNotices', () => {
  it('renders nothing when there are no notices', () => {
    const { container } = render(<AckNotices notices={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a notice naming the assignee and the task', () => {
    render(<AckNotices notices={[notice]} />)
    expect(screen.getByText('Max has it: Pick up the dog')).toBeInTheDocument()
  })

  it('dismissing a notice removes it from view', () => {
    render(<AckNotices notices={[notice]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notice' }))
    expect(screen.queryByText('Max has it: Pick up the dog')).not.toBeInTheDocument()
  })

  it('renders multiple notices independently', () => {
    const second: AckNotice = { key: 't2:2026-07-11T10:00', taskId: 't2', taskTitle: 'Book the vet', assignee: 'jaz' }
    render(<AckNotices notices={[notice, second]} />)
    expect(screen.getByText('Max has it: Pick up the dog')).toBeInTheDocument()
    expect(screen.getByText('Jaz has it: Book the vet')).toBeInTheDocument()
  })
})
