# CodeCanvas — Draw. Describe. Ship.

An AI-powered sketch-to-code platform that converts rough sketches into production-ready frontends using custom-trained machine learning models.

## 🎯 Features

- **Interactive Drawing Canvas**: Sketch UI designs with intuitive drawing tools
- **AI-Powered Detection**: Custom CNN detects UI elements (buttons, inputs, containers)
- **Code Generation**: Automatic React/HTML/Vue component generation
- **Real-time Preview**: See generated code instantly in the code panel
- **User Authentication**: Secure signup/login with Supabase Auth
- **Project Management**: Save, version, and iterate on designs
- **FYP Compliant**: Custom-trained models (no third-party AI APIs)

## 🏗️ Architecture

```
Next.js Frontend (React 19 + TypeScript)
    ↓ API Routes
FastAPI Backend (Python)
    ↓ Custom AI Models
TensorFlow/PyTorch CNN
    ↓ Persistence
Supabase (PostgreSQL + Auth + Storage)
```

## 🚀 Quick Start

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for complete setup instructions.

### Prerequisites

- Node.js 18+ and pnpm
- Python 3.10+
- Supabase account

### Installation

**Frontend:**

```bash
pnpm install
cp .env.example .env.local
# Add your Supabase credentials to .env.local
pnpm dev
```

**Backend:**

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
cp .env.example .env
# Add your Supabase credentials to backend/.env
uvicorn main:app --reload
```

Frontend: http://localhost:3000  
Backend API: http://localhost:8000  
API Docs: http://localhost:8000/docs

## 📚 Documentation

- [Integration Guide](./INTEGRATION_GUIDE.md) - Complete setup and testing
- [Supabase Setup](./SUPABASE_SETUP.md) - Database configuration
- [ML Training](./ml-training/README.md) - Model training guide
- [Models Directory](./backend/models/README.md) - AI model documentation

## 🎨 Design System

### Color Palette (Warm Studio)

```css
--paper-warm: #f8f4ee /* Background */ --ink-charcoal: #111217
  /* Primary text */ --tool-accent: #0ea5a4 /* Accent/Interactive */
  --soft-slate: #6b7280 /* Muted text */ --success: #16a34a /* Success state */
  --error: #ef4444 /* Error state */ --canvas-bg: #ffffff /* Canvas surface */;
```

### Spacing System

8px base unit with scale: 8 / 12 / 16 / 24 / 32 / 48 / 64

### Typography

- **Font**: Inter (system fallback: -apple-system, sans-serif)
- **Sizes**: Responsive scale from 0.75rem to 4rem

### Motion & Transitions

```css
--duration-fast: 120ms /* Hover reveals */ --duration-base: 180ms
  /* Tool open/close */ --duration-slow: 240ms /* Panel slide */
  --duration-panel: 360ms /* Large transitions */
  --ease-standard: cubic-bezier(0.22, 0.9, 0.28, 1)
  --ease-elastic: cubic-bezier(0.22, 1.4, 0.32, 1);
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

### Available Scripts

```bash
pnpm dev          # Start dev server (http://localhost:3000)
pnpm build        # Build for production
pnpm start        # Run production build
pnpm lint         # Run ESLint
pnpm lint:fix     # Fix linting issues
pnpm format       # Format with Prettier
pnpm format:check # Check formatting
```

## 📁 Project Structure

```
codecanvas/
├── src/
│   ├── app/
│   │   ├── canvas/          # Main canvas workspace
│   │   │   └── page.tsx
│   │   ├── globals.css      # Design system tokens
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Landing page
│   └── components/
│       └── canvas/
│           └── SketchCanvas.tsx  # Konva canvas component
├── public/                  # Static assets
├── .husky/                  # Git hooks
├── package.json
└── README.md
```

## 🎯 Features

### Landing Page

- **Interactive Hero**: Mini-canvas that lets users draw and see live preview
- **Feature Showcase**: Grid of key capabilities
- **Call-to-Action**: Direct navigation to canvas workspace

### Canvas Workspace

#### Layout Components

1. **Top Toolbar**
   - Project name editor
   - Mode switcher (Sketch / Detect / Refine / Preview)
   - Undo/Redo history
   - Run Detection button
   - Export button

