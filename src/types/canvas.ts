export type Tool =
  | "select"
  | "hand"
  | "pen"
  | "line"
  | "rectangle"
  | "circle"
  | "ellipse"
  | "triangle"
  | "arrow"
  | "text"
  | "erase"
  | "bin";

export type ToolGroup = "pointer" | "draw" | "shape" | "annotate" | "modify";

export type Mode = "sketch" | "detect" | "refine" | "preview";

export type RightPanel = "properties" | "layers" | "chat" | null;

export type CodeViewMode = "code" | "preview" | "split";

export type Framework = "react" | "html";
export type Styling = "tailwind" | "css";

export interface TextAnnotation {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedElement {
  type: string;
  bounds: unknown;
}

export interface ToolDescriptor {
  id: Tool;
  label: string;
  shortcut: string;
  group: ToolGroup;
}

export const TOOL_KEY_MAP: Record<string, Tool> = {
  v: "select",
  h: "hand",
  p: "pen",
  n: "line",
  r: "rectangle",
  a: "arrow",
  t: "text",
  e: "erase",
  x: "bin",
};

export interface Layer {
  id: string;
  name: string;
  type: "pen" | "shape" | "text" | "image";
  visible: boolean;
  locked: boolean;
  opacity: number;
}

export const ZOOM_MIN = 25;
export const ZOOM_MAX = 300;
export const ZOOM_DEFAULT = 100;
export const ZOOM_STEP = 10;

export const CODE_PANEL_MIN_HEIGHT = 220;
// Upper hard cap; the drag handler also clamps to viewport-aware bounds so the
// canvas never gets squeezed below ~180px regardless of this value.
export const CODE_PANEL_MAX_HEIGHT = 1400;
export const SPLIT_RATIO_MIN = 0.15;
export const SPLIT_RATIO_MAX = 0.85;

// Clamp helpers live next to the bounds they enforce so the constants and the
// logic that applies them stay in one place (and stay unit-testable).
export const clampZoom = (z: number): number =>
  Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export const clampCodePanelHeight = (h: number): number =>
  Math.min(CODE_PANEL_MAX_HEIGHT, Math.max(CODE_PANEL_MIN_HEIGHT, h));
