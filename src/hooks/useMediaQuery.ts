"use client";

import { useSyncExternalStore } from "react";

function subscribe(query: string, onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(query);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * SSR-safe media query hook built on useSyncExternalStore — the React API
 * designed for subscribing to external browser state (matchMedia here).
 * Server snapshot is always `false` (deterministic), so hydration can only
 * flip false->true post-mount, never mismatch.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => subscribe(query, onChange),
    () =>
      typeof window !== "undefined" ? window.matchMedia(query).matches : false,
    () => false
  );
}

/** Below `md` (768px) — the canvas editor's small-screen gate threshold. */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}

/** `md` to just under `lg` (768px–1023px). */
export function useIsTablet(): boolean {
  return useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
}

/** `lg` and up (1024px+). */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
