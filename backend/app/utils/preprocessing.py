import numpy as np
import cv2
from typing import Dict, List, Any, Tuple

def preprocess_canvas_data(canvas_data: Dict[str, Any], target_size: Tuple[int, int] = (256, 256)) -> np.ndarray:
    """
    Convert canvas JSON data to image format for CNN input
    
    Args:
        canvas_data: Dict with 'strokes' or 'lines' + width/height
        target_size: Target image dimensions for CNN
    
    Returns:
        Preprocessed numpy array ready for model input
    """
    width = canvas_data.get('width', 1000)
    height = canvas_data.get('height', 600)
    
    # Create blank white canvas
    image = np.ones((height, width, 3), dtype=np.uint8) * 255
    
    # Draw strokes/lines on canvas
    if 'strokes' in canvas_data and canvas_data['strokes']:
        # Mini canvas format: array of stroke arrays
        for stroke in canvas_data['strokes']:
            if len(stroke) < 2:
                continue
            points = [(int(p['x']), int(p['y'])) for p in stroke]
            for i in range(len(points) - 1):
                cv2.line(image, points[i], points[i + 1], (0, 0, 0), 2)
    
    elif 'lines' in canvas_data and canvas_data['lines']:
        # Main canvas format: array of line objects with flattened points
        for line in canvas_data['lines']:
            points_flat = line.get('points', [])
            if len(points_flat) < 4:  # Need at least 2 points (x1,y1,x2,y2)
                continue
            
            # Convert flattened points to coordinate pairs
            points = [(int(points_flat[i]), int(points_flat[i + 1])) 
                     for i in range(0, len(points_flat) - 1, 2)]
            
            for i in range(len(points) - 1):
                cv2.line(image, points[i], points[i + 1], (0, 0, 0), 2)
    
    # Resize to target size for CNN
    resized = cv2.resize(image, target_size, interpolation=cv2.INTER_AREA)
    
    # Normalize to [0, 1] range
    normalized = resized.astype(np.float32) / 255.0
    
    return normalized

def normalize_coordinates(bounds: Dict[str, float], canvas_width: int, canvas_height: int) -> Dict[str, float]:
    """
    Normalize bounding box coordinates to [0, 1] range
    
    Args:
        bounds: Dict with x, y, width, height in pixels
        canvas_width: Original canvas width
        canvas_height: Original canvas height
    
    Returns:
        Normalized bounds
    """
    return {
        'x': bounds['x'] / canvas_width,
        'y': bounds['y'] / canvas_height,
        'width': bounds['width'] / canvas_width,
        'height': bounds['height'] / canvas_height,
    }

def denormalize_coordinates(bounds: Dict[str, float], canvas_width: int, canvas_height: int) -> Dict[str, float]:
    """
    Convert normalized coordinates back to pixel values
    """
    return {
        'x': bounds['x'] * canvas_width,
        'y': bounds['y'] * canvas_height,
        'width': bounds['width'] * canvas_width,
        'height': bounds['height'] * canvas_height,
    }
