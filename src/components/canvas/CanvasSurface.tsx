"use client";

import { AnimatePresence, motion } from "motion/react";
import { T_CANVAS } from "./canvasTokens";

interface CanvasSurfaceProps {
  children: React.ReactNode;
  isEmpty?: boolean;
  emptyHint?: string;
  onUserInteract?: () => void;
}

/**
 * Drafting Room canvas surface — paper background with a two-layer hairline
 * graph (fine 8px texture + coarse 32px structural). The white Konva
 * SketchCanvas sits on top like a sheet of drawing paper on a drafting table.
 */
export default function CanvasSurface({
  children,
  isEmpty,
  emptyHint = "Start sketching or press T to type",
  onUserInteract,
}: CanvasSurfaceProps) {
  return (
    <div
      className="relative h-full w-full overflow-hidden overscroll-none touch-none"
      style={{ background: T_CANVAS.vellum }}
      onPointerDownCapture={onUserInteract}
    >
      {/* fine hairline texture — 1px lines at 8px grid, low opacity */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(to right, ${T_CANVAS.tick} 1px, transparent 1px), linear-gradient(to bottom, ${T_CANVAS.tick} 1px, transparent 1px)`,
          backgroundSize: "8px 8px",
          opacity: 0.35,
        }}
      />
      {/* coarse structural graph — 1.5px lines at 32px grid, full opacity */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(to right, ${T_CANVAS.tick} 1.5px, transparent 1.5px), linear-gradient(to bottom, ${T_CANVAS.tick} 1.5px, transparent 1.5px)`,
          backgroundSize: "32px 32px",
          opacity: 0.9,
        }}
      />

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
            <span
              className="flex h-14 w-14 items-center justify-center"
              style={{
                background: T_CANVAS.paper,
                border: `1px solid ${T_CANVAS.rule}`,
                color: T_CANVAS.cobalt,
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
              >
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              </svg>
            </span>
            <p
              className="text-[11px] tracking-[0.16em] uppercase"
              style={{
                color: T_CANVAS.graphite,
                fontFamily:
                  "var(--font-jetbrains-mono, ui-monospace, monospace)",
              }}
            >
              {emptyHint}
            </p>
            <p
              className="text-[10px] tracking-[0.14em] uppercase"
              style={{
                color: T_CANVAS.muted,
                fontFamily:
                  "var(--font-jetbrains-mono, ui-monospace, monospace)",
              }}
            >
              Press{" "}
              <kbd
                className="mx-0.5 px-1.5 py-0.5"
                style={{
                  background: T_CANVAS.vellum,
                  color: T_CANVAS.graphite,
                  fontFamily:
                    "var(--font-jetbrains-mono, ui-monospace, monospace)",
                }}
              >
                P
              </kbd>{" "}
              to draw ·{" "}
              <kbd
                className="mx-0.5 px-1.5 py-0.5"
                style={{
                  background: T_CANVAS.vellum,
                  color: T_CANVAS.graphite,
                  fontFamily:
                    "var(--font-jetbrains-mono, ui-monospace, monospace)",
                }}
              >
                Ctrl+K
              </kbd>{" "}
              for commands
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
