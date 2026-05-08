"use client";

import { useEffect } from "react";
import { TOOL_KEY_MAP, type Tool } from "@/types/canvas";

interface CanvasShortcutHandlers {
  onSelectTool: (tool: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void | Promise<void>;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onToggleRightPanel: () => void;
  onToggleCodePanel: () => void;
  onToggleShortcuts: () => void;
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};

export function useCanvasShortcuts(handlers: CanvasShortcutHandlers) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const mod = e.ctrlKey || e.metaKey;

      if (e.key === "?" && !mod) {
        e.preventDefault();
        handlers.onToggleShortcuts();
        return;
      }

      if (!mod && !e.shiftKey && !e.altKey) {
        const tool = TOOL_KEY_MAP[e.key.toLowerCase()];
        if (tool) {
          e.preventDefault();
          handlers.onSelectTool(tool);
          return;
        }
      }

      if (!mod) return;

      switch (e.key) {
        case "\\":
          e.preventDefault();
          handlers.onToggleRightPanel();
          break;
        case "`":
          e.preventDefault();
          handlers.onToggleCodePanel();
          break;
        case "z":
          e.preventDefault();
          (e.shiftKey ? handlers.onRedo : handlers.onUndo)();
          break;
        case "y":
          e.preventDefault();
          handlers.onRedo();
          break;
        case "=":
        case "+":
          e.preventDefault();
          handlers.onZoomIn();
          break;
        case "-":
          e.preventDefault();
          handlers.onZoomOut();
          break;
        case "0":
          e.preventDefault();
          handlers.onZoomReset();
          break;
        case "s":
          e.preventDefault();
          void handlers.onSave();
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}
