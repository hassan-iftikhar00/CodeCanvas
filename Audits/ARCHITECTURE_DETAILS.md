# CodeCanvas — Architecture Details

> Verbose pipeline details, model performance data, dataset composition, known failure modes, and FYP write-up guidance. Read this when debugging Roboflow detection issues, writing dissertation sections, or checking model numbers.
> Moved from CLAUDE.md on 2026-06-16.

---

## Shahwaiz's AI Model — Full Detail

### Dataset (v2)

- **Total images:** 311 (276 train / 17 valid / 18 test — 89% / 5% / 6%)
- **Source images:** 23 unique (rest from augmentation)
- **Annotations:** 221 across 4 classes — heavy class imbalance:
  - `card`: 154 (~70%)
  - `section`: 23
  - `navbar`: 22
  - `footer`: 22
- **Median image ratio:** 600 x 720 (page-shaped, portrait-leaning)
- **Training distribution:** mixed — hand-drawn pen sketches AND real digital UI screenshots

**Real dataset visual style distribution (discovered May 2026):**
- Clean digital wireframes (~40%) — thin crisp strokes, resembles Konva.js output; hardest inference target
- Dense hand-drawn sketches (~40%) — zigzag squiggles for text, X-cross marks for image placeholders
- Sparse wireframes (~20%) — few elements, minimal detail, lowest density

Synthetic generation weights mirror this 40/40/20 distribution.

### Preprocessing & Augmentations (v2)

- **Resize:** Stretch to 640x640 (input aspect ratio is altered — extreme aspect ratios lose vertical detail)
- **Auto-orient:** applied
- **Augmentations:** flip horizontal, ±5° rotation, ±10% brightness, 2 outputs per training example
- **No** noise / blur / contrast variation — model is brittle to inputs that don't match training contrast/lighting

### Performance (v2 model)

**Test set overall:** mAP@50 80.2% · Precision 83.1% · Recall 79.5% · F1 80.3%

**Per-class mAP@50 (validation set):**

| class     | mAP@50   |
| --------- | -------- |
| all       | ~72.0%   |
| `card`    | 58.0% ⚠️ |
| `footer`  | 68.0%    |
| `navbar`  | 82.0%    |
| `section` | 78.0%    |

Card is the weakest class — it's also the class with most variance (every content subtype lives under it).

### Dataset (v4)

- **Total images:** 4,481 (Train 3,690 / Valid 527 / Test 264 — 82% / 12% / 6%)
- **Composition:** 311 original real + 2,700 synthetic + ~1,470 unaccounted for (Roboflow auto-augmentation duplicates? Extra Shahwaiz uploads? Need to confirm by downloading the dataset and counting `sketch_*.jpg` files.)

### Performance (v4 model — trained 2026-06-11)

**Validation set:** mAP@50 **98.7%** · Precision **98.3%** · Recall **97.9%** · F1 **98.1%**

**Per-class mAP@50 (Roboflow self-reported):**

| class     | v2 validation | v4 validation | v4 test  |
| --------- | ------------- | ------------- | -------- |
| all       | ~72.0%        | 99.0%         | 98.0%    |
| `card`    | 58.0% ⚠️      | 98.0%         | 98.0%    |
| `footer`  | 68.0%         | 98.0%         | 96.0%    |
| `navbar`  | 82.0%         | 99.0%         | 99.0%    |
| `section` | 78.0%         | 99.0%         | 99.0%    |

⚠️ **Roboflow's own caveat:** "These metrics are reported by the model provider and may not follow industry-standard evaluation techniques." Treat headline numbers as directionally correct, not gospel — see `backend/eval_v4.py` for the locally-computed sanity check.

**Locally-verified v4 test-set numbers (2026-06-12, conf=0.20, IoU=0.5, n=264):**

| class     | precision | recall    |
| --------- | --------- | --------- |
| `card`    | 97.4%     | 98.8%     |
| `footer`  | 95.1%     | 91.7%     |
| `navbar`  | 97.0%     | 96.2%     |
| `section` | 99.5%     | 99.5%     |
| macro     | **97.2%** | **96.5%** |

The local computation matches Roboflow's reported 98.0% within ~1pp, confirming the headline metric is honest. `card` precision/recall both >97% on the held-out test set, vs 58% mAP on v2.

### Confusion Matrix (v2 validation set)

|              | predicted card | predicted footer | predicted navbar | predicted section | false neg |
| ------------ | -------------- | ---------------- | ---------------- | ----------------- | --------- |
| true card    | 106            | 0                | 0                | 0                 | 17        |
| true footer  | 1              | 11               | 0                | 0                 | 6         |
| true navbar  | 1              | 0                | 12               | 0                 | 4         |
| true section | 0              | 0                | 0                | 18                | 0         |
| false pos    | 46             | 5                | 0                | 1                 | —         |

Key takeaways:
- `section` is essentially perfect (no false negatives, 1 false positive)
- `card` has 46 false positives and 17 false negatives — BOTH hallucinates AND misses
- `footer` is sometimes mislabelled as `card`

### What Roboflow Returns

