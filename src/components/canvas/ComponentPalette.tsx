"use client";

import { useState } from "react";

interface Component {
  id: string;
  name: string;
  icon: string;
  description: string;
  canvasData: {
    shapes: Array<{
      type: "rectangle" | "circle" | "text";
      x: number;
      y: number;
      width?: number;
      height?: number;
      radius?: number;
      text?: string;
    }>;
    lines: any[];
  };
}

const COMPONENTS: Component[] = [
  {
    id: "button",
    name: "Button",
    icon: "🔘",
    description: "Interactive button",
    canvasData: {
      shapes: [
        { type: "rectangle", x: 200, y: 200, width: 120, height: 45 },
        { type: "text", x: 240, y: 220, text: "Click Me" },
      ],
      lines: [],
    },
  },
  {
    id: "input",
    name: "Input Field",
    icon: "📝",
    description: "Text input",
    canvasData: {
      shapes: [
        { type: "rectangle", x: 200, y: 200, width: 250, height: 40 },
        { type: "text", x: 210, y: 215, text: "Enter text..." },
      ],
      lines: [],
    },
  },
  {
    id: "card",
    name: "Card",
    icon: "🃏",
    description: "Content card",
    canvasData: {
      shapes: [
        { type: "rectangle", x: 180, y: 150, width: 280, height: 200 },
        { type: "text", x: 250, y: 190, text: "Card Title" },
        { type: "text", x: 210, y: 230, text: "Card description here" },
        { type: "rectangle", x: 220, y: 290, width: 100, height: 35 },
        { type: "text", x: 245, y: 307, text: "Action" },
      ],
      lines: [],
    },
  },
  {
    id: "navbar",
    name: "Navbar",
    icon: "🧭",
    description: "Navigation bar",
    canvasData: {
      shapes: [
        { type: "rectangle", x: 50, y: 50, width: 900, height: 70 },
        { type: "text", x: 80, y: 85, text: "LOGO" },
        { type: "text", x: 700, y: 85, text: "Menu" },
      ],
      lines: [],
    },
  },
  {
    id: "hero",
    name: "Hero Section",
    icon: "🎯",
    description: "Hero banner",
    canvasData: {
      shapes: [
        { type: "rectangle", x: 100, y: 100, width: 800, height: 350 },
        { type: "text", x: 300, y: 200, text: "Hero Heading" },
        { type: "text", x: 280, y: 250, text: "Subheading text here" },
        { type: "rectangle", x: 350, y: 310, width: 150, height: 50 },
        { type: "text", x: 395, y: 335, text: "CTA Button" },
      ],
      lines: [],
    },
  },
  {
    id: "footer",
    name: "Footer",
    icon: "📐",
    description: "Page footer",
    canvasData: {
      shapes: [
        { type: "rectangle", x: 50, y: 450, width: 900, height: 100 },
        { type: "text", x: 100, y: 490, text: "Company © 2026" },
        { type: "text", x: 700, y: 490, text: "Links" },
      ],
      lines: [],
    },
  },
];

interface ComponentPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertComponent: (component: Component) => void;
}

export default function ComponentPalette({
  isOpen,
  onClose,
  onInsertComponent,
}: ComponentPaletteProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-10 bg-black/30 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-30 h-screen w-80 animate-slide-in-right border-l border-[#2E2E2E] bg-[#1A1A1A] shadow-2xl">
        {/* Header */}
        <div className="border-b border-[#2E2E2E] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Components</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#A0A0A0] transition-colors hover:bg-[#2E2E2E] hover:text-white"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <p className="text-xs text-[#A0A0A0]">
            Quick-add UI elements to your canvas
          </p>
        </div>

        {/* Components Grid */}
        <div className="h-[calc(100vh-120px)] overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            {COMPONENTS.map((component) => (
              <button
                key={component.id}
                onClick={() => {
                  onInsertComponent(component);
                  onClose();
                }}
                className="group flex flex-col items-center gap-2 rounded-xl border border-[#2E2E2E] bg-[#0A0A0A] p-4 text-center transition-all hover:border-[#FF6B00] hover:bg-[#1A1A1A] hover:shadow-[0_0_20px_rgba(255,107,0,0.2)]"
              >
                <span className="text-3xl">{component.icon}</span>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {component.name}
                  </h3>
                  <p className="mt-1 text-xs text-[#A0A0A0]">
                    {component.description}
                  </p>
                </div>
                <div className="mt-auto flex items-center gap-1 text-xs text-[#FF6B00] opacity-0 transition-opacity group-hover:opacity-100">
                  <svg
                    className="h-3 w-3"
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
                  Add
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
