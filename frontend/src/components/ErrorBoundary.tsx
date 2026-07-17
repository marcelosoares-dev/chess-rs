import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-rose-400 p-8 font-mono flex flex-col justify-center items-center">
          <div className="max-w-2xl bg-rose-950/20 border border-rose-950 rounded-xl p-6 shadow-2xl">
            <h1 className="text-xl font-bold text-rose-500 mb-4">React Rendering Crash!</h1>
            <p className="mb-4 text-sm text-slate-300">
              Ocorreu um erro fatal durante a renderização do React:
            </p>
            <pre className="bg-slate-900 p-4 rounded-lg text-xs overflow-auto text-rose-300 border border-rose-900/50 max-h-60">
              {this.state.error?.toString()}
            </pre>
            {this.state.errorInfo && (
              <pre className="mt-4 bg-slate-900 p-4 rounded-lg text-[10px] overflow-auto text-slate-400 border border-slate-900 max-h-40">
                {this.state.errorInfo.componentStack}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded-lg text-sm font-semibold transition"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
