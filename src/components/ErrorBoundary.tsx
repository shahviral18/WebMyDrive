import { Component, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-4 bg-[#f8fbff]">
        <div className="text-5xl">⚠️</div>
        <h1 className="text-xl font-bold text-slate-800">Something went wrong</h1>
        <p className="text-slate-500 text-sm text-center max-w-sm">
          An unexpected error occurred. Please refresh the page or contact support if the problem persists.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 px-5 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors"
        >
          Refresh Page
        </button>
      </div>
    );
  }
}
