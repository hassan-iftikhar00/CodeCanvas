"use client";

// HITL detection editor (roadmap idea #4). After /api/detect returns, this
// overlay shows the model's boxes on top of the sketch so the user can fix
// them BEFORE generation: relabel a box (card to navbar), delete a false
// positive, or drag out a box the model missed. The corrected set goes to
// /api/predict as correctedElements (Roboflow is not called again) and the
// diff is logged to detection_corrections as a future fine-tuning dataset.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { T_CANVAS } from "@/components/canvas/canvasTokens";

const ELEMENT_CLASSES = ["navbar", "section", "card", "footer"] as const;
type ElementClass = (typeof ELEMENT_CLASSES)[number];

// Box stroke colors per class. Kept away from pure red/green so the boxes read
// as annotations, not verdicts.
const CLASS_COLORS: Record<string, string> = {
  navbar: "#4A4B8C",
  section: "#1E6A3C",
  card: "#A85A18",
  footer: "#7B3F8C",
};
const FALLBACK_COLOR = "#6B6B6E";

export interface ReviewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ReviewElement {
  id: string;
  type: string;
  confidence: number;
  bounds: ReviewBounds;
  label?: string | null;
}

export interface DetectionCorrection {
  action: "relabel" | "delete" | "add";
  elementType: string;
  previousType?: string;
  bounds: ReviewBounds;
}

interface DetectionReviewOverlayProps {
  /** Image the boxes were detected on (canvas export or processed upload). */
  image: string;
  imageWidth: number;
  imageHeight: number;
  initialElements: ReviewElement[];
  onGenerate: (
    elements: ReviewElement[],
    corrections: DetectionCorrection[]
  ) => void;
  onCancel: () => void;
}

function classColor(type: string): string {
  return CLASS_COLORS[type.toLowerCase()] ?? FALLBACK_COLOR;
}

/** Diff the reviewed set against the detected set to build the audit log. */
export function diffCorrections(
  initial: ReviewElement[],
  final: ReviewElement[]
): DetectionCorrection[] {
  const corrections: DetectionCorrection[] = [];
  const finalById = new Map(final.map((el) => [el.id, el]));
  for (const el of initial) {
    const now = finalById.get(el.id);
    if (!now) {
      corrections.push({
        action: "delete",
        elementType: el.type,
        bounds: el.bounds,
      });
    } else if (now.type !== el.type) {
      corrections.push({
        action: "relabel",
        elementType: now.type,
        previousType: el.type,
        bounds: now.bounds,
      });
    }
  }
  const initialIds = new Set(initial.map((el) => el.id));
  for (const el of final) {
    if (!initialIds.has(el.id)) {
      corrections.push({
        action: "add",
        elementType: el.type,
        bounds: el.bounds,
      });
    }
  }
  return corrections;
}

// Smallest drawn box we accept, in image pixels. Anything below this is
// treated as a stray click, not an intentional box.
const MIN_BOX_SIZE = 12;

