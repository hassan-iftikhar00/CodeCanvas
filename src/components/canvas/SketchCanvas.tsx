"use client";

import {
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Stage, Layer, Line, Rect, Circle, Text as KonvaText } from "react-konva";
import type Konva from "konva";

interface SketchCanvasProps {
  tool: string;
  mode: string;
  gridEnabled: boolean;
  snapEnabled: boolean;
  importedDesign?: { x: number; y: number }[][] | null;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  zoom?: number;  // Add zoom prop
}

interface LineData {
  tool: string;
  points: number[];
  color?: string;
  width?: number;
}

interface ShapeData {
  id: string;
  type: "rectangle" | "circle" | "text" | "image";
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  text?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface SketchCanvasRef {
  getCanvasData: () => {
    lines: LineData[];
    shapes: ShapeData[];
    width: number;
    height: number;
  };
  clearCanvas: () => void;
  insertTemplate: (data: any) => void;
}

const SketchCanvas = forwardRef<SketchCanvasRef, SketchCanvasProps>(
  ({ tool, gridEnabled, snapEnabled, importedDesign, strokeColor = "#000000", fillColor = "transparent", strokeWidth = 5, zoom = 100 }, ref) => {
    const [lines, setLines] = useState<LineData[]>([]);
    const [shapes, setShapes] = useState<ShapeData[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentShape, setCurrentShape] = useState<ShapeData | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    const [spacePressed, setSpacePressed] = useState(false);
    const stageRef = useRef<Konva.Stage>(null);

    // Expose methods to parent component via ref
    useImperativeHandle(ref, () => ({
      getCanvasData: () => ({
        lines,
        shapes,
        width: 1000,
        height: 600,
      }),
      clearCanvas: () => {
        setLines([]);
        setShapes([]);
      },
      insertTemplate: (data: any) => {
        if (data.lines) setLines((prev) => [...prev, ...data.lines]);
        if (data.shapes) {
          const newShapes = data.shapes.map((s: any) => ({
            ...s,
            id: s.id || `shape-${Date.now()}-${Math.random()}`,
            stroke: s.stroke || strokeColor,
            strokeWidth: s.strokeWidth || 2,
            fill: s.fill || "transparent"
          }));
          setShapes((prev) => [...prev, ...newShapes]);
        }
      },
    }));

    // Load imported design when available
    useEffect(() => {
      if (importedDesign && importedDesign.length > 0) {
        const convertedLines = importedDesign.map((stroke) => ({
          tool: "pen",
          points: stroke.flatMap((point) => [point.x * 2.5, point.y * 2]), // Scale up
          color: "#000000",
          width: 5
        }));
        setLines(convertedLines);
      }
    }, [importedDesign]);

    // Spacebar pan controls
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space' && !spacePressed) {
          e.preventDefault();
          setSpacePressed(true);
          if (stageRef.current) {
            stageRef.current.container().style.cursor = 'grab';
          }
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          e.preventDefault();
          setSpacePressed(false);
          setIsPanning(false);
          if (stageRef.current) {
            stageRef.current.container().style.cursor = 'default';
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }, [spacePressed]);

    const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Pan mode with spacebar
      if (spacePressed) {
        setIsPanning(true);
        if (stageRef.current) {
          stageRef.current.container().style.cursor = 'grabbing';
        }
        return;
      }

      const pos = e.target.getStage()?.getPointerPosition();
      if (!pos) return;

      if (tool === "pen" || tool === "erase") {
        setIsDrawing(true);
        setLines([...lines, { 
          tool: tool === "erase" ? "erase" : "pen", 
          points: [pos.x, pos.y],
          color: tool === "erase" ? "#FFFFFF" : strokeColor,
          width: tool === "erase" ? 20 : strokeWidth
        }]);
      } else if (tool === "shape" || tool === "rectangle" || tool === "circle") {
        // Handle Shape Tools (assuming 'shape' maps to rectangle for now if specific tool logic used)
        const shapeType = tool === "circle" ? "circle" : "rectangle"; 
        // If tool is generic 'shape', default to rectangle or check submodule
        // For simplicity in this demo, let's assume specific tools are passed or we map them.
        // The user only has "shape" in the tool list in page.tsx currently.
        // Let's assume the 'shape' tool creates a rectangle by default for now
        
        setIsDrawing(true);
        const newShape: ShapeData = {
          id: `shape-${Date.now()}`,
          type: shapeType,
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          radius: 0,
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          fill: fillColor
        };
        setCurrentShape(newShape);
      } else if (tool === "text") {
        const text = prompt("Enter text:", "New Text");
        if (text) {
          const newText: ShapeData = {
            id: `text-${Date.now()}`,
            type: "text",
            x: pos.x,
            y: pos.y,
            text: text,
            stroke: strokeColor,
            fill: strokeColor
          };
          setShapes([...shapes, newText]);
        }
      }
    };

