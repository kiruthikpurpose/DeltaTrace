import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}
/** Keeps the shell alive if a single page throws. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page error', error, info.componentStack);
  }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error)
      return (
        <div className="page" role="alert">
          <div className="note bad">
            <b>This page hit an unexpected error.</b>
            <p>{this.state.error.message}</p>
            <button className="btn sm" onClick={() => this.setState({ error: null })}>Try again</button>
          </div>
        </div>
      );
    return this.props.children;
  }
}
