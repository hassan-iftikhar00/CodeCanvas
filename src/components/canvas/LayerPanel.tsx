"use client";

import { useState } from "react";
import { 
  Pencil, 
  Square, 
  Type, 
  Image, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  GripVertical,
  MoreVertical,
  Layers
} from "lucide-react";

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
        return <Pencil className="h-4 w-4" />;
      case "shape":
        return <Square className="h-4 w-4" />;
      case "text":
        return <Type className="h-4 w-4" />;
      case "image":
        return <Image className="h-4 w-4" />;
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
              <GripVertical className="h-4 w-4" />
            </div>

            {/* Layer Icon */}
            <div className="text-white">
              {getLayerIcon(layer.type)}
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
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
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
                  <Lock className="h-4 w-4" />
                ) : (
                  <Unlock className="h-4 w-4" />
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
                <MoreVertical className="h-4 w-4" />
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
            <Layers className="mx-auto mb-3 h-12 w-12 opacity-50" />
            <p className="text-sm">No layers yet</p>
            <p className="mt-1 text-xs">Start drawing to create layers</p>
          </div>
        )}
      </div>
    </div>
  );
}
