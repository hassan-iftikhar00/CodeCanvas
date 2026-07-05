import numpy as np
import cv2
from typing import Dict, List, Any, Tuple


def preprocess_uploaded_photo(
    img_rgb: np.ndarray, *, binarize: bool, return_clean: bool = False
):
    """
    Normalize an uploaded image so it reaches the Roboflow model looking like the
    clean line-art-on-white the model was trained on.

    The detector was trained without noise/blur/contrast augmentation, so it is
    brittle to real-world capture conditions (phone-photo lighting, shadows,
    off-white paper). For a photo we binarize to crisp black-on-white; for a clean
    digital wireframe we skip binarization (it erodes thin crisp strokes) and only
    crop. In both cases we crop to the drawn content to remove desk/margin around
    the sketch, which also reduces the 640x640 stretch distortion.

    Args:
        img_rgb: HxWx3 uint8 RGB array (alpha already composited onto white).
        binarize: True for photos (threshold to black/white), False for clean
            digital wireframes (skip threshold, crop only).
        return_clean: also return a NON-binarized copy with the exact same crop
            geometry. Binarization is good for the detector but destroys faint /
            blurred text, so the clean copy is what should be handed to Gemini
            for text reading. Its pixel space matches the detector image (and
            therefore the detection boxes) exactly.

    Returns:
        HxWx3 uint8 RGB array ready for Roboflow, or a (detector_img, clean_img)
        tuple when return_clean=True.
    """
    if img_rgb is None or img_rgb.size == 0:
        return (img_rgb, img_rgb) if return_clean else img_rgb

    # Tolerate grayscale / RGBA inputs defensively.
    if img_rgb.ndim == 2:
        img_rgb = cv2.cvtColor(img_rgb, cv2.COLOR_GRAY2RGB)
    elif img_rgb.shape[2] == 4:
        img_rgb = cv2.cvtColor(img_rgb, cv2.COLOR_RGBA2RGB)

    gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)

    if binarize:
        # Median blur kills JPEG/paper speckle without smearing strokes the way a
        # Gaussian would. Adaptive threshold handles uneven lighting across the
        # page far better than a single global cutoff.
        denoised = cv2.medianBlur(gray, 3)
        binary = cv2.adaptiveThreshold(
            denoised,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            blockSize=35,
            C=10,
        )
        # Drop specks of inverse noise (isolated dark pixels) via a light open.
        kernel = np.ones((2, 2), np.uint8)
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
        work_gray = binary
        rgb_out = cv2.cvtColor(binary, cv2.COLOR_GRAY2RGB)
    else:
        # Clean wireframe: keep tonal detail, just use a generous Otsu mask to find
        # where the drawing is for cropping.
        _, work_gray = cv2.threshold(
            gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
        )
        rgb_out = img_rgb

    # Content crop: ink is dark (low value). Find the bbox of non-white pixels and
    # crop to it with a small margin so the model sees the sketch, not the desk.
    ink_mask = work_gray < 250
    ys, xs = np.where(ink_mask)
    if ys.size == 0 or xs.size == 0:
        # Nothing detectable to crop to — return as-is and let detection decide.
        return (rgb_out, img_rgb) if return_clean else rgb_out

    h, w = work_gray.shape[:2]
    margin = max(8, int(0.02 * max(h, w)))
    y0 = max(0, int(ys.min()) - margin)
    y1 = min(h, int(ys.max()) + 1 + margin)
    x0 = max(0, int(xs.min()) - margin)
    x1 = min(w, int(xs.max()) + 1 + margin)

    # Guard against a degenerate crop (e.g. a near-blank image) collapsing the frame.
    if (y1 - y0) < 16 or (x1 - x0) < 16:
        return (rgb_out, img_rgb) if return_clean else rgb_out

    if return_clean:
        return rgb_out[y0:y1, x0:x1], img_rgb[y0:y1, x0:x1]
    return rgb_out[y0:y1, x0:x1]


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
