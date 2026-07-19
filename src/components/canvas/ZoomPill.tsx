"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ZOOM_MIN, ZOOM_MAX, ZOOM_DEFAULT } from "@/types/canvas";
import { T_CANVAS } from "./canvasTokens";

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
      className="absolute top-3 left-3 bottom-auto z-40 flex items-center gap-0.5 px-1 py-1 sm:top-auto sm:bottom-3 sm:left-3"
      style={{
        background: T_CANVAS.paper,
        border: `1px solid ${T_CANVAS.rule}`,
      }}
    >
      <PillButton
        label="Zoom out"
        shortcut="Ctrl+-"
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
        className="flex h-7 min-w-[52px] items-center justify-center px-2 text-[13px] tracking-[0.16em] tabular-nums transition-colors"
        style={{
          color: T_CANVAS.graphite,
          fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = T_CANVAS.vellum)
        }
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        {zoom}%
      </button>

      <PillButton
        label="Zoom in"
        shortcut="Ctrl++"
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
        className="mx-0.5 h-4 w-px"
        style={{ background: T_CANVAS.rule, opacity: 0.35 }}
      />

      <PillButton
        label="Fit to screen"
        shortcut="Ctrl+0"
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
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.14 }}
            className="absolute bottom-full left-12 mb-2 w-36 py-1"
            style={{
              background: T_CANVAS.paper,
              border: `1px solid ${T_CANVAS.rule}`,
            }}
          >
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  onZoomChange(p);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-1.5 text-[13px] tracking-[0.14em] uppercase transition-colors"
                style={{
                  background: zoom === p ? T_CANVAS.cobaltWash : "transparent",
                  color: zoom === p ? T_CANVAS.cobaltInk : T_CANVAS.muted,
                  fontFamily:
                    "var(--font-jetbrains-mono, ui-monospace, monospace)",
                }}
                onMouseEnter={(e) => {
                  if (zoom !== p) {
                    e.currentTarget.style.background = T_CANVAS.vellum;
                    e.currentTarget.style.color = T_CANVAS.graphite;
                  }
                }}
                onMouseLeave={(e) => {
                  if (zoom !== p) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = T_CANVAS.muted;
                  }
                }}
              >
                <span>{p}%</span>
                {p === ZOOM_DEFAULT ? (
                  <kbd
                    className="px-1.5 py-0.5 text-[12px]"
                    style={{
                      background: T_CANVAS.vellum,
                      color: T_CANVAS.muted,
                      fontFamily:
                        "var(--font-jetbrains-mono, ui-monospace, monospace)",
                    }}
                  >
                    Ctrl+0
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
      className="flex h-7 w-7 items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      style={{ color: T_CANVAS.muted }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.color = T_CANVAS.graphite;
          e.currentTarget.style.background = T_CANVAS.vellum;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = T_CANVAS.muted;
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}
