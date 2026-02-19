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
  Transformer,
  Arrow,
  Ellipse,
  RegularPolygon,
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
  id?: string;
}

interface ShapeData {
  id: string;
  type:
    | "rectangle"
    | "circle"
    | "text"
    | "image"
    | "ellipse"
    | "triangle"
    | "arrow";
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  radiusX?: number;
  radiusY?: number;
  text?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  draggable?: boolean;
  selected?: boolean;
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
  exportAsPNG: () => string;
  exportAsDataURL: (mimeType?: string, quality?: number) => string;
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
    const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
    const [containerSize, setContainerSize] = useState({
      width: 800,
      height: 600,
    });
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentShape, setCurrentShape] = useState<ShapeData | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    const [spacePressed, setSpacePressed] = useState(false);
    const stageRef = useRef<Konva.Stage>(null);

    // Refs that always hold the latest values — used inside Konva event handlers
    // to avoid stale closures when the mouse moves fast.
    const isDrawingRef = useRef(false);
    const toolRef = useRef(tool);
    const currentShapeRef = useRef<ShapeData | null>(null);
    const strokeColorRef = useRef(strokeColor);
    const strokeWidthRef = useRef(strokeWidth);
    const fillColorRef = useRef(fillColor);
    const snapEnabledRef = useRef(snapEnabled);
    const gridEnabledRef = useRef(gridEnabled);
    const zoomRef = useRef(zoom);
    const spaceRef = useRef(false);

    // Active drawing line — updated imperatively via Konva API for zero-lag strokes
    const drawingLineNodeRef = useRef<Konva.Line>(null);
    const drawingPointsRef = useRef<number[]>([]);
    const drawingLineDataRef = useRef<LineData | null>(null);
    const [isActivelyDrawing, setIsActivelyDrawing] = useState(false);

    // Keep all refs in sync with latest props/state on every render
    useEffect(() => {
      toolRef.current = tool;
    }, [tool]);
    useEffect(() => {
      strokeColorRef.current = strokeColor;
    }, [strokeColor]);
    useEffect(() => {
      strokeWidthRef.current = strokeWidth;
    }, [strokeWidth]);
    useEffect(() => {
      fillColorRef.current = fillColor;
    }, [fillColor]);
    useEffect(() => {
      snapEnabledRef.current = snapEnabled;
    }, [snapEnabled]);
    useEffect(() => {
      gridEnabledRef.current = gridEnabled;
    }, [gridEnabled]);
    useEffect(() => {
      zoomRef.current = zoom;
    }, [zoom]);
    useEffect(() => {
      spaceRef.current = spacePressed;
    }, [spacePressed]);

    // Selection state
    const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
    const [isTransforming, setIsTransforming] = useState(false);
    const transformerRef = useRef<Konva.Transformer>(null);
    const selectedShapeRef = useRef<Konva.Shape | Konva.Group | null>(null);

    // Text input modal state
    const [showTextInput, setShowTextInput] = useState(false);
    const [textInputValue, setTextInputValue] = useState("");
    const [textInputPosition, setTextInputPosition] = useState({ x: 0, y: 0 });
    const [pendingTextPosition, setPendingTextPosition] = useState({
      x: 0,
      y: 0,
    });
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
        setSelectedShapeId(null);
      },
      insertTemplate: (data: any) => {
        if (data.lines) {
          const newLines = data.lines.map((line: any) => ({
            ...line,
            id: line.id || `line-${Date.now()}-${Math.random()}`,
          }));
          setLines((prev) => [...prev, ...newLines]);
        }
        if (data.shapes) {
          const newShapes = data.shapes.map((s: any) => ({
            ...s,
            id: s.id || `shape-${Date.now()}-${Math.random()}`,
            stroke: s.stroke || strokeColor,
            strokeWidth: s.strokeWidth || 2,
            fill: s.fill || "transparent",
            draggable: true,
          }));
          setShapes((prev) => [...prev, ...newShapes]);
        }
      },
      exportAsPNG: () => {
        if (!stageRef.current) return "";
        // Export immediately without selection - transformer won't be included in export
        const dataURL = stageRef.current.toDataURL({ pixelRatio: 2 });
        return dataURL;
      },
      exportAsDataURL: (mimeType = "image/png", quality = 1) => {
        if (!stageRef.current) return "";
        const dataURL = stageRef.current.toDataURL({
          mimeType,
          quality,
          pixelRatio: 2,
        });
        return dataURL;
      },
    }));
    // Responsive canvas sizing
    useEffect(() => {
      const updateSize = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const width = Math.max(200, Math.floor(rect.width));
          const height = Math.max(200, Math.floor(rect.height));

          // Set container size
          setContainerSize({ width, height });

          // Canvas size should be larger to allow panning, but reasonable
          // At 100% zoom, make canvas match container so no blank spaces
          const scale = zoom / 100;
          setCanvasSize({
            width: Math.max(width, Math.floor(width * scale * 1.5)),
            height: Math.max(height, Math.floor(height * scale * 1.5)),
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
    }, [zoom]);

    // Update cursor when hand tool is selected
    useEffect(() => {
      if (stageRef.current) {
        if (tool === "hand") {
          stageRef.current.container().style.cursor = "grab";
        } else if (!spacePressed) {
          stageRef.current.container().style.cursor = "default";
        }
      }
    }, [tool, spacePressed]);

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

    // Spacebar pan controls and keyboard shortcuts
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (
          e.code === "Space" &&
          !spacePressed &&
          document.activeElement?.tagName !== "INPUT"
        ) {
          e.preventDefault();
          setSpacePressed(true);
          if (stageRef.current) {
            stageRef.current.container().style.cursor = "grab";
          }
        }

        // Delete selected shape with Delete or Backspace
        if (
          (e.key === "Delete" || e.key === "Backspace") &&
          selectedShapeId &&
          document.activeElement?.tagName !== "INPUT"
        ) {
          e.preventDefault();
          setShapes((shapes) =>
            shapes.filter((shape) => shape.id !== selectedShapeId)
          );
          setSelectedShapeId(null);
        }

        // Escape to deselect
        if (e.key === "Escape") {
          setSelectedShapeId(null);
          if (showTextInput) {
            handleTextCancel();
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
            // Reset stage position to prevent blank spaces at 100% zoom
            if (zoom === 100) {
              stageRef.current.position({ x: 0, y: 0 });
              stageRef.current.batchDraw();
            }
          }
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
      };
    }, [spacePressed, selectedShapeId, showTextInput, zoom]);

    // Helper function to get mouse position adjusted for zoom and pan
    const getTransformedPointerPosition = (stage: Konva.Stage | null) => {
      if (!stage) return null;
      const pos = stage.getPointerPosition();
      if (!pos) return null;

      const scale = zoom / 100;
      const stagePos = stage.position();

      const transformed = {
        x: (pos.x - stagePos.x) / scale,
        y: (pos.y - stagePos.y) / scale,
      };

      // Apply snap to grid if enabled
      if (snapEnabled && gridEnabled) {
        const gridSize = 20;
        transformed.x = Math.round(transformed.x / gridSize) * gridSize;
        transformed.y = Math.round(transformed.y / gridSize) * gridSize;
      }

      return transformed;
    };

    // Focus text input when shown
    useEffect(() => {
      if (showTextInput && textInputRef.current) {
        textInputRef.current.focus();
      }
    }, [showTextInput]);

    // Attach transformer to selected shape
    useEffect(() => {
      if (
        tool === "select" &&
        selectedShapeId &&
        transformerRef.current &&
        selectedShapeRef.current
      ) {
        transformerRef.current.nodes([selectedShapeRef.current]);
        transformerRef.current.getLayer()?.batchDraw();
      } else if (transformerRef.current) {
        transformerRef.current.nodes([]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    }, [selectedShapeId, tool]);

    // Reset stage position when zoom changes to prevent blank spaces
    useEffect(() => {
      if (stageRef.current && zoom === 100) {
        stageRef.current.position({ x: 0, y: 0 });
        stageRef.current.batchDraw();
      }
    }, [zoom]);

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
      setShapes((shapes) => shapes.filter((shape) => shape.id !== id));
    };

    // Handle text drag
    const handleTextDragEnd = (id: string, newX: number, newY: number) => {
      setShapes((shapes) =>
        shapes.map((shape) =>
          shape.id === id ? { ...shape, x: newX, y: newY } : shape
        )
      );
    };

    // Handle shape drag
    const handleShapeDragEnd = (
      id: string,
      e: Konva.KonvaEventObject<DragEvent>
    ) => {
      setShapes((shapes) =>
        shapes.map((shape) =>
          shape.id === id
            ? { ...shape, x: e.target.x(), y: e.target.y() }
            : shape
        )
      );
    };

    // Handle shape transform
    const handleShapeTransformEnd = (id: string, node: Konva.Node) => {
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      // Reset scale and apply it to width/height
      node.scaleX(1);
      node.scaleY(1);

      setShapes((shapes) =>
        shapes.map((shape) => {
          if (shape.id === id) {
            if (
              shape.type === "rectangle" ||
              shape.type === "triangle" ||
              shape.type === "arrow"
            ) {
              return {
                ...shape,
                x: node.x(),
                y: node.y(),
                width: Math.max(5, (shape.width || 0) * scaleX),
                height: Math.max(5, (shape.height || 0) * scaleY),
                rotation: node.rotation(),
              };
            } else if (shape.type === "circle") {
              return {
                ...shape,
                x: node.x(),
                y: node.y(),
                radius: Math.max(
                  5,
                  (shape.radius || 0) * Math.max(scaleX, scaleY)
                ),
                rotation: node.rotation(),
              };
            } else if (shape.type === "ellipse") {
              return {
                ...shape,
                x: node.x(),
                y: node.y(),
                radiusX: Math.max(5, (shape.radiusX || 0) * scaleX),
                radiusY: Math.max(5, (shape.radiusY || 0) * scaleY),
                rotation: node.rotation(),
              };
            }
          }
          return shape;
        })
      );
    };

    const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Pan mode with spacebar or hand tool
      if (spacePressed || toolRef.current === "hand") {
        setIsPanning(true);
        if (stageRef.current) {
          stageRef.current.container().style.cursor = "grabbing";
        }
        return;
      }

      const pos = getTransformedPointerPosition(e.target.getStage());
      if (!pos) return;

      if (toolRef.current === "bin") {
        // Check for hit on shapes first (reverse for topmost first)
        for (let i = shapes.length - 1; i >= 0; i--) {
          const shape = shapes[i];
          if (
            shape.type === "rectangle" ||
            shape.type === "triangle" ||
            shape.type === "arrow"
          ) {
            const x1 = shape.x;
            const y1 = shape.y;
            const x2 = shape.x + (shape.width || 0);
            const y2 = shape.y + (shape.height || 0);
            if (
              pos.x >= Math.min(x1, x2) &&
              pos.x <= Math.max(x1, x2) &&
              pos.y >= Math.min(y1, y2) &&
              pos.y <= Math.max(y1, y2)
            ) {
              setShapes((shapes) => shapes.filter((_, idx) => idx !== i));
              return;
            }
          } else if (shape.type === "circle") {
            const dx = pos.x - shape.x;
            const dy = pos.y - shape.y;
            const r = shape.radius || 0;
            if (dx * dx + dy * dy <= r * r) {
              setShapes((shapes) => shapes.filter((_, idx) => idx !== i));
              return;
            }
          } else if (shape.type === "ellipse") {
            const dx = pos.x - shape.x;
            const dy = pos.y - shape.y;
            const rx = shape.radiusX || 0;
            const ry = shape.radiusY || 0;
            if (
              rx > 0 &&
              ry > 0 &&
              (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1
            ) {
              setShapes((shapes) => shapes.filter((_, idx) => idx !== i));
              return;
            }
          } else if (shape.type === "text") {
            // Assume text is 100x30 box for hit area (can be improved)
            const x1 = shape.x;
            const y1 = shape.y;
            const x2 = shape.x + 100;
            const y2 = shape.y + 30;
            if (pos.x >= x1 && pos.x <= x2 && pos.y >= y1 && pos.y <= y2) {
              setShapes((shapes) => shapes.filter((_, idx) => idx !== i));
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
            const t = Math.max(
              0,
              Math.min(
                1,
                ((pos.x - x1) * (x2 - x1) + (pos.y - y1) * (y2 - y1)) /
                  lineLen ** 2
              )
            );
            const projX = x1 + t * (x2 - x1);
            const projY = y1 + t * (y2 - y1);
            const dist = Math.sqrt((pos.x - projX) ** 2 + (pos.y - projY) ** 2);
            if (dist <= hitThreshold + (line.width || 5) / 2) {
              setLines((lines) => lines.filter((_, idx) => idx !== i));
              return;
            }
          }
        }
        return;
      }

      if (toolRef.current === "pen") {
        isDrawingRef.current = true;
        setIsDrawing(true);
        // Store drawing data in refs — NO React state updates during drawing
        drawingPointsRef.current = [pos.x, pos.y];
        drawingLineDataRef.current = {
          tool: "pen",
          points: [pos.x, pos.y],
          color: strokeColorRef.current,
          width: strokeWidthRef.current,
          id: `line-${Date.now()}-${Math.random()}`,
        };
        setIsActivelyDrawing(true);
      } else if (
        toolRef.current === "shape" ||
        toolRef.current === "rectangle" ||
        toolRef.current === "circle" ||
        toolRef.current === "ellipse" ||
        toolRef.current === "triangle" ||
        toolRef.current === "arrow"
      ) {
        // Handle Shape Tools
        let shapeType: ShapeData["type"] = "rectangle";
        if (toolRef.current === "circle") shapeType = "circle";
        else if (toolRef.current === "ellipse") shapeType = "ellipse";
        else if (toolRef.current === "triangle") shapeType = "triangle";
        else if (toolRef.current === "arrow") shapeType = "arrow";
        else if (toolRef.current === "shape") shapeType = "rectangle";

        isDrawingRef.current = true;
        setIsDrawing(true);
        const newShape: ShapeData = {
          id: `shape-${Date.now()}`,
          type: shapeType,
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          radius: 0,
          radiusX: 0,
          radiusY: 0,
          stroke: strokeColorRef.current,
          strokeWidth: strokeWidthRef.current,
          fill: fillColorRef.current,
        };
        currentShapeRef.current = newShape;
        setCurrentShape(newShape);
      } else if (toolRef.current === "text") {
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
      } else if (toolRef.current === "erase") {
        // Eraser tool - similar to bin but continuous during drag
        isDrawingRef.current = true;
        setIsDrawing(true);
        // Erase at current position
        eraseAtPosition(pos);
      } else if (toolRef.current === "select") {
        // Check if clicking on a shape
        let clickedShapeId: string | null = null;
        for (let i = shapes.length - 1; i >= 0; i--) {
          const shape = shapes[i];
          if (
            shape.type === "rectangle" ||
            shape.type === "triangle" ||
            shape.type === "arrow"
          ) {
            const x1 = shape.x;
            const y1 = shape.y;
            const x2 = shape.x + (shape.width || 0);
            const y2 = shape.y + (shape.height || 0);
            if (
              pos.x >= Math.min(x1, x2) &&
              pos.x <= Math.max(x1, x2) &&
              pos.y >= Math.min(y1, y2) &&
              pos.y <= Math.max(y1, y2)
            ) {
              clickedShapeId = shape.id;
              break;
            }
          } else if (shape.type === "circle") {
            const dx = pos.x - shape.x;
            const dy = pos.y - shape.y;
            const r = shape.radius || 0;
            if (dx * dx + dy * dy <= r * r) {
              clickedShapeId = shape.id;
              break;
            }
          } else if (shape.type === "ellipse") {
            const dx = pos.x - shape.x;
            const dy = pos.y - shape.y;
            const rx = shape.radiusX || 0;
            const ry = shape.radiusY || 0;
            if (
              rx > 0 &&
              ry > 0 &&
              (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1
            ) {
              clickedShapeId = shape.id;
              break;
            }
          }
        }
        setSelectedShapeId(clickedShapeId);
      }
    };

    // Helper function to erase at a position
    const eraseAtPosition = (pos: { x: number; y: number }) => {
      const eraseRadius = strokeWidth * 2; // Eraser size based on stroke width

      // Check for hit on lines
      const newLines = lines.filter((line) => {
        const points = line.points;
        for (let j = 0; j < points.length - 2; j += 2) {
          const x1 = points[j];
          const y1 = points[j + 1];
          const x2 = points[j + 2];
          const y2 = points[j + 3];
          const lineLen = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
          if (lineLen === 0) continue;
          const t = Math.max(
            0,
            Math.min(
              1,
              ((pos.x - x1) * (x2 - x1) + (pos.y - y1) * (y2 - y1)) /
                lineLen ** 2
            )
          );
          const projX = x1 + t * (x2 - x1);
          const projY = y1 + t * (y2 - y1);
          const dist = Math.sqrt((pos.x - projX) ** 2 + (pos.y - projY) ** 2);
          if (dist <= eraseRadius) {
            return false; // Remove this line
          }
        }
        return true; // Keep this line
      });

      setLines(newLines);
    };

    const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Use ref — never stale even during rapid mouse events
      if (!isDrawingRef.current) return;
      const stage = e.target.getStage();
      const point = getTransformedPointerPosition(stage);
      if (!point) return;

      if (toolRef.current === "pen") {
        // Push points directly into ref — zero React re-renders during drawing
        drawingPointsRef.current.push(point.x, point.y);
        // Update Konva node directly for immediate visual feedback
        const node = drawingLineNodeRef.current;
        if (node) {
          node.points(drawingPointsRef.current);
          node.getLayer()?.batchDraw();
        }
      } else if (toolRef.current === "erase") {
        eraseAtPosition(point);
      } else if (
        currentShapeRef.current &&
        (toolRef.current === "shape" ||
          toolRef.current === "rectangle" ||
          toolRef.current === "circle" ||
          toolRef.current === "ellipse" ||
          toolRef.current === "triangle" ||
          toolRef.current === "arrow")
      ) {
        // Update current shape using ref so we never lose startX/startY
        const startX = currentShapeRef.current.x;
        const startY = currentShapeRef.current.y;
        let updated: ShapeData;

        if (currentShapeRef.current.type === "rectangle") {
          updated = {
            ...currentShapeRef.current,
            width: point.x - startX,
            height: point.y - startY,
          };
        } else if (currentShapeRef.current.type === "circle") {
          const dx = point.x - startX;
          const dy = point.y - startY;
          updated = {
            ...currentShapeRef.current,
            radius: Math.sqrt(dx * dx + dy * dy),
          };
        } else if (currentShapeRef.current.type === "ellipse") {
          updated = {
            ...currentShapeRef.current,
            radiusX: Math.abs(point.x - startX),
            radiusY: Math.abs(point.y - startY),
          };
        } else {
          // triangle / arrow
          updated = {
            ...currentShapeRef.current,
            width: point.x - startX,
            height: point.y - startY,
          };
        }
        currentShapeRef.current = updated;
        setCurrentShape(updated);
      }
    };

    const handleMouseUp = () => {
      isDrawingRef.current = false;
      setIsDrawing(false);

      // Commit the active pen line to the lines array
      if (drawingLineDataRef.current && drawingPointsRef.current.length >= 2) {
        const finalLine: LineData = {
          ...drawingLineDataRef.current,
          points: [...drawingPointsRef.current],
        };
        setLines((prev) => [...prev, finalLine]);
      }
      drawingPointsRef.current = [];
      drawingLineDataRef.current = null;
      setIsActivelyDrawing(false);

      const shape = currentShapeRef.current;
      if (shape) {
        // Prevent adding 0-size shapes
        if (
          (shape.type === "rectangle" && shape.width !== 0) ||
          (shape.type === "circle" && shape.radius !== 0) ||
          (shape.type === "ellipse" && shape.radiusX !== 0) ||
          (shape.type === "triangle" && shape.width !== 0) ||
          (shape.type === "arrow" && shape.width !== 0)
        ) {
          setShapes((prev) => [...prev, shape]);
        }
        currentShapeRef.current = null;
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
          width={containerSize.width}
          height={containerSize.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          ref={stageRef}
          className="rounded-xl"
          draggable={spacePressed || tool === "hand"}
          dragBoundFunc={(pos) => {
            // Prevent panning beyond canvas boundaries
            const scale = zoom / 100;
            const maxX = 0;
            const minX = containerSize.width - canvasSize.width * scale;
            const maxY = 0;
            const minY = containerSize.height - canvasSize.height * scale;

            return {
              x: Math.max(minX, Math.min(maxX, pos.x)),
              y: Math.max(minY, Math.min(maxY, pos.y)),
            };
          }}
          onClick={(e) => {
            // Deselect when clicking on empty canvas
            if (e.target === e.target.getStage()) {
              setSelectedShapeId(null);
            }
          }}
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
                key={line.id || `line-${i}`}
                points={line.points}
                stroke={line.color || "#000000"}
                strokeWidth={line.width || 2.5}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                perfectDrawEnabled={false}
                listening={false}
                globalCompositeOperation={
                  line.tool === "erase" ? "destination-out" : "source-over"
                }
              />
            ))}

            {/* Active drawing line — updated via Konva API, not React state */}
            {isActivelyDrawing && (
              <Line
                ref={drawingLineNodeRef}
                points={drawingPointsRef.current}
                stroke={drawingLineDataRef.current?.color || "#000000"}
                strokeWidth={drawingLineDataRef.current?.width || 2.5}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                perfectDrawEnabled={false}
                listening={false}
                globalCompositeOperation="source-over"
              />
            )}

            {/* Drawn Shapes */}
            {shapes.map((shape, i) => {
              const isSelected =
                shape.id === selectedShapeId && tool === "select";
              if (shape.type === "rectangle") {
                return (
                  <Rect
                    key={shape.id || i}
                    ref={(node) => {
                      if (isSelected && node) {
                        selectedShapeRef.current = node;
                      }
                    }}
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    stroke={shape.stroke || "#000000"}
                    strokeWidth={shape.strokeWidth || 2}
                    fill={shape.fill || "transparent"}
                    cornerRadius={5}
                    draggable={tool === "select"}
                    rotation={shape.rotation || 0}
                    onClick={() => {
                      if (tool === "select") {
                        setSelectedShapeId(shape.id);
                      }
                    }}
                    onDragEnd={(e) => handleShapeDragEnd(shape.id, e)}
                    onTransformEnd={(e) =>
                      handleShapeTransformEnd(shape.id, e.target)
                    }
                  />
                );
              } else if (shape.type === "circle") {
                return (
                  <Circle
                    key={shape.id || i}
                    ref={(node) => {
                      if (isSelected && node) {
                        selectedShapeRef.current = node;
                      }
                    }}
                    x={shape.x}
                    y={shape.y}
                    radius={shape.radius}
                    stroke={shape.stroke || "#000000"}
                    strokeWidth={shape.strokeWidth || 2}
                    fill={shape.fill || "transparent"}
                    draggable={tool === "select"}
                    rotation={shape.rotation || 0}
                    onClick={() => {
                      if (tool === "select") {
                        setSelectedShapeId(shape.id);
                      }
                    }}
                    onDragEnd={(e) => handleShapeDragEnd(shape.id, e)}
                    onTransformEnd={(e) =>
                      handleShapeTransformEnd(shape.id, e.target)
                    }
                  />
                );
              } else if (shape.type === "ellipse") {
                return (
                  <Ellipse
                    key={shape.id || i}
                    ref={(node) => {
                      if (isSelected && node) {
                        selectedShapeRef.current = node;
                      }
                    }}
                    x={shape.x}
                    y={shape.y}
                    radiusX={shape.radiusX || 0}
                    radiusY={shape.radiusY || 0}
                    stroke={shape.stroke || "#000000"}
                    strokeWidth={shape.strokeWidth || 2}
                    fill={shape.fill || "transparent"}
                    draggable={tool === "select"}
                    rotation={shape.rotation || 0}
                    onClick={() => {
                      if (tool === "select") {
                        setSelectedShapeId(shape.id);
                      }
                    }}
                    onDragEnd={(e) => handleShapeDragEnd(shape.id, e)}
                    onTransformEnd={(e) =>
                      handleShapeTransformEnd(shape.id, e.target)
                    }
                  />
                );
              } else if (shape.type === "triangle") {
                // Draw triangle using Line
                const points = [
                  shape.x + (shape.width || 0) / 2,
                  shape.y, // Top point
                  shape.x,
                  shape.y + (shape.height || 0), // Bottom left
                  shape.x + (shape.width || 0),
                  shape.y + (shape.height || 0), // Bottom right
                ];
                return (
                  <Line
                    key={shape.id || i}
                    ref={(node) => {
                      if (isSelected && node) {
                        selectedShapeRef.current = node;
                      }
                    }}
                    points={points}
                    stroke={shape.stroke || "#000000"}
                    strokeWidth={shape.strokeWidth || 2}
                    fill={shape.fill || "transparent"}
                    closed={true}
                    draggable={tool === "select"}
                    rotation={shape.rotation || 0}
                    onClick={() => {
                      if (tool === "select") {
                        setSelectedShapeId(shape.id);
                      }
                    }}
                    onDragEnd={(e) => handleShapeDragEnd(shape.id, e)}
                    onTransformEnd={(e) =>
                      handleShapeTransformEnd(shape.id, e.target)
                    }
                  />
                );
              } else if (shape.type === "arrow") {
                return (
                  <Arrow
                    key={shape.id || i}
                    ref={(node) => {
                      if (isSelected && node) {
                        selectedShapeRef.current = node;
                      }
                    }}
                    points={[
                      shape.x,
                      shape.y,
                      shape.x + (shape.width || 0),
                      shape.y + (shape.height || 0),
                    ]}
                    stroke={shape.stroke || "#000000"}
                    strokeWidth={shape.strokeWidth || 2}
                    fill={shape.stroke || "#000000"}
                    pointerLength={10}
                    pointerWidth={10}
                    draggable={tool === "select"}
                    rotation={shape.rotation || 0}
                    onClick={() => {
                      if (tool === "select") {
                        setSelectedShapeId(shape.id);
                      }
                    }}
                    onDragEnd={(e) => handleShapeDragEnd(shape.id, e)}
                    onTransformEnd={(e) =>
                      handleShapeTransformEnd(shape.id, e.target)
                    }
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

            {/* Transformer for selected shapes */}
            {tool === "select" && selectedShapeId && (
              <Transformer
                ref={transformerRef}
                rotateEnabled={true}
                enabledAnchors={[
                  "top-left",
                  "top-right",
                  "bottom-left",
                  "bottom-right",
                  "top-center",
                  "middle-right",
                  "middle-left",
                  "bottom-center",
                ]}
                boundBoxFunc={(oldBox, newBox) => {
                  // Limit minimum size
                  if (newBox.width < 5 || newBox.height < 5) {
                    return oldBox;
                  }
                  return newBox;
                }}
              />
            )}

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
              ) : currentShape.type === "ellipse" ? (
                <Ellipse
                  x={currentShape.x}
                  y={currentShape.y}
                  radiusX={currentShape.radiusX || 0}
                  radiusY={currentShape.radiusY || 0}
                  stroke={currentShape.stroke || "#000000"}
                  strokeWidth={currentShape.strokeWidth || 2}
                  fill={currentShape.fill || "transparent"}
                />
              ) : currentShape.type === "triangle" ? (
                <Line
                  points={[
                    currentShape.x + (currentShape.width || 0) / 2,
                    currentShape.y,
                    currentShape.x,
                    currentShape.y + (currentShape.height || 0),
                    currentShape.x + (currentShape.width || 0),
                    currentShape.y + (currentShape.height || 0),
                  ]}
                  stroke={currentShape.stroke || "#000000"}
                  strokeWidth={currentShape.strokeWidth || 2}
                  fill={currentShape.fill || "transparent"}
                  closed={true}
                />
              ) : currentShape.type === "arrow" ? (
                <Arrow
                  points={[
                    currentShape.x,
                    currentShape.y,
                    currentShape.x + (currentShape.width || 0),
                    currentShape.y + (currentShape.height || 0),
                  ]}
                  stroke={currentShape.stroke || "#000000"}
                  strokeWidth={currentShape.strokeWidth || 2}
                  fill={currentShape.stroke || "#000000"}
                  pointerLength={10}
                  pointerWidth={10}
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
              transform: "translate(-50%, -100%)",
              marginTop: -8,
            }}
          >
            <input
              ref={textInputRef}
              type="text"
              value={textInputValue}
              onChange={(e) => setTextInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleTextSubmit();
                } else if (e.key === "Escape") {
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
                  : tool === "erase"
                    ? "Eraser"
                    : tool === "ellipse"
                      ? "Ellipse"
                      : tool === "triangle"
                        ? "Triangle"
                        : tool === "arrow"
                          ? "Arrow"
                          : tool.charAt(0).toUpperCase() + tool.slice(1)}{" "}
            Mode
          </span>
          {gridEnabled && (
            <>
              <span>•</span>
              <span className="text-accent">Grid On</span>
            </>
          )}
          {snapEnabled && gridEnabled && (
            <>
              <span>•</span>
              <span className="text-accent">Snap On</span>
            </>
          )}
          {zoom !== 100 && (
            <>
              <span>•</span>
              <span>Zoom: {zoom}%</span>
            </>
          )}
          {selectedShapeId && (
            <>
              <span>•</span>
              <span className="text-[#FF6B00]">Shape Selected</span>
            </>
          )}
        </div>
      </div>
    );
  }
);

SketchCanvas.displayName = "SketchCanvas";

export default SketchCanvas;
