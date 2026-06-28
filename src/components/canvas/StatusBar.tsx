"use client";

import type { Tool } from "@/types/canvas";
import { T_CANVAS } from "./canvasTokens";

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
  select: "SELECT",
  hand: "HAND",
  pen: "PEN",
  line: "LINE",
  rectangle: "RECT",
  circle: "CIRCLE",
  ellipse: "ELLIPSE",
  triangle: "TRIANGLE",
  arrow: "ARROW",
  text: "TEXT",
  erase: "ERASER",
  bin: "DELETE",
};

/**
 * Drafting Room status bar — mono uppercase metrics, cobalt accents for
 * active modes, hairline top border. Mirrors the landing page's
 * `IDLE · ZOOM · GRID · SNAP` bottom rail visually.
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
      className="flex h-7 flex-shrink-0 items-center justify-between border-t px-3 text-[10px] tracking-[0.14em] uppercase"
      style={{
        borderColor: T_CANVAS.rule,
        background: T_CANVAS.paper,
        color: T_CANVAS.muted,
        fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
      }}
    >
      <div className="flex items-center gap-3 truncate">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5"
            style={{ background: T_CANVAS.cobalt }}
          />
          <span style={{ color: T_CANVAS.graphite }}>{TOOL_LABEL[tool] ?? tool.toUpperCase()}</span>
        </span>
        <Sep />
        <span className="tabular-nums">
          {Math.round(width)} × {Math.round(height)}
        </span>
        <Sep />
        <span style={{ color: gridEnabled ? T_CANVAS.graphite : T_CANVAS.muted }}>
          GRID {gridEnabled ? "ON" : "OFF"}
        </span>
        {snapEnabled && gridEnabled ? (
          <>
            <Sep />
            <span style={{ color: T_CANVAS.cobalt }}>SNAP</span>
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-0.5">
        <ZoomBtn label="Zoom out" onClick={onZoomOut}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            className="h-3 w-3"
          >
            <path d="M5 12h14" />
          </svg>
        </ZoomBtn>
        <button
          type="button"
          onClick={onZoomReset}
          aria-label="Reset zoom"
          className="flex h-5 min-w-[44px] items-center justify-center px-1.5 text-[10px] tabular-nums transition-colors"
          style={{ color: T_CANVAS.graphite }}
          onMouseEnter={(e) => (e.currentTarget.style.background = T_CANVAS.vellum)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          {zoom}%
        </button>
        <ZoomBtn label="Zoom in" onClick={onZoomIn}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            className="h-3 w-3"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </ZoomBtn>
      </div>
    </div>
  );
}

function ZoomBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-5 w-5 items-center justify-center transition-colors"
      style={{ color: T_CANVAS.muted }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = T_CANVAS.graphite;
        e.currentTarget.style.background = T_CANVAS.vellum;
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

function Sep() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-0.5 w-0.5"
      style={{ background: T_CANVAS.muted, opacity: 0.5 }}
    />
  );
}
