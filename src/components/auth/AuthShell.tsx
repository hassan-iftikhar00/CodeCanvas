"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import { DRAFTING_TOKENS } from "@/lib/drafting-room/tokens";
import { DraftingMark as Mark } from "@/lib/drafting-room/marks";

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});
const sans = Inter({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"] });

// Re-export under the local alias so every existing auth-page importer
// (`import { T_AUTH } from "@/components/auth/AuthShell"`) keeps working
// against the canonical token table.
export const T_AUTH = DRAFTING_TOKENS;

interface AuthShellProps {
  slug: string;
  title: string;
  italicWord?: string;
  subtitle: string;
  children: ReactNode;
  footerNote?: ReactNode;
}

export default function AuthShell({
  slug,
  title,
  italicWord,
  subtitle,
  children,
  footerNote,
}: AuthShellProps) {
  return (
    <div
      className="d5-auth-root min-h-[100svh] flex flex-col"
      style={{
        background: T_AUTH.paper,
        color: T_AUTH.graphite,
      }}
    >
      <style jsx global>{`
        .d5-auth-root {
          --d5-paper: ${T_AUTH.paper};
          --d5-vellum: ${T_AUTH.vellum};
          --d5-tick: ${T_AUTH.tick};
          --d5-rule: ${T_AUTH.rule};
          --d5-graphite: ${T_AUTH.graphite};
          --d5-cobalt: ${T_AUTH.cobalt};
          --d5-cobalt-ink: ${T_AUTH.cobaltInk};
          --d5-cobalt-wash: ${T_AUTH.cobaltWash};
          --d5-muted: ${T_AUTH.muted};
          --d5-success: ${T_AUTH.success};
          --d5-error: ${T_AUTH.error};
          --d5-sans: ${sans.style.fontFamily};
          --d5-mono: ${mono.style.fontFamily};
          --d5-serif: ${serif.style.fontFamily};
        }
        .d5-auth-root .d5-sans {
          font-family: var(--d5-sans), ui-sans-serif, system-ui, sans-serif;
          letter-spacing: -0.005em;
        }
        .d5-auth-root .d5-mono {
          font-family: var(--d5-mono), ui-monospace, monospace;
          letter-spacing: 0;
        }
        .d5-auth-root .d5-serif {
          font-family: var(--d5-serif), ui-serif, Georgia, serif;
          font-feature-settings: "liga", "dlig", "kern";
        }
        .d5-auth-root .d5-grid-fine {
          background-image:
            linear-gradient(to right, var(--d5-tick) 1px, transparent 1px),
            linear-gradient(to bottom, var(--d5-tick) 1px, transparent 1px);
          background-size: 8px 8px;
          opacity: 0.4;
        }
        .d5-auth-root .d5-grid {
          background-image:
            linear-gradient(to right, var(--d5-tick) 1.5px, transparent 1.5px),
            linear-gradient(to bottom, var(--d5-tick) 1.5px, transparent 1.5px);
          background-size: 32px 32px;
          opacity: 1;
        }
        /* Form chrome — solid fills, hairline borders, drafting room voice. */
        .d5-auth-root .d5-btn {
          font-family: var(--d5-mono);
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          padding: 14px 22px;
          border: 1px solid var(--d5-rule);
          background: var(--d5-paper);
          color: var(--d5-graphite);
          transition:
            background 120ms ease,
            color 120ms ease,
            border-color 120ms ease;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 44px;
          width: 100%;
        }
        .d5-auth-root .d5-btn:hover:not(:disabled) {
          background: var(--d5-graphite);
          color: var(--d5-paper);
        }
        .d5-auth-root .d5-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .d5-auth-root .d5-btn-primary {
          background: var(--d5-cobalt);
          border-color: var(--d5-cobalt);
          color: var(--d5-paper);
        }
        .d5-auth-root .d5-btn-primary:hover:not(:disabled) {
          background: var(--d5-cobalt-ink);
          border-color: var(--d5-cobalt-ink);
          color: var(--d5-paper);
        }
        .d5-auth-root .d5-input-label {
          font-family: var(--d5-mono);
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--d5-muted);
          display: block;
          margin-bottom: 6px;
        }
        .d5-auth-root .d5-input {
          font-family: var(--d5-sans);
          background: transparent;
          border: 0;
          border-bottom: 1px solid var(--d5-rule);
          padding: 10px 0;
          color: var(--d5-graphite);
          outline: none;
          width: 100%;
          font-size: 15px;
          min-height: 44px;
        }
        .d5-auth-root .d5-input::placeholder {
          color: var(--d5-muted);
          opacity: 0.6;
        }
        .d5-auth-root .d5-input:focus {
          border-bottom-color: var(--d5-cobalt);
        }
        .d5-auth-root .d5-input.is-error {
          border-bottom-color: var(--d5-error);
        }
        .d5-auth-root .d5-input:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .d5-auth-root *::selection {
          background: var(--d5-cobalt-wash);
          color: var(--d5-cobalt-ink);
        }
        .d5-auth-root .d5-link {
          color: var(--d5-cobalt);
          text-decoration: none;
          transition: color 120ms ease;
        }
        .d5-auth-root .d5-link:hover {
          color: var(--d5-cobalt-ink);
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        @keyframes d5-auth-shake {
          0%,
          100% {
            transform: translateX(0);
          }
          20%,
          60% {
            transform: translateX(-3px);
          }
          40%,
          80% {
            transform: translateX(3px);
          }
        }
        .d5-auth-root .d5-shake {
          animation: d5-auth-shake 0.32s ease-in-out;
        }
      `}</style>

      {/* ─── TOP BAR ───────────────────────────────────────────── */}
      <header
        className="d5-mono sticky top-0 z-50 flex items-center justify-between border-b px-5 py-3 sm:px-6"
        style={{ background: T_AUTH.paper, borderColor: T_AUTH.rule }}
      >
        <Link href="/" className="flex items-center gap-3">
          <Mark size={22} color={T_AUTH.graphite} />
          <span
            className="text-[13px] tracking-[0.18em] uppercase"
            style={{ color: T_AUTH.graphite }}
          >
            CodeCanvas
          </span>
          <span
            className="hidden sm:inline text-[10px] tracking-[0.16em] uppercase"
            style={{ color: T_AUTH.muted }}
          >
            / DRAFTING ROOM
          </span>
        </Link>
        <Link
          href="/"
          className="text-[11px] tracking-[0.16em] uppercase"
          style={{ color: T_AUTH.muted }}
        >
          <span className="hidden sm:inline">← BACK TO HOME</span>
          <span className="sm:hidden">← HOME</span>
        </Link>
      </header>

      {/* ─── MAIN: gridded drafting table with centered paper sheet ─── */}
      <main className="relative flex-1 flex items-start justify-center overflow-hidden px-4 py-8 sm:px-6 sm:py-12">
        {/* hairline graph — same two-layer pattern as landing */}
        <div className="absolute inset-0 d5-grid-fine pointer-events-none" />
        <div className="absolute inset-0 d5-grid pointer-events-none" />

        {/* margin guides */}
        <div
          className="absolute left-0 right-0 h-px pointer-events-none"
          style={{ top: 32, background: T_AUTH.tick, opacity: 0.5 }}
        />
        <div
          className="absolute left-0 right-0 h-px pointer-events-none"
          style={{ bottom: 32, background: T_AUTH.tick, opacity: 0.5 }}
        />

        {/* the paper sheet */}
        <div
          className="relative w-full max-w-[460px]"
          style={{
            background: T_AUTH.paper,
            border: `1px solid ${T_AUTH.rule}`,
          }}
        >
          {/* title block — mirrors UNTITLED · DRAFT / BRIEF · v0.1 from landing */}
          <div
            className="d5-mono flex items-center justify-between border-b px-5 py-2.5 text-[10px] tracking-[0.16em] uppercase"
            style={{ borderColor: T_AUTH.rule, color: T_AUTH.muted }}
          >
            <span style={{ color: T_AUTH.graphite }}>{slug}</span>
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-1.5 w-1.5"
                style={{ background: T_AUTH.cobalt }}
              />
              SECURE
            </span>
          </div>

          {/* editorial heading */}
          <div className="px-6 pt-7 pb-2 sm:px-8 sm:pt-8">
            <h1
              className="d5-serif"
              style={{
                fontSize: "clamp(36px, 6vw, 56px)",
                lineHeight: 1.02,
                letterSpacing: "-0.02em",
                color: T_AUTH.graphite,
                fontWeight: 400,
              }}
            >
              {title}
              {italicWord && (
                <>
                  {" "}
                  <em
                    style={{
                      color: T_AUTH.cobalt,
                      fontStyle: "italic",
                    }}
                  >
                    {italicWord}
                  </em>
                </>
              )}
            </h1>
            <p
              className="d5-sans mt-3 text-[15px] leading-[1.5]"
              style={{ color: T_AUTH.muted }}
            >
              {subtitle}
            </p>
          </div>

          {/* form area */}
          <div className="px-6 pb-6 pt-4 sm:px-8 sm:pb-8 sm:pt-5">
            {children}
          </div>

          {footerNote && (
            <div
              className="d5-mono border-t px-6 py-3 text-[10px] tracking-[0.14em] uppercase sm:px-8"
              style={{
                borderColor: T_AUTH.rule,
                background: T_AUTH.vellum,
                color: T_AUTH.muted,
              }}
            >
              {footerNote}
            </div>
          )}
        </div>
      </main>

      {/* ─── BOTTOM STATUS LINE ─────────────────────────────────── */}
      <div
        className="d5-mono relative border-t flex items-center justify-between px-5 py-2 text-[10px] tracking-[0.14em] uppercase sm:px-6"
        style={{
          borderColor: T_AUTH.rule,
          background: T_AUTH.paper,
          color: T_AUTH.muted,
        }}
      >
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-1.5 h-1.5"
            style={{ background: T_AUTH.cobalt }}
          />
          AUTHENTICATION
        </span>
        <span className="hidden sm:inline">© CODECANVAS · DRAFTING ROOM</span>
      </div>
    </div>
  );
}
