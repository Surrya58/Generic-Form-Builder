import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Optional custom fallback; defaults to a recover/Back-to-forms panel. */
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Catches render-time errors in its subtree so one bad template/field config
 * can't white-screen the whole app. Wraps the Builder and Fill routes, which
 * render arbitrary user-defined field configurations.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the error for debugging; there's no server to report to.
    console.error('Unhandled UI error:', error, info.componentStack)
  }

  private readonly handleReset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (error === null) return this.props.children
    if (this.props.fallback !== undefined) return this.props.fallback

    return (
      <div
        role="alert"
        className="mx-auto flex max-w-md flex-col items-center gap-4 p-12 text-center"
      >
        <h1 className="text-xl font-semibold text-gray-900">Something went wrong</h1>
        <p className="text-sm text-gray-600">
          This screen hit an unexpected error. Your saved forms and responses are safe.
        </p>
        <p className="max-w-full truncate text-xs text-gray-400">{error.message}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Back to forms
          </a>
        </div>
      </div>
    )
  }
}
