"use client";

import type { Tool } from "@/types/canvas";
import { T_CANVAS } from "./canvasTokens";

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
  "#0E0E0F",
  "#4A4B8C",
  "#8B2A2A",
  "#1E6A3C",
  "#A85A18",
  "#6B6B6E",
  "#FAFAF7",
];

const WIDTHS: {
  id: "thin" | "medium" | "thick";
  label: string;
  value: number;
  thickness: number;
}[] = [
  { id: "thin", label: "THIN", value: 2, thickness: 1.5 },
  { id: "medium", label: "MED", value: 4, thickness: 2.5 },
  { id: "thick", label: "THICK", value: 8, thickness: 4 },
];

const VISIBLE_TOOLS: Tool[] = ["pen", "line", "rectangle", "arrow", "erase"];

/**
 * Drafting Room style controls. Renders as a vertical sidebar block (used
 * inside the DraftingToolbox PROPS tab — no more floating overlay over the
 * canvas). The component is a no-op when the current tool doesn't draw,
 * with a small placeholder hint so the panel stays informative.
 */
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
  const isEraser = currentTool === "erase";
  const showColorControls = !isEraser;
  const showFill = currentTool === "rectangle";
  const showOpacityControls = !isEraser && Boolean(onOpacityChange);

  if (!visible) {
    return (
      <div role="toolbar" aria-label="Drawing style" className="space-y-2">
        <span
          className="text-[10px] tracking-[0.18em] uppercase"
          style={{
            color: T_CANVAS.muted,
            fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
          }}
        >
          STYLE
        </span>
        <div
          className="px-3 py-2 text-[11px] leading-normal"
          style={{
            background: T_CANVAS.vellum,
            border: `1px dashed ${T_CANVAS.rule}`,
            color: T_CANVAS.muted,
            fontFamily:
              "var(--font-inter, ui-sans-serif, system-ui, sans-serif)",
          }}
        >
          Pick a drawing tool (Pen, Line, Rect, Arrow, Erase) to adjust stroke
          and width.
        </div>
      </div>
    );
  }

  return (
    <div
      role="toolbar"
      aria-label="Drawing style"
      className="space-y-4"
      style={{
        fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
      }}
    >
      {showColorControls ? (
        <Section label="COLOR">
          <div className="grid grid-cols-7 gap-1">
            {COLOR_PRESETS.map((c) => (
              <Swatch
                key={c}
                color={c}
                active={strokeColor.toLowerCase() === c.toLowerCase()}
                onClick={() => onStrokeColorChange(c)}
              />
            ))}
          </div>
          <ColorInputSwatch
            color={strokeColor}
            onChange={onStrokeColorChange}
          />
        </Section>
      ) : (
        <div
          className="px-3 py-2 text-[11px] leading-normal"
          style={{
            background: T_CANVAS.vellum,
            border: `1px dashed ${T_CANVAS.rule}`,
            color: T_CANVAS.muted,
            fontFamily:
              "var(--font-inter, ui-sans-serif, system-ui, sans-serif)",
          }}
        >
          Eraser uses size only. Color is fixed to erase by area.
        </div>
      )}

      {/* WIDTH */}
      <Section label="WIDTH">
        <div className="flex gap-1">
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
                className="flex h-8 flex-1 items-center justify-center transition-colors"
                style={{
                  background: active ? T_CANVAS.graphite : "transparent",
                  border: `1px solid ${active ? T_CANVAS.graphite : T_CANVAS.rule}`,
                  color: active ? T_CANVAS.paper : T_CANVAS.muted,
                }}
              >
                <span
                  aria-hidden="true"
                  className="block w-5"
                  style={{
                    height: w.thickness,
                    background: active ? T_CANVAS.paper : T_CANVAS.graphite,
                  }}
                />
              </button>
            );
          })}
        </div>
      </Section>

      {/* FILL — only for rectangle */}
      {showFill ? (
        <Section label="FILL">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onFillColorChange("transparent")}
              aria-pressed={fillColor === "transparent"}
              title="No fill"
              className="relative flex h-6 w-6 items-center justify-center transition-colors"
              style={{
                background: T_CANVAS.paper,
                border: `1px solid ${
                  fillColor === "transparent"
                    ? T_CANVAS.graphite
                    : T_CANVAS.rule
                }`,
              }}
            >
              <span
                aria-hidden="true"
                className="absolute inset-0 m-auto h-4 w-px rotate-45"
                style={{ background: T_CANVAS.error }}
              />
            </button>
            {COLOR_PRESETS.slice(0, 5).map((c) => (
              <Swatch
                key={`fill-${c}`}
                color={c}
                active={fillColor.toLowerCase() === c.toLowerCase()}
                onClick={() => onFillColorChange(c)}
              />
            ))}
          </div>
        </Section>
      ) : null}

      {/* OPACITY */}
      {showOpacityControls ? (
        <Section label="OPACITY">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => onOpacityChange?.(parseFloat(e.target.value))}
              aria-label="Opacity"
              className="h-px flex-1 cursor-pointer appearance-none"
              style={{
                background: `linear-gradient(to right, ${T_CANVAS.cobalt} 0%, ${T_CANVAS.cobalt} ${
                  opacity * 100
                }%, ${T_CANVAS.rule} ${opacity * 100}%, ${T_CANVAS.rule} 100%)`,
              }}
            />
            <span
              className="w-8 text-right text-[10px] tabular-nums tracking-[0.04em]"
              style={{ color: T_CANVAS.muted }}
            >
              {Math.round(opacity * 100)}%
            </span>
          </div>
        </Section>
      ) : null}
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <span
        className="text-[10px] tracking-[0.18em] uppercase block"
        style={{ color: T_CANVAS.muted }}
      >
        {label}
      </span>
      <div className="space-y-1">{children}</div>
    </div>
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
      className="flex h-6 w-full items-center justify-center transition-transform"
      style={{
        background: color,
        border: `1px solid ${active ? T_CANVAS.cobalt : T_CANVAS.rule}`,
        outline: active ? `1px solid ${T_CANVAS.cobalt}` : undefined,
        outlineOffset: active ? 1 : undefined,
        transform: active ? "scale(0.92)" : "scale(1)",
      }}
    />
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
      className="relative flex h-6 w-full cursor-pointer items-center justify-center text-[9px] tracking-[0.18em] uppercase transition-colors"
      style={{
        background: T_CANVAS.paper,
        border: `1px dashed ${T_CANVAS.rule}`,
        color: T_CANVAS.muted,
      }}
    >
      <span>+ CUSTOM</span>
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