export default function DetectionReviewOverlay({
  image,
  imageWidth,
  imageHeight,
  initialElements,
  onGenerate,
  onCancel,
}: DetectionReviewOverlayProps) {
  const [elements, setElements] = useState<ReviewElement[]>(initialElements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [draft, setDraft] = useState<ReviewBounds | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  // Undo/redo over the element set (relabel/delete/add are the only edits).
  // Snapshots of `elements` before each edit; redo stack clears on new edits.
  const [past, setPast] = useState<ReviewElement[][]>([]);
  const [future, setFuture] = useState<ReviewElement[][]>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);

  // Apply an edit and record the pre-edit state for undo.
  const commitElements = useCallback(
    (updater: (prev: ReviewElement[]) => ReviewElement[]) => {
      setElements((prev) => {
        const next = updater(prev);
        if (next === prev) return prev;
        setPast((p) => [...p, prev]);
        setFuture([]);
        return next;
      });
    },
    []
  );

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const snapshot = p[p.length - 1];
      setElements((current) => {
        setFuture((f) => [...f, current]);
        return snapshot;
      });
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const snapshot = f[f.length - 1];
      setElements((current) => {
        setPast((p) => [...p, current]);
        return snapshot;
      });
      return f.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    const sync = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === "z" || key === "y") {
          // Capture phase + stopPropagation: the canvas page has its own
          // window-level Ctrl+Z handler for drawing history, which must not
          // fire while this dialog owns the keyboard.
          e.preventDefault();
          e.stopPropagation();
          if (key === "y" || (key === "z" && e.shiftKey)) redo();
          else undo();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel, undo, redo]);

  // Fit the image inside the viewport, leaving room for header + footer rows.
  const scale = useMemo(() => {
    if (!viewport.width || !imageWidth || !imageHeight) return 1;
    const maxW = viewport.width * 0.86;
    const maxH = viewport.height - 210;
    return Math.min(maxW / imageWidth, maxH / imageHeight, 1);
  }, [viewport, imageWidth, imageHeight]);

  const selected = elements.find((el) => el.id === selectedId) ?? null;

  const toImageSpace = useCallback(
    (clientX: number, clientY: number) => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect || !scale) return { x: 0, y: 0 };
      return {
        x: Math.max(0, Math.min(imageWidth, (clientX - rect.left) / scale)),
        y: Math.max(0, Math.min(imageHeight, (clientY - rect.top) / scale)),
      };
    },
    [scale, imageWidth, imageHeight]
  );

  const handleStageMouseDown = (e: React.MouseEvent) => {
    if (!drawMode) {
      setSelectedId(null);
      return;
    }
    e.preventDefault();
    const start = toImageSpace(e.clientX, e.clientY);
    drawStartRef.current = start;
    setDraft({ x: start.x, y: start.y, width: 0, height: 0 });

    const onMove = (ev: MouseEvent) => {
      const cur = toImageSpace(ev.clientX, ev.clientY);
      const s = drawStartRef.current;
      if (!s) return;
      setDraft({
        x: Math.min(s.x, cur.x),
        y: Math.min(s.y, cur.y),
        width: Math.abs(cur.x - s.x),
        height: Math.abs(cur.y - s.y),
      });
    };
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const s = drawStartRef.current;
      drawStartRef.current = null;
      if (!s) {
        setDraft(null);
        return;
      }
      const cur = toImageSpace(ev.clientX, ev.clientY);
      const box: ReviewBounds = {
        x: Math.min(s.x, cur.x),
        y: Math.min(s.y, cur.y),
        width: Math.abs(cur.x - s.x),
        height: Math.abs(cur.y - s.y),
      };
      setDraft(null);
      if (box.width < MIN_BOX_SIZE || box.height < MIN_BOX_SIZE) return;
      const id = `user-${Date.now()}`;
      commitElements((prev) => [
        ...prev,
        // User-drawn boxes carry confidence 1.0: the human asserted it exists.
        { id, type: "card", confidence: 1, bounds: box },
      ]);
      setSelectedId(id);
      setDrawMode(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const relabelSelected = (type: ElementClass) => {
    if (!selectedId) return;
    commitElements((prev) =>
      prev.map((el) => (el.id === selectedId ? { ...el, type } : el))
    );
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    commitElements((prev) => prev.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  };

  const correctionCount = useMemo(
    () => diffCorrections(initialElements, elements).length,
    [initialElements, elements]
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(14,14,15,0.62)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Review detected elements"
    >
      <div
        className="flex flex-col"
        style={{
          background: T_CANVAS.paper,
          border: `1px solid ${T_CANVAS.rule}`,
          boxShadow: "6px 6px 0 rgba(14,14,15,0.18)",
          maxWidth: "94vw",
          maxHeight: "94vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-4 px-4 py-2.5"
          style={{ borderBottom: `1px solid ${T_CANVAS.rule}` }}
        >
          <div>
            <div
              className="text-[12px] font-bold tracking-[0.08em]"
              style={{ color: T_CANVAS.graphite }}
            >
              REVIEW DETECTIONS
            </div>
            <div className="text-[11px]" style={{ color: T_CANVAS.muted }}>
              Click a box to relabel or delete it. Use Draw box to add one the
              model missed. Generation uses exactly this set.
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={undo}
              disabled={past.length === 0}
              title="Undo (Ctrl+Z)"
              aria-label="Undo (Ctrl+Z)"
              className="px-3 py-1.5 text-[11px] font-bold tracking-[0.06em] disabled:opacity-40"
              style={{
                background: T_CANVAS.vellum,
                color: T_CANVAS.graphite,
                border: `1px solid ${T_CANVAS.rule}`,
              }}
            >
              UNDO
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={future.length === 0}
              title="Redo (Ctrl+Y)"
              aria-label="Redo (Ctrl+Y)"
              className="px-3 py-1.5 text-[11px] font-bold tracking-[0.06em] disabled:opacity-40"
              style={{
                background: T_CANVAS.vellum,
                color: T_CANVAS.graphite,
                border: `1px solid ${T_CANVAS.rule}`,
              }}
            >
              REDO
            </button>
            <button
              type="button"
              onClick={() => {
                setDrawMode((m) => !m);
                setSelectedId(null);
              }}
              aria-pressed={drawMode}
              className="px-3 py-1.5 text-[11px] font-bold tracking-[0.06em] whitespace-nowrap"
              style={{
                background: drawMode ? T_CANVAS.cobalt : T_CANVAS.vellum,
                color: drawMode ? T_CANVAS.paper : T_CANVAS.graphite,
                border: `1px solid ${drawMode ? T_CANVAS.cobalt : T_CANVAS.rule}`,
              }}
            >
              {drawMode ? "DRAWING · DRAG ON IMAGE" : "DRAW BOX"}
            </button>
          </div>
        </div>

        {/* Selection action row (fixed height so the layout never jumps) */}
        <div
          className="flex h-10 items-center gap-2 px-4"
          style={{
            borderBottom: `1px solid ${T_CANVAS.rule}`,
            background: T_CANVAS.vellum,
          }}
        >
          {selected ? (
            <>
              <span
                className="text-[11px] font-bold tracking-[0.06em]"
                style={{ color: classColor(selected.type) }}
              >
                SELECTED: {selected.type.toUpperCase()}
              </span>
              <span className="text-[11px]" style={{ color: T_CANVAS.muted }}>
                relabel as
              </span>
              {ELEMENT_CLASSES.map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => relabelSelected(cls)}
                  disabled={selected.type === cls}
                  className="px-2 py-1 text-[10px] font-bold tracking-[0.05em] disabled:opacity-40"
                  style={{
                    background:
                      selected.type === cls ? classColor(cls) : T_CANVAS.paper,
                    color:
                      selected.type === cls ? T_CANVAS.paper : classColor(cls),
                    border: `1px solid ${classColor(cls)}`,
                  }}
                >
                  {cls.toUpperCase()}
                </button>
              ))}
              <button
                type="button"
                onClick={deleteSelected}
                className="ml-2 px-2 py-1 text-[10px] font-bold tracking-[0.05em]"
                style={{
                  background: T_CANVAS.paper,
                  color: T_CANVAS.error,
                  border: `1px solid ${T_CANVAS.error}`,
                }}
              >
                DELETE
              </button>
            </>
          ) : (
            <span className="text-[11px]" style={{ color: T_CANVAS.muted }}>
              {drawMode
                ? "Drag on the image to draw the missing element."
                : "No box selected."}
            </span>
          )}
        </div>

        {/* Stage */}
        <div className="flex items-center justify-center overflow-auto p-4">
          <div
            ref={stageRef}
            className="relative select-none"
            style={{
              width: imageWidth * scale,
              height: imageHeight * scale,
              cursor: drawMode ? "crosshair" : "default",
              background: "#FFFFFF",
              border: `1px solid ${T_CANVAS.rule}`,
            }}
            onMouseDown={handleStageMouseDown}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt="Sketch under review"
              draggable={false}
              className="absolute left-0 top-0 h-full w-full"
              style={{ pointerEvents: "none" }}
            />
            {elements.map((el) => {
              const color = classColor(el.type);
              const isSelected = el.id === selectedId;
              return (
                <div
                  key={el.id}
                  onMouseDown={(e) => {
                    if (drawMode) return; // let the stage handler draw through
                    e.stopPropagation();
                    setSelectedId(el.id);
                  }}
                  className="absolute"
                  style={{
                    left: el.bounds.x * scale,
                    top: el.bounds.y * scale,
                    width: el.bounds.width * scale,
                    height: el.bounds.height * scale,
                    border: `2px solid ${color}`,
                    background: isSelected ? `${color}22` : "transparent",
                    boxShadow: isSelected ? `0 0 0 2px ${color}55` : "none",
                    cursor: drawMode ? "crosshair" : "pointer",
                    pointerEvents: drawMode ? "none" : "auto",
                  }}
                >
                  <span
                    className="absolute left-0 top-0 px-1 py-[1px] text-[9px] font-bold tracking-[0.04em]"
                    style={{
                      background: color,
                      color: "#FFFFFF",
                      transform: "translateY(-100%)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {el.type.toUpperCase()}
                    {el.confidence < 1
                      ? ` · ${Math.round(el.confidence * 100)}%`
                      : " · ADDED"}
                  </span>
                </div>
              );
            })}
            {draft && (
              <div
                className="absolute"
                style={{
                  left: draft.x * scale,
                  top: draft.y * scale,
                  width: draft.width * scale,
                  height: draft.height * scale,
                  border: `2px dashed ${T_CANVAS.cobalt}`,
                  background: "rgba(74,75,140,0.10)",
                  pointerEvents: "none",
                }}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-4 px-4 py-2.5"
          style={{ borderTop: `1px solid ${T_CANVAS.rule}` }}
        >
          <div className="flex items-center gap-3">
            {ELEMENT_CLASSES.map((cls) => (
              <span
                key={cls}
                className="flex items-center gap-1 text-[10px] font-bold tracking-[0.05em]"
                style={{ color: T_CANVAS.muted }}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5"
                  style={{ border: `2px solid ${classColor(cls)}` }}
                />
                {cls.toUpperCase()}
              </span>
            ))}
            <span className="text-[11px]" style={{ color: T_CANVAS.muted }}>
              {elements.length} element{elements.length === 1 ? "" : "s"}
              {correctionCount > 0
                ? ` · ${correctionCount} correction${correctionCount === 1 ? "" : "s"}`
                : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-[11px] font-bold tracking-[0.06em]"
              style={{
                background: T_CANVAS.paper,
                color: T_CANVAS.graphite,
                border: `1px solid ${T_CANVAS.rule}`,
              }}
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={() =>
                onGenerate(elements, diffCorrections(initialElements, elements))
              }
              disabled={elements.length === 0}
              className="px-4 py-2 text-[11px] font-bold tracking-[0.06em] disabled:opacity-40"
              style={{
                background: T_CANVAS.cobalt,
                color: T_CANVAS.paper,
                border: `1px solid ${T_CANVAS.cobalt}`,
              }}
            >
              GENERATE CODE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
