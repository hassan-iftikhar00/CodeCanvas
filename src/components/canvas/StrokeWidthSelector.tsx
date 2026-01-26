"use client";

import { useState } from "react";

interface StrokeWidthSelectorProps {
  selectedWidth: number;
  onWidthChange: (width: number) => void;
}

const QUICK_PRESETS = [
  { label: "Fine", value: 2 },
  { label: "Normal", value: 5 },
  { label: "Bold", value: 10 },
  { label: "Heavy", value: 15 },
];

export default function StrokeWidthSelector({
  selectedWidth,
  onWidthChange,
}: StrokeWidthSelectorProps) {
  const [showSelector, setShowSelector] = useState(false);

  return (
    <div className="relative">
      {/* Width Button */}
      <button
        onClick={() => setShowSelector(!showSelector)}
        className="flex items-center gap-2 rounded-lg border border-[var(--grey-700)] bg-[var(--grey-900)] px-3 py-2 transition-all hover:border-[var(--grey-600)]"
        title="Stroke Width"
      >
        <div className="flex h-6 w-6 items-center justify-center">
          <div
            className="rounded-full bg-white"
            style={{
              width: `${Math.min(selectedWidth, 20)}px`,
              height: `${Math.min(selectedWidth, 20)}px`,
            }}
          />
        </div>
        <span className="text-xs font-medium text-white">{selectedWidth}px</span>
        <svg
          className={`h-4 w-4 text-[var(--text-muted)] transition-transform ${showSelector ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Selector Popup */}
      {showSelector && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowSelector(false)}
          />

          {/* Selector Panel */}
          <div className="absolute left-0 top-full z-20 mt-2 w-64 animate-slide-in-down rounded-xl border border-[var(--grey-700)] bg-[var(--grey-800)] p-4 shadow-xl">
            {/* Quick Presets */}
            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                Presets
              </label>
              <div className="grid grid-cols-4 gap-2">
                {QUICK_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => {
                      onWidthChange(preset.value);
                      setShowSelector(false);
                    }}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                      selectedWidth === preset.value
                        ? "border-[var(--orange-primary)] bg-[var(--orange-glow)] text-white"
                        : "border-[var(--grey-700)] bg-[var(--grey-900)] text-[var(--text-secondary)] hover:border-[var(--grey-600)] hover:text-white"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Slider */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Custom
                </label>
                <span className="text-sm font-bold text-[var(--orange-primary)]">
                  {selectedWidth}px
                </span>
              </div>
              
              <input
                type="range"
                min="1"
                max="20"
                value={selectedWidth}
                onChange={(e) => onWidthChange(Number(e.target.value))}
                className="w-full accent-[var(--orange-primary)]"
              />

              {/* Visual Preview */}
              <div className="mt-4 flex h-12 items-center justify-center rounded-lg bg-[var(--grey-900)]">
                <div
                  className="rounded-full bg-white"
                  style={{
                    width: `${selectedWidth * 2}px`,
                    height: `${selectedWidth}px`,
                  }}
                />
              </div>

              {/* Min/Max Labels */}
              <div className="mt-1 flex justify-between text-xs text-[var(--text-muted)]">
                <span>1px</span>
                <span>20px</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
