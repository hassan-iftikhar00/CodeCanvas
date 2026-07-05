/**
 * First frontend test suite (B11): the pure logic in src/types/canvas.ts.
 *
 * This module is the single source of truth for canvas bounds (zoom, code-panel
 * height, split ratios), the keyboard-shortcut map, and the clamp helpers that
 * enforce those bounds. It has zero React / browser dependencies, so it is the
 * natural first target for the frontend test setup.
 *
 * Vitest globals are intentionally not used; everything is imported explicitly
 * so `next build` type-checking does not need ambient test types.
 */

import { describe, it, expect } from "vitest";

import {
  TOOL_KEY_MAP,
  clampZoom,
  clampCodePanelHeight,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_DEFAULT,
  ZOOM_STEP,
  CODE_PANEL_MIN_HEIGHT,
  CODE_PANEL_MAX_HEIGHT,
  SPLIT_RATIO_MIN,
  SPLIT_RATIO_MAX,
  type Tool,
} from "./canvas";

// Canonical list of every Tool literal. Kept in lockstep with the `Tool` union
// by hand on purpose: if a tool is added to the type and wired into
// TOOL_KEY_MAP without being added here, the "values are valid tools" test
// fails and flags the omission.
const ALL_TOOLS: readonly Tool[] = [
  "select",
  "hand",
  "pen",
  "line",
  "rectangle",
  "circle",
  "ellipse",
  "triangle",
  "arrow",
  "text",
  "erase",
  "bin",
];

// --- clampZoom -------------------------------------------------------------

describe("clampZoom", () => {
  it("leaves a value already inside the range unchanged", () => {
    expect(clampZoom(100)).toBe(100);
    expect(clampZoom(ZOOM_DEFAULT)).toBe(ZOOM_DEFAULT);
  });

  it("raises a value below the minimum up to ZOOM_MIN", () => {
    expect(clampZoom(ZOOM_MIN - 50)).toBe(ZOOM_MIN);
    expect(clampZoom(0)).toBe(ZOOM_MIN);
    expect(clampZoom(-999)).toBe(ZOOM_MIN);
  });

  it("lowers a value above the maximum down to ZOOM_MAX", () => {
    expect(clampZoom(ZOOM_MAX + 50)).toBe(ZOOM_MAX);
    expect(clampZoom(99999)).toBe(ZOOM_MAX);
  });

  it("treats the exact bounds as in-range", () => {
    expect(clampZoom(ZOOM_MIN)).toBe(ZOOM_MIN);
    expect(clampZoom(ZOOM_MAX)).toBe(ZOOM_MAX);
  });

  it("never lets a single step escape the bounds", () => {
    // Stepping up from the top or down from the bottom must stay clamped, which
    // is what the zoom-in / zoom-out buttons rely on.
    expect(clampZoom(ZOOM_MAX + ZOOM_STEP)).toBe(ZOOM_MAX);
    expect(clampZoom(ZOOM_MIN - ZOOM_STEP)).toBe(ZOOM_MIN);
  });
});

// --- clampCodePanelHeight --------------------------------------------------

describe("clampCodePanelHeight", () => {
  it("leaves a value already inside the range unchanged", () => {
    const mid = (CODE_PANEL_MIN_HEIGHT + CODE_PANEL_MAX_HEIGHT) / 2;
    expect(clampCodePanelHeight(mid)).toBe(mid);
  });

  it("raises a value below the minimum up to CODE_PANEL_MIN_HEIGHT", () => {
    expect(clampCodePanelHeight(0)).toBe(CODE_PANEL_MIN_HEIGHT);
    expect(clampCodePanelHeight(CODE_PANEL_MIN_HEIGHT - 1)).toBe(
      CODE_PANEL_MIN_HEIGHT
    );
  });

  it("lowers a value above the maximum down to CODE_PANEL_MAX_HEIGHT", () => {
    expect(clampCodePanelHeight(CODE_PANEL_MAX_HEIGHT + 1)).toBe(
      CODE_PANEL_MAX_HEIGHT
    );
    expect(clampCodePanelHeight(999999)).toBe(CODE_PANEL_MAX_HEIGHT);
  });

  it("treats the exact bounds as in-range", () => {
    expect(clampCodePanelHeight(CODE_PANEL_MIN_HEIGHT)).toBe(
      CODE_PANEL_MIN_HEIGHT
    );
    expect(clampCodePanelHeight(CODE_PANEL_MAX_HEIGHT)).toBe(
      CODE_PANEL_MAX_HEIGHT
    );
  });
});

// --- bounds invariants -----------------------------------------------------

describe("canvas bounds constants", () => {
  it("orders the zoom bounds min < default < max", () => {
    expect(ZOOM_MIN).toBeLessThan(ZOOM_DEFAULT);
    expect(ZOOM_DEFAULT).toBeLessThan(ZOOM_MAX);
  });

  it("uses a positive zoom step", () => {
    expect(ZOOM_STEP).toBeGreaterThan(0);
  });

  it("orders the code-panel height bounds min < max", () => {
    expect(CODE_PANEL_MIN_HEIGHT).toBeLessThan(CODE_PANEL_MAX_HEIGHT);
  });

  it("keeps the split ratios ordered and inside the open interval (0, 1)", () => {
    expect(SPLIT_RATIO_MIN).toBeGreaterThan(0);
    expect(SPLIT_RATIO_MIN).toBeLessThan(SPLIT_RATIO_MAX);
    expect(SPLIT_RATIO_MAX).toBeLessThan(1);
  });
});

// --- TOOL_KEY_MAP ----------------------------------------------------------

describe("TOOL_KEY_MAP", () => {
  const entries = Object.entries(TOOL_KEY_MAP);

  it("maps every shortcut to a known Tool", () => {
    for (const [key, tool] of entries) {
      expect(
        ALL_TOOLS,
        `key "${key}" maps to unknown tool "${tool}"`
      ).toContain(tool);
    }
  });

  it("uses a single lowercase character for every shortcut key", () => {
    for (const key of Object.keys(TOOL_KEY_MAP)) {
      expect(key).toMatch(/^[a-z]$/);
    }
  });

  it("never binds two keys to the same tool", () => {
    const tools = Object.values(TOOL_KEY_MAP);
    expect(new Set(tools).size).toBe(tools.length);
  });

  it("preserves the documented core bindings", () => {
    // These shortcuts are muscle-memory load-bearing; a silent remap would be a
    // regression even though the map as a whole is allowed to grow.
    expect(TOOL_KEY_MAP.v).toBe("select");
    expect(TOOL_KEY_MAP.h).toBe("hand");
    expect(TOOL_KEY_MAP.p).toBe("pen");
    expect(TOOL_KEY_MAP.t).toBe("text");
    expect(TOOL_KEY_MAP.e).toBe("erase");
    expect(TOOL_KEY_MAP.x).toBe("bin");
  });
});
