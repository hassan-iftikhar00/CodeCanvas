export type Tool =
  | "select"
  | "hand"
  | "pen"
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
  r: "rectangle",
  o: "circle",
  l: "ellipse",
  g: "triangle",
  a: "arrow",
  t: "text",
  e: "erase",
  x: "bin",
};

export const ZOOM_MIN = 25;
export const ZOOM_MAX = 300;
export const ZOOM_DEFAULT = 100;
export const ZOOM_STEP = 10;

export const CODE_PANEL_MIN_HEIGHT = 200;
export const CODE_PANEL_MAX_HEIGHT = 600;
export const SPLIT_RATIO_MIN = 0.15;
export const SPLIT_RATIO_MAX = 0.85;
