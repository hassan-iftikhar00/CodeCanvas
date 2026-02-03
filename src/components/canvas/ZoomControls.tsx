"use client";

import { useState } from "react";

interface ZoomControlsProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFitToScreen: () => void;
}

const ZOOM_PRESETS = [100, 125, 150, 175, 200];

export default function ZoomControls({
  zoom,
  onZoomChange,
  onFitToScreen,
}: ZoomControlsProps) {
  const [showPresets, setShowPresets] = useState(false);

  const zoomIn = () => {
    const nextZoom = Math.min(zoom + 25, 200);
    onZoomChange(nextZoom);
  };

  const zoomOut = () => {
    const nextZoom = Math.max(zoom - 25, 100);
    onZoomChange(nextZoom);
  };

  const resetZoom = () => {
    onZoomChange(100);
  };

  return (
    <div className="fixed bottom-6 left-24 z-20 flex items-center gap-2">
      {/* Zoom Out */}
      <button
        onClick={zoomOut}
        disabled={zoom <= 100}
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1A1A1A] border border-[#2E2E2E] text-white transition-all hover:border-[#4A4A4A] hover:bg-[#2E2E2E] disabled:opacity-30 disabled:cursor-not-allowed"
        title="Zoom Out (Ctrl + -)"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 12H4"
          />
        </svg>
      </button>

      {/* Zoom Level Display */}
      <div className="relative">
        <button
          onClick={() => setShowPresets(!showPresets)}
          className="bg-[#1A1A1A] min-w-[80px] rounded-lg border border-[#2E2E2E] px-3 py-2 text-sm font-semibold text-white transition-all hover:border-[#4A4A4A] hover:bg-[#2E2E2E]"
        >
          {zoom}%
        </button>

        {/* Presets Dropdown */}
        {showPresets && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowPresets(false)}
            />
            <div className="absolute bottom-full left-0 z-20 mb-2 w-32 animate-slide-in-down rounded-lg border border-[#2E2E2E] bg-[#1A1A1A] py-1 shadow-xl">
              {ZOOM_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    onZoomChange(preset);
                    setShowPresets(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                    zoom === preset
                      ? "bg-[#FF6B00] text-white"
                      : "text-[#A0A0A0] hover:bg-[#2E2E2E] hover:text-white"
                  }`}
                >
                  {preset}%
                </button>
              ))}
              <div className="my-1 h-px bg-[#2E2E2E]" />
              <button
                onClick={() => {
                  onFitToScreen();
                  setShowPresets(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-[#A0A0A0] transition-colors hover:bg-[#2E2E2E] hover:text-white"
              >
                Fit to Screen
              </button>
            </div>
          </>
        )}
      </div>

      {/* Zoom In */}
      <button
        onClick={zoomIn}
        disabled={zoom >= 200}
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1A1A1A] border border-[#2E2E2E] text-white transition-all hover:border-[#4A4A4A] hover:bg-[#2E2E2E] disabled:opacity-30 disabled:cursor-not-allowed"
        title="Zoom In (Ctrl + +)"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>

      {/* Reset to 100% */}
      <button
        onClick={resetZoom}
        className="bg-[#1A1A1A] rounded-lg border border-[#2E2E2E] px-3 py-2 text-xs font-medium text-[#A0A0A0] transition-all hover:border-[#4A4A4A] hover:bg-[#2E2E2E] hover:text-white"
        title="Reset Zoom (Ctrl + 0)"
      >
        Reset
      </button>

      {/* Removed Fit to Screen icon/button */}

      {/* Pan Mode Indicator */}
      <div className="ml-2 flex items-center gap-2 rounded-lg bg-[#1A1A1A] border border-[#2E2E2E] px-3 py-2">
        <svg
          className="h-4 w-4 text-[#666666]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"
          />
        </svg>
        <span className="text-xs text-[#666666]">
          <kbd className="rounded bg-[#2E2E2E] px-1 py-0.5 font-mono text-xs">
            Space
          </kbd>{" "}
          to pan
        </span>
      </div>
    </div>
  );
}