2. **Left Tool Rail**
   - Pen tool (P)
   - Shape tool (S)
   - Text tool (T)
   - Erase tool (E)
   - Select tool (V)
   - Grid toggle (G)
   - Snap toggle

3. **Center Canvas**
   - 1000×600 drawing surface
   - Optional grid overlay
   - Paper texture background
   - Real-time drawing feedback

4. **Right Inspector Panel**
   - Detected elements list with confidence scores
   - Element properties editor
   - NLP intent chips
   - Quick actions (Edit, Change Type)

5. **Bottom Code Panel**
   - Code view (syntax highlighted)
   - Live preview toggle
   - Resizable height

#### Canvas Tools

| Tool   | Shortcut | Description                |
| ------ | -------- | -------------------------- |
| Pen    | P        | Freehand drawing           |
| Shape  | S        | Rectangles, circles, etc.  |
| Text   | T        | Add text annotations       |
| Erase  | E        | Remove elements            |
| Select | V        | Selection and manipulation |

#### Modes

- **Sketch**: Draw UI components freely
- **Detect**: AI recognition of drawn elements
- **Refine**: Edit and adjust detected components
- **Preview**: Live code preview and export

## 🎨 Design Philosophy

### Primary Voice: Tactile Creative Instrument

Feels like sketching in a quality notebook that translates marks to code. Tangible, quiet, empowering.

### Secondary Voice: Serious Craft

Strong tools for makers. No fluff. Credible for developers.

### Key Principles

1. **Natural & Physical**: Interactions feel like real tools (drag, press, snap)
2. **Reversible**: Visible undo history, safe experimentation
3. **Transparent AI**: Show confidence, allow corrections
4. **Calm & Confident**: Warm neutrals over neon AI colors

## 🔧 Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Canvas**: Konva.js + React-Konva
- **Code Editor**: Monaco Editor (planned)
- **Linting**: ESLint + Prettier
- **Git Hooks**: Husky + lint-staged

## 🎯 Roadmap

### Phase 1: Foundation ✅

- [x] Design system setup
- [x] Landing page with interactive hero
- [x] Canvas layout structure
- [x] Basic drawing tools
- [x] Grid and snap toggles

### Phase 2: Recognition (In Progress)

- [ ] ML model integration for element detection
- [ ] Bounding box overlays
- [ ] Confidence scoring UI
- [ ] Element type suggestions

### Phase 3: Code Generation

- [ ] HTML/CSS generation
- [ ] Framework templates (React, Vue, etc.)
- [ ] Component export
- [ ] Monaco editor integration

### Phase 4: Advanced Features

- [ ] NLP prompt processing
- [ ] Multi-layer support
- [ ] Component library
- [ ] Version history
- [ ] Collaboration features

## 🎨 UI Patterns

### Empty States

Canvas shows friendly prompts with starter actions:

- "Start sketching your layout"
- Quick actions: Try sample, Drag template, Watch tour

### Loading States

Progressive stages with micro-animations:

1. Parsing sketch
2. Generating structure
3. Formatting code

### Error States

Friendly, actionable messages:

- "We hit a snag when converting this element"
- Options: Retry, Report, Switch mode

### Micro-interactions

- **Cursor**: Expressive states (crosshair, snap preview, drag ghost)
- **Animations**: Smooth transitions with defined durations
- **Feedback**: Subtle sounds (optional, toggleable)
- **Tooltips**: Keyboard shortcuts and descriptions

## ♿ Accessibility

- Keyboard-first navigation
- ARIA labels on all controls
- Focus indicators (2px accent ring)
- High-contrast mode support
- Reduced motion support
- Semantic HTML in generated code

## 📝 Code Style

### ESLint Rules

- TypeScript strict mode
- React hooks rules
- No unused variables
- Consistent imports

### Prettier Config

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

### Git Workflow

Pre-commit hooks via Husky:

- ESLint auto-fix
- Prettier formatting
- TypeScript type checking

## 🤝 Contributing

1. Create feature branch from `main`
2. Follow existing code style
3. Write meaningful commit messages
4. Test on multiple browsers
5. Submit PR with description

---

**CodeCanvas** — Making frontend development as natural as drawing on paper.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
