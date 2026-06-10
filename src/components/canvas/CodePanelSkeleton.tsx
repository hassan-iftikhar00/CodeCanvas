"use client";

import Skeleton from "@/components/ui/Skeleton";

const lines = [
  "w-2/3",
  "w-1/2",
  "w-5/6",
  "w-3/5",
  "w-4/6",
  "w-2/5",
  "w-3/4",
  "w-1/2",
  "w-5/6",
  "w-2/3",
  "w-4/5",
  "w-1/3",
];

export default function CodePanelSkeleton() {
  return (
    <div className="h-full w-full bg-[var(--cc-bg-surface)] p-4" role="status" aria-live="polite">
      <div className="space-y-2">
        {lines.map((width, index) => (
          <Skeleton key={`line-${index}`} className={`h-3 ${width}`} />
        ))}
      </div>
    </div>
  );
}
