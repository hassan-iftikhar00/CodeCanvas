"use client";

import { useState } from "react";

interface ToolPaletteProps {
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
  strokeColor,
  fillColor,
  strokeWidth,
  onStrokeColorChange,
  onFillColorChange,
  onStrokeWidthChange,
}: ToolPaletteProps) {
  const [showPalette, setShowPalette] = useState(false);

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setShowPalette(!showPalette)}
        className="fixed bottom-24 right-6 z-30 flex items-center gap-2 rounded-full glass-orange px-4 py-3 shadow-xl glow-orange-hover transition-all hover:scale-105"
        title="Tool Properties (Ctrl+P)"
      >
        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
        <span className="text-sm font-semibold text-white">Tools</span>
      </button>

      {/* Floating Palette Panel */}
      {showPalette && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowPalette(false)}
          />

          {/* Palette */}
          <div className="fixed bottom-24 right-24 z-30 w-80 animate-slide-in-right rounded-2xl glass-strong p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Tool Properties</h3>
              <button
                onClick={() => setShowPalette(false)}
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
      )}
    </>
  );
}
