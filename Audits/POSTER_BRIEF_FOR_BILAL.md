# CodeCanvas — FYP Exhibition Poster Brief

> Hand this whole file to whatever LLM/design tool you use (Canva AI, ChatGPT, Gemini, Midjourney prompt, Figma AI, etc.). It has BOTH the verified project context AND the poster design spec, so the chat starts with everything it needs. No follow-up context dumps required.
>
> Event: UMT SST Final Year Projects Exhibition — Computer Science Dept.
> Date: Friday, 17 July 2025 · 09:30 AM to 04:00 PM · STD Building, UMT (be there 09:00 AM).
> Deliverable: printed standee **2 ft wide × 5 ft tall (portrait)** + working software demo.
> Table reservation / final arrangements: 16 July 2025. Attendance = 20 marks.

---

## PART 1 — PROJECT CONTEXT (facts, all verified against the codebase)

### One-liner
CodeCanvas is a **sketch-to-code web application**: draw a UI wireframe on a canvas (or upload a photo of a hand-drawn sketch), and it generates production-ready frontend code in seconds.

### The problem it solves
Turning a UI idea into working frontend code is slow and manual. Designers hand sketches to developers; developers rebuild them by hand. CodeCanvas collapses that loop: hand-drawn sketch goes straight to real, editable React / HTML / Vue code.

### How it works (the pipeline, in plain terms)
1. **Draw or upload** a UI sketch (canvas built with Konva.js, or upload a photo/clean wireframe).
2. **Detect** the UI components. A custom-trained AI vision model (YOLOv11, hosted on Roboflow) finds the boxes: navbar, section, card, footer, with positions.
3. **Review (optional).** The user sees the AI's detected boxes overlaid on the sketch and can relabel, delete, or draw missed boxes before generating (human-in-the-loop).
4. **Generate.** Google Gemini 2.5 Pro turns the detected layout + labels into React + Tailwind code.
5. **Verify.** The system renders its own output, re-runs the SAME detector on the render, and scores how faithfully the code matches the sketch (a fidelity %). If the score is low, one automatic repair pass fixes it.
6. **Refine.** The user can export a ZIP, open in StackBlitz, share a public link, or keep version history.

### What makes it different (vs Uizard, Visily, Locofy, TeleportHQ)
- Works from **hand-drawn sketches**, not Figma files or design tools.
- Uses a **custom-trained detection model** (not a generic multimodal call).
- **Measures its own output fidelity** with the same vision model that read the sketch, then **self-repairs**. Competitors and a plain ChatGPT call cannot check their own work. This closed detect → generate → verify → repair loop is the core research contribution.
- Multi-framework output (React / HTML / Vue), live preview, and version history.

### Tech stack (verified)
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Konva.js (canvas drawing).
- **Backend:** Python FastAPI.
- **AI / ML:** Roboflow-hosted YOLOv11 model (UI component detection), Google Gemini 2.5 Pro (code generation, multi-key rotation across a paid + free key pool).
- **Data / Infra:** Supabase (auth, PostgreSQL database, storage).

### Key features (pick 3 for the poster — these are the strongest)
1. **Sketch-to-code** — draw or upload a wireframe, get production-ready React / HTML / Vue instantly.
2. **Self-verifying generation** — the system scores its own fidelity and auto-repairs low-scoring output (unique closed feedback loop).
3. **Human-in-the-loop detection editor** — review and correct the AI's detected components before code is generated.

(Backup features if a slot opens: live preview + version history · one-click export to ZIP / StackBlitz · shareable public link.)

### The AI model numbers (safe to quote on the poster)
- Custom YOLOv11 detector, trained on **4,481 images** (real hand-drawn sketches + synthetic).
- **~98% detection accuracy** (mAP@50 98.0% on the held-out test set; locally verified precision/recall ~97%).
- Detects 4 UI component classes: navbar, section, card, footer.
- Honest framing for judges: the accuracy gain over the earlier model came from BOTH a bigger dataset AND an architecture upgrade, not one alone. Don't over-claim.

### Team (verified from project docs)
| Member | Role |
|--------|------|
| **Hassan Iftikhar** | Team Lead — Architecture, integration, AI pipeline, QA |
| **Maarij** | Frontend / UI / Dashboard |
| **Bilal** | Backend / Database / API / Testing |
| **Shahwaiz** | AI Model training (detection model) |

