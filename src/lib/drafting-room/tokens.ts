// Drafting Room — canonical color tokens.
//
// One module, three importers (landing, auth, canvas). When a value here
// changes (e.g. tick contrast, cobalt hue), every surface picks it up.
//
// `paper` / `vellum` are the two warm base tints, `tick` is the gridline
// gray that survives external displays (~2.85:1 against paper), `graphite`
// is the heaviest ink, and the `cobalt*` triplet is the brand accent (ink /
// hover / wash). `success` / `warning` / `error` are intentionally
// desaturated so they sit next to `cobalt` without screaming.

export const DRAFTING_TOKENS = {
  paper: "#FAFAF7",
  vellum: "#F2F1EC",
  tick: "#989894",
  rule: "#1A1A1C",
  graphite: "#0E0E0F",
  cobalt: "#4A4B8C",
  cobaltInk: "#2D2E5C",
  cobaltWash: "#E8E8F1",
  muted: "#6B6B6E",
  success: "#1E6A3C",
  warning: "#A85A18",
  error: "#8B2A2A",
} as const;

export type DraftingToken = keyof typeof DRAFTING_TOKENS;

// Dark inset slab — for surfaces that read as a dark patch inside the
// otherwise paper-light drafting room (currently: the code panel in
// canvas/page.tsx and the Monaco editor inside it). Mirrors the design-
// preview-v2 CodeWell treatment: graphite background, paper-tinted ink at
// graded opacity, brighter cobalt accent that survives on dark.
export const DRAFTING_DARK = {
  bg: "#0E0E0F",          // graphite — main slab background
  bgRaised: "#131316",    // raised surfaces (sub-headers, tab bar rows)
  rule: "rgba(242,241,236,0.18)",
  ruleSoft: "rgba(242,241,236,0.12)",
  inkBright: "rgba(242,241,236,0.95)",
  ink: "rgba(242,241,236,0.85)",
  inkMuted: "rgba(242,241,236,0.55)",
  inkFaint: "rgba(242,241,236,0.45)",
  inkDim: "rgba(242,241,236,0.25)",
  surfaceSoft: "rgba(242,241,236,0.05)",
  surfaceHover: "rgba(242,241,236,0.12)",
  cobalt: "#8C8DD4",      // brighter cobalt — readable on graphite
  cobaltInk: "#B7B8E5",
  cobaltWash: "#232347",
  warning: "#C4936A",     // softened orange for fallback bars
  warningWash: "rgba(196,147,106,0.10)",
} as const;

export type DraftingDarkToken = keyof typeof DRAFTING_DARK;
