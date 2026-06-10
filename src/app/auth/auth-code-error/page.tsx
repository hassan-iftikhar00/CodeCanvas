"use client";

import Link from "next/link";
import { motion } from "motion/react";
import ThemeToggle from "@/components/theme/ThemeToggle";

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-[100svh] items-start justify-center bg-[var(--cc-bg-canvas)] px-4 py-10 sm:items-center">
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 0.9, 0.28, 1] }}
        className="w-full max-w-md space-y-6"
      >
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.25)]">
            <svg
              className="h-6 w-6 text-[var(--cc-error)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-[20px] font-semibold tracking-tight text-[var(--cc-text-primary)]">
            Authentication Failed
          </h2>
          <p className="mt-1.5 text-[13px] text-[var(--cc-text-secondary)]">
            We couldn&apos;t complete your sign-in.
          </p>
        </div>

        <div className="rounded-[var(--cc-radius-card)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] p-5">
          <h3 className="mb-3 text-[13px] font-semibold text-[var(--cc-text-primary)]">
            Possible reasons
          </h3>
          <ul className="space-y-2 text-[13px] text-[var(--cc-text-secondary)]">
            <li className="flex gap-2">
              <span className="text-[var(--cc-accent)]">•</span>
              <span>The authentication code expired</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--cc-accent)]">•</span>
              <span>Your browser blocked third-party cookies</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--cc-accent)]">•</span>
              <span>The redirect URL isn&apos;t whitelisted in Supabase</span>
            </li>
          </ul>

          <div className="mt-5 space-y-2">
            <Link
              href="/auth/login"
              className="block w-full rounded-[var(--cc-radius-button)] bg-[var(--cc-accent)] px-4 py-2.5 text-center text-[13px] font-semibold text-white transition-all hover:shadow-[0_0_20px_var(--cc-accent-glow-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--cc-bg-canvas)]"
            >
              Try Again
            </Link>
            <Link
              href="/"
              className="block w-full rounded-[var(--cc-radius-button)] border border-[var(--cc-border-subtle)] bg-transparent px-4 py-2.5 text-center text-[13px] font-medium text-[var(--cc-text-secondary)] transition-all hover:bg-[var(--cc-bg-elevated)] hover:text-[var(--cc-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]"
            >
              Back to Home
            </Link>
          </div>
        </div>

        <div className="rounded-[var(--cc-radius-card)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)]/60 p-4">
          <p className="text-[11px] leading-relaxed text-[var(--cc-text-muted)]">
            <strong className="text-[var(--cc-text-secondary)]">
              Developer tip:
            </strong>{" "}
            Check your browser console (F12) for detailed error messages, or
            verify your Supabase Dashboard &rarr; Authentication &rarr; URL
            Configuration settings.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