> ACTION FOR BILAL: confirm each member's full name spelling before printing. Add **Supervisor** and **Co-Supervisor** names — these are NOT in the project files, get them from the team.

---

## PART 2 — POSTER DESIGN SPEC

### Format
- **Standee: 2 ft wide × 5 ft tall. Portrait. Tall and narrow.** Design vertically, top-to-bottom reading flow.
- Print resolution: build at **300 DPI** → canvas ~**7200 px wide × 18000 px tall** (or design at 24in × 60in in your tool and export at 300 DPI). If the tool struggles at full size, design at 150 DPI (3600 × 9000 px) and upscale, but 300 DPI is preferred for text crispness.
- **Bleed:** add 0.5 in bleed on all sides if the print shop asks. Keep all text at least 2 in from the top and bottom edges (standee frames/rollers eat the extremes).
- Readable from ~2 to 4 feet away (people walking past a table). **Big title, big feature icons, minimal body text.** A poster is a billboard, not a report.

### Visual identity — match the actual product
CodeCanvas has a **"drafting room" aesthetic**: warm off-white paper, fine gridlines like graph/engineering paper, dark ink text, one cobalt-blue accent. Use these EXACT hex values so the poster matches the live demo on the laptop next to it:

| Role | Hex | Use for |
|------|-----|---------|
| Paper (background) | `#FAFAF7` | main poster background (warm off-white, NOT pure white) |
| Vellum (panel) | `#F2F1EC` | section cards / panels behind text blocks |
| Graphite (ink) | `#0E0E0F` | headings and body text (near-black) |
| Cobalt (accent) | `#4A4B8C` | the project title, key highlights, icons, dividers |
| Cobalt ink (deep) | `#2D2E5C` | accent text on light, stronger emphasis |
| Cobalt wash | `#E8E8F1` | subtle highlight fills behind an accent word |
| Tick (gridline) | `#989894` | faint graph-paper grid lines in the background |
| Muted (subtext) | `#6B6B6E` | captions, labels, member roles |

**Background treatment:** paper `#FAFAF7` with a **faint graph-paper grid** (thin `#989894` lines, low opacity ~8 to 12%, like drafting/engineering paper). This is the signature look. Keep it subtle so text stays readable.

**Typography:** clean geometric sans-serif. Poppins or Montserrat for headings, Inter or Roboto for body (these are the fonts the app itself uses). Big bold title, generous line spacing. Avoid decorative/script fonts.

**IMPORTANT copy rules (house style):** In any visible poster text, do **not** use em-dashes (—), emojis, or decorative symbols as flair. Use plain hyphens, commas, or the interpunct "·" as a separator. Keep wording plain and human, not "AI-flavored." (Real logos, arrows in the pipeline diagram, and functional icons are fine.)

### Layout — top to bottom (tall portrait)

```
┌──────────────────────────────┐  ← 2 ft wide
│  [UMT / SST logo]  small, top │
│                               │
│      C O D E C A N V A S      │  ← BIG title, cobalt, bold
│   Draw a UI sketch → get      │  ← tagline, graphite
│      real code instantly      │
│                               │
│  ── Project Overview ──       │
│  2-3 short lines (see copy)   │
│                               │
│  ── How It Works ──           │  ← the money shot: a vertical
│   [Sketch] icon               │     or horizontal pipeline diagram
│      ↓                        │     with 4-5 stages + arrows
│   [AI Detect] icon            │
│      ↓                        │
│   [Gemini Generate] icon      │
│      ↓                        │
│   [Verify + Repair] icon      │
│      ↓                        │
│   [Real Code] icon            │
│                               │
│  ── Key Features ──           │  ← 3 feature cards, icon + 1 line
│   • Sketch to code            │     each, on vellum panels
│   • Self-verifying + repair   │
│   • Human-in-the-loop review  │
│                               │
│  ── Technologies ──           │  ← logo row / chips:
│   Next.js · FastAPI · Gemini  │     React, Next, Python, Gemini,
│   Roboflow(YOLO) · Supabase   │     Roboflow, Supabase, Tailwind
│                               │
│  ── The Numbers ──            │  ← optional stat strip:
│   ~98% detection accuracy ·   │     "4,481 training images" ·
│   4,481 images · 4 classes    │     "~98% accuracy"
│                               │
│  ── Team ──                   │  ← 4 members + roles
│   Hassan · Maarij ·           │     Supervisor + Co-Supervisor
│   Bilal · Shahwaiz            │     below
│   Supervisor: [name]          │
│   Co-Supervisor: [name]       │
│                               │
│  [UMT logo]  [QR to demo?]    │  ← footer, small
└──────────────────────────────┘
```

