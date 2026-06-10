"use client";

import type { Tool } from "@/types/canvas";

interface StatusBarProps {
  width: number;
  height: number;
  tool: Tool;
  gridEnabled: boolean;
  snapEnabled: boolean;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

const TOOL_LABEL: Record<Tool, string> = {
  select: "Select",
  hand: "Hand",
  pen: "Pen",
  line: "Line",
  rectangle: "Rectangle",
  circle: "Circle",
  ellipse: "Ellipse",
  triangle: "Triangle",
  arrow: "Arrow",
  text: "Text",
  erase: "Eraser",
  bin: "Delete",
};

/**
 * Bottom status bar. Sits at the bottom of the canvas area, centered, with
 * the floating ZoomPill on its left and StyleRibbon overlapping prevented by
 * keeping the bar full-width and placing the dot-divided segments inline.
 *
 * Previously the canvas dimensions + mode + grid + zoom indicator was
 * absolutely positioned inside the Konva white box at `bottom-4 left-4` -
 * which collided with the FloatingToolbar (also left-side) and the ZoomPill
 * (also bottom-4 left-4). Moving it out to its own page-level row solves the
 * z-index/overlap problem permanently (BUG 6).
 */
export default function StatusBar({
  width,
  height,
  tool,
  gridEnabled,
  snapEnabled,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: StatusBarProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-7 flex-shrink-0 items-center justify-between border-t border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)]/95 px-3 font-mono text-[11px] text-[var(--cc-text-secondary)] backdrop-blur"
    >
      <div className="flex items-center gap-3 truncate">
        <span className="tabular-nums">
          {Math.round(width)} <span className="opacity-50">×</span>{" "}
          {Math.round(height)}
        </span>
        <Dot />
        <span>{TOOL_LABEL[tool] ?? tool}</span>
        <Dot />
        <span className={gridEnabled ? "text-[var(--cc-accent)]" : ""}>
          Grid {gridEnabled ? "On" : "Off"}
        </span>
        {snapEnabled && gridEnabled ? (
          <>
            <Dot />
            <span className="text-[var(--cc-accent)]">Snap</span>
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onZoomOut}
          aria-label="Zoom out"
          className="flex h-5 w-5 items-center justify-center rounded-[4px] text-[var(--cc-text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-[var(--cc-text-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--cc-accent)]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="h-3 w-3">
            <path d="M5 12h14" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onZoomReset}
          aria-label="Reset zoom"
          className="flex h-5 min-w-[44px] items-center justify-center rounded-[4px] px-1.5 text-[11px] tabular-nums text-[var(--cc-text-primary)] transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--cc-accent)]"
        >
          {zoom}%
        </button>
        <button
          type="button"
          onClick={onZoomIn}
          aria-label="Zoom in"
          className="flex h-5 w-5 items-center justify-center rounded-[4px] text-[var(--cc-text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-[var(--cc-text-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--cc-accent)]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="h-3 w-3">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Dot() {
  return (
    <span
      aria-hidden="true"
      className="h-0.5 w-0.5 rounded-full bg-[var(--cc-text-muted)]"
    />
  );
}
