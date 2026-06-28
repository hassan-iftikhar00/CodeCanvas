"use client";

import { DRAFTING_TOKENS as T } from "@/lib/drafting-room/tokens";

const recentCards = Array.from({ length: 4 }, (_, i) => i);
const projectCards = Array.from({ length: 8 }, (_, i) => i);

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
      className="flex items-center justify-between border-b px-4 py-2 text-[10px] tracking-[0.16em] uppercase"
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

export default function DashboardSkeleton() {
  return (
    <div
      className="space-y-6 p-4 sm:p-6 lg:p-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{ background: T.paper }}
    >
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Bar className="h-2.5 w-32" />
          <Bar className="mt-3 h-9 w-44" />
          <Bar className="mt-3 h-3 w-72" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="h-9 w-20"
            style={{
              background: T.paper,
              border: `1px solid ${T.rule}`,
            }}
          >
            <Bar className="m-2 h-4 w-12" />
          </div>
          <div
            className="h-9 w-24"
            style={{
              background: T.paper,
              border: `1px solid ${T.rule}`,
            }}
          >
            <Bar className="m-2 h-4 w-16" />
          </div>
          <div
            className="h-9 w-32"
            style={{
              background: T.cobaltWash,
              border: `1px solid ${T.cobalt}`,
            }}
          />
        </div>
      </div>

      {/* Recent activity */}
      <section
        style={{
          background: T.paper,
          border: `1px solid ${T.rule}`,
        }}
      >
        <Strip slug="Recent activity" />
        <div className="grid gap-2.5 p-4 md:grid-cols-2 xl:grid-cols-4">
          {recentCards.map((card) => (
            <div
              key={`recent-${card}`}
              className="p-3"
              style={{
                background: T.paper,
                border: `1px solid ${T.rule}`,
              }}
            >
              <div className="flex items-center justify-between">
                <Bar className="h-4 w-16" />
                <Bar className="h-2.5 w-14" />
              </div>
              <Bar className="mt-3 h-4 w-32" />
              <Bar className="mt-2 h-2.5 w-24" />
            </div>
          ))}
        </div>
      </section>

      {/* Filter strip */}
      <section
        style={{
          background: T.paper,
          border: `1px solid ${T.rule}`,
        }}
      >
        <Strip slug="Filter · Sort" />
        <div
          className="grid gap-px lg:grid-cols-[minmax(0,1.8fr)_repeat(3,minmax(0,1fr))]"
          style={{ background: T.rule }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div
              key={`filter-${i}`}
              className="flex flex-col px-4 py-2.5"
              style={{ background: T.paper, minHeight: 56 }}
            >
              <Bar className="h-2.5 w-14" />
              <Bar className="mt-1.5 h-3.5 w-28" />
            </div>
          ))}
        </div>
      </section>

      {/* Project grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {projectCards.map((card) => (
          <div
            key={`project-${card}`}
            className="overflow-hidden"
            style={{
              background: T.paper,
              border: `1px solid ${T.rule}`,
            }}
          >
            {/* Title strip */}
            <div
              className="flex items-center justify-between border-b px-3 py-1.5"
              style={{
                background: T.vellum,
                borderColor: T.rule,
              }}
            >
              <Bar className="h-2.5 w-14" />
              <Bar className="h-2.5 w-10" />
            </div>

            {/* Thumbnail */}
            <div
              className="aspect-video w-full border-b"
              style={{
                background: T.vellum,
                borderColor: T.rule,
                animation: "d5-pulse 1.6s ease-in-out infinite",
              }}
            />

            {/* Body */}
            <div className="p-3.5">
              <Bar className="h-4 w-32" />
              <div className="mt-3 flex items-center justify-between">
                <Bar className="h-2.5 w-24" />
                <Bar className="h-1 w-1" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes d5-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}
