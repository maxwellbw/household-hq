import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LoadBalance } from './LoadBalance'
import type { LoadBalanceResult } from '@/lib/dashboard'

const ZERO: LoadBalanceResult = { max: 0, jaz: 0, both: 0 }

describe('LoadBalance', () => {
  it('collapses an all-zero period to one quiet line (audit F-19)', () => {
    render(<LoadBalance weekBalance={ZERO} monthBalance={ZERO} viewer="jaz" />)
    expect(screen.getByText('Nothing tracked this week.')).toBeInTheDocument()
    expect(screen.getByText('Nothing tracked this month.')).toBeInTheDocument()
    expect(screen.queryByText(/MORE/)).not.toBeInTheDocument()
  })

  it('describes the leader in a plain sentence, using "You" for the viewer', () => {
    render(
      <LoadBalance
        weekBalance={{ max: 5, jaz: 2, both: 0 }}
        monthBalance={ZERO}
        viewer="max"
      />,
    )
    expect(screen.getByText("You're carrying more this week.")).toBeInTheDocument()
  })

  it('names the other person when they lead', () => {
    render(
      <LoadBalance
        weekBalance={{ max: 5, jaz: 2, both: 0 }}
        monthBalance={ZERO}
        viewer="jaz"
      />,
    )
    expect(screen.getByText('Max is carrying more this week.')).toBeInTheDocument()
  })

  it('describes an even split without naming a leader', () => {
    render(
      <LoadBalance
        weekBalance={{ max: 3, jaz: 3, both: 1 }}
        monthBalance={ZERO}
        viewer="jaz"
      />,
    )
    expect(screen.getByText('Max and Jaz are evenly matched this week.')).toBeInTheDocument()
  })
})
