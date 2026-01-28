"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import SketchCanvas, { type SketchCanvasRef } from "./SketchCanvas";

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
  canvasState: { lines: any[]; shapes: any[] };
  onStateChange: (newState: { lines: any[]; shapes: any[] }) => void;
}

export interface SketchCanvasWithHistoryRef extends SketchCanvasRef {
  //  Additional methods if needed
}

/**
 * Wrapper around SketchCanvas that integrates with the useHistory hook
 * This component manages the canvas state and syncs it with the parent's history
 */
const SketchCanvasWithHistory = forwardRef<SketchCanvasWithHistoryRef, SketchCanvasWithHistoryProps>(
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
    const canvasRef = React.useRef<SketchCanvasRef>(null);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      getCanvasData: () => {
        if (canvasRef.current) {
          return canvasRef.current.getCanvasData();
        }
        return {
          lines: canvasState.lines,
          shapes: canvasState.shapes,
          width: 1000,
          height: 600,
        };
      },
      clearCanvas: () => {
        if (canvasRef.current) {
          canvasRef.current.clearCanvas();
        }
        onStateChange({ lines: [], shapes: [] });
      },
      insertTemplate: (data: any) => {
        if (canvasRef.current) {
          canvasRef.current.insertTemplate(data);
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
    }));

    // Sync canvas state changes with parent (for undo/redo)
    useEffect(() => {
      // Poll for canvas changes every 500ms
      const interval = setInterval(() => {
        if (canvasRef.current) {
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
