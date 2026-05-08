"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ZOOM_MIN, ZOOM_MAX, ZOOM_DEFAULT } from "@/types/canvas";

interface ZoomPillProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFitToScreen: () => void;
}

const PRESETS = [25, 50, 75, 100, 125, 150, 200, 300];

export default function ZoomPill({
  zoom,
  onZoomChange,
  onFitToScreen,
}: ZoomPillProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div
      ref={ref}
      className="absolute bottom-4 left-4 z-30 flex items-center gap-0.5 rounded-[10px] cc-frost px-1 py-1 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]"
    >
      <PillButton
        label="Zoom out"
        shortcut="Ctrl/⌘-"
        disabled={zoom <= ZOOM_MIN}
        onClick={() => onZoomChange(Math.max(zoom - 10, ZOOM_MIN))}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.25}
          strokeLinecap="round"
          className="h-3.5 w-3.5"
        >
          <path d="M5 12h14" />
        </svg>
      </PillButton>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-7 min-w-[52px] items-center justify-center rounded-[6px] px-2 text-[11px] font-medium tabular-nums text-[var(--cc-text-primary)] transition-colors hover:bg-[var(--cc-bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]"
      >
        {zoom}%
      </button>

      <PillButton
        label="Zoom in"
        shortcut="Ctrl/⌘+"
        disabled={zoom >= ZOOM_MAX}
        onClick={() => onZoomChange(Math.min(zoom + 10, ZOOM_MAX))}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.25}
          strokeLinecap="round"
          className="h-3.5 w-3.5"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </PillButton>

      <span
        aria-hidden="true"
        className="mx-0.5 h-4 w-px bg-[var(--cc-border-subtle)]"
      />

      <PillButton
        label="Fit to screen"
        shortcut="Ctrl/⌘0"
        onClick={onFitToScreen}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <path d="M3 8V5a2 2 0 0 1 2-2h3" />
          <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
          <path d="M3 16v3a2 2 0 0 0 2 2h3" />
          <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
        </svg>
      </PillButton>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 0.9, 0.28, 1] }}
            className="absolute bottom-full left-12 mb-2 w-32 overflow-hidden rounded-[var(--cc-radius-card)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-elevated)] py-1 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.6)]"
          >
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  onZoomChange(p);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-[12px] transition-colors ${
                  zoom === p
                    ? "bg-[var(--cc-accent-glow)] text-[var(--cc-accent)]"
                    : "text-[var(--cc-text-secondary)] hover:bg-[var(--cc-bg-canvas)] hover:text-[var(--cc-text-primary)]"
                }`}
              >
                <span>{p}%</span>
                {p === ZOOM_DEFAULT ? (
                  <kbd className="rounded-[var(--cc-radius-tag)] bg-[var(--cc-bg-canvas)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--cc-text-muted)]">
                    Ctrl/⌘0
                  </kbd>
                ) : null}
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function PillButton({
  children,
  label,
  shortcut,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--cc-text-secondary)] transition-colors hover:bg-[var(--cc-bg-elevated)] hover:text-[var(--cc-text-primary)] disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]"
    >
      {children}
    </button>
  );
}
