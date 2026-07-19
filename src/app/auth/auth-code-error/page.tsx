"use client";

import Link from "next/link";
import { DRAFTING_TOKENS as T } from "@/lib/drafting-room/tokens";

const MONO = "var(--font-jetbrains-mono, ui-monospace, monospace)";
const SANS = "var(--font-inter, ui-sans-serif, system-ui)";
const SERIF = "var(--font-instrument-serif, ui-serif, Georgia, serif)";

export default function AuthCodeErrorPage() {
  return (
    <div
      className="flex min-h-[100svh] items-start justify-center px-4 py-10 sm:items-center"
      style={{
        background: T.paper,
        backgroundImage: `
          linear-gradient(to right, ${T.tick}22 1px, transparent 1px),
          linear-gradient(to bottom, ${T.tick}22 1px, transparent 1px)
        `,
        backgroundSize: "16px 16px",
      }}
    >
      <div className="animate-slide-in-up w-full max-w-md space-y-4">
        <section
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
            <span>Auth · Code exchange failed</span>
            <span>Read below</span>
          </div>

          {/* Header */}
          <div className="px-6 pt-5 pb-2">
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
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2
              className="text-[28px] leading-[1.1] tracking-[-0.01em]"
              style={{
                color: T.graphite,
                fontFamily: SERIF,
                fontWeight: 400,
              }}
            >
              Authentication failed.
            </h2>
            <p
              className="mt-1.5 text-[13px] leading-[1.55]"
              style={{ color: T.muted, fontFamily: SANS }}
            >
              We could not complete your sign-in.
            </p>
          </div>

          {/* Possible reasons */}
          <div className="px-6 pt-3">
            <div
              className="px-3 py-2.5"
              style={{
                background: T.vellum,
                border: `1px solid ${T.rule}`,
              }}
            >
              <div
                className="text-[13px] tracking-[0.16em] uppercase"
                style={{ color: T.muted, fontFamily: MONO }}
              >
                Possible reasons
              </div>
              <ul
                className="mt-2 space-y-1 text-[13px]"
                style={{ color: T.graphite, fontFamily: SANS }}
              >
                {[
                  "The authentication code expired",
                  "Your browser blocked third-party cookies",
                  "The redirect URL isn't whitelisted in Supabase",
                ].map((reason) => (
                  <li key={reason} className="flex items-center gap-2">
                    <span
                      className="inline-block h-1 w-1 flex-none"
                      style={{ background: T.error }}
                      aria-hidden="true"
                    />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div
            className="mt-4 flex flex-col-reverse gap-2 border-t px-6 py-3.5 sm:flex-row sm:justify-end"
            style={{
              background: T.vellum,
              borderColor: T.rule,
            }}
          >
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 text-[13px] tracking-[0.18em] uppercase transition-colors"
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
              Back to home
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center px-4 py-2 text-[13px] tracking-[0.18em] uppercase transition-colors"
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
              Try again →
            </Link>
          </div>
        </section>

        {/* Developer tip */}
        <div
          className="px-4 py-3 text-[13px] leading-relaxed"
          style={{
            background: T.paper,
            border: `1px solid ${T.rule}`,
            color: T.muted,
            fontFamily: SANS,
          }}
        >
          <span
            className="mr-2 inline-block px-1.5 py-0.5 text-[12px] tracking-[0.18em] uppercase"
            style={{
              background: T.vellum,
              border: `1px solid ${T.rule}`,
              color: T.graphite,
              fontFamily: MONO,
            }}
          >
            Dev tip
          </span>
          Check your browser console (F12) for detailed error messages, or
          verify your Supabase Dashboard &rarr; Authentication &rarr; URL
          Configuration settings.
        </div>
      </div>
    </div>
  );
}
