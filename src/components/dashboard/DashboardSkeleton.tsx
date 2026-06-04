"use client";

import Skeleton from "@/components/ui/Skeleton";

const recentCards = Array.from({ length: 4 }, (_, i) => i);
const projectCards = Array.from({ length: 8 }, (_, i) => i);

export default function DashboardSkeleton() {
  return (
    <div
      className="space-y-6 p-6 lg:p-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Skeleton className="h-7 w-36" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      <section className="rounded-[var(--cc-radius-card)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] p-5">
        <div className="mb-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-56" />
        </div>
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          {recentCards.map((card) => (
            <div
              key={`recent-${card}`}
              className="rounded-[var(--cc-radius-card)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-canvas)] p-3.5"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="mt-3 h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-24" />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[var(--cc-radius-card)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] p-4">
        <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,0.6fr))]">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {projectCards.map((card) => (
          <div
            key={`project-${card}`}
            className="rounded-[var(--cc-radius-card)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] p-4"
          >
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-3 h-4 w-36" />
            <Skeleton className="mt-2 h-3 w-24" />
            <div className="mt-4 flex items-center justify-between">
              <Skeleton className="h-6 w-14" />
              <Skeleton className="h-6 w-6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
