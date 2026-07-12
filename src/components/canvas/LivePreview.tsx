"use client";

import React, { useState, useEffect, useRef } from "react";
import { T_CANVAS } from "./canvasTokens";
import {
  buildReactDocument,
  buildHtmlDocument,
  buildVueDocument,
} from "@/lib/preview-doc";

/** One rendered component the annotation markup covers (document-space px). */
export interface AnnotateTarget {
  ccId: string;
  tag?: string;
  rect: { x: number; y: number; width: number; height: number };
}

/** Payload handed up when the user applies an on-render annotation. */
export interface AnnotatePayload {
  note: string;
  targets: AnnotateTarget[];
  region: { x: number; y: number; width: number; height: number } | null;
  width: number;
  height: number;
}

/** Shape of the linker bridge's cc-rects reply (see preview-doc.ts). */
interface CcRectsMessage {
  requestId: number;
  rects: {
    ccId: string;
    tag: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  scrollX: number;
  scrollY: number;
  docWidth: number;
  docHeight: number;
}

interface LivePreviewProps {
  code: string;
  language?: "html" | "react" | "vue";
  /** Annotate-on-render (feature B): resolve markup + note into a targeted
   *  refinement. Return true on success so the overlay clears itself. */
  onAnnotate?: (payload: AnnotatePayload) => Promise<boolean>;
  /** Multi-screen flows (feature A): generated code called
   *  window.ccNavigate("Screen Name") inside the preview. */
  onNavigateScreen?: (screenName: string) => void;
}

type DeviceType = "fit" | "desktop" | "tablet" | "mobile";
type Orientation = "portrait" | "landscape";

const DEVICE_PRESETS: Record<
  DeviceType,
  { width: number; height: number; label: string }
> = {
  fit: { width: 0, height: 0, label: "Fit" },
  // 1920 rendered at ~0.4 scale in the side panel - unreadable. 1440 keeps
  // the same lg/xl Tailwind breakpoints at a legible scale.
  desktop: { width: 1440, height: 900, label: "Desktop" },
  // 768 portrait sits exactly on Tailwind's md: breakpoint, so this frame is
  // the one that shows the drawn desktop rows collapsing/restoring.
  tablet: { width: 768, height: 1024, label: "Tablet" },
  mobile: { width: 390, height: 844, label: "Mobile" },
};

/** Inner padding of the device-mode scroll area (p-6 on each side). */
const DEVICE_PADDING = 48;

export default function LivePreview({
  code,
  language = "html",
  onAnnotate,
  onNavigateScreen,
}: LivePreviewProps) {
  const [device, setDevice] = useState<DeviceType>("fit");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [manualZoom, setManualZoom] = useState<number | null>(null);
  const [containerSize, setContainerSize] = useState({
    width: 800,
    height: 600,
  });
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  // INSPECT mode (Element↔Code Linker): while on, clicking an element in the
  // preview jumps to its code instead of activating the element.
  const [inspectMode, setInspectMode] = useState(false);
  // ANNOTATE mode (feature B): red-pen markup drawn over the render, plus a
  // note, resolved to data-cc-id targets and sent up via onAnnotate. Stroke
  // points are stored in IFRAME CSS pixel space (already divided by scale) so
  // they survive zoom/device changes and match the bridge's element rects.
  const [annotateMode, setAnnotateMode] = useState(false);
  const [strokes, setStrokes] = useState<number[][]>([]);
  const [annotateNote, setAnnotateNote] = useState("");
  const [annotateBusy, setAnnotateBusy] = useState(false);
  const drawingRef = useRef(false);
  const rectsRequestRef = useRef<{
    id: number;
    resolve: (data: CcRectsMessage | null) => void;
  } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // The message listener below mounts once (deps []); route navigation through
  // a ref so it always calls the latest handler without re-binding.
  const onNavigateScreenRef = useRef(onNavigateScreen);
  onNavigateScreenRef.current = onNavigateScreen;

  const sendInspectMode = (enabled: boolean) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "cc-inspect-mode", enabled },
      window.location.origin
    );
  };

  const toggleInspect = () => {
    setInspectMode((prev) => {
      sendInspectMode(!prev);
      return !prev;
    });
    // Inspect and annotate both repurpose clicks on the preview; only one can
    // own the pointer at a time.
    setAnnotateMode(false);
  };

  const toggleAnnotate = () => {
    setAnnotateMode((prev) => {
      if (!prev && inspectMode) {
        sendInspectMode(false);
        setInspectMode(false);
      }
      if (prev) {
        setStrokes([]);
        setAnnotateNote("");
      }
      return !prev;
    });
  };

  /** Pointer position → iframe CSS pixel space. The iframe's bounding rect is
   *  its VISUAL (scaled) box, so dividing the offset by the current scale
   *  yields coordinates in the same space as the bridge's element rects. */
  const toIframePoint = (clientX: number, clientY: number) => {
    const rect = iframeRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  };

  const handleAnnotatePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (annotateBusy) return;
    const p = toIframePoint(e.clientX, e.clientY);
    if (!p) return;
    drawingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setStrokes((prev) => [...prev, [p.x, p.y]]);
  };

  const handleAnnotatePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawingRef.current) return;
    const p = toIframePoint(e.clientX, e.clientY);
    if (!p) return;
    setStrokes((prev) => {
      const next = prev.slice();
      next[next.length - 1] = [...next[next.length - 1], p.x, p.y];
      return next;
    });
  };

  const handleAnnotatePointerUp = () => {
    drawingRef.current = false;
    // Drop degenerate strokes (a stray click leaves a single point).
    setStrokes((prev) => prev.filter((s) => s.length >= 4));
  };

  /** Ask the iframe's linker script for every data-cc-id element box. */
  const requestElementRects = (): Promise<CcRectsMessage | null> => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return Promise.resolve(null);
    return new Promise((resolve) => {
      const id = Date.now();
      const timeout = setTimeout(() => {
        if (rectsRequestRef.current?.id === id) {
          rectsRequestRef.current = null;
          resolve(null);
        }
      }, 1500);
      rectsRequestRef.current = {
        id,
        resolve: (data) => {
          clearTimeout(timeout);
          resolve(data);
        },
      };
      win.postMessage(
        { type: "cc-get-rects", requestId: id },
        window.location.origin
      );
    });
  };

  const strokeBBox = (points: number[]) => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (let i = 0; i < points.length; i += 2) {
      minX = Math.min(minX, points[i]);
      maxX = Math.max(maxX, points[i]);
      minY = Math.min(minY, points[i + 1]);
      maxY = Math.max(maxY, points[i + 1]);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  };

  const rectsIntersect = (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number }
  ) =>
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;

  const handleApplyAnnotation = async () => {
    if (!onAnnotate || annotateBusy) return;
    if (strokes.length === 0 || !annotateNote.trim()) return;
    setAnnotateBusy(true);
    try {
      const reply = await requestElementRects();
      const scrollX = reply?.scrollX ?? 0;
      const scrollY = reply?.scrollY ?? 0;
      // Stroke points are iframe-VIEWPORT relative; element rects too. Adding
      // the iframe's scroll offset puts both in document space, so positions
      // in the prompt read against the full page, not the visible slice.
      const boxes = strokes.map((s) => {
        const b = strokeBBox(s);
        return { ...b, x: b.x + scrollX, y: b.y + scrollY };
      });
      const targets: AnnotateTarget[] = (reply?.rects ?? [])
        .map((r) => ({
          ccId: r.ccId,
          tag: r.tag,
          rect: {
            x: r.x + scrollX,
            y: r.y + scrollY,
            width: r.width,
            height: r.height,
          },
        }))
        .filter((t) => boxes.some((b) => rectsIntersect(b, t.rect)));

      const minX = Math.min(...boxes.map((b) => b.x));
      const minY = Math.min(...boxes.map((b) => b.y));
      const region = {
        x: minX,
        y: minY,
        width: Math.max(...boxes.map((b) => b.x + b.width)) - minX,
        height: Math.max(...boxes.map((b) => b.y + b.height)) - minY,
      };

      const iframeRect = iframeRef.current?.getBoundingClientRect();
      const ok = await onAnnotate({
        note: annotateNote.trim(),
        targets,
        region,
        width: reply?.docWidth ?? (iframeRect ? iframeRect.width / scale : 0),
        height:
          reply?.docHeight ?? (iframeRect ? iframeRect.height / scale : 0),
      });
      if (ok) {
        setStrokes([]);
        setAnnotateNote("");
        setAnnotateMode(false);
      }
    } finally {
      setAnnotateBusy(false);
    }
  };

  // Track the RAW container size; padding is subtracted at the use sites
  // because fit mode is p-0 while device mode is p-6 (subtracting here made
  // the fit-mode dimension label lie by 48px).
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const update = () => {
      setContainerSize({
        width: Math.max(320, el.clientWidth),
        height: Math.max(240, el.clientHeight),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Space actually available for the device frame (inside the p-6 padding).
  const availWidth = Math.max(320, containerSize.width - DEVICE_PADDING);
  const availHeight = Math.max(240, containerSize.height - DEVICE_PADDING);

  const getDeviceDimensions = () => {
    if (device === "fit") {
      return { width: containerSize.width, height: containerSize.height };
    }
    const preset = DEVICE_PRESETS[device];
    if (orientation === "landscape") {
      return { width: preset.height, height: preset.width };
    }
    return { width: preset.width, height: preset.height };
  };

  const dimensions = getDeviceDimensions();

  // In "Fit" mode the preview card IS the container, so its baseline scale is
  // 1 and any manual zoom must apply on top of it (BUG 2 - previously the zoom
  // shrank the white card itself, leaving a floating tile inside the black
  // container).
  //
  // Desktop emulates responsive WIDTH only (like Chrome's device toolbar):
  // scale to fit the panel width and let the frame fill the panel height, so
  // the page scrolls naturally inside it instead of letterboxing a fixed
  // 16:9 box. Mobile keeps a true phone-shaped frame, fit on both axes.
  const autoScale =
    device === "fit"
      ? 1
      : device === "desktop"
        ? Math.min(availWidth / dimensions.width, 1)
        : Math.min(
            availWidth / dimensions.width,
            availHeight / dimensions.height,
            1
          );

  const scale = manualZoom ?? autoScale;

  // Desktop frame: at least the preset height, but grow to fill the panel so
  // no dead paper shows below the frame at small scales.
  const frameHeight =
    device === "desktop"
      ? Math.max(dimensions.height, Math.round(availHeight / scale))
      : dimensions.height;

  const selectDevice = (next: DeviceType) => {
    setDevice(next);
    setManualZoom(null);
  };

  const toggleOrientation = () => {
    setOrientation((prev) => (prev === "portrait" ? "landscape" : "portrait"));
    setManualZoom(null);
  };

  useEffect(() => {
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

    if (!iframeDoc) return;

    const htmlContent =
      language === "react"
        ? buildReactDocument(code, window.location.origin)
        : language === "vue"
          ? buildVueDocument(code, window.location.origin)
          : buildHtmlDocument(code, window.location.origin);

    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();
    // Re-arm inspect mode after every rewrite — the fresh document's linker
    // script starts with the flag off.
    if (inspectMode) {
      iframe.contentWindow?.postMessage(
        { type: "cc-inspect-mode", enabled: true },
        window.location.origin
      );
    }
    // `device` and `orientation` belong here: switching device modes swaps
    // between the fit-branch and the device-frame-branch in the JSX, which
    // unmounts the old iframe and mounts a new one. The new iframe is blank
    // until we re-write into it - so the dep array has to track that swap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, language, refreshTick, device, orientation]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      // Element↔Code Linker: the canvas page broadcasts a highlight request
      // (element chip clicked / code revealed); forward it into the preview
      // iframe, whose linker script outlines the matching data-cc-id element.
      if (event.data.type === "cc-highlight-request" && event.data.ccId) {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "cc-highlight", ccId: event.data.ccId },
          window.location.origin
        );
        return;
      }
      // Multi-screen flows: generated code invoked window.ccNavigate(...)
      // inside the iframe; hand the target screen name up to the canvas page.
      if (event.data.type === "cc-navigate") {
        const name = String(event.data.screen ?? "").trim();
        if (name) onNavigateScreenRef.current?.(name);
        return;
      }
      // Annotate-on-render: reply to a pending cc-get-rects request.
      if (event.data.type === "cc-rects") {
        const pending = rectsRequestRef.current;
        if (pending && pending.id === event.data.requestId) {
          rectsRequestRef.current = null;
          pending.resolve(event.data as CcRectsMessage);
        }
        return;
      }
      if (event.data.type === "console" || event.data.type === "error") {
        setConsoleOutput((prev) => [...prev, event.data.data]);
        if (event.data.type === "error") {
          setShowConsole(true);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  /** Red-pen markup layer. Rendered inside the iframe's immediate visual
   *  container in BOTH branches: in fit mode the wrapper is unscaled (the
   *  viewBox maps iframe space onto it); in device mode the overlay sits
   *  inside the scaled frame so it inherits the same transform as the iframe.
   *  Either way 1 viewBox unit = 1 iframe CSS px, and 2.5/scale keeps the ink
   *  a constant ~2.5 visual px. */
  const annotationOverlay = (viewW: number, viewH: number) =>
    annotateMode ? (
      <svg
        className="absolute inset-0 h-full w-full"
        style={{ cursor: "crosshair", touchAction: "none", zIndex: 10 }}
        viewBox={`0 0 ${Math.max(1, viewW)} ${Math.max(1, viewH)}`}
        preserveAspectRatio="none"
        onPointerDown={handleAnnotatePointerDown}
        onPointerMove={handleAnnotatePointerMove}
        onPointerUp={handleAnnotatePointerUp}
        onPointerCancel={handleAnnotatePointerUp}
        aria-label="Annotation markup layer"
      >
        {strokes.map((s, i) => {
          const pts: string[] = [];
          for (let j = 0; j < s.length; j += 2) {
            pts.push(`${s[j]},${s[j + 1]}`);
          }
          return (
            <polyline
              key={i}
              points={pts.join(" ")}
              fill="none"
              stroke={T_CANVAS.error}
              strokeWidth={2.5 / scale}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
            />
          );
        })}
      </svg>
    ) : null;

  const handleRefresh = () => {
    setConsoleOutput([]);
    setRefreshTick((t) => t + 1);
  };

  const handleOpenInNewWindow = () => {
    // Window.open with `noopener` returns null in many browsers, which is why
    // writing to the new document failed silently before. Use a Blob URL for
    // the HTML so the new tab can load it directly — no document.write needed.
    const htmlContent =
      language === "react"
        ? buildReactDocument(code, window.location.origin)
        : language === "vue"
          ? buildVueDocument(code, window.location.origin)
          : buildHtmlDocument(code, window.location.origin);
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, "_blank");
    if (!newWindow) {
      URL.revokeObjectURL(url);
      return;
    }
    // Revoke the URL after the new window has had time to load it.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  return (
    <div
      className="flex h-full flex-col"
      style={{
        background: T_CANVAS.paper,
        fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
      }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-y-1.5 border-b px-3 py-1.5"
        style={{ borderColor: T_CANVAS.rule, background: T_CANVAS.vellum }}
      >
        {/* DEVICE picker — Drafting Room mono tabs */}
        <div
          className="flex items-center"
          style={{ border: `1px solid ${T_CANVAS.rule}` }}
        >
          {Object.entries(DEVICE_PRESETS).map(([key, preset], i) => {
            const active = device === key;
            return (
              <button
                key={key}
                onClick={() => selectDevice(key as DeviceType)}
                className="px-2.5 py-1 text-[10px] tracking-[0.16em] uppercase transition-colors"
                style={{
                  background: active ? T_CANVAS.graphite : T_CANVAS.paper,
                  color: active ? T_CANVAS.paper : T_CANVAS.muted,
                  borderLeft: i > 0 ? `1px solid ${T_CANVAS.rule}` : undefined,
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.color = T_CANVAS.graphite;
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.color = T_CANVAS.muted;
                }}
                title={
                  key === "fit"
                    ? "Fit to panel"
                    : `${preset.label} (${preset.width}x${preset.height})`
                }
              >
                {preset.label}
              </button>
            );
          })}

          {device !== "desktop" && device !== "fit" && (
            <button
              onClick={toggleOrientation}
              className="flex h-6 w-7 items-center justify-center transition-colors"
              style={{
                background: T_CANVAS.paper,
                color: T_CANVAS.muted,
                borderLeft: `1px solid ${T_CANVAS.rule}`,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = T_CANVAS.graphite)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = T_CANVAS.muted)
              }
              title="Toggle Orientation"
            >
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* INSPECT — Element↔Code Linker toggle. Deliberately prominent
              (solid fill when active, cobalt accent when idle): it changes
              what clicking the preview does. */}
          <button
            onClick={toggleInspect}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-[0.16em] uppercase transition-colors"
            style={{
              background: inspectMode ? T_CANVAS.cobalt : T_CANVAS.paper,
              border: `1px solid ${T_CANVAS.cobalt}`,
              color: inspectMode ? T_CANVAS.paper : T_CANVAS.cobaltInk,
            }}
            title={
              inspectMode
                ? "Inspect on: click any element to jump to its code. Click to turn off."
                : "Inspect: click any element in the preview to jump to its code"
            }
            aria-pressed={inspectMode}
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
              <path d="M3 3l7 19 2.5-8.5L21 11z" />
            </svg>
            {inspectMode ? "INSPECTING" : "INSPECT"}
          </button>

          {/* ANNOTATE — feature B. Red-pen markup on the render; solid fill
              when active (grid pages bleed through transparent fills). */}
          {onAnnotate && (
            <button
              onClick={toggleAnnotate}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-[0.16em] uppercase transition-colors"
              style={{
                background: annotateMode ? T_CANVAS.error : T_CANVAS.paper,
                border: `1px solid ${T_CANVAS.error}`,
                color: annotateMode ? T_CANVAS.paper : T_CANVAS.error,
              }}
              title={
                annotateMode
                  ? "Annotate on: draw on the preview, describe the change below, then apply. Click to cancel."
                  : "Annotate: draw on the preview and describe a change to apply to that spot"
              }
              aria-pressed={annotateMode}
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
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              {annotateMode ? "ANNOTATING" : "ANNOTATE"}
            </button>
          )}

          <button
            onClick={() => setShowConsole(!showConsole)}
            className="px-2.5 py-1 text-[10px] tracking-[0.16em] uppercase transition-colors"
            style={{
              background: showConsole ? T_CANVAS.cobaltWash : T_CANVAS.paper,
              border: `1px solid ${showConsole ? T_CANVAS.cobalt : T_CANVAS.rule}`,
              color: showConsole ? T_CANVAS.cobaltInk : T_CANVAS.muted,
            }}
          >
            CONSOLE {consoleOutput.length > 0 && `(${consoleOutput.length})`}
          </button>

          <button
            onClick={handleRefresh}
            className="flex h-6 w-6 items-center justify-center transition-colors"
            style={{
              background: T_CANVAS.paper,
              border: `1px solid ${T_CANVAS.rule}`,
              color: T_CANVAS.muted,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = T_CANVAS.graphite)
            }
            onMouseLeave={(e) => (e.currentTarget.style.color = T_CANVAS.muted)}
            title="Refresh Preview"
          >
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          <button
            onClick={handleOpenInNewWindow}
            className="flex h-6 w-6 items-center justify-center transition-colors"
            style={{
              background: T_CANVAS.paper,
              border: `1px solid ${T_CANVAS.rule}`,
              color: T_CANVAS.muted,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = T_CANVAS.graphite)
            }
            onMouseLeave={(e) => (e.currentTarget.style.color = T_CANVAS.muted)}
            title="Open in New Window"
          >
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>

          <div
            className="ml-1 flex items-center"
            style={{
              border: `1px solid ${T_CANVAS.rule}`,
              background: T_CANVAS.paper,
            }}
          >
            <button
              onClick={() =>
                setManualZoom((z) =>
                  Math.max(0.1, +((z ?? autoScale) - 0.1).toFixed(2))
                )
              }
              className="flex h-5 w-5 items-center justify-center transition-colors"
              style={{ color: T_CANVAS.muted }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = T_CANVAS.graphite)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = T_CANVAS.muted)
              }
              title="Zoom out"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                className="h-3 w-3"
              >
                <path d="M5 12h14" />
              </svg>
            </button>
            <span
              className="min-w-[40px] text-center text-[10px] tracking-[0.06em] tabular-nums"
              style={{ color: T_CANVAS.graphite }}
            >
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() =>
                setManualZoom((z) =>
                  Math.min(2, +((z ?? autoScale) + 0.1).toFixed(2))
                )
              }
              className="flex h-5 w-5 items-center justify-center transition-colors"
              style={{ color: T_CANVAS.muted }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = T_CANVAS.graphite)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = T_CANVAS.muted)
              }
              title="Zoom in"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                className="h-3 w-3"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            {manualZoom !== null && (
              <button
                onClick={() => setManualZoom(null)}
                className="ml-0.5 px-1.5 py-0.5 text-[9px] tracking-[0.16em] uppercase"
                style={{ color: T_CANVAS.cobalt }}
                title="Reset to auto-fit"
              >
                AUTO
              </button>
            )}
          </div>
          <span
            className="ml-1 text-[10px] tabular-nums tracking-[0.04em]"
            style={{ color: T_CANVAS.muted }}
          >
            {Math.round(dimensions.width)} ×{" "}
            {Math.round(device === "desktop" ? frameHeight : dimensions.height)}
          </span>
        </div>
      </div>

      <div
        ref={containerRef}
        className={`d5-preview-scroll flex-1 overflow-auto ${device === "fit" ? "p-0" : "p-6"}`}
        style={{
          background: T_CANVAS.paper,
        }}
      >
        <style jsx>{`
          .d5-preview-scroll {
            scrollbar-color: ${T_CANVAS.tick} ${T_CANVAS.paper};
            scrollbar-width: thin;
          }
          .d5-preview-scroll::-webkit-scrollbar {
            width: 10px;
            height: 10px;
            background: ${T_CANVAS.paper};
          }
          .d5-preview-scroll::-webkit-scrollbar-thumb {
            background: ${T_CANVAS.tick};
            border: 2px solid ${T_CANVAS.paper};
          }
          .d5-preview-scroll::-webkit-scrollbar-thumb:hover {
            background: ${T_CANVAS.muted};
          }
          .d5-preview-scroll::-webkit-scrollbar-corner {
            background: ${T_CANVAS.paper};
          }
        `}</style>
        {device === "fit" ? (
          /* Fit: the white card fills the container entirely. Manual zoom
             scales the iframe content, not the wrapper - eliminates the
             "tiny white card on black background" zoom-out artifact (BUG 2). */
          <div className="relative h-full w-full overflow-auto bg-white">
            <iframe
              ref={iframeRef}
              title="Live Preview"
              sandbox="allow-scripts allow-same-origin allow-forms"
              className="border-0"
              style={{
                width: `${100 / scale}%`,
                height: `${100 / scale}%`,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            />
            {annotationOverlay(
              containerSize.width / scale,
              containerSize.height / scale
            )}
          </div>
        ) : (
          /* Device-frame mode. The flex wrapper + margin:auto centers the frame
             on both axes when it is smaller than the panel, and degrades to a
             normal scrollable overflow (no clipped edges) when zoomed larger.
             The size-matching middle box tells layout flow the true VISUAL
             extent of the scaled frame — without it the frame occupies its
             unscaled dimensions in flow, leaving a huge ghost area below. */
          <div className="flex h-max min-h-full w-max min-w-full">
            <div
              style={{
                margin: "auto",
                width: dimensions.width * scale,
                height: frameHeight * scale,
              }}
            >
              <div
                className="relative overflow-hidden bg-white"
                style={{
                  width: dimensions.width,
                  height: frameHeight,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  border: `1px solid ${T_CANVAS.rule}`,
                  borderRadius:
                    device === "mobile" ? 24 : device === "tablet" ? 14 : 0,
                  boxShadow:
                    device === "mobile" || device === "tablet"
                      ? `0 0 0 6px ${T_CANVAS.graphite}`
                      : undefined,
                }}
              >
                <iframe
                  ref={iframeRef}
                  title="Live Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                  className="border-0"
                  style={{
                    width: dimensions.width,
                    height: frameHeight,
                  }}
                />
                {annotationOverlay(dimensions.width, frameHeight)}
              </div>
            </div>
          </div>
        )}
      </div>

      {annotateMode && (
        <div
          className="border-t px-3 py-2"
          style={{ borderColor: T_CANVAS.rule, background: T_CANVAS.vellum }}
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={annotateNote}
              onChange={(e) => setAnnotateNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleApplyAnnotation();
              }}
              placeholder="Describe the change for the marked area, e.g. make this button red"
              aria-label="Annotation instruction"
              disabled={annotateBusy}
              className="min-w-0 flex-1 px-2.5 py-1.5 text-[11px] outline-none"
              style={{
                background: T_CANVAS.paper,
                border: `1px solid ${T_CANVAS.rule}`,
                color: T_CANVAS.graphite,
              }}
            />
            <button
              onClick={() => setStrokes([])}
              disabled={annotateBusy || strokes.length === 0}
              className="px-2.5 py-1.5 text-[10px] tracking-[0.16em] uppercase transition-opacity disabled:opacity-40"
              style={{
                background: T_CANVAS.paper,
                border: `1px solid ${T_CANVAS.rule}`,
                color: T_CANVAS.muted,
              }}
            >
              CLEAR INK
            </button>
            <button
              onClick={() => void handleApplyAnnotation()}
              disabled={
                annotateBusy || strokes.length === 0 || !annotateNote.trim()
              }
              className="px-3 py-1.5 text-[10px] tracking-[0.16em] uppercase transition-opacity disabled:opacity-40"
              style={{
                background: T_CANVAS.error,
                border: `1px solid ${T_CANVAS.error}`,
                color: T_CANVAS.paper,
              }}
            >
              {annotateBusy ? "APPLYING..." : "APPLY"}
            </button>
          </div>
          <p
            className="mt-1.5 text-[10px] tracking-[0.04em]"
            style={{ color: T_CANVAS.muted }}
          >
            Draw on the preview to mark what should change, then describe the
            change and apply. One targeted edit per apply.
          </p>
        </div>
      )}

      {showConsole && (
        <div
          className="border-t p-3"
          style={{
            borderColor: T_CANVAS.rule,
            background: T_CANVAS.vellum,
            fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <h3
              className="text-[10px] tracking-[0.18em] uppercase"
              style={{ color: T_CANVAS.graphite }}
            >
              CONSOLE OUTPUT
            </h3>
            <button
              onClick={() => setConsoleOutput([])}
              className="text-[10px] tracking-[0.14em] uppercase transition-colors"
              style={{ color: T_CANVAS.muted }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = T_CANVAS.cobalt)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = T_CANVAS.muted)
              }
            >
              CLEAR
            </button>
          </div>
          <div
            className="max-h-32 overflow-auto p-2.5 text-[11px] leading-[1.5]"
            style={{
              background: T_CANVAS.paper,
              border: `1px solid ${T_CANVAS.rule}`,
              color: T_CANVAS.graphite,
            }}
          >
            {consoleOutput.length === 0 ? (
              <div style={{ color: T_CANVAS.muted }}>NO CONSOLE OUTPUT</div>
            ) : (
              consoleOutput.map((output, i) => (
                <div
                  key={i}
                  className="py-0.5"
                  style={{ color: T_CANVAS.graphite }}
                >
                  <span style={{ color: T_CANVAS.cobalt }}>›</span> {output}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
