import { Component, Suspense, lazy, type ComponentType } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface LazyBoundaryProps<P extends object> {
  /** Human label for the area, used in the fallback/error copy (e.g. "Calendar"). */
  label: string
  loader: () => Promise<{ default: ComponentType<P> }>
  componentProps: P
}

interface LazyBoundaryState {
  hasError: boolean
  attempt: number
}

/**
 * Feature 030 US5 (FR-019/020): wraps a React.lazy view in a Suspense fallback and a
 * retryable, area-scoped error boundary, so a failed chunk (offline, stale deploy) never
 * takes down the whole app. Retrying re-creates the `lazy()` wrapper, which re-issues the
 * dynamic import — React caches a lazy component's promise for life, so reusing the same
 * one would replay the same rejection forever.
 */
export class LazyBoundary<P extends object> extends Component<LazyBoundaryProps<P>, LazyBoundaryState> {
  state: LazyBoundaryState = { hasError: false, attempt: 0 }

  private lazyComponent: ComponentType<P> | null = null
  private lazyAttempt = -1

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error(`LazyBoundary(${this.props.label}):`, error)
  }

  private handleRetry = () => {
    this.setState((s) => ({ hasError: false, attempt: s.attempt + 1 }))
  }

  private getLazyComponent(): ComponentType<P> {
    if (this.lazyAttempt !== this.state.attempt || !this.lazyComponent) {
      this.lazyComponent = lazy(this.props.loader)
      this.lazyAttempt = this.state.attempt
    }
    return this.lazyComponent
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center"
        >
          <p className="text-ink">Couldn't load {this.props.label}.</p>
          <p className="text-sm text-ink-muted">Check your connection and try again.</p>
          <Button className="min-h-[44px]" onClick={this.handleRetry}>
            <RefreshCw aria-hidden="true" />
            Retry
          </Button>
        </div>
      )
    }

    const LazyComponent = this.getLazyComponent()
    return (
      <Suspense
        fallback={
          <div
            className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center"
            aria-live="polite"
          >
            <p className="text-sm text-ink-muted">Loading {this.props.label.toLowerCase()}…</p>
          </div>
        }
      >
        <LazyComponent {...this.props.componentProps} />
      </Suspense>
    )
  }
}
