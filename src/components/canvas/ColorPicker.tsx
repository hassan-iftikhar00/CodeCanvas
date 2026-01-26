"use client";

import { useState } from "react";

interface ColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
  type: "stroke" | "fill";
}

const PRESET_COLORS = [
  "#000000", // Black
  "#FFFFFF", // White
  "#FF6B00", // Orange (brand)
  "#EF4444", // Red
  "#F59E0B", // Amber
  "#10B981", // Green
  "#3B82F6", // Blue
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#6B7280", // Gray
  "#FCD34D", // Yellow
  "#60A5FA", // Light Blue
  "#A78BFA", // Light Purple
  "#F472B6", // Light Pink
  "#94A3B8", // Slate
  "#D1D5DB", // Light Gray
];

export default function ColorPicker({ selectedColor, onColorChange, type }: ColorPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [customColor, setCustomColor] = useState(selectedColor);
  const [recentColors, setRecentColors] = useState<string[]>([]);

  const handleColorSelect = (color: string) => {
    onColorChange(color);
    setCustomColor(color);
    
    // Add to recent colors
    setRecentColors((prev) => {
      const filtered = prev.filter((c) => c !== color);
      return [color, ...filtered].slice(0, 8);
    });
  };

  const handleCustomColor = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setCustomColor(color);
    handleColorSelect(color);
  };

  return (
    <div className="relative">
      {/* Color Button */}
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="flex items-center gap-2 rounded-lg border border-[var(--grey-700)] bg-[var(--grey-900)] px-3 py-2 transition-all hover:border-[var(--grey-600)]"
        title={`${type === "stroke" ? "Stroke" : "Fill"} Color`}
      >
        <div
          className="h-6 w-6 rounded border-2 border-[var(--grey-600)] shadow-sm"
          style={{ backgroundColor: selectedColor }}
        />
        <span className="text-xs font-medium text-white capitalize">{type}</span>
        <svg
          className={`h-4 w-4 text-[var(--text-muted)] transition-transform ${showPicker ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Color Picker Popup */}
      {showPicker && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowPicker(false)}
          />
          
          {/* Picker Panel */}
          <div className="absolute left-0 top-full z-20 mt-2 w-64 animate-slide-in-down rounded-xl border border-[var(--grey-700)] bg-[var(--grey-800)] p-4 shadow-xl">
            {/* Preset Colors */}
            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                Presets
              </label>
              <div className="grid grid-cols-8 gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorSelect(color)}
                    className={`h-8 w-8 rounded-lg border-2 transition-all hover:scale-110 ${
                      selectedColor === color
                        ? "border-[var(--orange-primary)] shadow-[var(--shadow-orange-glow)]"
                        : "border-[var(--grey-600)] hover:border-[var(--grey-500)]"
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Recent Colors */}
            {recentColors.length > 0 && (
              <div className="mb-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Recent
                </label>
                <div className="grid grid-cols-8 gap-2">
                  {recentColors.map((color, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleColorSelect(color)}
                      className="h-8 w-8 rounded-lg border-2 border-[var(--grey-600)] transition-all hover:scale-110 hover:border-[var(--grey-500)]"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Custom Color Input */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                Custom
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customColor}
                  onChange={handleCustomColor}
                  className="h-10 w-full cursor-pointer rounded-lg border-2 border-[var(--grey-600)] bg-transparent"
                />
                <input
                  type="text"
                  value={customColor.toUpperCase()}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^#[0-9A-F]{0,6}$/i.test(val)) {
                      setCustomColor(val);
                      if (val.length === 7) handleColorSelect(val);
                    }
                  }}
                  className="w-24 rounded-lg border border-[var(--grey-700)] bg-[var(--grey-900)] px-2 py-1.5 text-xs font-mono text-white focus:border-[var(--orange-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--orange-glow)]"
                  placeholder="#000000"
                  maxLength={7}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
