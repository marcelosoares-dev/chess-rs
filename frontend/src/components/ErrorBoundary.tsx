import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="welcome">
        <div className="welcome__card">
          <h1 className="welcome__title">Algo deu errado</h1>
          <p className="muted">Something went wrong.</p>
          <pre className="crash">{this.state.error.message}</pre>
          <button className="button button--primary button--large" onClick={() => window.location.reload()}>
            Recarregar
          </button>
        </div>
      </main>
    );
  }
}
