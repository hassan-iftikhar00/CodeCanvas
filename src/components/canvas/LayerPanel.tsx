"use client";

import { useState } from "react";

export interface Layer {
  id: string;
  name: string;
  type: "pen" | "shape" | "text" | "image";
  visible: boolean;
  locked: boolean;
  opacity: number;
}

interface LayerPanelProps {
  layers: Layer[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onDuplicateLayer: (id: string) => void;
  onRenameLayer: (id: string, newName: string) => void;
}

export default function LayerPanel({
  layers,
  selectedLayerId,
  onSelectLayer,
  onToggleVisibility,
  onToggleLock,
  onDeleteLayer,
  onDuplicateLayer,
  onRenameLayer,
}: LayerPanelProps) {
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [contextMenuLayer, setContextMenuLayer] = useState<string | null>(null);

  const handleRename = (id: string) => {
    if (editName.trim()) {
      onRenameLayer(id, editName.trim());
    }
    setEditingLayerId(null);
    setEditName("");
  };

  const getLayerIcon = (type: Layer["type"]) => {
    switch (type) {
      case "pen":
        return (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        );
      case "shape":
        return (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5z"
          />
        );
      case "text":
        return (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
          />
        );
      case "image":
        return (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        );
    }
  };

  return (
    <div className="h-full">
      <div className="space-y-1">
        {layers.map((layer, index) => (
          <div
            key={layer.id}
            className={`group relative flex items-center gap-2 rounded-lg border px-3 py-2 transition-all duration-[var(--duration-fast)] ${
              selectedLayerId === layer.id
                ? "border-[var(--orange-primary)] bg-[var(--orange-glow)]"
                : "border-[var(--grey-700)] bg-[var(--grey-900)] hover:border-[var(--grey-600)] hover:bg-[var(--grey-800)]"
            }`}
            onClick={() => onSelectLayer(layer.id)}
          >
            {/* Drag Handle */}
            <div className="cursor-grab text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" />
              </svg>
            </div>

            {/* Layer Icon */}
            <div className="text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {getLayerIcon(layer.type)}
              </svg>
            </div>

            {/* Layer Name */}
            <div className="flex-1">
              {editingLayerId === layer.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => handleRename(layer.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(layer.id);
                    if (e.key === "Escape") {
                      setEditingLayerId(null);
                      setEditName("");
                    }
                  }}
                  autoFocus
                  className="w-full rounded border border-[var(--orange-primary)] bg-[var(--grey-800)] px-2 py-0.5 text-sm text-white focus:outline-none"
                />
              ) : (
                <span
                  className="text-sm font-medium text-white"
                  onDoubleClick={() => {
                    setEditingLayerId(layer.id);
                    setEditName(layer.name);
                  }}
                >
                  {layer.name}
                </span>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1">
              {/* Visibility Toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility(layer.id);
                }}
                className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--grey-700)] hover:text-white"
                title={layer.visible ? "Hide layer" : "Show layer"}
              >
                {layer.visible ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                )}
              </button>

              {/* Lock Toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLock(layer.id);
                }}
                className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--grey-700)] hover:text-white"
                title={layer.locked ? "Unlock layer" : "Lock layer"}
              >
                {layer.locked ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                    />
                  </svg>
                )}
              </button>

              {/* Context Menu Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenuLayer(contextMenuLayer === layer.id ? null : layer.id);
                }}
                className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--grey-700)] hover:text-white"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
            </div>

            {/* Context Menu */}
            {contextMenuLayer === layer.id && (
              <div className="absolute right-0 top-full z-10 mt-1 w-40 animate-slide-in-down rounded-lg border border-[var(--grey-700)] bg-[var(--grey-800)] py-1 shadow-lg">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicateLayer(layer.id);
                    setContextMenuLayer(null);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-white transition-colors hover:bg-[var(--grey-700)]"
                >
                  Duplicate
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingLayerId(layer.id);
                    setEditName(layer.name);
                    setContextMenuLayer(null);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-white transition-colors hover:bg-[var(--grey-700)]"
                >
                  Rename
                </button>
                <div className="my-1 h-px bg-[var(--grey-700)]" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteLayer(layer.id);
                    setContextMenuLayer(null);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-[var(--error)] transition-colors hover:bg-[var(--grey-700)]"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}

        {layers.length === 0 && (
          <div className="py-8 text-center text-[var(--text-muted)]">
            <svg
              className="mx-auto mb-3 h-12 w-12 opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <p className="text-sm">No layers yet</p>
            <p className="mt-1 text-xs">Start drawing to create layers</p>
          </div>
        )}
      </div>
    </div>
  );
}
