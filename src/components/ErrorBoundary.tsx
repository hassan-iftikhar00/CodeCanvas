"use client";

import React from "react";

export type ErrorBoundaryVariant = "page" | "panel" | "inline";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  name?: string;
  resetKeys?: unknown[];
  onReset?: () => void;
  onError?: (error: Error, info: React.ErrorInfo) => void;
  variant?: ErrorBoundaryVariant;
  title?: string;
  message?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorFallbackProps {
  title: string;
  message: string;
  onRetry: () => void;
  onRefresh: () => void;
  variant: ErrorBoundaryVariant;
}

const defaultTitle = "Something went wrong";
const defaultMessage = "We could not load this section.";

function ErrorFallback({
  title,
  message,
  onRetry,
  onRefresh,
  variant,
}: ErrorFallbackProps) {
  const containerClassName =
    variant === "page"
      ? "min-h-screen"
      : "h-full min-h-[220px]";

  return (
    <div
      className={`${containerClassName} w-full bg-[var(--cc-bg-canvas)] p-6 flex items-center justify-center`}
      role="alert"
      aria-live="polite"
    >
      <div className="w-full max-w-md rounded-[var(--cc-radius-card)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] p-6 text-center shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)]">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-elevated)] text-[var(--cc-text-muted)]">
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          </svg>
        </div>
        <h2 className="text-[16px] font-semibold text-[var(--cc-text-primary)]">
          {title}
        </h2>
        <p className="mt-1 text-[12px] text-[var(--cc-text-secondary)]">
          {message}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-[var(--cc-radius-button)] bg-[var(--cc-accent)] px-4 py-2 text-[12px] font-semibold text-white transition-all hover:shadow-[0_0_16px_var(--cc-accent-glow-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-[var(--cc-radius-button)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-elevated)] px-4 py-2 text-[12px] font-semibold text-[var(--cc-text-primary)] transition-colors hover:border-[var(--cc-border-emphasis)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]"
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  );
}

function areResetKeysEqual(prev: unknown[] = [], next: unknown[] = []) {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    if (!Object.is(prev[i], next[i])) return false;
  }
  return true;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (!this.state.hasError) return;
    if (!this.props.resetKeys) return;
    if (areResetKeysEqual(prevProps.resetKeys, this.props.resetKeys)) return;
    this.resetErrorBoundary();
  }

  resetErrorBoundary = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: undefined });
  };

  handleRefresh = () => {
    if (typeof window === "undefined") return;
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          title={this.props.title ?? defaultTitle}
          message={this.props.message ?? defaultMessage}
          onRetry={this.resetErrorBoundary}
          onRefresh={this.handleRefresh}
          variant={this.props.variant ?? "panel"}
        />
      );
    }

    return this.props.children;
  }
}
