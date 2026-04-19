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
  type?: "text" | "rectangle" | "circle" | "image" | "ellipse" | "triangle" | "arrow";
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

interface CanvasTemplateData {
  lines?: CanvasLineData[];
  shapes?: CanvasShapeData[];
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

export interface SketchCanvasWithHistoryRef extends SketchCanvasRef {
  //  Additional methods if needed
}

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
        onStateChange({ lines: [], shapes: [] });
      },
      insertTemplate: (data: CanvasTemplateData, templateName?: string) => {
        if (canvasRef.current) {
          canvasRef.current.insertTemplate(data, templateName);
          // After inserting template, get updated state
          setTimeout(() => {
            const updatedData = canvasRef.current?.getCanvasData();
            if (updatedData) {
              onStateChange({
                lines: updatedData.lines,
                shapes: updatedData.shapes,
              });
            }
          }, 100);
        }
      },
      exportAsPNG: () => {
        if (canvasRef.current) {
          return canvasRef.current.exportAsPNG();
        }
        return "";
      },
      exportAsDataURL: (mimeType?: string, quality?: number) => {
        if (canvasRef.current) {
          return canvasRef.current.exportAsDataURL(mimeType, quality);
        }
        return "";
      },
    }));

    // Track if we're applying history state to prevent circular updates
    const isApplyingHistoryRef = useRef(false);

    // Apply history state to canvas (for undo/redo)
    useEffect(() => {
      if (!canvasState || !canvasRef.current || isApplyingHistoryRef.current) return;

      const currentData = canvasRef.current.getCanvasData();
      const currentCanvasState = {
        lines: currentData.lines,
        shapes: currentData.shapes,
      };

      // Only update canvas if history state is different from canvas state
      if (JSON.stringify(currentCanvasState) !== JSON.stringify(canvasState)) {
        isApplyingHistoryRef.current = true;
        // Clear and restore canvas from history
        canvasRef.current.clearCanvas();
        if (
          (canvasState.lines?.length ?? 0) > 0 ||
          (canvasState.shapes?.length ?? 0) > 0
        ) {
          canvasRef.current.insertTemplate(canvasState);
        }
        // Reset flag after a brief delay
        setTimeout(() => {
          isApplyingHistoryRef.current = false;
        }, 100);
      }
    }, [canvasState]);

    // Sync canvas state changes with parent (for capturing new changes)
    useEffect(() => {
      if (!canvasState || isApplyingHistoryRef.current) return; // Don't capture changes while applying history

      // Poll for canvas changes every 500ms
      const interval = setInterval(() => {
        if (canvasRef.current && !isApplyingHistoryRef.current) {
          const currentData = canvasRef.current.getCanvasData();
          const currentState = {
            lines: currentData.lines,
            shapes: currentData.shapes,
          };

          // Check if state has changed
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