    const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isDrawing) return;
      const stage = e.target.getStage();
      const point = stage?.getPointerPosition();
      if (!point) return;

      if (tool === "pen" || tool === "erase") {
        const lastLine = lines[lines.length - 1];
        const updatedLine = {
          ...lastLine,
          points: lastLine.points.concat([point.x, point.y]),
        };
        setLines([...lines.slice(0, -1), updatedLine]);
      } else if (currentShape && (tool === "shape" || tool === "rectangle" || tool === "circle")) {
        // Update current shape dimensions
        const startX = currentShape.x;
        const startY = currentShape.y;
        
        if (currentShape.type === "rectangle") {
          const width = point.x - startX;
          const height = point.y - startY;
          setCurrentShape({
            ...currentShape,
            width,
            height
          });
        } else if (currentShape.type === "circle") {
          const dx = point.x - startX;
          const dy = point.y - startY;
          const radius = Math.sqrt(dx*dx + dy*dy);
          setCurrentShape({
            ...currentShape,
            radius
          });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDrawing(false);
      if (currentShape) {
        // Prevent adding 0-size shapes
        if ((currentShape.type === "rectangle" && currentShape.width !== 0) || 
            (currentShape.type === "circle" && currentShape.radius !== 0)) {
           setShapes([...shapes, currentShape]);
        }
        setCurrentShape(null);
      }
    };

    return (
      <div className="relative h-full w-full rounded-xl bg-canvas border-2 border-[#2E2E2E] shadow-panel paper-texture">
        <Stage
          width={1000}
          height={600}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          ref={stageRef}
          className="rounded-xl"
          draggable={spacePressed}
          scaleX={zoom / 100}
          scaleY={zoom / 100}
        >
          <Layer>
            {/* Grid Background */}
            {gridEnabled && (
              <>
                {Array.from({ length: 50 }).map((_, i) => (
                  <Line
                    key={`v-${i}`}
                    points={[i * 20, 0, i * 20, 600]}
                    stroke="rgba(46, 46, 46, 0.3)"
                    strokeWidth={1}
                  />
                ))}
                {Array.from({ length: 30 }).map((_, i) => (
                  <Line
                    key={`h-${i}`}
                    points={[0, i * 20, 1000, i * 20]}
                    stroke="rgba(46, 46, 46, 0.3)"
                    strokeWidth={1}
                  />
                ))}
              </>
            )}

            {/* Drawn Lines */}
            {lines.map((line, i) => (
              <Line
                key={`line-${i}`}
                points={line.points}
                stroke={line.color || "#000000"}
                strokeWidth={line.width || 2.5}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
              />
            ))}

            {/* Drawn Shapes */}
            {shapes.map((shape, i) => {
              if (shape.type === 'rectangle') {
                return (
                  <Rect
                    key={shape.id || i}
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    stroke={shape.stroke || "#000000"}
                    strokeWidth={shape.strokeWidth || 2}
                    fill={shape.fill || "transparent"}
                    cornerRadius={5}
                  />
                );
              } else if (shape.type === 'circle') {
                return (
                  <Circle
                    key={shape.id || i}
                    x={shape.x}
                    y={shape.y}
                    radius={shape.radius}
                    stroke={shape.stroke || "#000000"}
                    strokeWidth={shape.strokeWidth || 2}
                    fill={shape.fill || "transparent"}
                  />
                );
              } else if (shape.type === 'text') {
                return (
                  <KonvaText
                    key={shape.id || i}
                    x={shape.x}
                    y={shape.y}
                    text={shape.text || "Text"}
                    fontSize={16}
                    fontFamily="Inter, sans-serif"
                    fill={shape.stroke || "#000000"}
                  />
                );
              }
              return null;
            })}

            {/* Current Shape (Being Drawn) */}
            {currentShape && (
              currentShape.type === 'rectangle' ? (
                <Rect
                  x={currentShape.x}
                  y={currentShape.y}
                  width={currentShape.width}
                  height={currentShape.height}
                  stroke={currentShape.stroke || "#000000"}
                  strokeWidth={currentShape.strokeWidth || 2}
                  fill={currentShape.fill || "transparent"}
                  cornerRadius={5}
                />
              ) : currentShape.type === 'circle' ? (
                <Circle
                  x={currentShape.x}
                  y={currentShape.y}
                  radius={currentShape.radius}
                  stroke={currentShape.stroke || "#000000"}
                  strokeWidth={currentShape.strokeWidth || 2}
                  fill={currentShape.fill || "transparent"}
                />
              ) : null
            )}

            {/* Empty State Hint */}
            {lines.length === 0 && shapes.length === 0 && !currentShape && (
              <Rect
                x={300}
                y={250}
                width={400}
                height={100}
                fill="transparent"
              />
            )}
          </Layer>
        </Stage>

        {/* Canvas Info Overlay */}
        <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-3 rounded-lg bg-white/90 px-3 py-2 text-xs font-medium text-muted shadow-sm backdrop-blur-sm">
          <span>1000 × 600</span>
          <span>•</span>
          <span>
            {tool === "pen"
              ? "Drawing"
              : tool === "select"
                ? "Selection"
                : tool.charAt(0).toUpperCase() + tool.slice(1)}{" "}
            Mode
          </span>
          {gridEnabled && (
            <>
              <span>•</span>
              <span className="text-accent">Grid On</span>
            </>
          )}
        </div>
      </div>
    );
  }
);

SketchCanvas.displayName = "SketchCanvas";

export default SketchCanvas;
