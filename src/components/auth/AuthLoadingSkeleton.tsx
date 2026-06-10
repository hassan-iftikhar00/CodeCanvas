"use client";

import Skeleton from "@/components/ui/Skeleton";

export default function AuthLoadingSkeleton() {
  return (
    <div
      className="flex h-screen items-center justify-center bg-[var(--cc-bg-canvas)]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-md rounded-[var(--cc-radius-card)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] p-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-2 h-4 w-48" />
        <div className="mt-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="mt-6 h-10 w-full" />
        <div className="mt-5 flex items-center justify-center">
          <span className="text-[12px] text-[var(--cc-text-secondary)]">
            Loading your session...
          </span>
        </div>
      </div>
    </div>
  );
}
