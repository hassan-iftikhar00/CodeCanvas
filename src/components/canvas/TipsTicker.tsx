"use client";

/**
 * TipsTicker — rotating "did you know" strip for the canvas workspace.
 *
 * Floats bottom-center of the canvas area (ZoomPill owns bottom-left, the
 * code-panel pill owns bottom-right). Shows one tip at a time, advances to a
 * random different tip every ROTATE_MS, pauses while hovered. The X collapses
 * it to a small TIP pill; that choice is remembered in localStorage so it
 * stays out of the way across sessions until the user reopens it.
 *
 * Copy rules: ASCII only, no em dashes, no emojis (user-facing surface).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { DRAFTING_TOKENS as T } from "@/lib/drafting-room/tokens";

const ROTATE_MS = 25000;
const STORAGE_KEY = "cc-tips-collapsed";

const TIPS: string[] = [
  "Add a second screen with the + tab, then label a button with that screen's name. The generated preview navigates between them.",
  "Turn on SNAP in the status bar to draw clean point-to-point lines that lock onto the grid.",
  "Double-click a screen tab to rename it. Button labels that match a screen name become working links.",
  "After Run Detection you can fix the AI's boxes: relabel, delete false positives, or drag out anything it missed before generating.",
  "Prefer paper? Upload a photo of a hand-drawn sketch and the same pipeline reads it, handwriting included.",
  "Write labels inside your boxes, like Email or Login. The generator uses them as the real button and field text.",
  "A wide flat bar at the top reads as a navbar, at the bottom as a footer. Position decides the meaning.",
  "Wavy or zigzag lines inside a box read as paragraph text. Label a box img or [ image ] to get an image placeholder.",
  "Use the INSPECT toggle in the preview toolbar, then click any element to jump straight to its code.",
  "The element chips in the detection strip highlight each component in both the preview and the code.",
  "Set your colors and font once in BRAND KIT (toolbox). Every generation on this project will use them.",
  "COMPARE VERSIONS in the toolbox shows two generations side by side with a code diff and one-click rollback.",
  "SHARE publishes a read-only live preview link that anyone can open without an account.",
  "The right half of the EXPORT button opens your project directly in StackBlitz, live and editable.",
  "Small sketch edits after a generation only regenerate the changed elements. Your other code stays untouched.",
  "Press ? to see every keyboard shortcut. Tools have single keys: V select, P pen, R rectangle, T text.",
  "Ctrl+S saves your project, Ctrl+Z undoes, Ctrl+` toggles the code panel.",
  "The FIDELITY score after a generation measures how closely the render matches your sketch. Low scores trigger one automatic repair.",
  "Rerunning the exact same sketch within 30 minutes returns instantly from cache.",
  "Pick REACT, HTML or VUE in the top bar before generating. Each produces idiomatic code for that framework.",
  "The tablet preview (768px) is where the responsive layout collapses. Use it to demo mobile behavior.",
  "Unhappy with one detail? Tell the chat something like: make the navbar dark. It edits the existing code instead of regenerating.",
];

const MONO = "var(--font-jetbrains-mono, ui-monospace, monospace)";

export default function TipsTicker() {
  const [collapsed, setCollapsed] = useState(true); // start hidden until localStorage is read (avoids SSR mismatch + flash)
  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    let stored = false;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // localStorage unavailable (private mode) - default to visible
    }
    setCollapsed(stored);
    setIndex(Math.floor(Math.random() * TIPS.length));
    setReady(true);
  }, []);

  const nextTip = useCallback(() => {
    setIndex((prev) => {
      if (TIPS.length < 2) return prev;
      let n = prev;
      while (n === prev) n = Math.floor(Math.random() * TIPS.length);
      return n;
    });
  }, []);

  useEffect(() => {
    if (collapsed || !ready) return;
    const id = window.setInterval(() => {
      if (!pausedRef.current) nextTip();
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [collapsed, ready, nextTip]);

  const setStored = (value: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      // best effort only
    }
  };

  if (!ready) return null;

  if (collapsed) {
    return (
      <button
        onClick={() => {
          setCollapsed(false);
          setStored(false);
          nextTip();
        }}
        className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] tracking-[0.16em] uppercase transition-colors"
        style={{
          background: T.paper,
          border: `1px solid ${T.rule}`,
          color: T.muted,
          fontFamily: MONO,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = T.graphite;
          e.currentTarget.style.color = T.paper;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = T.paper;
          e.currentTarget.style.color = T.muted;
        }}
        title="Show tips"
        aria-label="Show tips"
      >
        <BulbIcon />
        TIP
      </button>
    );
  }

  return (
    <div
      className="pointer-events-auto flex max-w-[440px] items-start gap-2.5 px-3 py-2.5"
      style={{ background: T.paper, border: `1px solid ${T.rule}` }}
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
      role="note"
      aria-label="Tip"
    >
      <span
        className="mt-[1px] flex flex-shrink-0 items-center gap-1 px-1.5 py-0.5 text-[12px] tracking-[0.16em]"
        style={{
          background: T.cobaltWash,
          color: T.cobaltInk,
          fontFamily: MONO,
        }}
      >
        <BulbIcon />
        TIP
      </span>

      <p
        key={index}
        className="min-w-0 flex-1 text-[13px] leading-[1.5]"
        style={{ color: T.rule }}
      >
        {TIPS[index]}
      </p>

      <div className="flex flex-shrink-0 items-center gap-1">
        <button
          onClick={nextTip}
          className="flex h-5 w-5 items-center justify-center transition-colors"
          style={{ background: T.paper, color: T.muted }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = T.graphite;
            e.currentTarget.style.color = T.paper;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = T.paper;
            e.currentTarget.style.color = T.muted;
          }}
          title="Next tip"
          aria-label="Next tip"
        >
          <svg
            className="h-3 w-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <button
          onClick={() => {
            setCollapsed(true);
            setStored(true);
          }}
          className="flex h-5 w-5 items-center justify-center transition-colors"
          style={{ background: T.paper, color: T.muted }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = T.graphite;
            e.currentTarget.style.color = T.paper;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = T.paper;
            e.currentTarget.style.color = T.muted;
          }}
          title="Hide tips"
          aria-label="Hide tips"
        >
          <svg
            className="h-3 w-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function BulbIcon() {
  return (
    <svg
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.5 1 2.5h6c0-1 .4-1.9 1-2.5A6 6 0 0 0 12 3z" />
    </svg>
  );
}
