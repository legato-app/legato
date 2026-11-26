import { Component, type ErrorInfo, type ReactNode } from 'react'
import { describe, frames, report } from '../shared/diag'

/**
 * Around a part of the shell a theme can move: when it throws under a theme's layout, the layout is dropped and the part
 * drawn again. Thrown under the app's own, it isn't the layout's doing: the root ErrorBoundary's, as before.
 */
export class LayoutBoundary extends Component<{ children: ReactNode; on: boolean; drop: () => void }, { failure?: { error: unknown } }> {
  state: { failure?: { error: unknown } } = {}

  static getDerivedStateFromError(error: unknown) {
    return { failure: { error } }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (!this.props.on) return
    const said = describe(error, 'A theme layout failed')
    report('warn', 'ui', said.message + frames(info.componentStack), said.detail)
    this.props.drop()
    this.setState({ failure: undefined })
  }

  render() {
    const { failure } = this.state
    if (!failure) return this.props.children
    if (!this.props.on) throw failure.error
    // One frame, until componentDidCatch has dropped the layout.
    return null
  }
}
