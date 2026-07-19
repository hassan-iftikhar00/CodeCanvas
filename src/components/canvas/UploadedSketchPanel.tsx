"use client";

import { useCallback, useRef, useState } from "react";
import { T_CANVAS } from "./canvasTokens";
import type { UploadSource } from "./UploadSketchModal";

interface UploadedSketchPanelProps {
  /** Data URL of the uploaded image being used as the sketch source. */
  src: string;
  /** Which upload mode produced this image (drives the caption). */
  source: UploadSource;
  /** Original filename from the user's device, if available. */
  fileName?: string;
  /** Current zoom scale (shared with the canvas ZoomPill; 1 = 100%). */
  zoom: number;
  /** Flip the workspace back to the drawing canvas. */
  onBackToCanvas: () => void;
  /** Open the upload modal again to swap in a different image. */
  onReplace: () => void;
  /** True while detection/generation is in flight. */
  isGenerating?: boolean;
}

const SOURCE_LABEL: Record<UploadSource, string> = {
  "upload-photo": "Photo / scan",
  "upload-clean": "Digital wireframe",
};

/**
 * Read-only stand-in for the drawing canvas when the sketch came from an
 * uploaded image. It occupies the same <main> slot as <CanvasSurface> so the
 * rest of the workspace (code panel, chat, topbar) is unchanged. The image is
 * pannable by drag and zoomed via the shared ZoomPill scale.
 */
export default function UploadedSketchPanel({
  src,
  source,
  fileName,
  zoom,
  onBackToCanvas,
  onReplace,
  isGenerating = false,
}: UploadedSketchPanelProps) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      setDragging(true);
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    [pan]
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPan({
      x: e.clientX - dragRef.current.x,
      y: e.clientY - dragRef.current.y,
    });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null;
    setDragging(false);
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }, []);

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden select-none"
      style={{
        background: T_CANVAS.vellum,
        cursor: dragging ? "grabbing" : "grab",
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Uploaded sketch used as the generation source"
        draggable={false}
        className="max-h-[82%] max-w-[82%] object-contain"
        style={{
          border: `1px solid ${T_CANVAS.rule}`,
          background: T_CANVAS.paper,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
          transformOrigin: "center center",
          transition: dragging ? "none" : "transform 120ms ease-out",
        }}
      />

      {/* Source caption + filename, top-left */}
      <div className="absolute left-4 top-4 z-20 flex flex-col gap-1">
        <div
          className="flex items-center gap-2 px-3 py-1.5 text-[13px] uppercase tracking-[0.16em]"
          style={{
            background: T_CANVAS.paper,
            border: `1px solid ${T_CANVAS.rule}`,
            color: T_CANVAS.muted,
            fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
          }}
        >
          <span
            className="inline-block h-1.5 w-1.5"
            style={{ background: T_CANVAS.cobalt }}
          />
          Uploaded · {SOURCE_LABEL[source]}
        </div>
        {fileName && (
          <div
            className="px-3 py-1 text-[13px] truncate max-w-[220px]"
            style={{
              background: T_CANVAS.paper,
              border: `1px solid ${T_CANVAS.rule}`,
              color: T_CANVAS.graphite,
              fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
            }}
            title={fileName}
          >
            {fileName}
          </div>
        )}
      </div>

      {/* Action pills, top-right of the image area */}
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        <button
          onClick={onReplace}
          disabled={isGenerating}
          className="flex items-center gap-2 px-3 py-2 text-[13px] uppercase tracking-[0.16em] transition-colors disabled:opacity-50"
          style={{
            background: T_CANVAS.paper,
            border: `1px solid ${T_CANVAS.rule}`,
            color: T_CANVAS.muted,
            fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
            cursor: isGenerating ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (isGenerating) return;
            e.currentTarget.style.background = T_CANVAS.cobalt;
            e.currentTarget.style.color = T_CANVAS.paper;
            e.currentTarget.style.borderColor = T_CANVAS.cobalt;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = T_CANVAS.paper;
            e.currentTarget.style.color = T_CANVAS.muted;
            e.currentTarget.style.borderColor = T_CANVAS.rule;
          }}
          title="Upload a different image"
        >
          <svg
            className="h-3 w-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          Replace image
        </button>

        <button
          onClick={onBackToCanvas}
          disabled={isGenerating}
          className="flex items-center gap-2 px-3 py-2 text-[13px] uppercase tracking-[0.16em] transition-colors disabled:opacity-50"
          style={{
            background: T_CANVAS.paper,
            border: `1px solid ${T_CANVAS.rule}`,
            color: T_CANVAS.muted,
            fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
            cursor: isGenerating ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (isGenerating) return;
            e.currentTarget.style.background = T_CANVAS.graphite;
            e.currentTarget.style.color = T_CANVAS.paper;
            e.currentTarget.style.borderColor = T_CANVAS.graphite;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = T_CANVAS.paper;
            e.currentTarget.style.color = T_CANVAS.muted;
            e.currentTarget.style.borderColor = T_CANVAS.rule;
          }}
          title="Discard this upload and return to drawing"
        >
          <svg
            className="h-3 w-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 19l-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          Back to canvas
        </button>
      </div>
    </div>
  );
}
