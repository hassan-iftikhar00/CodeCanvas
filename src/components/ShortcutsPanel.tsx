"use client";

import { useState } from "react";
import DraftingModal from "@/components/canvas/DraftingModal";
import { T_CANVAS } from "@/components/canvas/canvasTokens";

interface Shortcut {
  keys: string[];
  description: string;
  category: "Tools" | "Canvas" | "Edit" | "View" | "General";
}

const shortcuts: Shortcut[] = [
  { keys: ["V"], description: "Select tool", category: "Tools" },
  { keys: ["H"], description: "Hand / pan tool", category: "Tools" },
  { keys: ["P"], description: "Pen tool", category: "Tools" },
  { keys: ["N"], description: "Line tool", category: "Tools" },
  { keys: ["R"], description: "Rectangle tool", category: "Tools" },
  { keys: ["A"], description: "Arrow tool", category: "Tools" },
  { keys: ["T"], description: "Text tool", category: "Tools" },
  { keys: ["E"], description: "Eraser tool", category: "Tools" },
  { keys: ["X"], description: "Delete tool", category: "Tools" },

  { keys: ["Ctrl", "0"], description: "Reset zoom", category: "Canvas" },
  { keys: ["Ctrl", "="], description: "Zoom in", category: "Canvas" },
  { keys: ["Ctrl", "-"], description: "Zoom out", category: "Canvas" },

  { keys: ["Ctrl", "Z"], description: "Undo", category: "Edit" },
  { keys: ["Ctrl", "Shift", "Z"], description: "Redo", category: "Edit" },
  { keys: ["Ctrl", "Y"], description: "Redo", category: "Edit" },
  { keys: ["Delete"], description: "Delete selection", category: "Edit" },
  { keys: ["Backspace"], description: "Delete selection", category: "Edit" },

  { keys: ["Ctrl", "\\"], description: "Toggle inspector", category: "View" },
  { keys: ["Ctrl", "`"], description: "Toggle code panel", category: "View" },
  { keys: ["Space"], description: "Pan mode (hold)", category: "View" },

  { keys: ["?"], description: "Show shortcuts", category: "General" },
  { keys: ["Esc"], description: "Close shortcuts panel", category: "General" },
  { keys: ["Ctrl", "S"], description: "Save project", category: "General" },
];

interface ShortcutsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShortcutsPanel({
  isOpen,
  onClose,
}: ShortcutsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredShortcuts = shortcuts.filter(
    (shortcut) =>
      shortcut.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shortcut.keys.some((key) =>
        key.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  const groupedShortcuts = filteredShortcuts.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) acc[shortcut.category] = [];
      acc[shortcut.category].push(shortcut);
      return acc;
    },
    {} as Record<string, Shortcut[]>
  );

  return (
    <DraftingModal
      open={isOpen}
      onClose={onClose}
      slug="REFERENCE · SHORTCUTS"
      title="Keyboard shortcuts."
      subtitle="Every command without leaving the keyboard."
      maxWidth={680}
      footer={
        <p
          className="text-center text-[10px] tracking-[0.16em] uppercase"
          style={{
            color: T_CANVAS.muted,
            fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
          }}
        >
          PRESS <Kbd>?</Kbd> OR <Kbd>Esc</Kbd> TO CLOSE
        </p>
      }
    >
      {/* SEARCH */}
      <div className="mb-5">
        <div
          className="flex items-center gap-2 px-3 py-1.5"
          style={{
            background: T_CANVAS.paper,
            border: `1px solid ${T_CANVAS.rule}`,
          }}
        >
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
            style={{ color: T_CANVAS.muted }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="SEARCH SHORTCUTS..."
            aria-label="Search shortcuts"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-[11px] tracking-[0.14em] uppercase outline-none placeholder:opacity-60"
            style={{
              color: T_CANVAS.graphite,
              fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
            }}
            autoFocus
          />
        </div>
      </div>

      {/* GROUPED SHORTCUTS */}
      {Object.entries(groupedShortcuts).map(([category, list]) => (
        <div key={category} className="mb-5 last:mb-0">
          <div
            className="mb-2 text-[10px] tracking-[0.18em] uppercase"
            style={{
              color: T_CANVAS.muted,
              fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
            }}
          >
            {category}
          </div>
          <div
            className="divide-y"
            style={{
              border: `1px solid ${T_CANVAS.rule}`,
            }}
          >
            {list.map((s, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-3 py-2 text-[12px]"
                style={{
                  background: T_CANVAS.paper,
                  color: T_CANVAS.graphite,
                  borderTop:
                    idx === 0 ? undefined : `1px solid ${T_CANVAS.rule}`,
                  fontFamily:
                    "var(--font-inter, ui-sans-serif, system-ui, sans-serif)",
                }}
              >
                <span>{s.description}</span>
                <div className="flex gap-1">
                  {s.keys.map((key, ki) => (
                    <Kbd key={ki}>{key}</Kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {filteredShortcuts.length === 0 && (
        <div
          className="border px-4 py-12 text-center"
          style={{
            background: T_CANVAS.vellum,
            borderColor: T_CANVAS.rule,
            borderStyle: "dashed",
          }}
        >
          <p
            className="text-[12px] tracking-[0.14em] uppercase"
            style={{
              color: T_CANVAS.muted,
              fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
            }}
          >
            NO SHORTCUTS FOUND
          </p>
          <p
            className="mt-2 text-[11px]"
            style={{
              color: T_CANVAS.muted,
              fontFamily: "var(--font-inter, ui-sans-serif, system-ui)",
            }}
          >
            Try a different search term.
          </p>
        </div>
      )}
    </DraftingModal>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] tracking-[0.04em]"
      style={{
        background: T_CANVAS.vellum,
        border: `1px solid ${T_CANVAS.rule}`,
        color: T_CANVAS.graphite,
        fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
      }}
    >
      {children}
    </kbd>
  );
}
