# AI Models Directory

This directory contains the trained machine learning models for CodeCanvas.

## Model Files

### Sketch Detection Model

- **File**: `sketch_detector.h5` (TensorFlow/Keras format)
- **Purpose**: Detect UI elements (buttons, inputs, containers, text) from canvas sketches
- **Input**: Preprocessed canvas image (grayscale, 224x224)
- **Output**: Element type predictions with bounding boxes

### Code Generation Model

- **File**: `code_generator.pth` (PyTorch format) or `code_generator.h5`
- **Purpose**: Generate framework-specific code from detected elements
- **Input**: Element types, positions, and relationships
- **Output**: React/HTML/Vue component code

## Training

Models are trained using the notebooks in `ml-training/`:

- `ml-training/01_sketch_detection_cnn.ipynb` - CNN for element detection
- `ml-training/02_code_generation_model.ipynb` - Code generation model

## Fallback Behavior

When model files are not present, the system uses fallback logic:

- **Detection**: OpenCV contour-based detection
- **Generation**: Template-based code generation

## Model Loading

Models are automatically loaded on FastAPI startup in `backend/main.py`:

```python
@app.on_event("startup")
async def load_models():
    sketch_detector.load_model()
    code_generator.load_model()
```

## File Requirements

- Place `.h5` files for TensorFlow/Keras models
- Place `.pth` files for PyTorch models
- Ensure model input/output dimensions match preprocessing pipeline
