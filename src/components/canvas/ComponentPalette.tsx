"use client";

import DraftingModal from "./DraftingModal";
import { T_CANVAS } from "./canvasTokens";

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
    icon: "",
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
    icon: "",
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
    icon: "",
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
    icon: "",
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
    icon: "",
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
    icon: "",
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
  return (
    <DraftingModal
      open={isOpen}
      onClose={onClose}
      slug="LIBRARY · COMPONENTS"
      title="Drop-in elements."
      subtitle="Quick-add common UI patterns to bootstrap your sketch."
      maxWidth={680}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {COMPONENTS.map((component) => (
          <button
            key={component.id}
            onClick={() => {
              onInsertComponent(component);
              onClose();
            }}
            className="group flex flex-col items-start gap-2 px-3 py-3 text-left transition-colors"
            style={{
              background: T_CANVAS.paper,
              border: `1px solid ${T_CANVAS.rule}`,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = T_CANVAS.cobalt)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = T_CANVAS.rule)
            }
          >
            <span
              className="flex h-7 w-7 items-center justify-center"
              style={{
                background: T_CANVAS.vellum,
                border: `1px solid ${T_CANVAS.rule}`,
                color: T_CANVAS.cobalt,
              }}
            >
              <ComponentGlyph id={component.id} />
            </span>
            <h3
              className="text-[11px] tracking-[0.16em] uppercase"
              style={{
                color: T_CANVAS.graphite,
                fontFamily:
                  "var(--font-jetbrains-mono, ui-monospace, monospace)",
              }}
            >
              {component.name}
            </h3>
            <p
              className="text-[11px] leading-[1.4]"
              style={{
                color: T_CANVAS.muted,
                fontFamily:
                  "var(--font-inter, ui-sans-serif, system-ui, sans-serif)",
              }}
            >
              {component.description}
            </p>
            <span
              className="mt-1 inline-flex items-center gap-1 text-[10px] tracking-[0.16em] uppercase opacity-0 transition-opacity group-hover:opacity-100"
              style={{ color: T_CANVAS.cobalt }}
            >
              + INSERT →
            </span>
          </button>
        ))}
      </div>
    </DraftingModal>
  );
}

function ComponentGlyph({ id }: { id: string }) {
  const ic = {
    fill: "none" as const,
    stroke: "currentColor" as const,
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
    className: "h-4 w-4",
    "aria-hidden": true,
  };
  switch (id) {
    case "button":
      return (
        <svg {...ic}>
          <rect x="3" y="9" width="18" height="6" rx="1" />
        </svg>
      );
    case "input":
      return (
        <svg {...ic}>
          <rect x="3" y="9" width="18" height="6" rx="0.5" />
          <line x1="6" y1="12" x2="10" y2="12" />
        </svg>
      );
    case "card":
      return (
        <svg {...ic}>
          <rect x="3" y="4" width="18" height="16" rx="1" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case "navbar":
      return (
        <svg {...ic}>
          <rect x="2" y="5" width="20" height="4" rx="0.5" />
          <line x1="5" y1="7" x2="9" y2="7" />
          <line x1="16" y1="7" x2="19" y2="7" />
        </svg>
      );
    case "hero":
      return (
        <svg {...ic}>
          <rect x="3" y="4" width="18" height="14" rx="1" />
          <line x1="6" y1="9" x2="14" y2="9" />
          <line x1="6" y1="12" x2="11" y2="12" />
          <rect x="6" y="14" width="6" height="2" rx="0.5" />
        </svg>
      );
    case "footer":
      return (
        <svg {...ic}>
          <rect x="2" y="14" width="20" height="6" rx="0.5" />
          <line x1="5" y1="17" x2="11" y2="17" />
          <line x1="15" y1="17" x2="19" y2="17" />
        </svg>
      );
    default:
      return (
        <svg {...ic}>
          <rect x="4" y="4" width="16" height="16" rx="1" />
        </svg>
      );
  }
}
