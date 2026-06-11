# Handoff — Training v3 of the Object Detection Model

> **STATUS: COMPLETED 2026-06-11.** Shahwaiz delivered `object-detection-4affw/4`
> (iterated past v3 to v4) with valid-set mAP@50 98.7%. See `CLAUDE_CONTEXT.md`
> → "Performance (v4 model)" for the full breakdown and integration to-do list.
> Two deviations from the handoff: (1) final model is v4 not v3, (2) architecture
> is YOLOv11 Small not Fast — both noted in CLAUDE_CONTEXT.md. This document is
> kept as historical reference only.

**To:** Shahwaiz
**From:** Hassan
**Project:** CodeCanvas FYP — UI Sketch Detection
**Bundle:** `synthetic_dataset.zip` + this document + v2 baseline screenshot

---

## TL;DR (1 minute read)

Hassan generated **2500 synthetic UI sketch images** to expand the training set from 311 → 2811. The synthetic data matches the three visual styles in your real dataset (clean digital, dense hand-drawn with zigzag-line text, sparse sketch). Class IDs match yours exactly: `[card, footer, navbar, section]`.

**Your v2 model and 311 original images are completely safe.** v3 will be a new, separate version. If it doesn't improve performance, we delete v3 — v2 stays in production untouched.

**Your job:** upload the synthetic data → generate v3 with identical settings to v2 → train (10–30 min) → screenshot results → send Hassan the new Model ID.

---

## What's preserved (no risk to your work)

- Your 311 original images stay in Roboflow's source library — none get deleted
- **Version 2 stays fully trained** — its weights, metrics page, and API endpoint don't change
- The backend `.env` still points to `object-detection-4affw/2`, so the app keeps using your model until Hassan explicitly updates it
- If v3 underperforms, we delete v3 — zero data loss, zero impact on v2

---

## Assets in the bundle

| File                              | Purpose                                                       |
| --------------------------------- | ------------------------------------------------------------- |
| `synthetic_dataset.zip` (~150 MB) | 2500 synthetic images + YOLOv11 labels + data.yaml            |
| `v2_baseline.png` (or similar)    | Screenshot of your current v2 metrics — the comparison target |
| `HANDOFF_v3.md`                   | This document                                                 |

---

## Synthetic dataset stats

| breakdown                                             | count |
| ----------------------------------------------------- | ----- |
| Total images                                          | 2,500 |
| Style: clean (digital)                                | 1,007 |
| Style: dense_hand (zigzag text, X image placeholders) | 957   |
| Style: sparse_sketch                                  | 536   |
| Pristine (no artifacts)                               | 712   |

**Annotation count gain over your existing 311 images:**

| class   | your real count | synthetic count | gain |
| ------- | --------------- | --------------- | ---- |
| card    | 154             | 27,623          | 179× |
| section | 23              | 3,732           | 162× |
| navbar  | 22              | 1,144           | 52×  |
| footer  | 22              | 649             | 29×  |

Simulated annotator miss rate: ~1.1% (intentional — teaches the model that real labels are imperfect).

---

## v2 config — locked for v3 to match exactly

The whole point of the comparison is to isolate **the dataset** as the only variable. So v3 uses **exactly the same** preprocessing and augmentation as v2. Any mAP change is then provably caused by the new training data, not by config tuning.

| setting                     | v2 value                        | v3 (match exactly)              |
| --------------------------- | ------------------------------- | ------------------------------- |
| Architecture                | YOLOv11 Object Detection (Fast) | YOLOv11 Object Detection (Fast) |
| Preprocessing — Auto-Orient | Applied                         | Applied                         |
| Preprocessing — Resize      | Stretch to 640×640              | Stretch to 640×640              |
| Aug — Flip                  | Horizontal                      | Horizontal                      |
| Aug — Rotation              | −5° to +5°                      | −5° to +5°                      |
| Aug — Brightness            | −10% to +10%                    | −10% to +10%                    |
| Aug — Outputs per example   | 2                               | 2                               |

**No new augmentations.** If v3 underperforms or wins only marginally, we'll do a follow-up v3.1 run with added blur/noise — but that's a separate experiment.

---

## Step-by-step

### Step 1 — Backup the v2 baseline

