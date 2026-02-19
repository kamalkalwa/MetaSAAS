"use client";

/**
 * ErrorBoundary — catches unhandled rendering errors in child components.
 *
 * React error boundaries MUST be class components (hooks can't catch
 * render-phase errors). This component provides:
 *   - A user-friendly fallback UI with retry capability
 *   - Console logging of the error for debugging
 *   - Prevents a single component crash from taking down the entire app
 *
 * Usage:
 *   <ErrorBoundary fallbackMessage="The chat failed to load.">
 *     <ChatSidebar />
 *   </ErrorBoundary>
 */

import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  /** The components to render when no error has occurred */
  children: ReactNode;
  /** Optional message shown in the fallback UI */
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[ErrorBoundary] Caught error:", error, info.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 text-center min-h-[200px]">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-destructive"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground mb-1">
            Something went wrong
          </p>
          <p className="text-xs text-muted-foreground mb-4 max-w-[300px]">
            {this.props.fallbackMessage ??
              "An unexpected error occurred. Please try again."}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="text-sm text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
