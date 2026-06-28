"use client";

import { motion } from "motion/react";
import type { Tool, ToolGroup } from "@/types/canvas";
import { T_CANVAS } from "./canvasTokens";

interface ToolItem {
  id: Tool;
  label: string;
  shortcut: string;
  group: ToolGroup;
  icon: React.ReactNode;
}

const TOOLS: ToolItem[] = [
  {
    id: "select",
    label: "Select",
    shortcut: "V",
    group: "pointer",
    icon: <SelectIcon />,
  },
  {
    id: "hand",
    label: "Hand / Pan",
    shortcut: "H",
    group: "pointer",
    icon: <HandIcon />,
  },
  {
    id: "pen",
    label: "Pen",
    shortcut: "P",
    group: "draw",
    icon: <PenIcon />,
  },
  {
    id: "line",
    label: "Line",
    shortcut: "N",
    group: "draw",
    icon: <LineIcon />,
  },
  {
    id: "rectangle",
    label: "Rectangle",
    shortcut: "R",
    group: "shape",
    icon: <RectIcon />,
  },
  {
    id: "arrow",
    label: "Arrow",
    shortcut: "A",
    group: "shape",
    icon: <ArrowIcon />,
  },
  {
    id: "text",
    label: "Text",
    shortcut: "T",
    group: "annotate",
    icon: <TextIcon />,
  },
  {
    id: "erase",
    label: "Eraser",
    shortcut: "E",
    group: "modify",
    icon: <EraserIcon />,
  },
  {
    id: "bin",
    label: "Delete",
    shortcut: "X",
    group: "modify",
    icon: <BinIcon />,
  },
];

const GROUP_ORDER: ToolGroup[] = [
  "pointer",
  "draw",
  "shape",
  "annotate",
  "modify",
];

interface FloatingToolbarProps {
  currentTool: Tool;
  onSelectTool: (tool: Tool) => void;
}

export default function FloatingToolbar({
  currentTool,
  onSelectTool,
}: FloatingToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Drawing tools"
      aria-orientation="vertical"
      data-onboarding="draw-tools"
      // Vertically centered on the left rail. max-h clamps to viewport so the
      // toolbar can never overflow when the code panel grows and the canvas
      // area shrinks. Drafting room: paper bg + hairline border, no glow.
      style={{
        scrollbarWidth: "none",
        background: T_CANVAS.paper,
        border: `1px solid ${T_CANVAS.rule}`,
      }}
      className="absolute left-3 top-1/2 -translate-y-1/2 z-40 flex max-h-[calc(100%-1.5rem)] flex-col items-center gap-0.5 overflow-y-auto p-1.5 [&::-webkit-scrollbar]:hidden"
    >
      {GROUP_ORDER.map((group, gi) => (
        <div key={group} className="flex flex-col items-center gap-1">
          {gi > 0 ? (
            <div
              aria-hidden="true"
              className="my-1 h-px w-5"
              style={{ background: T_CANVAS.rule, opacity: 0.35 }}
            />
          ) : null}
          {TOOLS.filter((t) => t.group === group).map((tool) => (
            <ToolButton
              key={tool.id}
              tool={tool}
              active={currentTool === tool.id}
              onSelect={onSelectTool}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function ToolButton({
  tool,
  active,
  onSelect,
}: {
  tool: ToolItem;
  active: boolean;
  onSelect: (tool: Tool) => void;
}) {
  return (
    <div className="group relative">
      <motion.button
        type="button"
        onClick={() => onSelect(tool.id)}
        aria-label={`${tool.label} (${tool.shortcut})`}
        aria-pressed={active}
        animate={active ? { scale: [0.9, 1] } : { scale: 1 }}
        transition={{
          duration: 0.22,
          ease: [0.34, 1.56, 0.64, 1],
        }}
        className="relative flex h-9 w-9 items-center justify-center transition-colors duration-150 focus-visible:outline-none"
        style={{
          background: active ? T_CANVAS.graphite : "transparent",
          color: active ? T_CANVAS.paper : T_CANVAS.muted,
          border: `1px solid ${active ? T_CANVAS.graphite : "transparent"}`,
        }}
        onMouseEnter={(e) => {
          if (!active) e.currentTarget.style.color = T_CANVAS.graphite;
        }}
        onMouseLeave={(e) => {
          if (!active) e.currentTarget.style.color = T_CANVAS.muted;
        }}
      >
        {/* Active left accent bar — cobalt mark */}
        {active ? (
          <motion.span
            layoutId="cc-toolbar-active-bar"
            aria-hidden="true"
            className="absolute -left-1.5 top-1.5 bottom-1.5 w-[2px]"
            style={{ background: T_CANVAS.cobalt }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        ) : null}
        {tool.icon}
      </motion.button>

      {/* Tooltip — mono, paper bg, hairline border */}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap px-2 py-1 text-[10px] tracking-[0.14em] uppercase opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-hover:delay-150"
        style={{
          background: T_CANVAS.paper,
          border: `1px solid ${T_CANVAS.rule}`,
          color: T_CANVAS.graphite,
          fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
        }}
      >
        {tool.label}
        <kbd
          className="ml-2 px-1.5 py-0.5 text-[10px]"
          style={{
            background: T_CANVAS.vellum,
            color: T_CANVAS.muted,
            fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
          }}
        >
          {tool.shortcut}
        </kbd>
      </span>
    </div>
  );
}

// ───────────────── Icons ─────────────────
const _icon = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-[18px] w-[18px]",
};
function SelectIcon() {
  return (
    <svg {..._icon}>
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      <path d="M13 13l6 6" />
    </svg>
  );
}
function HandIcon() {
  return (
    <svg {..._icon}>
      <path d="M18 11V6a2 2 0 0 0-4 0v1" />
      <path d="M14 10V4a2 2 0 0 0-4 0v2" />
      <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  );
}
function PenIcon() {
  return (
    <svg {..._icon}>
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    </svg>
  );
}
function LineIcon() {
  return (
    <svg {..._icon}>
      {/* Point-to-point straight line with end dots - Excalidraw style */}
      <circle cx="5" cy="19" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="5" r="1.6" fill="currentColor" stroke="none" />
      <line x1="5" y1="19" x2="19" y2="5" />
    </svg>
  );
}
function RectIcon() {
  return (
    <svg {..._icon}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg {..._icon}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
function TextIcon() {
  return (
    <svg {..._icon}>
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  );
}
function EraserIcon() {
  return (
    <svg {..._icon}>
      <path d="M20 20H7L3 16c-.6-.6-.6-1.5 0-2.1l10-10c.6-.6 1.5-.6 2.1 0l6 6c.6.6.6 1.5 0 2.1L14 19" />
      <path d="M7 20l-4-4" />
    </svg>
  );
}
function BinIcon() {
  return (
    <svg {..._icon}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
