import { DRAFTING_TOKENS as T } from "@/lib/drafting-room/tokens";
import type { CanvasData, CanvasShapeData } from "@/hooks/useProjectSave";

const PAD = 12;
const VW = 320;
const VH = 180;
const MAX_POLYLINE_POINTS = 80;

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function shapeBounds(s: CanvasShapeData): Bounds | null {
  const x = s.x ?? 0;
  const y = s.y ?? 0;
  switch (s.type) {
    case "rectangle":
    case "image": {
      return {
        minX: x,
        minY: y,
        maxX: x + (s.width ?? 0),
        maxY: y + (s.height ?? 0),
      };
    }
    case "circle": {
      const r = s.radius ?? 0;
      return { minX: x - r, minY: y - r, maxX: x + r, maxY: y + r };
    }
    case "ellipse": {
      const rx = s.radiusX ?? 0;
      const ry = s.radiusY ?? 0;
      return { minX: x - rx, minY: y - ry, maxX: x + rx, maxY: y + ry };
    }
    case "text": {
      const fs = s.fontSize ?? 12;
      const len = (s.text ?? "").length * fs * 0.55;
      return { minX: x, minY: y - fs, maxX: x + len, maxY: y };
    }
    default:
      return null;
  }
}

function linePoints(pts: number[] | undefined): Bounds | null {
  if (!pts || pts.length < 4) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i + 1 < pts.length; i += 2) {
    const x = pts[i],
      y = pts[i + 1];
    if (typeof x !== "number" || typeof y !== "number") continue;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

function flattenShapes(data: CanvasData): CanvasShapeData[] {
  const out: CanvasShapeData[] = [...(data.shapes ?? [])];
  for (const g of data.componentGroups ?? []) {
    const offX = g.x ?? 0;
    const offY = g.y ?? 0;
    for (const s of g.shapes ?? []) {
      out.push({ ...s, x: (s.x ?? 0) + offX, y: (s.y ?? 0) + offY });
    }
  }
  return out;
}

export function hasSketchContent(data: CanvasData | null | undefined): boolean {
  if (!data) return false;
  if ((data.shapes?.length ?? 0) > 0) return true;
  if ((data.lines?.length ?? 0) > 0) return true;
  if ((data.componentGroups ?? []).some((g) => (g.shapes?.length ?? 0) > 0))
    return true;
  return false;
}

export default function SketchThumbnail({
  canvasData,
}: {
  canvasData: CanvasData;
}) {
  const shapes = flattenShapes(canvasData);
  const lines = canvasData.lines ?? [];

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const merge = (b: Bounds | null) => {
    if (!b) return;
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  };
  for (const s of shapes) merge(shapeBounds(s));
  for (const l of lines) merge(linePoints(l.points));

  if (!isFinite(minX) || maxX <= minX || maxY <= minY) {
    return null;
  }

  const dataW = Math.max(maxX - minX, 1);
  const dataH = Math.max(maxY - minY, 1);
  const scale = Math.min((VW - PAD * 2) / dataW, (VH - PAD * 2) / dataH);
  const offX = PAD + (VW - PAD * 2 - dataW * scale) / 2;
  const offY = PAD + (VH - PAD * 2 - dataH * scale) / 2;
  const tx = (v: number) => offX + (v - minX) * scale;
  const ty = (v: number) => offY + (v - minY) * scale;

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 z-10 h-full w-full"
      aria-hidden="true"
    >
      {lines.map((l, i) => {
        const pts = l.points;
        if (!pts || pts.length < 4) return null;
        const pairs = Math.floor(pts.length / 2);
        const stride = Math.max(1, Math.ceil(pairs / MAX_POLYLINE_POINTS));
        const coords: string[] = [];
        for (let j = 0; j + 1 < pts.length; j += 2 * stride) {
          coords.push(`${tx(pts[j])},${ty(pts[j + 1])}`);
        }
        const lastX = pts[pts.length - 2];
        const lastY = pts[pts.length - 1];
        if (typeof lastX === "number" && typeof lastY === "number") {
          coords.push(`${tx(lastX)},${ty(lastY)}`);
        }
        return (
          <polyline
            key={`l${i}`}
            points={coords.join(" ")}
            fill="none"
            stroke={T.graphite}
            strokeWidth={0.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.55}
          />
        );
      })}
      {shapes.map((s, i) => {
        const x = s.x ?? 0;
        const y = s.y ?? 0;
        if (s.type === "rectangle" || s.type === "image") {
          return (
            <rect
              key={`s${i}`}
              x={tx(x)}
              y={ty(y)}
              width={Math.max((s.width ?? 0) * scale, 0)}
              height={Math.max((s.height ?? 0) * scale, 0)}
              fill="none"
              stroke={T.cobalt}
              strokeWidth={0.9}
              opacity={0.55}
            />
          );
        }
        if (s.type === "circle") {
          return (
            <circle
              key={`s${i}`}
              cx={tx(x)}
              cy={ty(y)}
              r={Math.max((s.radius ?? 0) * scale, 0)}
              fill="none"
              stroke={T.cobalt}
              strokeWidth={0.9}
              opacity={0.55}
            />
          );
        }
        if (s.type === "ellipse") {
          return (
            <ellipse
              key={`s${i}`}
              cx={tx(x)}
              cy={ty(y)}
              rx={Math.max((s.radiusX ?? 0) * scale, 0)}
              ry={Math.max((s.radiusY ?? 0) * scale, 0)}
              fill="none"
              stroke={T.cobalt}
              strokeWidth={0.9}
              opacity={0.55}
            />
          );
        }
        if (s.type === "text") {
          const fs = s.fontSize ?? 12;
          const w = Math.min((s.text ?? "").length * fs * 0.55 * scale, 90);
          return (
            <rect
              key={`s${i}`}
              x={tx(x)}
              y={ty(y) - 1.75}
              width={Math.max(w, 6)}
              height={2.5}
              fill={T.muted}
              opacity={0.4}
            />
          );
        }
        return null;
      })}
    </svg>
  );
}
