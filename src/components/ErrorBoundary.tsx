import React, { Component, ErrorInfo, ReactNode } from 'react';
import { auth } from '../firebase';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error && parsed.operationType) {
          errorMessage = `Firestore ${parsed.operationType} error: ${parsed.error}`;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || "An unexpected error occurred.";
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
          <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-xl max-w-md w-full text-center">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">Application Error</h2>
            <div className="bg-rose-50 text-rose-700 p-4 rounded-xl text-sm mb-6 text-left overflow-auto max-h-40">
              {errorMessage}
            </div>
            <div className="flex flex-col gap-3 pt-4">
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-all"
              >
                Reload Application
              </button>
              <button 
                onClick={async () => {
                  await auth.signOut();
                  window.location.reload();
                }}
                className="w-full py-3 bg-white border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50 transition-all"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
