"use client";

import { useState } from "react";

interface ToolPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  onStrokeColorChange: (color: string) => void;
  onFillColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
}

import ColorPicker from "./ColorPicker";
import StrokeWidthSelector from "./StrokeWidthSelector";

export default function ToolPalette({
  isOpen,
  onClose,
  strokeColor,
  fillColor,
  strokeWidth,
  onStrokeColorChange,
  onFillColorChange,
  onStrokeWidthChange,
}: ToolPaletteProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Palette - positioned next to left sidebar */}
      <div className="fixed left-16 bottom-24 z-30 w-80 animate-slide-in-right rounded-2xl glass-strong p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Tool Properties</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--grey-700)] hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Stroke Color */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Stroke Color
            </label>
            <ColorPicker
              selectedColor={strokeColor}
              onColorChange={onStrokeColorChange}
              type="stroke"
            />
          </div>

          {/* Fill Color */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Fill Color
            </label>
            <ColorPicker
              selectedColor={fillColor}
              onColorChange={onFillColorChange}
              type="fill"
            />
          </div>

          {/* Stroke Width */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Stroke Width
            </label>
            <StrokeWidthSelector
              selectedWidth={strokeWidth}
              onWidthChange={onStrokeWidthChange}
            />
          </div>

          {/* Quick Tips */}
          <div className="rounded-lg bg-[var(--grey-900)] p-3">
            <p className="text-xs text-[var(--text-muted)]">
              <span className="font-semibold text-white">Tip:</span> Use keyboard shortcuts to switch tools quickly. Press <kbd className="rounded bg-[var(--grey-800)] px-1 py-0.5 font-mono text-xs text-white">?</kbd> for all shortcuts.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
