"use client";

// Canvas-side aliases for the canonical Drafting Room tokens.
// The single source of truth is `src/lib/drafting-room/tokens.ts`. This
// file exists so the rest of the canvas package can keep importing the
// `T_CANVAS` / `CanvasMark` / `CanvasCross` names it has used since the
// migration started - no cascading rename across every component.

export {
  DRAFTING_TOKENS as T_CANVAS,
  DRAFTING_DARK as T_DARK,
} from "@/lib/drafting-room/tokens";
export {
  DraftingMark as CanvasMark,
  DraftingCross as CanvasCross,
} from "@/lib/drafting-room/marks";
