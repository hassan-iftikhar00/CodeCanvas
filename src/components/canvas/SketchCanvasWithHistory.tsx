"use client";

import React, {
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import SketchCanvas, { type SketchCanvasRef } from "./SketchCanvas";

interface CanvasShapeData {
  id?: string;
  type?:
    | "text"
    | "rectangle"
    | "circle"
    | "image"
    | "ellipse"
    | "triangle"
    | "arrow"
    | "line";
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  radiusX?: number;
  radiusY?: number;
  text?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  draggable?: boolean;
}

interface CanvasLineData {
  tool?: string;
  points?: number[];
  color?: string;
  width?: number;
  id?: string;
}

interface CanvasComponentGroup {
  id?: string;
  name?: string;
  x?: number;
  y?: number;
  shapes?: CanvasShapeData[];
  selected?: boolean;
}

interface CanvasTemplateData {
  lines?: CanvasLineData[];
  shapes?: CanvasShapeData[];
  componentGroups?: CanvasComponentGroup[];
}

interface SketchCanvasWithHistoryProps {
  tool: string;
  mode: string;
  gridEnabled: boolean;
  snapEnabled: boolean;
  importedDesign?: { x: number; y: number }[][] | null;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  zoom?: number;
  canvasState: CanvasTemplateData;
  onStateChange: (newState: CanvasTemplateData) => void;
}

// Alias for now; widen into an interface if history-specific methods appear.
export type SketchCanvasWithHistoryRef = SketchCanvasRef;

/**
 * Wrapper around SketchCanvas that integrates with the useHistory hook
 * This component manages the canvas state and syncs it with the parent's history
 */
const SketchCanvasWithHistory = forwardRef<
  SketchCanvasWithHistoryRef,
  SketchCanvasWithHistoryProps
>(
  (
    {
      tool,
      mode,
      gridEnabled,
      snapEnabled,
      importedDesign,
      strokeColor,
      fillColor,
      strokeWidth,
      canvasState,
      onStateChange,
      zoom,
      ...props
    },
    ref
  ) => {
    const canvasRef = useRef<SketchCanvasRef>(null);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      getCanvasData: () => {
        if (canvasRef.current) {
          return canvasRef.current.getCanvasData();
        }
        return {
          lines: canvasState?.lines || [],
          shapes: canvasState?.shapes || [],
          componentGroups: [],
          width: 1000,
          height: 600,
        } as ReturnType<SketchCanvasRef["getCanvasData"]>;
      },
      clearCanvas: () => {
        if (canvasRef.current) {
          canvasRef.current.clearCanvas();
        }
        onStateChange({ lines: [], shapes: [], componentGroups: [] });
      },
      insertTemplate: (data: CanvasTemplateData, templateName?: string) => {
        if (canvasRef.current) {
          canvasRef.current.insertTemplate(data, templateName);
          // After inserting template, push the updated state (including
          // componentGroups - omitting them here made the restore effect
          // see a mismatch 100ms later and wipe the just-inserted template).
          setTimeout(() => {
            const updatedData = canvasRef.current?.getCanvasData();
            if (updatedData) {
              onStateChange({
                lines: updatedData.lines,
                shapes: updatedData.shapes,
                componentGroups: updatedData.componentGroups,
              });
            }
          }, 100);
        }
      },
      exportAsPNG: () => {
        if (canvasRef.current) {
          return canvasRef.current.exportAsPNG();
        }
        return { dataURL: "", transform: { offsetX: 0, offsetY: 0, scale: 1 } };
      },
      exportAsDataURL: (mimeType?: string, quality?: number) => {
        if (canvasRef.current) {
          return canvasRef.current.exportAsDataURL(mimeType, quality);
        }
        return "";
      },
      replaceCanvasState: (data) => {
        if (canvasRef.current) {
          canvasRef.current.replaceCanvasState(data);
        }
        onStateChange({
          lines: (data.lines ?? []) as CanvasLineData[],
          shapes: (data.shapes ?? []) as CanvasShapeData[],
          componentGroups: (data.componentGroups ??
            []) as CanvasComponentGroup[],
        });
      },
    }));

    // Track if we're applying history state to prevent circular updates
    const isApplyingHistoryRef = useRef(false);

    // Apply history state to canvas (for undo/redo + project load).
    // Uses replaceCanvasState so componentGroups (templates) survive the round-trip;
    // the previous clearCanvas + insertTemplate path silently dropped them.
    useEffect(() => {
      if (!canvasState || !canvasRef.current || isApplyingHistoryRef.current)
        return;

      const currentData = canvasRef.current.getCanvasData();
      const currentCanvasState = {
        lines: currentData.lines,
        shapes: currentData.shapes,
        componentGroups: currentData.componentGroups,
      };

      if (JSON.stringify(currentCanvasState) !== JSON.stringify(canvasState)) {
        isApplyingHistoryRef.current = true;
        canvasRef.current.replaceCanvasState(
          canvasState as Parameters<SketchCanvasRef["replaceCanvasState"]>[0]
        );
        setTimeout(() => {
          isApplyingHistoryRef.current = false;
        }, 100);
      }
    }, [canvasState]);

    // Sync canvas state changes with parent (for capturing new changes)
    useEffect(() => {
      if (!canvasState) return; // Don't bail on isApplyingHistoryRef here - the interval tick re-checks it. Bailing out at this level skips creating the interval after undo, which leaves the parent's history.state stale and breaks the empty-state placeholder.

      // Poll for canvas changes every 500ms
      const interval = setInterval(() => {
        if (canvasRef.current && !isApplyingHistoryRef.current) {
          const currentData = canvasRef.current.getCanvasData();
          const currentState = {
            lines: currentData.lines,
            shapes: currentData.shapes,
            componentGroups: currentData.componentGroups,
          };

          if (JSON.stringify(currentState) !== JSON.stringify(canvasState)) {
            onStateChange(currentState);
          }
        }
      }, 500);

      return () => clearInterval(interval);
    }, [canvasState, onStateChange]);

    return (
      <SketchCanvas
        ref={canvasRef}
        tool={tool}
        mode={mode}
        gridEnabled={gridEnabled}
        snapEnabled={snapEnabled}
        importedDesign={importedDesign}
        strokeColor={strokeColor}
        fillColor={fillColor}
        strokeWidth={strokeWidth}
        zoom={zoom}
        {...props}
      />
    );
  }
);

SketchCanvasWithHistory.displayName = "SketchCanvasWithHistory";

export default SketchCanvasWithHistory;
