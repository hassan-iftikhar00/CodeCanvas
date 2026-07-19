"use client";

import React from "react";
import { DRAFTING_TOKENS as T } from "@/lib/drafting-room/tokens";

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

const MONO = "var(--font-jetbrains-mono, ui-monospace, monospace)";
const SANS = "var(--font-inter, ui-sans-serif, system-ui)";
const SERIF = "var(--font-instrument-serif, ui-serif, Georgia, serif)";

function ErrorFallback({
  title,
  message,
  onRetry,
  onRefresh,
  variant,
}: ErrorFallbackProps) {
  // Inline: thin banner, no sheet, no refresh button
  if (variant === "inline") {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="flex items-center gap-3 px-3 py-2 text-[13px]"
        style={{
          background: `${T.error}10`,
          border: `1px solid ${T.error}`,
          color: T.error,
          fontFamily: SANS,
        }}
      >
        <span
          className="px-1.5 py-0.5 text-[12px] tracking-[0.18em] uppercase"
          style={{
            border: `1px solid currentColor`,
            fontFamily: MONO,
          }}
        >
          Error
        </span>
        <span className="flex-1 truncate">{message}</span>
        <button
          type="button"
          onClick={onRetry}
          className="px-2 py-1 text-[13px] tracking-[0.18em] uppercase transition-colors"
          style={{
            background: T.paper,
            border: `1px solid ${T.error}`,
            color: T.error,
            fontFamily: MONO,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = T.error;
            e.currentTarget.style.color = T.paper;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = T.paper;
            e.currentTarget.style.color = T.error;
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Page + panel both use the paper-sheet treatment, sized to context.
  const containerClassName =
    variant === "page" ? "min-h-screen" : "h-full min-h-[260px]";

  return (
    <div
      className={`${containerClassName} flex w-full items-center justify-center p-6`}
      role="alert"
      aria-live="polite"
      style={{ background: T.paper }}
    >
      <div
        className="w-full max-w-md"
        style={{
          background: T.paper,
          border: `1px solid ${T.error}`,
        }}
      >
        {/* Title strip */}
        <div
          className="flex items-center justify-between border-b px-5 py-2 text-[13px] tracking-[0.16em] uppercase"
          style={{
            background: `${T.error}10`,
            borderColor: T.error,
            color: T.error,
            fontFamily: MONO,
          }}
        >
          <span>Error · Boundary caught</span>
          <span>{variant === "page" ? "PAGE" : "PANEL"}</span>
        </div>

        {/* Body */}
        <div className="px-6 pt-5 pb-2 text-center sm:text-left">
          <div
            className="mb-4 inline-flex h-10 w-10 items-center justify-center"
            style={{
              border: `1px solid ${T.error}`,
              color: T.error,
              background: `${T.error}10`,
            }}
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
          </div>
          <h2
            className="text-[26px] leading-[1.1] tracking-[-0.01em]"
            style={{ color: T.graphite, fontFamily: SERIF, fontWeight: 400 }}
          >
            {title}
          </h2>
          <p
            className="mt-1.5 text-[13px] leading-[1.55]"
            style={{ color: T.muted, fontFamily: SANS }}
          >
            {message}
          </p>
        </div>

        {/* Actions */}
        <div
          className="flex flex-col-reverse gap-2 border-t px-6 py-3.5 sm:flex-row sm:justify-end"
          style={{
            background: T.vellum,
            borderColor: T.rule,
          }}
        >
          <button
            type="button"
            onClick={onRefresh}
            className="px-4 py-2 text-[13px] tracking-[0.18em] uppercase transition-colors"
            style={{
              background: T.paper,
              border: `1px solid ${T.rule}`,
              color: T.graphite,
              fontFamily: MONO,
              minHeight: 36,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = T.graphite;
              e.currentTarget.style.color = T.paper;
              e.currentTarget.style.borderColor = T.graphite;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = T.paper;
              e.currentTarget.style.color = T.graphite;
              e.currentTarget.style.borderColor = T.rule;
            }}
          >
            Refresh page
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 text-[13px] tracking-[0.18em] uppercase transition-colors"
            style={{
              background: T.cobalt,
              border: `1px solid ${T.cobalt}`,
              color: T.paper,
              fontFamily: MONO,
              minHeight: 36,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = T.cobaltInk;
              e.currentTarget.style.borderColor = T.cobaltInk;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = T.cobalt;
              e.currentTarget.style.borderColor = T.cobalt;
            }}
          >
            Retry →
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