1. Open [the project on Roboflow](https://app.roboflow.com/shahwaizs-workspace/object-detection-4affw)
2. Click **Versions** in the left sidebar → click **Version 2**
3. **Screenshot the metrics page** (the one showing mAP@50 80.2%, Precision 83.1%, etc.). Save it somewhere safe.

This is the baseline we compare v3 against. Don't skip it.

---

### Step 2 — Upload `synthetic_dataset.zip`

1. From the project page, click **Upload Data** in the left sidebar
2. **Drag `synthetic_dataset.zip` into the drop zone.** Roboflow extracts it automatically and reads YOLOv11 format from the `data.yaml` inside.
3. Verify the import preview shows:
   - **2500 images detected**
   - **4 classes**: card, footer, navbar, section (matching your existing classes — no class conflict)
   - **Annotations attached** (NOT "needs labeling")
4. **Split assignment: force 100% Train** for these 2500 images. **Do NOT let any roll into Valid or Test.** Your real 17 valid + 18 test must stay clean as the evaluation set.
5. Click **Save and Continue** → **Add Images**

Upload runs in your browser. Takes a few minutes.

> **If anything looks wrong** (class mismatch, "needs labeling", missing images), stop and message Hassan **before** clicking Save. Don't proceed past an unexpected error.

---

### Step 3 — Generate v3 (match v2 exactly)

1. After upload completes, click **Versions → Create New Version**
2. **Preprocessing** — set exactly:
   - Auto-Orient: **On (Applied)**
   - Resize: **Stretch to 640×640**
   - Nothing else
3. **Augmentation** — set exactly:
   - Flip: **Horizontal**
   - Rotation: **Between −5° and +5°**
   - Brightness: **Between −10% and +10%**
   - **Outputs per training example: 2**
   - Nothing else (no blur, no noise, no other transforms)
4. Click **Generate**

Roboflow builds the version (a few minutes). You'll see split totals around **2776 train / 17 valid / 18 test**.

---

### Step 4 — Train v3

1. On the new version page, click **Train with Roboflow**
2. **Architecture: YOLOv11 Object Detection**
3. **Mode: Fast** (matches v2 exactly)
4. Click **Start Training**

Training takes **10–30 minutes**. Roboflow will email you when it finishes.

---

### Step 5 — Compare against v2 baseline

When training completes, **screenshot v3's metrics page**. Compare against v2:

**Test set aggregate metrics (headline numbers):**

| metric    | v2 baseline | v3 target         |
| --------- | ----------- | ----------------- |
| mAP@50    | 80.2%       | ≥ 82% (clear win) |
| Precision | 83.1%       | ≥ 84%             |
| Recall    | 79.5%       | ≥ 81%             |
| F1        | 80.3%       | ≥ 82%             |

**Validation set per-class precision (the FYP story):**

| class   | v2 baseline | v3 target | notes                                                            |
| ------- | ----------- | --------- | ---------------------------------------------------------------- |
| card    | 58%         | ≥ 70%     | biggest expected jump — the synthetic data directly attacks this |
| footer  | 68%         | ≥ 72%     |                                                                  |
| navbar  | 82%         | ≥ 84%     |                                                                  |
| section | 78%         | ≥ 80%     |                                                                  |

---

### Step 6 — Send Hassan the results

Send back:

1. The **v3 metrics screenshot** (both aggregate and per-class views)
2. The **new Model ID** (will look like `object-detection-4affw/3`)
3. _(Optional but useful)_ Screenshots of any obvious failure modes you spot in the test-set predictions visualizer

**Production keeps using v2 until then.**

---

## What NOT to do

| Don't                                             | Reason                                                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Delete or modify Version 2                        | Production still runs on v2. Keep it as a fallback.                                                 |
| Put synthetic images in Valid or Test splits      | Evaluation must use real data only — that's how sim-to-real benchmarking works.                     |
| Change augmentation settings from the table above | Breaks the experimental control. Any v2 vs v3 delta becomes ambiguous.                              |
| Change the class names or order in `data.yaml`    | The synthetic labels use indices `0=card, 1=footer, 2=navbar, 3=section`. Reordering corrupts them. |

---

_End of handoff document. Total time once started: ~30–45 minutes including the email-wait for training._
