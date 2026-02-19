"use client";

import { useState } from "react";

interface ZoomControlsProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFitToScreen: () => void;
}

const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200, 300];

export default function ZoomControls({
  zoom,
  onZoomChange,
  onFitToScreen,
}: ZoomControlsProps) {
  const [showPresets, setShowPresets] = useState(false);

  return (
    <div className="absolute bottom-4 left-4 z-20 flex items-center gap-px rounded-lg border border-[#2E2E2E] bg-[#1A1A1A] shadow-lg overflow-hidden">
      {/* Zoom Out */}
      <button
        onClick={() => onZoomChange(Math.max(zoom - 10, 25))}
        disabled={zoom <= 25}
        className="flex h-8 w-8 items-center justify-center text-[#A0A0A0] transition-colors hover:bg-[#2E2E2E] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
        title="Zoom Out (Ctrl+-)"
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
        >
          <path d="M5 12h14" />
        </svg>
      </button>

      {/* Zoom Level / Preset dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowPresets(!showPresets)}
          className="flex h-8 min-w-[52px] items-center justify-center border-x border-[#2E2E2E] px-2 text-[11px] font-semibold text-white tabular-nums transition-colors hover:bg-[#2E2E2E]"
        >
          {zoom}%
        </button>

        {showPresets && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowPresets(false)}
            />
            <div className="absolute bottom-full left-1/2 z-20 mb-2 w-28 -translate-x-1/2 rounded-lg border border-[#2E2E2E] bg-[#1A1A1A] py-1 shadow-xl">
              {ZOOM_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    onZoomChange(p);
                    setShowPresets(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                    zoom === p
                      ? "bg-[#FF6B00] text-white"
                      : "text-[#A0A0A0] hover:bg-[#2E2E2E] hover:text-white"
                  }`}
                >
                  {p}%
                </button>
              ))}
              <div className="my-1 h-px bg-[#2E2E2E]" />
              <button
                onClick={() => {
                  onFitToScreen();
                  setShowPresets(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-[#A0A0A0] transition-colors hover:bg-[#2E2E2E] hover:text-white"
              >
                Fit to Screen
              </button>
            </div>
          </>
        )}
      </div>

      {/* Zoom In */}
      <button
        onClick={() => onZoomChange(Math.min(zoom + 10, 300))}
        disabled={zoom >= 300}
        className="flex h-8 w-8 items-center justify-center text-[#A0A0A0] transition-colors hover:bg-[#2E2E2E] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
        title="Zoom In (Ctrl+=)"
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {/* Reset */}
      <button
        onClick={() => onZoomChange(100)}
        className="flex h-8 items-center border-l border-[#2E2E2E] px-2 text-[10px] font-medium text-[#666] transition-colors hover:bg-[#2E2E2E] hover:text-white"
        title="Reset Zoom (Ctrl+0)"
      >
        Reset
      </button>
    </div>
  );
}
