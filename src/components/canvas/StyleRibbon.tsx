"use client";

import { AnimatePresence, motion } from "motion/react";
import type { Tool } from "@/types/canvas";

interface StyleRibbonProps {
  currentTool: Tool;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity?: number;
  onStrokeColorChange: (c: string) => void;
  onFillColorChange: (c: string) => void;
  onStrokeWidthChange: (w: number) => void;
  onOpacityChange?: (o: number) => void;
}

const COLOR_PRESETS = [
  "#000000",
  "#F5F5F5",
  "#FF6B00",
  "#22C55E",
  "#3B82F6",
  "#A855F7",
  "#EC4899",
];

const WIDTHS: {
  id: "thin" | "medium" | "thick";
  label: string;
  value: number;
  thickness: number;
}[] = [
  { id: "thin", label: "Thin", value: 2, thickness: 2 },
  { id: "medium", label: "Medium", value: 4, thickness: 3 },
  { id: "thick", label: "Thick", value: 8, thickness: 5 },
];

const VISIBLE_TOOLS: Tool[] = [
  "pen",
  "rectangle",
  "circle",
  "ellipse",
  "triangle",
  "arrow",
  "erase",
];

export default function StyleRibbon({
  currentTool,
  strokeColor,
  fillColor,
  strokeWidth,
  opacity = 1,
  onStrokeColorChange,
  onFillColorChange,
  onStrokeWidthChange,
  onOpacityChange,
}: StyleRibbonProps) {
  const visible = VISIBLE_TOOLS.includes(currentTool);
  const showFill = ["rectangle", "circle", "ellipse", "triangle"].includes(
    currentTool
  );

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="style-ribbon"
          role="toolbar"
          aria-label="Drawing style"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.22, ease: [0.22, 0.9, 0.28, 1] }}
          className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 flex items-center gap-3 rounded-[10px] cc-frost px-3 py-2 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]"
        >
          {/* Color swatches */}
          <RibbonSection label="Color">
            <div className="flex items-center gap-1.5">
              {COLOR_PRESETS.map((c) => (
                <Swatch
                  key={c}
                  color={c}
                  active={strokeColor.toLowerCase() === c.toLowerCase()}
                  onClick={() => onStrokeColorChange(c)}
                />
              ))}
              <ColorInputSwatch
                color={strokeColor}
                onChange={onStrokeColorChange}
              />
            </div>
          </RibbonSection>

          <Divider />

          {/* Stroke width */}
          <RibbonSection label="Width">
            <div className="flex items-center gap-1">
              {WIDTHS.map((w) => {
                const active = strokeWidth === w.value;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => onStrokeWidthChange(w.value)}
                    aria-label={w.label}
                    aria-pressed={active}
                    title={w.label}
                    className={`flex h-7 w-9 items-center justify-center rounded-[6px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)] ${
                      active
                        ? "bg-[var(--cc-accent-glow)]"
                        : "hover:bg-[var(--cc-bg-elevated)]"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`block w-5 rounded-full ${
                        active
                          ? "bg-[var(--cc-accent)]"
                          : "bg-[var(--cc-text-secondary)]"
                      }`}
                      style={{ height: w.thickness }}
                    />
                  </button>
                );
              })}
            </div>
          </RibbonSection>

          {/* Fill (only for shapes) */}
          {showFill ? (
            <>
              <Divider />
              <RibbonSection label="Fill">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onFillColorChange("transparent")}
                    aria-pressed={fillColor === "transparent"}
                    title="No fill"
                    className={`relative flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 transition-transform duration-150 ${
                      fillColor === "transparent"
                        ? "scale-110 border-white"
                        : "border-[var(--cc-border-emphasis)]"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 m-auto h-[14px] w-[1.5px] rotate-45 bg-[var(--cc-error)]"
                    />
                  </button>
                  {COLOR_PRESETS.slice(0, 4).map((c) => (
                    <Swatch
                      key={`fill-${c}`}
                      color={c}
                      active={fillColor.toLowerCase() === c.toLowerCase()}
                      onClick={() => onFillColorChange(c)}
                    />
                  ))}
                </div>
              </RibbonSection>
            </>
          ) : null}

          {/* Opacity */}
          {onOpacityChange ? (
            <>
              <Divider />
              <RibbonSection label="Opacity">
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={opacity}
                  onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
                  aria-label="Opacity"
                  className="cc-range h-1 w-24 cursor-pointer appearance-none rounded-full bg-[var(--cc-border-subtle)]"
                  style={{
                    background: `linear-gradient(to right, var(--cc-accent) 0%, var(--cc-accent) ${
                      opacity * 100
                    }%, var(--cc-border-subtle) ${
                      opacity * 100
                    }%, var(--cc-border-subtle) 100%)`,
                  }}
                />
                <span className="ml-1 w-7 text-right text-[10px] tabular-nums text-[var(--cc-text-secondary)]">
                  {Math.round(opacity * 100)}%
                </span>
              </RibbonSection>
            </>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function RibbonSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--cc-text-muted)]">
        {label}
      </span>
      {children}
    </div>
  );
}

function Divider() {
  return (
    <span
      aria-hidden="true"
      className="h-5 w-px bg-[var(--cc-border-subtle)]"
    />
  );
}

function Swatch({
  color,
  active,
  onClick,
}: {
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Color ${color}`}
      aria-pressed={active}
      title={color}
      className={`flex h-[22px] w-[22px] items-center justify-center rounded-full transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)] ${
        active ? "scale-[1.15]" : "hover:scale-105"
      }`}
    >
      <span
        aria-hidden="true"
        className={`block h-[18px] w-[18px] rounded-full transition-shadow ${
          active
            ? "ring-2 ring-white ring-offset-2 ring-offset-[var(--cc-bg-elevated)]"
            : "ring-1 ring-inset ring-[var(--cc-border-emphasis)]"
        }`}
        style={{ backgroundColor: color }}
      />
    </button>
  );
}

function ColorInputSwatch({
  color,
  onChange,
}: {
  color: string;
  onChange: (c: string) => void;
}) {
  return (
    <label
      title="Custom color"
      className="relative flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-full border border-dashed border-[var(--cc-border-emphasis)] text-[var(--cc-text-secondary)] transition-colors hover:text-[var(--cc-text-primary)]"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        className="h-3 w-3"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      <input
        type="color"
        value={color.startsWith("#") ? color : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        aria-label="Pick custom color"
      />
    </label>
  );
}
