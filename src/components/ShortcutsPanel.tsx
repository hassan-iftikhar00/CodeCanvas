"use client";

import { useEffect, useState } from "react";

interface Shortcut {
  keys: string[];
  description: string;
  category: "Tools" | "Canvas" | "Edit" | "View" | "General";
}

const shortcuts: Shortcut[] = [
  // Tools
  { keys: ["P"], description: "Pen tool", category: "Tools" },
  { keys: ["S"], description: "Shape tool", category: "Tools" },
  { keys: ["T"], description: "Text tool", category: "Tools" },
  { keys: ["E"], description: "Eraser tool", category: "Tools" },
  { keys: ["V"], description: "Select tool", category: "Tools" },

  // Canvas
  { keys: ["G"], description: "Toggle grid", category: "Canvas" },
  { keys: ["Shift", "S"], description: "Toggle snap to grid", category: "Canvas" },
  { keys: ["0"], description: "Fit to screen", category: "Canvas" },
  { keys: ["1"], description: "Zoom 100%", category: "Canvas" },
  { keys: ["+"], description: "Zoom in", category: "Canvas" },
  { keys: ["-"], description: "Zoom out", category: "Canvas" },

  // Edit
  { keys: ["Ctrl", "Z"], description: "Undo", category: "Edit" },
  { keys: ["Ctrl", "Shift", "Z"], description: "Redo", category: "Edit" },
  { keys: ["Ctrl", "C"], description: "Copy", category: "Edit" },
  { keys: ["Ctrl", "V"], description: "Paste", category: "Edit" },
  { keys: ["Ctrl", "D"], description: "Duplicate", category: "Edit" },
  { keys: ["Ctrl", "A"], description: "Select all", category: "Edit" },
  { keys: ["Delete"], description: "Delete selection", category: "Edit" },

  // View
  { keys: ["Ctrl", "\\"], description: "Toggle inspector", category: "View" },
  { keys: ["Ctrl", "`"], description: "Toggle code panel", category: "View" },
  { keys: ["Space"], description: "Pan mode (hold)", category: "View" },

  // General
  { keys: ["?"], description: "Show shortcuts", category: "General" },
  { keys: ["Esc"], description: "Deselect / Close", category: "General" },
  { keys: ["Ctrl", "S"], description: "Save project", category: "General" },
];

interface ShortcutsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShortcutsPanel({ isOpen, onClose }: ShortcutsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        onClose();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredShortcuts = shortcuts.filter(
    (shortcut) =>
      shortcut.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shortcut.keys.some((key) =>
        key.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  const groupedShortcuts = filteredShortcuts.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = [];
      }
      acc[shortcut.category].push(shortcut);
      return acc;
    },
    {} as Record<string, Shortcut[]>
  );

  const formatKey = (key: string) => {
    if (isMac) {
      return key
        .replace("Ctrl", "⌘")
        .replace("Shift", "⇧")
        .replace("Alt", "⌥");
    }
    return key;
  };

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-strong w-full max-w-3xl rounded-2xl shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-[var(--grey-700)] px-6 py-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Keyboard Shortcuts</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-[var(--text-secondary)] transition-all duration-[var(--duration-fast)] hover:bg-[var(--grey-700)] hover:text-white"
              aria-label="Close"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-muted)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search shortcuts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[var(--grey-700)] bg-[var(--grey-900)] py-2 pl-10 pr-4 text-white placeholder:text-[var(--text-muted)] focus:border-[var(--orange-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--orange-glow)]"
            />
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category} className="mb-6 last:mb-0">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                {category}
              </h3>
              <div className="space-y-2">
                {categoryShortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-[var(--grey-700)] bg-[var(--grey-900)] px-4 py-3 transition-colors hover:border-[var(--grey-600)] hover:bg-[var(--grey-800)]"
                  >
                    <span className="text-white">{shortcut.description}</span>
                    <div className="flex gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <kbd
                          key={keyIdx}
                          className="flex min-w-[32px] items-center justify-center rounded-md border border-[var(--grey-600)] bg-[var(--grey-800)] px-2 py-1 text-xs font-semibold text-white shadow-sm"
                        >
                          {formatKey(key)}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {filteredShortcuts.length === 0 && (
            <div className="py-12 text-center text-[var(--text-muted)]">
              <svg
                className="mx-auto mb-4 h-16 w-16 opacity-50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <p className="text-lg font-medium">No shortcuts found</p>
              <p className="mt-1 text-sm">Try a different search term</p>
            </div>
          )}
        </div>

        {/* Footer Tip */}
        <div className="border-t border-[var(--grey-700)] px-6 py-3">
          <p className="text-center text-sm text-[var(--text-muted)]">
            Press <kbd className="rounded bg-[var(--grey-800)] px-1.5 py-0.5 font-mono text-xs text-white">?</kbd> or{" "}
            <kbd className="rounded bg-[var(--grey-800)] px-1.5 py-0.5 font-mono text-xs text-white">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}