```json
{
  "predictions": [
    { "class": "navbar",  "x": 200, "y": 10,  "width": 400, "height": 60,  "confidence": 0.94 },
    { "class": "section", "x": 200, "y": 150, "width": 400, "height": 200, "confidence": 0.87 },
    { "class": "card",    "x": 150, "y": 300, "width": 200, "height": 150, "confidence": 0.91 },
    { "class": "footer",  "x": 200, "y": 500, "width": 400, "height": 80,  "confidence": 0.89 }
  ]
}
```

### Operational Caveats (v4)

- ✅ Per-class confidence thresholds re-tuned for v4 (2026-06-12) — all four classes at `0.20`. v2's `card=0.03` would admit noise on v4's well-calibrated outputs.
- ✅ Roboflow timeout bumped 30s -> 60s (2026-06-12). YOLOv11 Small is slower than Fast; 30s wasn't enough headroom for cold starts.
- ✅ Backend startup warm-up (2026-06-12) — `warmup_roboflow()` fires one 64x64 dummy inference on FastAPI startup. Watch for `[startup] Roboflow ... warm-up done in X.Xs` in backend output.
- ⚠️ YOLOv11 Small is slower than Fast at inference — measure user-facing detection latency after the swap.
- ✅ Decision #15 effectively verified (2026-06-12) — the contamination check's filename heuristic was defeated by Roboflow auto-renaming uploads. However, uniform per-class numbers across the full 264-image test set rule out a synthetic-easy bimodal distribution.

### Honest FYP Write-up for v2 -> v4 Gain

The mAP@50 jump (test set: 80.2% -> 98.0%) is real, but **attribute it to BOTH variables, not just the dataset**:

1. **Dataset expansion** (311 -> 4,481 images, mostly synthetic): exposes the model to far more `card`-class variety.
2. **Architecture upgrade** (YOLOv11 Fast -> YOLOv11 Small): Small has more parameters — typically gives a few mAP points on its own.

**Defensible viva claim:** "Synthetic data expansion combined with a moderate architecture upgrade moved test-set mAP@50 from 80.2% to 98.0%. Each contributes; we cannot fully decouple them without retraining v2-architecture on the v4 dataset (which we did not do due to compute/time constraints)."

Do NOT claim "the synthetic data alone delivered 18 mAP points" — that's not defensible without an ablation.

---

## Known Failure Modes

These are real failure patterns seen in production or testing.

| Failure | Root cause |
|---------|-----------|
| Detection returns 0 predictions on a clearly valid sketch | Transparent canvas background composited to black — sketch lines invisible. Fixed in `inference.py` (alpha->white). If it regresses, check `backend/debug/last_sketch.png`. |
| Single isolated rectangle detected as `section` not `card` | Model learned sections as large-rectangle regions; a lone card drawn without context triggers the wrong class |
| Wide/thin or tall/narrow layouts lose detail | Stretch to 640x640 preprocessing alters aspect ratio — extreme proportions lose spatial relationships |
| `card` confidence structurally lower than containers | Cards are diverse (button/input/heading/image all map to one class) — a single global threshold can't fit both. Use per-class thresholds. |
| Oversized `section` prediction engulfs everything | A section covering >85% of canvas is the model confusing the canvas boundary with a section. Oversize-card guard handles this for cards; similar behavior can affect sections. |
| Sparse sketches underperform dense ones | Model trained on data skewed toward dense hand-drawn layouts (~40%) — sparse wireframe style (~20%) is underrepresented |
| Roboflow default threshold silently hides card predictions | Default Roboflow confidence floor is ~0.4. Always set `InferenceConfiguration(confidence_threshold=0.05)` explicitly. |
| Footer mislabelled as `card` | Confusion matrix shows ~1 footer per validation run lands on card. Low-confidence footers look like wide cards to the model. |
| Isolated-footer sketches classified as `card` | v4 verified 2026-06-12 via Footer template. A footer drawn alone loses the "wide bar BELOW page content" context. Same behaviour as v2 — not a v4 regression. Workaround: Gemini's positional rendering still produces a horizontal-link layout. |

---

## FYP Competitors (Differentiation Context)

- **Uizard** — sketch to UI, no code export
- **Visily** — design tool, limited code
- **TeleportHQ** — visual builder, not sketch-based
- **Locofy** — Figma to code, not hand-drawn sketches

### What Makes CodeCanvas Different

1. Hand-drawn sketch -> real code (not Figma/design tool)
2. Custom trained AI model (Shahwaiz's Roboflow model)
3. AI chat refinement built in (OpenRouter)
4. Multiple framework output (React + HTML)
5. Version history of generated code

---

## How to Get the Best Help from Claude

1. Read CLAUDE.md first for context
2. Do NOT suggest reassigning work to Hassan unless it's integration/review
3. Do NOT change canvas editor core — it is complete
4. Do NOT change OpenRouter chat refinement — it is working
5. Always keep existing endpoint shapes (no frontend contract changes)
6. Prefer React + Tailwind in code suggestions
7. Keep DB column names canonical: title, thumbnail_url, iterations
