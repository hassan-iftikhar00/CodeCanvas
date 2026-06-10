"use client";

import { AnimatePresence, motion } from "motion/react";

interface CanvasSurfaceProps {
  children: React.ReactNode;
  isEmpty?: boolean;
  emptyHint?: string;
  onUserInteract?: () => void;
}

export default function CanvasSurface({
  children,
  isEmpty,
  emptyHint = "Start sketching or press T to type",
  onUserInteract,
}: CanvasSurfaceProps) {
  return (
    <div
      className="relative h-full w-full overflow-hidden overscroll-none touch-none cc-dot-grid cc-vignette"
      onPointerDownCapture={onUserInteract}
    >
      {children}

      <AnimatePresence>
        {isEmpty ? (
          <motion.div
            key="empty-state"
            aria-hidden="true"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.22, 0.9, 0.28, 1] }}
            className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-elevated)]/60 text-[var(--cc-text-muted)] backdrop-blur-sm">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
              >
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              </svg>
            </span>
            <p className="text-[13px] font-medium text-[var(--cc-text-secondary)]">
              {emptyHint}
            </p>
            <p className="text-[11px] text-[var(--cc-text-muted)]">
              Press{" "}
              <kbd className="mx-0.5 rounded-[var(--cc-radius-tag)] bg-[var(--cc-bg-elevated)] px-1.5 py-0.5 font-mono text-white">
                P
              </kbd>{" "}
              to draw,
              <kbd className="mx-0.5 rounded-[var(--cc-radius-tag)] bg-[var(--cc-bg-elevated)] px-1.5 py-0.5 font-mono text-white">
                Ctrl/⌘K
              </kbd>
              for commands
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
