// Drafting Room — canonical brand marks.
//
// The CodeCanvas "C" logo and the small "+" crosshair used as the dust-tick
// graphic across paper sheets. Pulled out alongside the tokens so landing,
// auth and canvas all draw the same shape.

import { DRAFTING_TOKENS } from "./tokens";

export function DraftingMark({
  size = 22,
  color = DRAFTING_TOKENS.graphite,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      fill={color}
      aria-label="CodeCanvas"
    >
      <rect x="48" y="12" width="140" height="40" rx="4" />
      <rect x="12" y="56" width="40" height="88" rx="4" />
      <rect x="48" y="148" width="140" height="40" rx="4" />
    </svg>
  );
}

export function DraftingCross({ size = 8 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" aria-hidden="true">
      <line x1="0" y1="4" x2="8" y2="4" stroke="currentColor" />
      <line x1="4" y1="0" x2="4" y2="8" stroke="currentColor" />
    </svg>
  );
}
