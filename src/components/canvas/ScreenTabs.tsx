"use client";

import { useEffect, useRef, useState } from "react";
import { T_CANVAS } from "./canvasTokens";

/**
 * Multi-screen flows (App Uplift feature A): drafting-style tab strip for the
 * project's screens. Rendered by canvas/page.tsx above the canvas area.
 *
 * Interactions: click = switch screen, double-click = rename inline,
 * X (visible on hover, only when 2+ screens) = delete, + = add screen.
 */

export interface ScreenTabInfo {
  id: string;
  name: string;
}

interface ScreenTabsProps {
  screens: ScreenTabInfo[];
  activeScreenId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  maxScreens?: number;
}

export default function ScreenTabs({
  screens,
  activeScreenId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  maxScreens = 6,
}: ScreenTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  const commitRename = () => {
    if (editingId) {
      const name = draftName.trim();
      if (name) onRename(editingId, name);
    }
    setEditingId(null);
  };

  return (
    <div
      className="flex items-center"
      style={{
        border: `1px solid ${T_CANVAS.rule}`,
        background: T_CANVAS.paper,
        fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
      }}
      role="tablist"
      aria-label="Screens"
    >
      {screens.map((screen, i) => {
        const active = screen.id === activeScreenId;
        const editing = editingId === screen.id;
        return (
          <div
            key={screen.id}
            className="group flex items-center"
            style={{
              background: active ? T_CANVAS.graphite : T_CANVAS.paper,
              borderLeft: i > 0 ? `1px solid ${T_CANVAS.rule}` : undefined,
            }}
          >
            {editing ? (
              <input
                ref={inputRef}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setEditingId(null);
                }}
                maxLength={24}
                aria-label="Screen name"
                className="w-24 px-2 py-1 text-[10px] tracking-[0.1em] uppercase outline-none"
                style={{
                  background: T_CANVAS.paper,
                  color: T_CANVAS.graphite,
                  border: `1px solid ${T_CANVAS.cobalt}`,
                }}
              />
            ) : (
              <button
                role="tab"
                aria-selected={active}
                onClick={() => onSelect(screen.id)}
                onDoubleClick={() => {
                  setEditingId(screen.id);
                  setDraftName(screen.name);
                }}
                className="max-w-[140px] truncate px-2.5 py-1 text-[10px] tracking-[0.14em] uppercase transition-colors"
                style={{
                  color: active ? T_CANVAS.paper : T_CANVAS.muted,
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.color = T_CANVAS.graphite;
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.color = T_CANVAS.muted;
                }}
                title={`${screen.name} (double-click to rename)`}
              >
                {screen.name}
              </button>
            )}
            {screens.length > 1 && !editing && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(screen.id);
                }}
                className="mr-1 hidden h-4 w-4 items-center justify-center group-hover:flex"
                style={{ color: active ? T_CANVAS.paper : T_CANVAS.muted }}
                title={`Delete ${screen.name}`}
                aria-label={`Delete screen ${screen.name}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  className="h-2.5 w-2.5"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        );
      })}

      {screens.length < maxScreens && (
        <button
          onClick={onAdd}
          className="flex h-6 w-7 items-center justify-center transition-colors"
          style={{
            background: T_CANVAS.paper,
            color: T_CANVAS.muted,
            borderLeft: `1px solid ${T_CANVAS.rule}`,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = T_CANVAS.cobalt)}
          onMouseLeave={(e) => (e.currentTarget.style.color = T_CANVAS.muted)}
          title="Add screen"
          aria-label="Add screen"
        >
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
        </button>
      )}
    </div>
  );
}
