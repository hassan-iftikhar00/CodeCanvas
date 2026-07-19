"use client";

import { DRAFTING_TOKENS as T } from "@/lib/drafting-room/tokens";

const MONO = "var(--font-jetbrains-mono, ui-monospace, monospace)";

function Bar({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        background: T.vellum,
        animation: "d5-pulse 1.6s ease-in-out infinite",
      }}
    />
  );
}

function Strip({ slug }: { slug: string }) {
  return (
    <div
      className="flex items-center justify-between border-b px-5 py-2 text-[13px] tracking-[0.16em] uppercase"
      style={{
        background: T.vellum,
        borderColor: T.rule,
        color: T.muted,
        fontFamily: MONO,
      }}
    >
      <span style={{ color: T.graphite }}>{slug}</span>
      <span>Loading</span>
    </div>
  );
}

export default function ProfileSkeleton() {
  return (
    <div
      className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6 lg:px-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{ background: T.paper }}
    >
      {/* Page header */}
      <div>
        <Bar className="h-2.5 w-32" />
        <Bar className="mt-3 h-9 w-36" />
        <Bar className="mt-3 h-3 w-72" />
      </div>

      {/* Personal information */}
      <section
        style={{
          background: T.paper,
          border: `1px solid ${T.rule}`,
        }}
      >
        <Strip slug="Personal information" />
        <div className="space-y-5 px-5 py-5">
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <div
              className="h-16 w-16 flex-none"
              style={{
                background: T.vellum,
                animation: "d5-pulse 1.6s ease-in-out infinite",
              }}
            />
            <div className="flex-1 space-y-2">
              <Bar className="h-3 w-32" />
              <Bar className="h-2.5 w-48" />
              <Bar className="h-8 w-32" />
            </div>
          </div>
          {[0, 1, 2].map((i) => (
            <div key={`f-${i}`}>
              <Bar className="h-2.5 w-20" />
              <Bar className="mt-1.5 h-9 w-full" />
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2">
            <Bar className="h-9 w-32" />
            <Bar className="h-9 w-20" />
          </div>
        </div>
      </section>

      {/* Account information */}
      <section
        style={{
          background: T.paper,
          border: `1px solid ${T.rule}`,
        }}
      >
        <Strip slug="Account information" />
        <div className="divide-y px-5" style={{ borderColor: T.rule }}>
          {[0, 1].map((i) => (
            <div
              key={`a-${i}`}
              className="flex items-center justify-between py-2.5"
            >
              <Bar className="h-2.5 w-28" />
              <Bar className="h-3 w-20" />
            </div>
          ))}
        </div>
      </section>

      <style>{`
        @keyframes d5-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}
