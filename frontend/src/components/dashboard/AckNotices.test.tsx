import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { AckNotices } from './AckNotices'
import type { AckNotice } from '@/lib/ackNotices'

beforeEach(() => {
  localStorage.clear()
})

const notice: AckNotice = { key: 't1:2026-07-11T09:00', taskId: 't1', taskTitle: 'Pick up the dog', assignee: 'max' }

// The notice text is split across nested <span>s for owner-color styling (feature 028 R7),
// so match on the containing status role's full text content rather than an exact string.
function statusWithText(text: string) {
  return screen.getByText((_content, el) => el?.tagName === 'DIV' && el.textContent === text, {
    selector: '[role="status"]',
  })
}

describe('AckNotices', () => {
  it('renders nothing when there are no notices', () => {
    const { container } = render(<AckNotices notices={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a notice naming the assignee and the task', () => {
    render(<AckNotices notices={[notice]} />)
    expect(statusWithText('Max has it: Pick up the dog✕')).toBeInTheDocument()
  })

  it('dismissing a notice removes it from view', () => {
    render(<AckNotices notices={[notice]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notice' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders multiple notices independently', () => {
    const second: AckNotice = { key: 't2:2026-07-11T10:00', taskId: 't2', taskTitle: 'Book the vet', assignee: 'jaz' }
    render(<AckNotices notices={[notice, second]} />)
    expect(statusWithText('Max has it: Pick up the dog✕')).toBeInTheDocument()
    expect(statusWithText('Jaz has it: Book the vet✕')).toBeInTheDocument()
  })
})
