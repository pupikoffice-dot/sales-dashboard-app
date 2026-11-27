import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Catches a crash inside one page so the rest of the app (menu, header) stays on screen instead of going black.
 * Wrap it with `key={location.pathname}` so moving to another page clears the error.
 */
export class RouteErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="status-msg error" role="alert" style={{ margin: 16 }}>
        <p style={{ margin: '0 0 8px' }}>This page hit an error and could not be shown.</p>
        <p style={{ margin: '0 0 8px', opacity: 0.8 }}>{this.state.error.message}</p>
        <button type="button" className="chip" onClick={() => this.setState({ error: null })}>
          Try again
        </button>
      </div>
    )
  }
}
