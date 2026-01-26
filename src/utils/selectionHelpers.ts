// Selection utilities for canvas elements
// Handles multi-select, resize, and transformation

export interface SelectedElement {
  id: string;
  type: 'line' | 'shape' | 'text';
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface SelectionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResizeHandle {
  name: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
  x: number;
  y: number;
  cursor: string;
}

// Calculate bounding box for multiple elements
export function calculateSelectionBounds(elements: SelectedElement[]): SelectionBounds | null {
  if (elements.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  elements.forEach((el) => {
    minX = Math.min(minX, el.bounds.x);
    minY = Math.min(minY, el.bounds.y);
    maxX = Math.max(maxX, el.bounds.x + el.bounds.width);
    maxY = Math.max(maxY, el.bounds.y + el.bounds.height);
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// Generate resize handles for selection
export function getResizeHandles(bounds: SelectionBounds): ResizeHandle[] {
  const { x, y, width, height } = bounds;
  const handleSize = 8;

  return [
    { name: 'nw', x: x - handleSize / 2, y: y - handleSize / 2, cursor: 'nw-resize' },
    { name: 'n', x: x + width / 2 - handleSize / 2, y: y - handleSize / 2, cursor: 'n-resize' },
    { name: 'ne', x: x + width - handleSize / 2, y: y - handleSize / 2, cursor: 'ne-resize' },
    { name: 'e', x: x + width - handleSize / 2, y: y + height / 2 - handleSize / 2, cursor: 'e-resize' },
    { name: 'se', x: x + width - handleSize / 2, y: y + height - handleSize / 2, cursor: 'se-resize' },
    { name: 's', x: x + width / 2 - handleSize / 2, y: y + height - handleSize / 2, cursor: 's-resize' },
    { name: 'sw', x: x - handleSize / 2, y: y + height - handleSize / 2, cursor: 'sw-resize' },
    { name: 'w', x: x - handleSize / 2, y: y + height / 2 - handleSize / 2, cursor: 'w-resize' },
  ];
}

// Check if point is inside bounds
export function isPointInBounds(
  point: { x: number; y: number },
  bounds: SelectionBounds
): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

// Check if point is on resize handle
export function getHandleAtPoint(
  point: { x: number; y: number },
  handles: ResizeHandle[]
): ResizeHandle | null {
  const handleSize = 8;
  
  for (const handle of handles) {
    if (
      point.x >= handle.x &&
      point.x <= handle.x + handleSize &&
      point.y >= handle.y &&
      point.y <= handle.y + handleSize
    ) {
      return handle;
    }
  }
  
  return null;
}

// Calculate new bounds after resize
export function calculateResizedBounds(
  originalBounds: SelectionBounds,
  handle: ResizeHandle,
  delta: { x: number; y: number }
): SelectionBounds {
  const { x, y, width, height } = originalBounds;
  let newX = x;
  let newY = y;
  let newWidth = width;
  let newHeight = height;

  // Adjust based on handle
  switch (handle.name) {
    case 'nw':
      newX = x + delta.x;
      newY = y + delta.y;
      newWidth = width - delta.x;
      newHeight = height - delta.y;
      break;
    case 'n':
      newY = y + delta.y;
      newHeight = height - delta.y;
      break;
    case 'ne':
      newY = y + delta.y;
      newWidth = width + delta.x;
      newHeight = height - delta.y;
      break;
    case 'e':
      newWidth = width + delta.x;
      break;
    case 'se':
      newWidth = width + delta.x;
      newHeight = height + delta.y;
      break;
    case 's':
      newHeight = height + delta.y;
      break;
    case 'sw':
      newX = x + delta.x;
      newWidth = width - delta.x;
      newHeight = height + delta.y;
      break;
    case 'w':
      newX = x + delta.x;
      newWidth = width - delta.x;
      break;
  }

  // Ensure minimum size
  const minSize = 10;
  if (newWidth < minSize) {
    newWidth = minSize;
    newX = x + width - minSize;
  }
  if (newHeight < minSize) {
    newHeight = minSize;
    newY = y + height - minSize;
  }

  return {
    x: newX,
    y: newY,
    width: newWidth,
    height: newHeight,
  };
}

// Group selection helpers
export function selectMultiple(
  currentSelection: string[],
  newId: string,
  isShiftHeld: boolean
): string[] {
  if (isShiftHeld) {
    // Add to selection
    if (currentSelection.includes(newId)) {
      return currentSelection.filter((id) => id !== newId);
    }
    return [...currentSelection, newId];
  }
  
  // Replace selection
  return [newId];
}

// Rectangle selection (drag to select multiple)
export function getElementsInRectangle(
  elements: SelectedElement[],
  rect: SelectionBounds
): SelectedElement[] {
  return elements.filter((el) => {
    // Check if element intersects with selection rectangle
    const elRight = el.bounds.x + el.bounds.width;
    const elBottom = el.bounds.y + el.bounds.height;
    const rectRight = rect.x + rect.width;
    const rectBottom = rect.y + rect.height;

    return !(
      elRight < rect.x ||
      el.bounds.x > rectRight ||
      elBottom < rect.y ||
      el.bounds.y > rectBottom
    );
  });
}
