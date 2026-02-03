"use client";

import {
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import {
  Stage,
  Layer,
  Line,
  Rect,
  Circle,
  Text as KonvaText,
  Group,
} from "react-konva";
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
  zoom?: number; // Add zoom prop
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
  (
    {
      tool,
      gridEnabled,
      snapEnabled,
      importedDesign,
      strokeColor = "#000000",
      fillColor = "transparent",
      strokeWidth = 5,
      zoom = 100,
    },
    ref
  ) => {
    const [lines, setLines] = useState<LineData[]>([]);
    const [shapes, setShapes] = useState<ShapeData[]>([]);
    const [canvasSize, setCanvasSize] = useState({ width: 3000, height: 2000 });
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentShape, setCurrentShape] = useState<ShapeData | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    const [spacePressed, setSpacePressed] = useState(false);
    const stageRef = useRef<Konva.Stage>(null);

    // Text input modal state
    const [showTextInput, setShowTextInput] = useState(false);
    const [textInputValue, setTextInputValue] = useState("");
    const [textInputPosition, setTextInputPosition] = useState({ x: 0, y: 0 });
    const [pendingTextPosition, setPendingTextPosition] = useState({ x: 0, y: 0 });
    const textInputRef = useRef<HTMLInputElement>(null);

    // Track which text element is being hovered for delete button
    const [hoveredTextId, setHoveredTextId] = useState<string | null>(null);

    // Expose methods to parent component via ref
    useImperativeHandle(ref, () => ({
      getCanvasData: () => ({
        lines,
        shapes,
        width: canvasSize.width,
        height: canvasSize.height,
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
            fill: s.fill || "transparent",
          }));
          setShapes((prev) => [...prev, ...newShapes]);
        }
      },
    }));
    // Responsive canvas sizing
    useEffect(() => {
      const updateSize = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setCanvasSize({
            width: Math.max(200, Math.floor(rect.width)),
            height: Math.max(200, Math.floor(rect.height)),
          });
        }
      };
      updateSize();
      const ro = new (window as any).ResizeObserver(updateSize);
      if (containerRef.current) {
        ro.observe(containerRef.current);
      }
      return () => {
        if (containerRef.current) ro.unobserve(containerRef.current);
        ro.disconnect();
      };
    }, []);

    // Load imported design when available
    useEffect(() => {
      if (importedDesign && importedDesign.length > 0) {
        const convertedLines = importedDesign.map((stroke) => ({
          tool: "pen",
          points: stroke.flatMap((point) => [point.x * 2.5, point.y * 2]), // Scale up
          color: "#000000",
          width: 5,
        }));
        setLines(convertedLines);
      }
    }, [importedDesign]);

    // Spacebar pan controls
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === "Space" && !spacePressed) {
          e.preventDefault();
          setSpacePressed(true);
          if (stageRef.current) {
            stageRef.current.container().style.cursor = "grab";
          }
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === "Space") {
          e.preventDefault();
          setSpacePressed(false);
          setIsPanning(false);
          if (stageRef.current) {
            stageRef.current.container().style.cursor = "default";
          }
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
      };
    }, [spacePressed]);

    // Helper function to get mouse position adjusted for zoom and pan
    const getTransformedPointerPosition = (stage: Konva.Stage | null) => {
      if (!stage) return null;
      const pos = stage.getPointerPosition();
      if (!pos) return null;

      const scale = zoom / 100;
      const stagePos = stage.position();

      return {
        x: (pos.x - stagePos.x) / scale,
        y: (pos.y - stagePos.y) / scale,
      };
    };

    // Focus text input when shown
    useEffect(() => {
      if (showTextInput && textInputRef.current) {
        textInputRef.current.focus();
      }
    }, [showTextInput]);

    // Handle text submission
    const handleTextSubmit = () => {
      if (textInputValue.trim()) {
        const newText: ShapeData = {
          id: `text-${Date.now()}`,
          type: "text",
          x: pendingTextPosition.x,
          y: pendingTextPosition.y,
          text: textInputValue.trim(),
          stroke: strokeColor,
          fill: strokeColor,
        };
        setShapes([...shapes, newText]);
      }
      setShowTextInput(false);
      setTextInputValue("");
    };

    // Handle text cancellation
    const handleTextCancel = () => {
      setShowTextInput(false);
      setTextInputValue("");
    };

    // Handle text element deletion
    const handleDeleteText = (id: string) => {
      setShapes(shapes => shapes.filter(shape => shape.id !== id));
    };

    // Handle text drag
    const handleTextDragEnd = (id: string, newX: number, newY: number) => {
      setShapes(shapes =>
        shapes.map(shape =>
          shape.id === id ? { ...shape, x: newX, y: newY } : shape
        )
      );
    };

    const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Pan mode with spacebar
      if (spacePressed) {
        setIsPanning(true);
        if (stageRef.current) {
          stageRef.current.container().style.cursor = "grabbing";
        }
        return;
      }

      const pos = getTransformedPointerPosition(e.target.getStage());
      if (!pos) return;

      if (tool === "bin") {
        // Check for hit on shapes first (reverse for topmost first)
        for (let i = shapes.length - 1; i >= 0; i--) {
          const shape = shapes[i];
          if (shape.type === "rectangle") {
            const x1 = shape.x;
            const y1 = shape.y;
            const x2 = shape.x + (shape.width || 0);
            const y2 = shape.y + (shape.height || 0);
            if (pos.x >= Math.min(x1, x2) && pos.x <= Math.max(x1, x2) && pos.y >= Math.min(y1, y2) && pos.y <= Math.max(y1, y2)) {
              setShapes(shapes => shapes.filter((_, idx) => idx !== i));
              return;
            }
          } else if (shape.type === "circle") {
            const dx = pos.x - shape.x;
            const dy = pos.y - shape.y;
            const r = shape.radius || 0;
            if (dx * dx + dy * dy <= r * r) {
              setShapes(shapes => shapes.filter((_, idx) => idx !== i));
              return;
            }
          } else if (shape.type === "text") {
            // Assume text is 100x30 box for hit area (can be improved)
            const x1 = shape.x;
            const y1 = shape.y;
            const x2 = shape.x + 100;
            const y2 = shape.y + 30;
            if (pos.x >= x1 && pos.x <= x2 && pos.y >= y1 && pos.y <= y2) {
              setShapes(shapes => shapes.filter((_, idx) => idx !== i));
              return;
            }
          }
        }

        // Check for hit on lines (pen drawings)
        const hitThreshold = 10; // pixels distance threshold for line hit detection
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i];
          const points = line.points;
          // Check each segment of the line
          for (let j = 0; j < points.length - 2; j += 2) {
            const x1 = points[j];
            const y1 = points[j + 1];
            const x2 = points[j + 2];
            const y2 = points[j + 3];
            // Calculate distance from point to line segment
            const lineLen = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            if (lineLen === 0) continue;
            const t = Math.max(0, Math.min(1, ((pos.x - x1) * (x2 - x1) + (pos.y - y1) * (y2 - y1)) / (lineLen ** 2)));
            const projX = x1 + t * (x2 - x1);
            const projY = y1 + t * (y2 - y1);
            const dist = Math.sqrt((pos.x - projX) ** 2 + (pos.y - projY) ** 2);
            if (dist <= hitThreshold + (line.width || 5) / 2) {
              setLines(lines => lines.filter((_, idx) => idx !== i));
              return;
            }
          }
        }
        return;
      }

      if (tool === "pen") {
        setIsDrawing(true);
        setLines([
          ...lines,
          {
            tool: "pen",
            points: [pos.x, pos.y],
            color: strokeColor,
            width: strokeWidth,
          },
        ]);
      } else if (
        tool === "shape" ||
        tool === "rectangle" ||
        tool === "circle"
      ) {
        // Handle Shape Tools (assuming 'shape' maps to rectangle for now if specific tool logic used)
        const shapeType = tool === "circle" ? "circle" : "rectangle";
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
          fill: fillColor,
        };
        setCurrentShape(newShape);
      } else if (tool === "text") {
        // Show the text input modal at the clicked position
        const stage = e.target.getStage();
        if (stage && containerRef.current) {
          const containerRect = containerRef.current.getBoundingClientRect();
          const stagePos = stage.position();
          const scale = zoom / 100;

          // Calculate screen position for the input
          const screenX = pos.x * scale + stagePos.x + containerRect.left;
          const screenY = pos.y * scale + stagePos.y + containerRect.top;

          setTextInputPosition({ x: screenX, y: screenY });
          setPendingTextPosition({ x: pos.x, y: pos.y });
          setTextInputValue("");
          setShowTextInput(true);
        }
      }
    };

    const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isDrawing) return;
      const stage = e.target.getStage();
      const point = getTransformedPointerPosition(stage);
      if (!point) return;

      if (tool === "pen") {
        const lastLine = lines[lines.length - 1];
        const updatedLine = {
          ...lastLine,
          points: lastLine.points.concat([point.x, point.y]),
        };
        setLines([...lines.slice(0, -1), updatedLine]);
      } else if (
        currentShape &&
        (tool === "shape" || tool === "rectangle" || tool === "circle")
      ) {
        // Update current shape dimensions
        const startX = currentShape.x;
        const startY = currentShape.y;

        if (currentShape.type === "rectangle") {
          const width = point.x - startX;
          const height = point.y - startY;
          setCurrentShape({
            ...currentShape,
            width,
            height,
          });
        } else if (currentShape.type === "circle") {
          const dx = point.x - startX;
          const dy = point.y - startY;
          const radius = Math.sqrt(dx * dx + dy * dy);
          setCurrentShape({
            ...currentShape,
            radius,
          });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDrawing(false);
      if (currentShape) {
        // Prevent adding 0-size shapes
        if (
          (currentShape.type === "rectangle" && currentShape.width !== 0) ||
          (currentShape.type === "circle" && currentShape.radius !== 0)
        ) {
          setShapes([...shapes, currentShape]);
        }
        setCurrentShape(null);
      }
    };

    // Calculate scaled dimensions for proper zoom behavior
    const scale = zoom / 100;

    return (
      <div
        ref={containerRef}
        className="relative h-full w-full rounded-xl border-2 border-[#2E2E2E] shadow-panel overflow-hidden"
        style={{ background: "#ffffff" }}
      >
        <Stage
          width={canvasSize.width}
          height={canvasSize.height}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          ref={stageRef}
          className="rounded-xl"
          draggable={spacePressed}
        >
          {/* Background Layer - Grid doesn't scale with zoom */}
          <Layer>
            {/* Grid Lines - Visual guide for drawing */}
            {gridEnabled && (
              <>
                {/* Vertical grid lines */}
                {Array.from({
                  length: Math.ceil(canvasSize.width / 20) + 1,
                }).map((_, i) => (
                  <Line
                    key={`v-${i}`}
                    points={[i * 20, 0, i * 20, canvasSize.height]}
                    stroke="rgba(46, 46, 46, 0.3)"
                    strokeWidth={1}
                  />
                ))}
                {/* Horizontal grid lines */}
                {Array.from({
                  length: Math.ceil(canvasSize.height / 20) + 1,
                }).map((_, i) => (
                  <Line
                    key={`h-${i}`}
                    points={[0, i * 20, canvasSize.width, i * 20]}
                    stroke="rgba(46, 46, 46, 0.3)"
                    strokeWidth={1}
                  />
                ))}
              </>
            )}
          </Layer>

          {/* Content Layer - Scales with zoom */}
          <Layer scaleX={scale} scaleY={scale}>
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
              if (shape.type === "rectangle") {
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
              } else if (shape.type === "circle") {
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
              } else if (shape.type === "text") {
                const isHovered = hoveredTextId === shape.id;
                return (
                  <Group
                    key={shape.id || i}
                    x={shape.x}
                    y={shape.y}
                    draggable={tool !== "bin"}
                    onDragEnd={(e) => {
                      handleTextDragEnd(shape.id, e.target.x(), e.target.y());
                    }}
                    onMouseEnter={() => setHoveredTextId(shape.id)}
                    onMouseLeave={() => setHoveredTextId(null)}
                  >
                    <KonvaText
                      text={shape.text || "Text"}
                      fontSize={16}
                      fontFamily="Inter, sans-serif"
                      fill={shape.stroke || "#000000"}
                    />
                    {/* Delete button - shown on hover */}
                    {isHovered && (
                      <>
                        {/* Delete button background */}
                        <Rect
                          x={-8}
                          y={-24}
                          width={20}
                          height={20}
                          fill="#FF4444"
                          cornerRadius={4}
                          onClick={() => handleDeleteText(shape.id)}
                          onTap={() => handleDeleteText(shape.id)}
                        />
                        {/* Delete icon (X shape using lines) */}
                        <Line
                          points={[-3, -19, 7, -9]}
                          stroke="white"
                          strokeWidth={2}
                          lineCap="round"
                          onClick={() => handleDeleteText(shape.id)}
                          onTap={() => handleDeleteText(shape.id)}
                        />
                        <Line
                          points={[7, -19, -3, -9]}
                          stroke="white"
                          strokeWidth={2}
                          lineCap="round"
                          onClick={() => handleDeleteText(shape.id)}
                          onTap={() => handleDeleteText(shape.id)}
                        />
                      </>
                    )}
                  </Group>
                );
              }
              return null;
            })}

            {/* Current Shape (Being Drawn) */}
            {currentShape &&
              (currentShape.type === "rectangle" ? (
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
              ) : currentShape.type === "circle" ? (
                <Circle
                  x={currentShape.x}
                  y={currentShape.y}
                  radius={currentShape.radius}
                  stroke={currentShape.stroke || "#000000"}
                  strokeWidth={currentShape.strokeWidth || 2}
                  fill={currentShape.fill || "transparent"}
                />
              ) : null)}

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

        {/* Floating Text Input Modal */}
        {showTextInput && (
          <div
            className="fixed z-50 flex flex-col gap-2 rounded-lg bg-white p-3 shadow-xl border border-gray-300"
            style={{
              left: textInputPosition.x,
              top: textInputPosition.y,
              transform: 'translate(-50%, -100%)',
              marginTop: -8,
            }}
          >
            <input
              ref={textInputRef}
              type="text"
              value={textInputValue}
              onChange={(e) => setTextInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleTextSubmit();
                } else if (e.key === 'Escape') {
                  handleTextCancel();
                }
              }}
              placeholder="Enter your text"
              className="w-48 rounded border border-gray-300 px-3 py-2 text-sm text-black placeholder-gray-400 focus:border-[#FF6B00] focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/20"
            />
            <div className="flex gap-2">
              <button
                onClick={handleTextSubmit}
                className="flex-1 rounded bg-[#FF6B00] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#FF8533]"
              >
                Add
              </button>
              <button
                onClick={handleTextCancel}
                className="flex-1 rounded bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Canvas Info Overlay */}
        <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-3 rounded-lg bg-white/90 px-3 py-2 text-xs font-medium text-muted shadow-sm backdrop-blur-sm">
          <span>
            {canvasSize.width} × {canvasSize.height}
          </span>
          <span>•</span>
          <span>
            {tool === "pen"
              ? "Drawing"
              : tool === "select"
                ? "Selection"
                : tool === "bin"
                  ? "Delete"
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
