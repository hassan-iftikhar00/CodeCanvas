# Machine Learning Training

This directory contains Jupyter notebooks and datasets for training custom AI models.

## Structure

```
ml-training/
├── datasets/                 # Training data
│   ├── sketches/            # Raw sketch images
│   ├── labels/              # Element annotations (JSON)
│   └── augmented/           # Augmented training data
├── notebooks/
│   ├── 01_sketch_detection_cnn.ipynb    # CNN training
│   ├── 02_code_generation_model.ipynb   # Code gen training
│   └── 03_model_evaluation.ipynb        # Evaluation metrics
├── utils/
│   ├── data_labeling.py     # Annotation tools
│   └── augmentation.py      # Data augmentation
└── exports/                  # Trained models (.h5/.pth)
```

## Setup

1. Install ML dependencies:

```bash
pip install tensorflow tensorflow-datasets scikit-learn matplotlib jupyter
```

2. Collect training data:
   - Use the canvas UI to create sketch samples
   - Label elements using `utils/data_labeling.py`
   - Store in `datasets/sketches/` and `datasets/labels/`

3. Run notebooks in order:
   - `01_sketch_detection_cnn.ipynb` - Train element detector
   - `02_code_generation_model.ipynb` - Train code generator
   - `03_model_evaluation.ipynb` - Evaluate performance

## Dataset Format

### Sketch Images

- Format: PNG, 1000x600 resolution
- Grayscale or RGB canvas drawings

### Labels (JSON)

```json
{
  "image": "sketch_001.png",
  "elements": [
    {
      "type": "button",
      "bounds": { "x": 100, "y": 200, "width": 150, "height": 50 }
    },
    {
      "type": "input",
      "bounds": { "x": 100, "y": 300, "width": 200, "height": 40 }
    }
  ]
}
```

## Model Export

After training, export models:

```python
# TensorFlow/Keras
model.save('../backend/models/sketch_detector.h5')

# PyTorch
torch.save(model.state_dict(), '../backend/models/code_generator.pth')
```

## Evaluation Metrics

Track these metrics for FYP documentation:

- **Accuracy**: Element type classification accuracy
- **Precision/Recall**: Per-class detection performance
- **Confusion Matrix**: Visualization of predictions
- **Training Curves**: Loss and accuracy over epochs

## Academic Requirements

For FYP compliance, document:

1. Dataset size and distribution
2. Training hyperparameters
3. Model architecture diagrams
4. Performance metrics with graphs
5. Comparison with baseline methods