### The one hero element: the pipeline diagram
This is what sells the project at a glance. Show the **detect → generate → verify → repair loop** as an arrowed flow. Ideal touch: draw it as a small **loop** (the "verify" arrow curves back to "repair/generate") to visually communicate the closed feedback loop, which is the unique selling point. Use simple line-art icons in cobalt on paper (matches the drafting aesthetic): a pencil/sketch, a bounding-box/eye for detect, a code bracket `</>` for generate, a checkmark-in-circle for verify.

If space is tight, a strong alternative hero is a **before/after split**: left = a rough hand-drawn login-form sketch, right = the clean rendered UI it produces. Very legible from a distance, instantly communicates the value. (You can screenshot a real sketch + its generated output from the running app for this.)

### Ready-to-use poster copy

**Title:** CodeCanvas

**Tagline:** Draw a UI sketch. Get real code instantly.

**Project Overview (use this text):**
> CodeCanvas turns hand-drawn UI wireframes into production-ready frontend code. A custom-trained AI vision model detects the interface components in your sketch, Google Gemini generates clean React, HTML, or Vue code, and the system verifies its own output against your drawing, then repairs any mismatch automatically. Sketch to working code in seconds, no manual coding of the layout.

**Key Features (3, use these one-liners):**
1. **Sketch to Code** — Draw or upload a wireframe and get production-ready React / HTML / Vue code instantly.
2. **Self-Verifying Generation** — The system scores how faithfully the code matches your sketch and auto-repairs low-fidelity output. A closed feedback loop no plain AI call has.
3. **Human-in-the-Loop Review** — See and correct the AI's detected components before generating, so you stay in control.

**Technologies (chips/logos):** Next.js · TypeScript · Tailwind CSS · Konva.js · Python FastAPI · Google Gemini 2.5 Pro · Roboflow (YOLOv11) · Supabase

**Stat strip (optional, high impact):** ~98% detection accuracy · 4,481 training images · 4 component classes · self-repairing output

**Team:** Hassan Iftikhar (Lead) · Maarij · Bilal · Shahwaiz
**Supervisor:** [FILL IN] · **Co-Supervisor:** [FILL IN]

### Do / Don't for the designer
- DO keep the warm paper `#FAFAF7` background with a faint grid. It IS the brand.
- DO make the title and pipeline diagram dominate. Everything else supports them.
- DO use cobalt `#4A4B8C` as the ONLY accent color. One accent reads clean; five reads like a school project.
- DO leave whitespace. A tall standee crammed edge-to-edge is unreadable from 3 feet.
- DON'T use pure white `#FFFFFF` background (kills the drafting look).
- DON'T add em-dashes, emojis, or clip-art decoration in visible text.
- DON'T shrink body text below what's readable at 3 feet. If it doesn't fit, cut words, don't shrink.
- DON'T use more than 2 fonts.

### If you prompt an image/design AI, paste this
> Design a tall portrait exhibition standee poster, 2 feet wide by 5 feet tall (24×60 inches, 300 DPI). Theme: a "drafting room" / engineering graph-paper aesthetic. Warm off-white paper background (#FAFAF7) with a very faint gray graph-paper grid. Near-black graphite ink text (#0E0E0F). A single cobalt-blue accent color (#4A4B8C). Clean geometric sans-serif fonts (Poppins headings, Inter body). Big bold title "CodeCanvas" in cobalt with tagline "Draw a UI sketch. Get real code instantly." A central hero pipeline diagram showing a closed loop: hand-drawn sketch → AI detects UI components → Gemini generates code → system verifies and repairs, with the verify step arrow curving back to form a loop. Line-art icons in cobalt. Three feature cards on light vellum panels. A row of technology logos. A team section at the bottom. Minimal text, lots of whitespace, readable from several feet away. No emojis, no em-dashes, no clip-art decoration.

---

*Context verified against CodeCanvas CLAUDE.md, Audits/ARCHITECTURE_DETAILS.md, Audits/FYP_FEATURE_ROADMAP.md, and src/lib/drafting-room/tokens.ts on 2026-07-12.*
