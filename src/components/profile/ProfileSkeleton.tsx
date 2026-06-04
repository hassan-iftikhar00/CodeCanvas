"use client";

import Skeleton from "@/components/ui/Skeleton";

export default function ProfileSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-live="polite" aria-busy="true">
      <div>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>

      <section className="rounded-[var(--cc-radius-card)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] p-5">
        <Skeleton className="h-4 w-40" />
        <div className="mt-4 flex items-start gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-8 w-32" />
          </div>
        </div>
        <div className="mt-5 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      </section>

      <section className="rounded-[var(--cc-radius-card)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] p-5">
        <Skeleton className="h-4 w-36" />
        <div className="mt-4 grid gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </section>
    </div>
  );
}
