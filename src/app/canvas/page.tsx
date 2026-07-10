"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { SketchCanvasWithHistoryRef } from "@/components/canvas/SketchCanvasWithHistory";
import { createClient } from "@/lib/supabase/client";

import { useHistory } from "@/hooks/useHistory";
import ShortcutsPanel from "@/components/ShortcutsPanel";
import { SHORTCUTS_PANEL_EVENT } from "@/components/CommandPalette";
import { type Layer } from "@/types/canvas";
import ExportDialog, { type ExportOptions } from "@/components/ExportDialog";
import ShareDialog from "@/components/ShareDialog";
import BrandKitModal, {
  type BrandKit,
} from "@/components/canvas/BrandKitModal";
import TemplatesPanel from "@/components/canvas/TemplatesPanel";
import ZoomPill from "@/components/canvas/ZoomPill";
import FloatingToolbar from "@/components/canvas/FloatingToolbar";
import CanvasSurface from "@/components/canvas/CanvasSurface";
import UploadedSketchPanel from "@/components/canvas/UploadedSketchPanel";
import StyleRibbon from "@/components/canvas/StyleRibbon";
import StatusBar from "@/components/canvas/StatusBar";
import TipsTicker from "@/components/canvas/TipsTicker";
import CanvasTopBar from "@/components/canvas/CanvasTopBar";
import ErrorBoundary from "@/components/ErrorBoundary";
import OnboardingTour, {
  type OnboardingStep,
} from "@/components/onboarding/OnboardingTour";
import {
  useProjectSave,
  useAutoSave,
  type CanvasData,
  type ScreenSnapshot,
} from "@/hooks/useProjectSave";
import ScreenTabs, { type ScreenTabInfo } from "@/components/canvas/ScreenTabs";
import { recordProjectActivity } from "@/lib/dashboard-projects";
import { buildExportZip } from "@/lib/export-zip";
import { openInStackBlitz } from "@/lib/open-in-stackblitz";
import type { Template } from "@/data/templates";

import MonacoCodeEditor, {
  type MonacoCodeEditorHandle,
} from "@/components/canvas/MonacoCodeEditor";
import LivePreview, {
  type AnnotatePayload,
} from "@/components/canvas/LivePreview";
import ChatInterface from "@/components/canvas/ChatInterface";
import ComponentPalette from "@/components/canvas/ComponentPalette";
import GenerationProgress from "@/components/canvas/GenerationProgress";
import DraftingToolbox, {
  type ToolboxTabId,
  type ToolboxTab,
} from "@/components/canvas/DraftingToolbox";
import DraftingModal, { ModalButton } from "@/components/canvas/DraftingModal";
import UploadSketchModal, {
  type UploadDetectionPayload,
} from "@/components/canvas/UploadSketchModal";
import DetectionReviewOverlay, {
  type DetectionCorrection,
  type ReviewElement,
} from "@/components/canvas/DetectionReviewOverlay";
import { T_CANVAS, T_DARK } from "@/components/canvas/canvasTokens";
import {
  useVersionHistory,
  type ProjectVersion,
} from "@/hooks/useVersionHistory";
import VersionCompareModal from "@/components/canvas/VersionCompareModal";
import { useToast } from "@/components/ui/Toast";
import { registerCanvasCommands } from "@/components/CommandPalette";
import type {
  Tool,
  Mode,
  RightPanel,
  TextAnnotation,
  CodeViewMode,
} from "@/types/canvas";
import {
  ZOOM_DEFAULT,
  ZOOM_STEP,
  CODE_PANEL_MIN_HEIGHT,
  CODE_PANEL_MAX_HEIGHT,
  clampZoom,
  clampCodePanelHeight,
} from "@/types/canvas";

const SketchCanvas = dynamic(
  () => import("@/components/canvas/SketchCanvasWithHistory"),
  { ssr: false }
);

const GENERATE_CODE_ENDPOINT = "/api/generate-code";
const DETECT_ENDPOINT = "/api/detect";
const FIDELITY_ENDPOINT = "/api/fidelity";
const REPAIR_ENDPOINT = "/api/repair";
// Below this fidelity score, one automatic repair pass runs (single pass per
// generation — the re-score after repair never triggers another).
const REPAIR_THRESHOLD = 0.8;

// The detection boxes live in the sketch image's pixel space, so the fidelity
// render must use the same dimensions. Read them off the image itself.
function getImageSize(
  dataUrl: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not read sketch image size"));
    img.src = dataUrl;
  });
}
// Options for the shared generation routine (canvas + upload paths, and the
// HITL review overlay's corrected re-entry all funnel through this shape).
type RunGenerationOpts = {
  canvasData: CanvasData;
  sketchImage?: string;
  textAnnotations: TextAnnotation[];
  sketchSource: "canvas" | "upload-photo" | "upload-clean";
  framework?: "react" | "html" | "vue";
  // What gets written to the projects row. The upload path persists the
  // uploaded image here (so reloads restore it) while keeping the API
  // payload lean — the image already travels as `sketchImage`.
  persistCanvasData?: CanvasData;
  // HITL: user-reviewed detection set. When present the backend skips
  // Roboflow (and container synthesis) and generates from exactly these.
  correctedElements?: Array<{
    type: string;
    confidence: number;
    bounds: { x: number; y: number; width: number; height: number };
    label?: string | null;
  }>;
  // HITL: audit log of relabel/delete/add actions from the review overlay.
  detectionCorrections?: DetectionCorrection[];
};

const ONBOARDING_STORAGE_PREFIX = "codecanvas:onboarding:seen";
const ONBOARDING_PENDING_PREFIX = "codecanvas:onboarding:pending";
const ONBOARDING_LOCAL_PREFIX = "codecanvas:onboarding:local";
const ONBOARDING_DEBUG_KEY = "codecanvas:onboarding:debug";

// Canvas types are imported from @/types/canvas for cross-component use.

// Tool/color/width metadata is now owned by FloatingToolbar and StyleRibbon components.

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// CANVAS PAGE
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
export default function CanvasPage() {
  return (
    <Suspense fallback={<CanvasPageFallback />}>
      <CanvasPageInner />
    </Suspense>
  );
}

function CanvasPageFallback() {
  return (
    <div
      className="flex h-screen items-center justify-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{ background: "#FAFAF7" }}
    >
      <span className="sr-only">Loading canvas...</span>
      <div
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
        style={{ borderColor: "#4A4B8C", borderTopColor: "transparent" }}
      />
    </div>
  );
}

function DraftingToggle({
  label,
  enabled,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className="flex items-center justify-between px-3 py-2 cursor-pointer"
      style={{
        background: T_CANVAS.vellum,
        border: `1px solid ${T_CANVAS.rule}`,
      }}
    >
      <span className="text-[12px]" style={{ color: T_CANVAS.graphite }}>
        {label}
      </span>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={enabled}
        className="relative h-5 w-9 transition-colors"
        style={{
          background: enabled ? T_CANVAS.cobalt : T_CANVAS.paper,
          border: `1px solid ${enabled ? T_CANVAS.cobalt : T_CANVAS.rule}`,
        }}
      >
        <span
          className="absolute top-[1px] block h-3.5 w-3.5 transition-transform"
          style={{
            background: enabled ? T_CANVAS.paper : T_CANVAS.graphite,
            transform: enabled ? "translateX(17px)" : "translateX(1px)",
          }}
        />
      </button>
    </label>
  );
}

function CanvasPageInner() {
  const toast = useToast();
  // Ã¢â€â‚¬Ã¢â€â‚¬ Core state Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [currentTool, setCurrentTool] = useState<Tool>("pen");
  const [currentMode, setCurrentMode] = useState<Mode>("sketch");
  // Default to PROPS because the initial tool is "pen" (a drawing tool) —
  // we want users to discover style controls on first load. See the effect
  // below that re-opens PROPS whenever any drawing tool is selected.
  const [rightPanel, setRightPanel] = useState<RightPanel>("properties");
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [codePanelHeight, setCodePanelHeight] = useState(350);
  const [selectedFramework, setSelectedFramework] = useState<
    "react" | "html" | "vue"
  >("react");
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [codeCopied, setCodeCopied] = useState(false);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);
  const [screenToDelete, setScreenToDelete] = useState<ScreenTabInfo | null>(
    null
  );
  const [importedDesign, setImportedDesign] = useState<
    { x: number; y: number }[][] | null
  >(null);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Panels / modals Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showVersionCompare, setShowVersionCompare] = useState(false);
  const [showBrandKit, setShowBrandKit] = useState(false);
  // Brand kit rides along in a ref so runGeneration reads the latest kit
  // without adding it to the callback's dependency chain.
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const brandKitRef = useRef<BrandKit | null>(null);
  const applyBrandKit = (kit: BrandKit | null) => {
    brandKitRef.current = kit;
    setBrandKit(kit);
  };

  // ── Element↔Code Linker (App Uplift feature C) ──
  // Generated code carries data-cc-id="cc-N" (N = 1-based index into
  // detectedElements, same order the prompt listed them). The Monaco handle
  // scrolls/flashes the matching attribute; the preview iframe outlines the
  // matching element via the cc-highlight message bridge in preview-doc.ts.
  const monacoEditorRef = useRef<MonacoCodeEditorHandle>(null);

  // ── Incremental regeneration (App Uplift feature D) ──
  // Mirror of the latest generation (code incl. chat/manual edits + detection
  // set + framework), sent with the next generation request so the backend
  // can diff detection sets and PATCH the code instead of regenerating.
  // A ref (not state): runGeneration clears code state synchronously before
  // its fetch, but this effect only runs post-render, so at request-build
  // time the ref still holds the prior generation.
  const previousGenRef = useRef<{
    code: string;
    elements: Array<{ type: string; bounds: unknown }>;
    // Generation CONTEXT, stamped only when a generation completes (or a
    // screen switch restores one) — never live-synced. The code was produced
    // under this framework/brand kit; if either differs at the next request,
    // incremental patching would keep code that ignores the change (e.g. a
    // brand kit added with an unchanged sketch → zero delta → old unstyled
    // code returned verbatim), so the payload gate below forces a full regen.
    framework: string;
    brandKitKey: string;
  }>({ code: "", elements: [], framework: "react", brandKitKey: "null" });
  // (Kept in sync by an effect placed after the code/detection state
  // declarations below.)

  const revealCcInCode = useCallback((ccId: string) => {
    // The editor may be mid-mount (e.g. we just switched preview → split), so
    // retry briefly before giving up.
    const attempt = (triesLeft: number) => {
      const ok = monacoEditorRef.current?.revealAndFlash(
        `data-cc-id="${ccId}"`
      );
      if (!ok && triesLeft > 0) {
        setTimeout(() => attempt(triesLeft - 1), 150);
      }
    };
    attempt(10);
  }, []);

  // Click on a rendered element inside the preview iframe → jump to its code.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "cc-element-click" && event.data.ccId) {
        // If only the preview is visible, open split view so the highlighted
        // code is actually on screen.
        setCodeViewMode((mode) => (mode === "preview" ? "split" : mode));
        revealCcInCode(event.data.ccId);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [revealCcInCode]);

  // Element chip in the detection strip → highlight in preview AND code.
  const handleElementChipClick = useCallback(
    (ccId: string) => {
      window.postMessage(
        { type: "cc-highlight-request", ccId },
        window.location.origin
      );
      revealCcInCode(ccId);
    },
    [revealCcInCode]
  );
  const [showTemplates, setShowTemplates] = useState(false);
  const [showComponents, setShowComponents] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  // Which source feeds the workspace: the drawing canvas, or an uploaded image.
  // When "upload", the center column swaps CanvasSurface for UploadedSketchPanel
  // (same slot) and the uploaded image drives generation instead of the canvas.
  const [inputSource, setInputSource] = useState<"canvas" | "upload">("canvas");
  const [uploadedPreview, setUploadedPreview] =
    useState<UploadDetectionPayload | null>(null);

  // ── Multi-screen flows (App Uplift feature A) ──
  // The ACTIVE screen lives in the page's existing live state (canvas history,
  // generatedCode/editedCode, detectedElements); entries in `screens` are
  // snapshots that get refreshed on tab switch and on persist. Single-screen
  // projects never touch any of this — the tab strip renders one tab and the
  // request/persist payloads stay byte-identical to the pre-A shape.
  const [screens, setScreens] = useState<ScreenSnapshot[]>([
    { id: "screen-1", name: "Home", canvasData: null, generatedCode: "" },
  ]);
  const [activeScreenId, setActiveScreenId] = useState("screen-1");
  // runGeneration reads screens through this ref so adding/renaming screens
  // does not recreate the (heavy) generation callback.
  const screensRef = useRef({ screens, activeScreenId });
  useEffect(() => {
    screensRef.current = { screens, activeScreenId };
  }, [screens, activeScreenId]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const exportOpenedByTourRef = useRef(false);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Layers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [layers, setLayers] = useState<Layer[]>([
    {
      id: "layer-1",
      name: "Layer 1",
      type: "pen",
      visible: true,
      locked: false,
      opacity: 1,
    },
  ]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(
    "layer-1"
  );

  // Ã¢â€â‚¬Ã¢â€â‚¬ Tool properties Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [fillColor, setFillColor] = useState("transparent");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [zoom, setZoom] = useState(100);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Project saving Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const {
    saveProject,
    updateProject,
    updateProjectTitle,
    loadProject,
    isSaving: isManualSaving,
    lastSaved,
    error,
  } = useProjectSave();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [originalProjectName, setOriginalProjectName] =
    useState("Untitled Project");
  const [isSavingName, setIsSavingName] = useState(false);
  const [currentProject, setCurrentProject] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Code / AI Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [editedCode, setEditedCode] = useState("");
  const [codeViewMode, setCodeViewMode] = useState<CodeViewMode>("code");
  const [codeLanguage] = useState<"html" | "css" | "javascript" | "typescript">(
    "javascript"
  );
  const [detectedElements, setDetectedElements] = useState<
    Array<{ type: string; bounds: unknown }>
  >([]);
  const [usedFallback, setUsedFallback] = useState(false);

  // Keep the incremental-regen mirror (declared above) current with the
  // latest code (incl. chat/manual edits) and detection set. The generation
  // CONTEXT fields (framework, brandKitKey) are deliberately NOT synced here:
  // flipping the framework pill or editing the brand kit does not change what
  // the existing code was generated with — updating them live would defeat
  // the payload gate that forces a full regen on context change.
  useEffect(() => {
    const code = editedCode || generatedCode;
    if (code && detectedElements.length > 0) {
      previousGenRef.current = {
        ...previousGenRef.current,
        code,
        elements: detectedElements,
      };
    }
  }, [editedCode, generatedCode, detectedElements]);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  // Fidelity self-check: the backend renders the generated code headless,
  // re-runs the sketch detector on the render, and scores the boxes against
  // the original detections. Null = not scored (endpoint off / failed).
  const [fidelity, setFidelity] = useState<{
    score: number;
    missing: number;
    extra: number;
    // Pre-repair score, present only after an auto-repair pass ran.
    before?: number;
  } | null>(null);
  const [isScoringFidelity, setIsScoringFidelity] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  // HITL detection review (roadmap idea #4): detection runs first (/api/detect),
  // the boxes open in an overlay for correction, and only the reviewed set goes
  // to generation. Null = no review in progress.
  const [isDetecting, setIsDetecting] = useState(false);
  const [reviewSession, setReviewSession] = useState<{
    image: string;
    imageWidth: number;
    imageHeight: number;
    elements: ReviewElement[];
    generationOpts: RunGenerationOpts;
  } | null>(null);

  // Ã¢â€â‚¬Ã¢â€â‚¬ History & versions Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const history = useHistory({
    initialState: {
      lines: [],
      shapes: [],
      componentGroups: [],
    } as CanvasData,
    maxHistory: 50,
  });
  const { isSaving: isAutoSaving } = useAutoSave(
    currentProject?.id || null,
    history.state
  );
  const isSaving = isManualSaving || isAutoSaving;
  const versionHistory = useVersionHistory();
  const [checkpointToDelete, setCheckpointToDelete] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [isDeletingCheckpoint, setIsDeletingCheckpoint] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Refs Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const canvasRef = useRef<SketchCanvasWithHistoryRef>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const codePanelDragRef = useRef(false);
  const codePanelRef = useRef<HTMLDivElement>(null);
  const codePanelHeightRef = useRef(350);
  const mainRef = useRef<HTMLElement>(null);
  const [canvasArea, setCanvasArea] = useState({ width: 0, height: 0 });

  // Ã¢â€â‚¬Ã¢â€â‚¬ User Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [userProfile, setUserProfile] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const lastOnboardingUserIdRef = useRef<string | null>(null);

  const onboardingSteps = useMemo<OnboardingStep[]>(
    () => [
      {
        id: "draw",
        title: "Draw Your UI",
        description:
          "Use the drawing tools to create wireframes, layouts, or UI sketches.",
        targetSelector: "[data-onboarding='draw-tools']",
        placement: "right",
      },
      {
        id: "generate",
        title: "Generate Frontend Code",
        description:
          "Click Generate to convert your sketch into frontend code using AI.",
        targetSelector: "[data-onboarding='generate-action']",
        placement: "bottom",
      },
      {
        id: "export",
        title: "Export Your Code",
        description: "Preview, copy, or export your generated frontend code.",
        targetSelector: "[data-onboarding='export-dialog']",
        placement: "bottom",
      },
    ],
    []
  );

  // Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
  // Effects
  // Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

  // Auto-open PROPS tab when a drawing tool is selected so users discover
  // the style controls (color / width / fill / opacity). Also un-collapses
  // the toolbox if it was collapsed, since setting rightPanel to a non-null
  // value implicitly expands it. Runs on mount too because the initial tool
  // is "pen".
  useEffect(() => {
    const DRAWING_TOOLS: Tool[] = [
      "pen",
      "line",
      "rectangle",
      "button",
      "erase",
    ];
    if (DRAWING_TOOLS.includes(currentTool)) {
      setRightPanel("properties");
    }
  }, [currentTool]);

  // Fetch user
  useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { user: u },
        } = await supabase.auth.getUser();
        if (u) {
          setUser({ id: u.id, email: u.email ?? undefined });
          const { data: profile } = await supabase
            .from("profiles")
            .select("onboarding_completed")
            .eq("id", u.id)
            .single();
          if (profile) setUserProfile(profile as Record<string, unknown>);
        } else {
          setUserProfile(null);
        }
      } catch {
        setUser(null);
        setUserProfile(null);
      } finally {
        setProfileLoaded(true);
      }
    };
    getUser();
  }, [supabase]);

  const getOnboardingSeenKey = (userId: string | null) =>
    `${ONBOARDING_STORAGE_PREFIX}:${userId ?? "anon"}`;
  const getOnboardingPendingKey = (userId: string | null) =>
    `${ONBOARDING_PENDING_PREFIX}:${userId ?? "anon"}`;
  const getOnboardingLocalKey = (userId: string | null) =>
    `${ONBOARDING_LOCAL_PREFIX}:${userId ?? "anon"}`;

  // First-time onboarding (user-scoped)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!profileLoaded) return;
    const resolvedUserId = user?.id ?? null;
    if (!resolvedUserId) return;
    if (lastOnboardingUserIdRef.current === resolvedUserId) {
      return;
    }
    lastOnboardingUserIdRef.current = resolvedUserId;

    const seenKey = getOnboardingSeenKey(resolvedUserId);
    const pendingKey = getOnboardingPendingKey(resolvedUserId);
    const localKey = getOnboardingLocalKey(resolvedUserId);
    const hasSeen = window.localStorage.getItem(seenKey);
    const pending = window.localStorage.getItem(pendingKey);
    const localSeen = window.localStorage.getItem(localKey);
    const profileCompleted = Boolean(
      userProfile &&
      (userProfile as { onboarding_completed?: boolean }).onboarding_completed
    );

    if (window.localStorage.getItem(ONBOARDING_DEBUG_KEY) === "true") {
      console.debug("[onboarding]", "init", {
        userId: resolvedUserId,
        seenKey,
        pendingKey,
        localKey,
        hasSeen,
        pending,
        localSeen,
        profileCompleted,
      });
    }

    if (pending) {
      window.localStorage.removeItem(pendingKey);
    }

    if (!profileCompleted && !hasSeen && !localSeen) {
      setShowOnboarding(true);
      setOnboardingStep(0);
    }
  }, [profileLoaded, user?.id, userProfile]);

  useEffect(() => {
    if (!showOnboarding) {
      if (exportOpenedByTourRef.current) {
        setShowExport(false);
        exportOpenedByTourRef.current = false;
      }
      return;
    }

    if (onboardingStep === 2 && !showExport) {
      exportOpenedByTourRef.current = true;
      setShowExport(true);
      return;
    }

    if (onboardingStep !== 2 && exportOpenedByTourRef.current) {
      setShowExport(false);
      exportOpenedByTourRef.current = false;
    }
  }, [onboardingStep, showExport, showOnboarding]);

  // Import mini-canvas design
  useEffect(() => {
    const fromMini = searchParams.get("fromMini");
    if (fromMini === "true") {
      const savedDesign = localStorage.getItem("miniCanvasDesign");
      if (savedDesign) {
        setImportedDesign(JSON.parse(savedDesign));
        setShowWelcomeDialog(true);
      }
    }
  }, [searchParams]);

  // Load project from URL
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      const load = async () => {
        const project = await loadProject(id);
        if (project) {
          setCurrentProject({ id: project.id, name: project.title });
          setProjectName(project.title);
          setOriginalProjectName(project.title);
          recordProjectActivity(project.id, "opened");
          {
            // Restore the project's brand kit so regenerations keep the
            // user's tokens without reopening the modal.
            const kit =
              (project as { brand_kit?: BrandKit | null }).brand_kit ?? null;
            brandKitRef.current = kit;
            setBrandKit(kit);
          }
          if (project.canvas_data) {
            const cd = project.canvas_data as CanvasData;
            // Multi-screen project: restore the whole tab set. The top-level
            // canvas_data mirrors the screen that was ACTIVE at save time, so
            // the upload/canvas restore below still loads the right workspace.
            if (cd.screens && cd.screens.length > 0) {
              setScreens(cd.screens);
              const active =
                cd.screens.find((s) => s.id === cd.activeScreenId) ??
                cd.screens[0];
              setActiveScreenId(active.id);
              if (active.detectedElements) {
                setDetectedElements(active.detectedElements);
              }
            }
            // Upload-based project: the sketch is a stored image, not drawn
            // strokes. Restore the upload workspace so a reload (or opening
            // the ?id= URL in a new tab) shows the image again instead of an
            // empty canvas.
            if (cd.uploadedSketch?.dataUrl) {
              setUploadedPreview({
                dataUrl: cd.uploadedSketch.dataUrl,
                source: cd.uploadedSketch.source,
                width: cd.uploadedSketch.width,
                height: cd.uploadedSketch.height,
              });
              setInputSource("upload");
              // PROPS tab is canvas-only; mirror handleUploadDetection.
              setRightPanel((p) => (p === "properties" ? null : p));
            }
            const hasContent =
              (cd.lines?.length ?? 0) > 0 ||
              (cd.shapes?.length ?? 0) > 0 ||
              (cd.componentGroups?.length ?? 0) > 0;
            if (hasContent) {
              // Normalize to exactly the three keys the wrapper's JSON
              // comparison tracks. Raw canvas_data also carries width/height,
              // which would otherwise make every comparison report a diff.
              history.setState({
                lines: cd.lines ?? [],
                shapes: cd.shapes ?? [],
                componentGroups: cd.componentGroups ?? [],
              });
              setHasUserInteracted(true);
            }
          }
          if (project.generated_code) {
            setGeneratedCode(project.generated_code);
            setEditedCode(project.generated_code);
          }
        }
      };
      load();
    }
  }, [searchParams, loadProject]);

  // Load version history
  useEffect(() => {
    const projectId = currentProject?.id;
    if (projectId && !projectId.startsWith("temp-")) {
      versionHistory.fetchVersions(projectId);
    }
  }, [currentProject?.id, versionHistory.fetchVersions]);

  // What should be written to the projects row right now. In canvas mode
  // that's the live Konva state; in upload mode the canvas is unmounted
  // (canvasRef is null), so build a stub carrying the uploaded image instead —
  // otherwise Ctrl+S and post-chat persistence silently no-op after an upload.
  const getRawCanvasData = useCallback((): CanvasData | null => {
    if (inputSource === "upload" && uploadedPreview) {
      return {
        lines: [],
        shapes: [],
        componentGroups: [],
        uploadedSketch: {
          dataUrl: uploadedPreview.dataUrl,
          source: uploadedPreview.source,
          width: uploadedPreview.width,
          height: uploadedPreview.height,
        },
      };
    }
    return canvasRef.current?.getCanvasData() ?? null;
  }, [inputSource, uploadedPreview]);

  // Multi-screen: what handleSaveProject / chat / annotate persist. With one
  // screen this is the raw data (unchanged legacy shape). With 2+ screens the
  // ACTIVE screen's snapshot is refreshed from live state, the whole tab set
  // rides in `screens`, and the top-level fields still mirror the active
  // screen so thumbnails/share/older restores keep working.
  const getPersistableCanvasData = useCallback((): CanvasData | null => {
    const raw = getRawCanvasData();
    if (screens.length <= 1) return raw;
    const updatedScreens = screens.map((s) =>
      s.id === activeScreenId
        ? {
            ...s,
            canvasData: raw,
            generatedCode: editedCode || generatedCode,
            detectedElements:
              detectedElements as ScreenSnapshot["detectedElements"],
          }
        : s
    );
    return {
      ...(raw ?? { lines: [], shapes: [], componentGroups: [] }),
      screens: updatedScreens,
      activeScreenId,
    };
  }, [
    getRawCanvasData,
    screens,
    activeScreenId,
    editedCode,
    generatedCode,
    detectedElements,
  ]);

  // ── Multi-screen tab handlers ──
  const activeScreenName =
    screens.find((s) => s.id === activeScreenId)?.name ?? "Home";

  /** Snapshot the active screen's live state into the screens array. */
  const captureActiveScreen = useCallback(
    (list: ScreenSnapshot[]): ScreenSnapshot[] =>
      list.map((s) =>
        s.id === activeScreenId
          ? {
              ...s,
              canvasData: getRawCanvasData(),
              generatedCode: editedCode || generatedCode,
              detectedElements:
                detectedElements as ScreenSnapshot["detectedElements"],
            }
          : s
      ),
    [
      activeScreenId,
      getRawCanvasData,
      editedCode,
      generatedCode,
      detectedElements,
    ]
  );

  /** Load a screen snapshot into the live workspace (canvas or upload view). */
  const loadScreenIntoWorkspace = useCallback(
    (screen: ScreenSnapshot) => {
      const cd = screen.canvasData;
      if (cd?.uploadedSketch?.dataUrl) {
        setUploadedPreview({
          dataUrl: cd.uploadedSketch.dataUrl,
          source: cd.uploadedSketch.source,
          width: cd.uploadedSketch.width,
          height: cd.uploadedSketch.height,
        });
        setInputSource("upload");
        setRightPanel((p) => (p === "properties" ? null : p));
      } else {
        setInputSource("canvas");
        setUploadedPreview(null);
        // Unlike restoreCanvasSnapshot this DELIBERATELY clears on an empty
        // snapshot — switching to a fresh screen must show a blank canvas,
        // not the previous screen's strokes.
        //
        // Load imperatively (loadState) rather than via history.setState: the
        // latter only updates history and waits for the wrapper's apply-effect
        // to push it into the canvas after paint, leaving a window where the
        // 500ms canvas->history poll copies the OUTGOING screen's strokes back
        // over the load (cross-screen sketch bleed). loadState sets the poll
        // guard synchronously and replaces the canvas in one shot.
        const nextState = {
          lines: cd?.lines ?? [],
          shapes: cd?.shapes ?? [],
          componentGroups: cd?.componentGroups ?? [],
        };
        if (canvasRef.current?.loadState) {
          canvasRef.current.loadState(nextState);
        } else {
          history.setState(nextState);
        }
        const hasContent =
          (cd?.lines?.length ?? 0) > 0 ||
          (cd?.shapes?.length ?? 0) > 0 ||
          (cd?.componentGroups?.length ?? 0) > 0;
        setHasUserInteracted(hasContent);
      }
      const code = screen.generatedCode || "";
      setGeneratedCode(code);
      setEditedCode(code);
      setDetectedElements(screen.detectedElements ?? []);
      setFidelity(null);
      // Reset the incremental-regen mirror to THIS screen's last generation,
      // otherwise the next generation diffs against another screen's elements.
      previousGenRef.current = {
        code,
        elements: screen.detectedElements ?? [],
        framework: selectedFramework,
        brandKitKey: JSON.stringify(brandKitRef.current ?? null),
      };
    },
    // history.setState is stable (useHistory memoizes it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history.setState, selectedFramework]
  );

  const handleSelectScreen = useCallback(
    (id: string) => {
      if (id === activeScreenId) return;
      const target = screens.find((s) => s.id === id);
      if (!target) return;
      setScreens((prev) => captureActiveScreen(prev));
      loadScreenIntoWorkspace(target);
      setActiveScreenId(id);
    },
    [activeScreenId, screens, captureActiveScreen, loadScreenIntoWorkspace]
  );

  const handleAddScreen = useCallback(() => {
    const fresh: ScreenSnapshot = {
      id: `screen-${Date.now()}`,
      name: `Screen ${screens.length + 1}`,
      canvasData: null,
      generatedCode: "",
    };
    setScreens((prev) => [...captureActiveScreen(prev), fresh]);
    loadScreenIntoWorkspace(fresh);
    setActiveScreenId(fresh.id);
    toast.info(
      `Buttons labeled with a screen's name (like "${activeScreenName}") become navigation links between screens.`,
      { title: "Screen added" }
    );
  }, [
    screens.length,
    captureActiveScreen,
    loadScreenIntoWorkspace,
    toast,
    activeScreenName,
  ]);

  const handleRenameScreen = useCallback((id: string, name: string) => {
    setScreens((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  }, []);

  const handleDeleteScreen = useCallback(
    (id: string) => {
      if (screens.length <= 1) return;
      const doomed = screens.find((s) => s.id === id);
      if (!doomed) return;
      setScreenToDelete({ id: doomed.id, name: doomed.name });
    },
    [screens]
  );

  const confirmDeleteScreen = useCallback(() => {
    if (!screenToDelete) return;
    const id = screenToDelete.id;
    setScreenToDelete(null);
    if (screens.length <= 1) return;
    const remaining = screens.filter((s) => s.id !== id);
    if (remaining.length === screens.length) return;
    setScreens(remaining);
    if (id === activeScreenId) {
      loadScreenIntoWorkspace(remaining[0]);
      setActiveScreenId(remaining[0].id);
    }
  }, [screenToDelete, screens, activeScreenId, loadScreenIntoWorkspace]);

  // Generated code called window.ccNavigate("Name") inside the preview.
  const handlePreviewNavigate = useCallback(
    (screenName: string) => {
      const wanted = screenName.trim().toLowerCase();
      const target = screens.find(
        (s) => s.name.trim().toLowerCase() === wanted
      );
      if (target) handleSelectScreen(target.id);
    },
    [screens, handleSelectScreen]
  );

  // Save project handler
  const handleSaveProject = useCallback(async () => {
    const canvasData = getPersistableCanvasData();
    if (!canvasData) return;

    const codeToSave = editedCode || generatedCode || undefined;

    if (currentProject?.id && !currentProject.id.startsWith("temp-")) {
      const success = await updateProject(
        currentProject.id,
        canvasData,
        undefined,
        codeToSave
      );
      if (success) {
        console.log("Project saved successfully");
      }
    } else {
      const newId = await saveProject(
        projectName || "Untitled Project",
        canvasData,
        undefined,
        codeToSave
      );
      if (newId) {
        setCurrentProject({
          id: newId,
          name: projectName || "Untitled Project",
        });
        window.history.replaceState({}, "", `/canvas?id=${newId}`);
        recordProjectActivity(newId, "created");
      }
    }
  }, [
    currentProject,
    projectName,
    saveProject,
    updateProject,
    editedCode,
    generatedCode,
    getPersistableCanvasData,
  ]);

  const ensureGenerationProject = useCallback(
    async (canvasData: CanvasData): Promise<string | null> => {
      if (currentProject?.id && !currentProject.id.startsWith("temp-")) {
        return currentProject.id;
      }

      const title = projectName.trim() || "Untitled Project";
      const projectId = await saveProject(title, canvasData);

      if (projectId) {
        setCurrentProject({ id: projectId, name: title });
        window.history.replaceState({}, "", `/canvas?id=${projectId}`);
        recordProjectActivity(projectId, "created");
      }

      return projectId;
    },
    [currentProject?.id, projectName, saveProject]
  );

  // Ã¢â€â‚¬Ã¢â€â‚¬ Keyboard shortcuts Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // Listen for the command-palette redirect — when a user picks "Keyboard
  // shortcuts" from Ctrl+K, the palette closes and asks us to open the
  // migrated ShortcutsPanel (single source of truth, drafting room theme).
  useEffect(() => {
    const onOpen = () => setShowShortcuts(true);
    window.addEventListener(SHORTCUTS_PANEL_EVENT, onOpen);
    return () => window.removeEventListener(SHORTCUTS_PANEL_EVENT, onOpen);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowShortcuts((p) => !p);
        return;
      }

      // Single-key tool shortcuts
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        const map: Record<string, Tool> = {
          v: "select",
          h: "hand",
          p: "pen",
          n: "line",
          r: "rectangle",
          b: "button",
          t: "text",
          e: "erase",
          x: "bin",
        };
        const tool = map[e.key.toLowerCase()];
        if (tool) {
          setCurrentTool(tool);
          return;
        }
      }

      // Ctrl combos
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "\\") {
          e.preventDefault();
          setRightPanel((p) => (p ? null : "properties"));
        }
        if (e.key === "`") {
          e.preventDefault();
          setShowCodePanel((p) => !p);
        }
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          history.undo();
        }
        if (e.key === "z" && e.shiftKey) {
          e.preventDefault();
          history.redo();
        }
        if (e.key === "y") {
          e.preventDefault();
          history.redo();
        }
        if (e.key === "=") {
          e.preventDefault();
          setZoom((z) => clampZoom(z + ZOOM_STEP));
        }
        if (e.key === "-") {
          e.preventDefault();
          setZoom((z) => clampZoom(z - ZOOM_STEP));
        }
        if (e.key === "0") {
          e.preventDefault();
          setZoom(ZOOM_DEFAULT);
        }
        if (e.key === "s") {
          e.preventDefault();
          handleSaveProject();
        }
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [history, handleSaveProject]);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Scroll-wheel zoom Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -5 : 5;
        setZoom((z) => clampZoom(z + delta));
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  // ── Track canvas-area size for the status bar ────────────────────
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const sync = () => {
      const r = el.getBoundingClientRect();
      setCanvasArea({
        width: Math.round(r.width),
        height: Math.round(r.height),
      });
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
  // Handlers
  // Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

  const handleSaveProjectName = async () => {
    if (!currentProject?.id || !projectName.trim()) return;
    setIsSavingName(true);
    try {
      const success = await updateProjectTitle(
        currentProject.id,
        projectName.trim()
      );
      if (success) {
        setCurrentProject({ ...currentProject, name: projectName.trim() });
        setOriginalProjectName(projectName.trim());
      }
    } finally {
      setIsSavingName(false);
    }
  };

  const handleChatMessage = async (message: string): Promise<string> => {
    // Sketch-first workflow: block chat if no code exists
    const currentCode = editedCode || generatedCode;
    if (!currentCode) {
      return "Please draw a sketch and generate code first. I can only refine existing code.";
    }

    setIsGenerating(true);
    try {
      const response = await fetch(GENERATE_CODE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "chat",
          messages: [{ role: "user", content: message }],
          currentCode,
          projectId: currentProject?.id,
          framework: selectedFramework,
          styling: "tailwind",
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(
          err?.error || err?.detail || "Failed to process request"
        );
      }
      const result = await response.json();
      setGeneratedCode(result.code);
      setEditedCode(result.code);
      // Ensure code panel is visible so user sees the update
      setShowCodePanel(true);
      // Persist updated code immediately so it survives a reload.
      if (currentProject?.id && !currentProject.id.startsWith("temp-")) {
        const currentCanvasData = getPersistableCanvasData();
        if (currentCanvasData) {
          void updateProject(
            currentProject.id,
            currentCanvasData,
            undefined,
            result.code
          );
        }
      }
      return (
        result.message ||
        "Done! I've updated the code. Check the code panel below."
      );
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  // Annotate-on-render refinement (feature B): the user drew markup on the
  // live preview and wrote an instruction; LivePreview resolved the markup to
  // data-cc-id targets. One targeted Gemini call applies it.
  const handleAnnotateRefine = async (
    payload: AnnotatePayload
  ): Promise<boolean> => {
    const currentCode = editedCode || generatedCode;
    if (!currentCode) return false;
    if (!currentProject?.id || currentProject.id.startsWith("temp-")) {
      toast.warning("Save the project first to use annotation refinement.", {
        title: "Project not saved",
      });
      return false;
    }
    setIsGenerating(true);
    try {
      const response = await fetch("/api/annotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: currentProject.id,
          code: currentCode,
          framework: selectedFramework,
          note: payload.note,
          targets: payload.targets,
          region: payload.region,
          width: payload.width,
          height: payload.height,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || "Annotation refinement failed");
      }
      const result = await response.json();
      setGeneratedCode(result.code);
      setEditedCode(result.code);
      setShowCodePanel(true);
      // Persist so the refined code survives a reload (same as chat).
      const currentCanvasData = getPersistableCanvasData();
      if (currentCanvasData) {
        void updateProject(
          currentProject.id,
          currentCanvasData,
          undefined,
          result.code
        );
      }
      toast.success(
        payload.targets.length > 0
          ? `Applied to ${payload.targets.length} marked element${payload.targets.length === 1 ? "" : "s"}.`
          : "Applied to the marked region.",
        { title: "Annotation applied" }
      );
      return true;
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Annotation refinement failed",
        { title: "Annotation failed" }
      );
      return false;
    } finally {
      setIsGenerating(false);
    }
  };

  // Version history
  const handleCreateCheckpoint = async () => {
    if (!currentProject?.id) {
      toast.warning("Save the project first to create a checkpoint.", {
        title: "Project not saved",
      });
      return;
    }
    // TODO: replace with a custom modal that allows naming a checkpoint;
    // window.prompt is intentionally avoided. For now, use a default label.
    const description = `Checkpoint ${new Date().toLocaleString()}`;
    const canvasData = canvasRef.current?.getCanvasData();
    if (canvasData) {
      await versionHistory.createVersion(
        currentProject.id,
        canvasData,
        description
      );
      toast.success("Checkpoint created.", { title: "Saved" });
    }
  };
  // Restore a canvas_data snapshot into the workspace. Handles BOTH input
  // modes: an upload-based snapshot re-opens the upload workspace with the
  // stored image; a drawn snapshot goes through history.setState (the same
  // path the ?id= loader uses) so the strokes actually re-render, and flips
  // back to canvas mode if the user was in the upload view.
  const restoreCanvasSnapshot = (cd: CanvasData | null | undefined) => {
    if (!cd) return;
    // Multi-screen snapshot: bring back the whole tab set as of that save.
    if (cd.screens && cd.screens.length > 0) {
      setScreens(cd.screens);
      const active =
        cd.screens.find((s) => s.id === cd.activeScreenId) ?? cd.screens[0];
      setActiveScreenId(active.id);
      // Top-level fields mirror the active screen; fall through to the
      // regular restore below so its workspace loads too.
    }
    if (cd.uploadedSketch?.dataUrl) {
      setUploadedPreview({
        dataUrl: cd.uploadedSketch.dataUrl,
        source: cd.uploadedSketch.source,
        width: cd.uploadedSketch.width,
        height: cd.uploadedSketch.height,
      });
      setInputSource("upload");
      setRightPanel((p) => (p === "properties" ? null : p));
      return;
    }
    const hasContent =
      (cd.lines?.length ?? 0) > 0 ||
      (cd.shapes?.length ?? 0) > 0 ||
      (cd.componentGroups?.length ?? 0) > 0;
    if (!hasContent) return;
    setInputSource("canvas");
    setUploadedPreview(null);
    history.setState({
      lines: cd.lines ?? [],
      shapes: cd.shapes ?? [],
      componentGroups: cd.componentGroups ?? [],
    });
    setHasUserInteracted(true);
  };

  const handleRestoreVersion = async (versionId: string) => {
    const version = await versionHistory.restoreVersion(versionId);
    if (!version) {
      toast.error("Could not load that checkpoint.", {
        title: "Restore failed",
      });
      return;
    }
    // Same treatment as the compare-modal rollback: restore the code (when
    // the iteration has one — manual checkpoints store an empty string) and
    // the canvas snapshot. Previously this restored the canvas only, so a
    // toolbox click looked like it did nothing to the code panel.
    if (version.generated_code) {
      setGeneratedCode(version.generated_code);
      setEditedCode("");
      setShowCodePanel(true);
    }
    restoreCanvasSnapshot(version.canvas_data as CanvasData | null);
    toast.success(`Restored version ${version.version_number}.`, {
      title: "Checkpoint restored",
    });
  };
  const handleDeleteVersion = async (versionId: string) => {
    await versionHistory.deleteVersion(versionId);
  };
  // Rollback from the compare modal: restore the iteration's code into the
  // editor (clearing manual edits) and its canvas snapshot when it has one.
  const handleRollbackVersion = (version: ProjectVersion) => {
    if (version.generated_code) {
      setGeneratedCode(version.generated_code);
      setEditedCode("");
      setShowCodePanel(true);
    }
    restoreCanvasSnapshot(version.canvas_data as CanvasData | null);
    setShowVersionCompare(false);
    toast.success(`Rolled back to version ${version.version_number}.`, {
      title: "Version restored",
    });
  };
  const confirmDeleteCheckpoint = async () => {
    if (!checkpointToDelete || isDeletingCheckpoint) return;
    setIsDeletingCheckpoint(true);
    const ok = await versionHistory.deleteVersion(checkpointToDelete.id);
    setIsDeletingCheckpoint(false);
    if (ok) {
      toast.success("Checkpoint deleted.", { title: "Removed" });
      setCheckpointToDelete(null);
    } else {
      toast.error("Could not delete the checkpoint.", {
        title: "Delete failed",
      });
    }
  };

  const persistOnboardingCompletion = useCallback(async () => {
    if (!user?.id) return;
    try {
      await supabase.from("profiles").upsert(
        {
          id: user.id,
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
      setUserProfile({ onboarding_completed: true });
    } catch (error) {
      console.error("Failed to persist onboarding completion:", error);
    }
  }, [supabase, user?.id]);

  const handleOnboardingSkip = useCallback(() => {
    if (typeof window !== "undefined") {
      const seenKey = getOnboardingSeenKey(user?.id ?? null);
      const pendingKey = getOnboardingPendingKey(user?.id ?? null);
      const localKey = getOnboardingLocalKey(user?.id ?? null);
      window.localStorage.setItem(seenKey, "true");
      window.localStorage.setItem(localKey, "true");
      window.localStorage.removeItem(pendingKey);
    }
    void persistOnboardingCompletion();
    setShowOnboarding(false);
    setOnboardingStep(0);
  }, [persistOnboardingCompletion, user?.id]);

  const handleOnboardingFinish = useCallback(() => {
    if (typeof window !== "undefined") {
      const seenKey = getOnboardingSeenKey(user?.id ?? null);
      const pendingKey = getOnboardingPendingKey(user?.id ?? null);
      const localKey = getOnboardingLocalKey(user?.id ?? null);
      window.localStorage.setItem(seenKey, "true");
      window.localStorage.setItem(localKey, "true");
      window.localStorage.removeItem(pendingKey);
    }
    void persistOnboardingCompletion();
    setShowOnboarding(false);
    setOnboardingStep(0);
  }, [persistOnboardingCompletion, user?.id]);

  const handleOnboardingNext = useCallback(() => {
    setOnboardingStep((step) => Math.min(step + 1, onboardingSteps.length - 1));
  }, [onboardingSteps.length]);

  const handleOnboardingBack = useCallback(() => {
    setOnboardingStep((step) => Math.max(step - 1, 0));
  }, []);

  // Layers
  const handleSelectLayer = (id: string) => setSelectedLayerId(id);
  const handleToggleVisibility = (id: string) =>
    setLayers((p) =>
      p.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
    );
  const handleToggleLock = (id: string) =>
    setLayers((p) =>
      p.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l))
    );
  const handleDeleteLayer = (id: string) => {
    setLayers((p) => p.filter((l) => l.id !== id));
    if (selectedLayerId === id) setSelectedLayerId(layers[0]?.id || null);
  };
  const handleDuplicateLayer = (id: string) => {
    const l = layers.find((x) => x.id === id);
    if (l)
      setLayers((p) => [
        ...p,
        { ...l, id: `layer-${Date.now()}`, name: `${l.name} Copy` },
      ]);
  };
  const handleRenameLayer = (id: string, name: string) =>
    setLayers((p) => p.map((l) => (l.id === id ? { ...l, name } : l)));

  // Export
  const handleExport = async (options: ExportOptions) => {
    const baseName = projectName?.trim() || "canvas";
    const code = editedCode || generatedCode || "";
    // Multi-screen export: the active screen's code is the LIVE one (its
    // snapshot may be stale); the rest come from their snapshots. Only screens
    // with code count — buildReactScaffoldFiles falls back to single-App when
    // fewer than two carry code.
    const exportScreens =
      screens.length > 1
        ? screens.map((s) => ({
            name: s.name,
            code: s.id === activeScreenId ? code : s.generatedCode,
          }))
        : undefined;

    const downloadBlob = (blob: Blob, filename: string) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    };

    if (options.format === "png") {
      const result = canvasRef.current?.exportAsPNG();
      if (!result?.dataURL) {
        toast.error("Could not capture the canvas image.", {
          title: "Export failed",
        });
        return;
      }
      const a = document.createElement("a");
      a.href = result.dataURL;
      a.download = `${baseName}.png`;
      a.click();
      return;
    }

    if (options.format === "svg") {
      // Konva does not emit native SVG, so wrap the PNG export inside an SVG
      // envelope. Result is a valid .svg that opens in any viewer and scales
      // without re-rasterising the wrapper (raster bitmap is still embedded).
      const result = canvasRef.current?.exportAsPNG();
      if (!result?.dataURL) {
        toast.error("Could not capture the canvas image.", {
          title: "Export failed",
        });
        return;
      }
      const img = new Image();
      img.onload = () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${img.width}" height="${img.height}" viewBox="0 0 ${img.width} ${img.height}"><image href="${result.dataURL}" width="${img.width}" height="${img.height}"/></svg>`;
        downloadBlob(
          new Blob([svg], { type: "image/svg+xml" }),
          `${baseName}.svg`
        );
      };
      img.onerror = () => {
        toast.error("Could not build the SVG file.", {
          title: "Export failed",
        });
      };
      img.src = result.dataURL;
      return;
    }

    if (options.format === "json") {
      const canvasData = canvasRef.current?.getCanvasData() ?? null;
      const payload = {
        projectName: baseName,
        exportedAt: new Date().toISOString(),
        framework: options.framework ?? null,
        styling: options.styling ?? null,
        code,
        canvas: canvasData,
      };
      downloadBlob(
        new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        }),
        `${baseName}.json`
      );
      return;
    }

    if (options.format === "zip") {
      if (!code) {
        toast.warning("Generate code first, then export.", {
          title: "Nothing to export",
        });
        return;
      }
      try {
        const blob = await buildExportZip({
          code,
          framework: options.framework ?? "react",
          styling: options.styling ?? "tailwind",
          projectName: baseName,
          screens: exportScreens,
        });
        downloadBlob(blob, `${baseName}.zip`);
      } catch (err) {
        console.error("ZIP export failed:", err);
        toast.error("Could not build the ZIP file.", {
          title: "Export failed",
        });
      }
      return;
    }

    if (options.format === "stackblitz") {
      if (!code) {
        toast.warning("Generate code first, then export.", {
          title: "Nothing to export",
        });
        return;
      }
      openInStackBlitz({
        code,
        framework: options.framework ?? "react",
        styling: options.styling ?? "tailwind",
        projectName: baseName,
        screens: exportScreens,
      });
      return;
    }
  };

  // Templates & components
  const handleInsertTemplate = (template: Template) => {
    if (canvasRef.current) {
      canvasRef.current.insertTemplate(template.canvasData);
      setHasUserInteracted(true);
    }
  };
  const handleInsertComponent = (component: { canvasData: unknown }) => {
    if (canvasRef.current) {
      canvasRef.current.insertTemplate(
        component.canvasData as Parameters<
          SketchCanvasWithHistoryRef["insertTemplate"]
        >[0]
      );
      setHasUserInteracted(true);
    }
  };

  const handleFitToScreen = () => setZoom(100);

  // Detection / AI
  //
  // Fidelity self-check, fired after a successful generation. Non-blocking:
  // the code panel is already usable while this runs, and any failure is
  // silent (the badge simply does not appear). The backend renders the code
  // headless, re-detects with the same Roboflow model, and returns an F1-style
  // score against the original detections.
  //
  // When the score lands below REPAIR_THRESHOLD, one auto-repair pass runs:
  // the mismatch report goes back to Gemini as a surgical fix instruction,
  // the repaired code replaces the panel content, and a re-score (repair
  // disabled — exactly one pass per generation) shows before -> after.
  const scoreFidelity = useCallback(async function scoreRun(opts: {
    projectId: string;
    code: string;
    framework: string;
    elements: Array<{ type: string; bounds: unknown }>;
    sketchImage: string;
    allowRepair: boolean;
    before?: number;
  }): Promise<void> {
    setIsScoringFidelity(true);
    try {
      const { width, height } = await getImageSize(opts.sketchImage);
      const response = await fetch(FIDELITY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: opts.projectId,
          code: opts.code,
          framework: opts.framework,
          elements: opts.elements,
          width,
          height,
        }),
      });
      if (!response.ok) return;
      const result = await response.json();
      if (typeof result.score !== "number") return;
      const missing: Array<Record<string, unknown>> =
        result.report?.missing ?? [];
      const extra: Array<Record<string, unknown>> = result.report?.extra ?? [];
      setFidelity({
        score: result.score,
        missing: missing.length,
        extra: extra.length,
        before: opts.before,
      });

      // score === 0 means NOTHING matched — that is a systemic failure of the
      // scoring loop (render broke, coordinate mismatch, detector confused by
      // the line-art), not a partially-wrong generation. A repair prompt built
      // from a total mismatch tells Gemini to remove everything and re-add
      // everything, which rewrites the page into a stub. Only repair partial
      // mismatches.
      const needsRepair =
        opts.allowRepair &&
        result.score > 0 &&
        result.score < REPAIR_THRESHOLD &&
        missing.length + extra.length > 0;
      if (!needsRepair) return;

      setIsRepairing(true);
      try {
        const repairResponse = await fetch(REPAIR_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: opts.projectId,
            code: opts.code,
            framework: opts.framework,
            missing,
            extra,
            width,
            height,
          }),
        });
        if (!repairResponse.ok) return;
        const repaired = await repairResponse.json();
        if (typeof repaired.code !== "string" || !repaired.code.trim()) return;
        setGeneratedCode(repaired.code);
        setEditedCode(repaired.code);
        await scoreRun({
          ...opts,
          code: repaired.code,
          allowRepair: false,
          before: result.score,
        });
      } finally {
        setIsRepairing(false);
      }
    } catch {
      // Fidelity is an enhancement, never a blocker — stay quiet on failure.
    } finally {
      setIsScoringFidelity(false);
    }
  }, []);

  // Shared generation routine. Both the canvas "Run detection" path and the
  // image-upload path funnel through here so they hit the SAME detection ->
  // Gemini pipeline. The only difference is the source of `sketchImage` and the
  // `sketchSource` tag (which tells the backend whether to photo-normalize).
  const runGeneration = useCallback(
    async (opts: RunGenerationOpts) => {
      setIsGenerating(true);
      setGeneratedCode("");
      setDetectedElements([]);
      setUsedFallback(false);
      setFidelity(null);
      // Open the code panel immediately so the generation progress loader is
      // visible on EVERY path (canvas, HITL confirm, upload) — previously the
      // canvas path opened it only on success, which read as "nothing is
      // happening" after confirming the detection review.
      setShowCodePanel((prev) => {
        if (!prev) {
          // Open at the default height, not whatever the user last dragged it
          // to (e.g. a leftover maximized panel). 350 = double-click reset.
          setCodePanelHeight(350);
          codePanelHeightRef.current = 350;
        }
        return true;
      });
      const persistData = opts.persistCanvasData ?? opts.canvasData;
      try {
        const projectId = await ensureGenerationProject(persistData);
        if (!projectId) {
          throw new Error("Failed to create a project before generation");
        }

        const response = await fetch(GENERATE_CODE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "generate",
            canvasData: opts.canvasData,
            framework: opts.framework ?? "react",
            styling: "tailwind",
            description: "",
            projectId,
            sketchImage: opts.sketchImage,
            textAnnotations: opts.textAnnotations,
            sketchSource: opts.sketchSource,
            correctedElements: opts.correctedElements,
            detectionCorrections: opts.detectionCorrections,
            brandKit: brandKitRef.current ?? undefined,
            // Multi-screen flows (feature A): tell the backend which screens
            // exist and which one this generation targets, so the prompt can
            // wire label-matched nav elements to window.ccNavigate. Omitted
            // entirely for single-screen projects (legacy payload + cache key).
            ...(screensRef.current.screens.length > 1
              ? {
                  screens: screensRef.current.screens.map((s) => s.name),
                  currentScreen:
                    screensRef.current.screens.find(
                      (s) => s.id === screensRef.current.activeScreenId
                    )?.name ?? screensRef.current.screens[0].name,
                }
              : {}),
            // Incremental regen (feature D): hand the backend the prior
            // generation so it can patch instead of regenerate. Only when the
            // generation CONTEXT matches: patching React code under a Vue
            // request corrupts the output, and an unchanged sketch with a
            // changed brand kit would zero-delta back the old (wrongly
            // styled) code — both must force a full regeneration.
            ...(previousGenRef.current.code &&
            previousGenRef.current.elements.length > 0 &&
            previousGenRef.current.framework === (opts.framework ?? "react") &&
            previousGenRef.current.brandKitKey ===
              JSON.stringify(brandKitRef.current ?? null)
              ? {
                  previousCode: previousGenRef.current.code,
                  previousElements: previousGenRef.current.elements,
                }
              : {}),
          }),
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to generate code");
        }
        const result = await response.json();
        const elements = result.detectedElements ?? result.elements ?? [];
        // Stamp the incremental-regen mirror with this generation's full
        // context; the live-sync effect only refreshes code/elements after
        // edits and leaves these context fields alone.
        previousGenRef.current = {
          code: result.code,
          elements,
          framework: opts.framework ?? "react",
          brandKitKey: JSON.stringify(brandKitRef.current ?? null),
        };
        setGeneratedCode(result.code);
        setEditedCode(result.code);
        setDetectedElements(elements);
        setUsedFallback(Boolean(result.usedFallback));
        setFallbackMessage(result.message ?? null);
        setCurrentMode("preview");
        setShowCodePanel(true);
        if (result.usedIncremental) {
          toast.success(
            "Only the changed elements were updated. Your existing code and refinements were kept.",
            { title: "Incremental update" }
          );
        }
        // Persist generated code immediately so it survives a reload without
        // requiring a manual Ctrl+S.
        if (projectId) {
          // Multi-screen heal: callers hand in a screen-less canvasData (the
          // API payload stays lean); writing that raw would WIPE the other
          // screens from projects.canvas_data. Re-attach the full tab set
          // with the active screen's snapshot refreshed to this generation.
          const { screens: screenList, activeScreenId: activeId } =
            screensRef.current;
          const persistWithScreens: CanvasData =
            screenList.length > 1
              ? {
                  ...persistData,
                  screens: screenList.map((s) =>
                    s.id === activeId
                      ? {
                          ...s,
                          canvasData: {
                            ...persistData,
                            screens: undefined,
                            activeScreenId: undefined,
                          },
                          generatedCode: result.code,
                          detectedElements:
                            elements as ScreenSnapshot["detectedElements"],
                        }
                      : s
                  ),
                  activeScreenId: activeId,
                }
              : persistData;
          void updateProject(
            projectId,
            persistWithScreens,
            undefined,
            result.code
          );
          // The backend just persisted a new iteration — refresh the version
          // list so CHECKPOINTS and COMPARE VERSIONS see it without a reload.
          void versionHistory.fetchVersions(projectId);
        }
        // Kick off the fidelity self-check in the background. Skip fallback
        // and template outputs — scoring a degraded result is meaningless.
        if (
          !result.usedFallback &&
          result.code &&
          elements.length > 0 &&
          opts.sketchImage
        ) {
          void scoreFidelity({
            projectId,
            code: result.code,
            framework: opts.framework ?? "react",
            elements,
            sketchImage: opts.sketchImage,
            allowRepair: true,
          });
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to generate code. Please try again.";
        toast.error(message, { title: "Generation failed" });
      } finally {
        setIsGenerating(false);
      }
    },
    [
      ensureGenerationProject,
      updateProject,
      toast,
      scoreFidelity,
      versionHistory.fetchVersions,
    ]
  );

  // HITL review step (roadmap idea #4). Runs detection FIRST (/api/detect,
  // Roboflow only, no Gemini), then opens the review overlay so the user can
  // relabel, delete, or add boxes before generation. If detection is
  // unavailable or finds nothing, falls back to the direct one-shot pipeline
  // (which has its own contour fallback) so the feature never blocks a user.
  const runDetectionReview = useCallback(
    async (opts: RunGenerationOpts) => {
      if (!opts.sketchImage) {
        void runGeneration(opts);
        return;
      }
      setIsDetecting(true);
      try {
        const projectId = await ensureGenerationProject(
          opts.persistCanvasData ?? opts.canvasData
        );
        if (!projectId) {
          throw new Error("Failed to create a project before detection");
        }
        const response = await fetch(DETECT_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            sketchImage: opts.sketchImage,
            sketchSource: opts.sketchSource,
            // CanvasData only carries width/height on the upload path (the
            // handler stamps them in); canvas exports fall back to defaults —
            // the backend uses these purely as an image-size fallback.
            width: (opts.canvasData as { width?: number }).width ?? 1000,
            height: (opts.canvasData as { height?: number }).height ?? 600,
          }),
        });
        if (!response.ok) throw new Error("Detection request failed");
        const result = await response.json();
        const detected: Array<{
          type: string;
          confidence: number;
          bounds: { x: number; y: number; width: number; height: number };
          label?: string | null;
        }> = result.elements ?? [];
        if (detected.length === 0) {
          // Nothing to review; let the normal pipeline (and its fallbacks) run.
          void runGeneration(opts);
          return;
        }
        // Uploads: boxes live in post-preprocessing pixel space, so both the
        // overlay AND the later generation call must use the processed preview.
        const reviewImage: string = result.previewImage || opts.sketchImage;
        let imageWidth: number = result.imageWidth ?? 0;
        let imageHeight: number = result.imageHeight ?? 0;
        if (!imageWidth || !imageHeight) {
          const size = await getImageSize(reviewImage);
          imageWidth = size.width;
          imageHeight = size.height;
        }
        setReviewSession({
          image: reviewImage,
          imageWidth,
          imageHeight,
          elements: detected.map((el, i) => ({
            id: `detected-${i}`,
            type: (el.type || "card").toLowerCase(),
            confidence: el.confidence ?? 0,
            bounds: el.bounds,
            label: el.label,
          })),
          generationOpts: { ...opts, sketchImage: reviewImage },
        });
      } catch (err) {
        // Review is an enhancement on top of the pipeline, not a gate: any
        // detect failure routes back through the direct one-shot path.
        console.error(
          "Detection review unavailable, generating directly:",
          err
        );
        void runGeneration(opts);
      } finally {
        setIsDetecting(false);
      }
    },
    [ensureGenerationProject, runGeneration]
  );

  // The user confirmed (or corrected) the detections: generate from exactly
  // that set. The backend skips Roboflow and container synthesis.
  const handleReviewGenerate = useCallback(
    (elements: ReviewElement[], corrections: DetectionCorrection[]) => {
      const session = reviewSession;
      if (!session) return;
      setReviewSession(null);
      void runGeneration({
        ...session.generationOpts,
        correctedElements: elements.map((el) => ({
          type: el.type,
          confidence: el.confidence,
          bounds: el.bounds,
          label: el.label ?? undefined,
        })),
        detectionCorrections: corrections.length > 0 ? corrections : undefined,
      });
    },
    [reviewSession, runGeneration]
  );

  // Upload path: the uploaded image IS the sketch. Send it straight through
  // with a minimal empty canvasData (the backend requires canvasData and uses
  // its width/height as an image-size fallback). No text annotations, since
  // there are no canvas-drawn labels to map.
  const handleUploadDetection = useCallback(
    (payload: UploadDetectionPayload) => {
      setShowUpload(false);
      // Swap the center column to show the uploaded image in place of the canvas.
      setUploadedPreview(payload);
      setInputSource("upload");
      // PROPS tab is canvas-only; close it so DraftingToolbox doesn't show a
      // mismatched active tab with no content.
      setRightPanel((p) => (p === "properties" ? null : p));
      const emptyCanvas: CanvasData = {
        lines: [],
        shapes: [],
        componentGroups: [],
        width: payload.width,
        height: payload.height,
      } as CanvasData;
      void runDetectionReview({
        canvasData: emptyCanvas,
        sketchImage: payload.dataUrl,
        textAnnotations: [],
        sketchSource: payload.source,
        framework: selectedFramework,
        // Persist the image in canvas_data so /canvas?id=... restores the
        // upload view after a reload or when opened in a new tab.
        persistCanvasData: {
          ...emptyCanvas,
          uploadedSketch: {
            dataUrl: payload.dataUrl,
            source: payload.source,
            width: payload.width,
            height: payload.height,
          },
        },
      });
    },
    [runDetectionReview, selectedFramework]
  );

  // Return the workspace to the drawing canvas after an upload, discarding the
  // uploaded image. Generated code in the panel is left untouched.
  const handleBackToCanvas = useCallback(() => {
    setInputSource("canvas");
    setUploadedPreview(null);
  }, []);

  const handleRunDetection = async () => {
    if (!canvasRef.current) return;
    const canvasData = canvasRef.current.getCanvasData();
    const hasContent =
      !!canvasData &&
      ((canvasData.lines?.length ?? 0) > 0 ||
        (canvasData.shapes?.length ?? 0) > 0 ||
        (canvasData.componentGroups?.length ?? 0) > 0);
    if (!hasContent) {
      toast.warning(
        "Draw or add something to the canvas before generating code.",
        {
          title: "Canvas is empty",
        }
      );
      return;
    }
    {
      const exportResult = canvasRef.current.exportAsPNG?.();
      const sketchImage = exportResult?.dataURL || undefined;
      // Transform that maps canvas-coords → exported-image pixel coords.
      // The exported PNG is a tight crop of the canvas at pixelRatio=2, so
      // canvas (cx, cy) lands at image ((cx - offsetX) * scale, (cy - offsetY) * scale).
      // Pre-applying this here means the backend gets text annotations in
      // the same coord space Roboflow returns bboxes in - no scaling needed
      // server-side, which previously broke when the export crop ≠ canvas size.
      const exportTransform = exportResult?.transform ?? {
        offsetX: 0,
        offsetY: 0,
        scale: 1,
      };
      const toImageSpace = (
        cx: number,
        cy: number,
        cw: number,
        ch: number
      ) => ({
        x: (cx - exportTransform.offsetX) * exportTransform.scale,
        y: (cy - exportTransform.offsetY) * exportTransform.scale,
        width: cw * exportTransform.scale,
        height: ch * exportTransform.scale,
      });

      // Collect text the user wrote on the canvas so the backend can map each
      // string to whichever detected component (navbar/section/card/footer)
      // contains it. Uses absolute canvas coordinates for shapes inside groups,
      // then transforms into exported-image space.
      const textAnnotations: TextAnnotation[] = [];
      const pushIfText = (
        s: {
          type?: string;
          text?: string;
          x?: number;
          y?: number;
          width?: number;
          height?: number;
        },
        offsetX = 0,
        offsetY = 0
      ) => {
        const value = (s.text || "").trim();
        if (!value) return;
        if (s.type !== "text" && !s.text) return;
        const inImage = toImageSpace(
          (s.x ?? 0) + offsetX,
          (s.y ?? 0) + offsetY,
          s.width ?? 0,
          s.height ?? 0
        );
        textAnnotations.push({ text: value, ...inImage });
      };
      for (const shape of canvasData.shapes ?? []) pushIfText(shape);
      for (const group of canvasData.componentGroups ?? []) {
        for (const shape of group.shapes ?? []) {
          pushIfText(shape, group.x ?? 0, group.y ?? 0);
        }
      }

      void runDetectionReview({
        canvasData,
        sketchImage,
        textAnnotations,
        sketchSource: "canvas",
        framework: selectedFramework,
      });
    }
  };

  // Keep a ref of the current panel height so the drag handler can be stable.
  useEffect(() => {
    codePanelHeightRef.current = codePanelHeight;
  }, [codePanelHeight]);

  // Code panel resize via drag - imperative for smoothness.
  // The drag writes height directly to the DOM inside a single rAF tick so we
  // don't churn React state (and thus avoid restarting Konva's ResizeObserver
  // on every mousemove, which was the source of the flicker).
  const handleCodePanelDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    codePanelDragRef.current = true;
    const startY = e.clientY;
    const startH = codePanelHeightRef.current;
    // Bound max by viewport so the canvas can't be squeezed to nothing on
    // short screens, but otherwise let the preview panel grow large enough to
    // be usable. Floor reduced to ~80px (one toolbar's worth) so the user can
    // near-fullscreen the code panel when reviewing generated code.
    const CANVAS_MIN_HEIGHT = 80;
    const dynMax = Math.min(
      CODE_PANEL_MAX_HEIGHT,
      Math.max(CODE_PANEL_MIN_HEIGHT, window.innerHeight - CANVAS_MIN_HEIGHT)
    );
    const clampDyn = (h: number) =>
      Math.min(dynMax, Math.max(CODE_PANEL_MIN_HEIGHT, h));

    let pendingH = startH;
    let finalH = startH;
    let rafId: number | null = null;

    const apply = () => {
      rafId = null;
      if (codePanelRef.current) {
        codePanelRef.current.style.height = `${pendingH}px`;
      }
    };

    const onMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      finalH = clampDyn(startH + delta);
      pendingH = finalH;
      if (rafId === null) rafId = requestAnimationFrame(apply);
    };

    const onUp = () => {
      codePanelDragRef.current = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      // Commit the final value to React state so other consumers see it.
      setCodePanelHeight(finalH);
      codePanelHeightRef.current = finalH;
    };

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  // Stable refs let us register commands once without re-registering on every render
  // when callbacks like handleRunDetection get a new identity.
  const runDetectionRef = useRef<() => void>(() => {});
  const saveProjectRef = useRef<() => void>(() => {});
  useEffect(() => {
    runDetectionRef.current = () => {
      void handleRunDetection();
    };
  });
  useEffect(() => {
    saveProjectRef.current = () => {
      void handleSaveProject();
    };
  }, [handleSaveProject]);

  // Publish canvas-area commands to the global Cmd+K palette while this page is mounted.
  useEffect(() => {
    return registerCanvasCommands([
      {
        id: "canvas:run-detection",
        title: "Run detection",
        subtitle: "Generate code from the current sketch",
        keywords: "detect generate code roboflow gemini",
        shortcut: "Run",
        group: "Canvas",
        onSelect: () => runDetectionRef.current(),
      },
      {
        id: "canvas:save",
        title: "Save project",
        subtitle: "Persist the current canvas to your library",
        keywords: "save persist project",
        shortcut: "Ctrl+S",
        group: "Canvas",
        onSelect: () => saveProjectRef.current(),
      },
      {
        id: "canvas:toggle-code-panel",
        title: "Toggle code panel",
        subtitle: "Show or hide the generated code editor",
        keywords: "code panel editor monaco",
        shortcut: "Ctrl+`",
        group: "View",
        onSelect: () => setShowCodePanel((p) => !p),
      },
      {
        id: "canvas:toggle-right-panel",
        title: "Toggle right panel",
        subtitle: "Switch between properties, layers, and chat",
        keywords: "panel sidebar properties layers chat",
        shortcut: "Ctrl+\\",
        group: "View",
        onSelect: () => setRightPanel((p) => (p ? null : "chat")),
      },
      {
        id: "canvas:open-templates",
        title: "Open templates",
        subtitle: "Insert a starter sketch from the template library",
        keywords: "templates starter library presets",
        group: "Canvas",
        onSelect: () => setShowTemplates(true),
      },
      {
        id: "canvas:open-components",
        title: "Open component library",
        subtitle: "Insert a saved component group",
        keywords: "components library navbar footer card",
        group: "Canvas",
        onSelect: () => setShowComponents(true),
      },
      {
        id: "canvas:upload-sketch",
        title: "Upload a sketch",
        subtitle: "Detect code from a photo of a sketch or a wireframe image",
        keywords: "upload image photo sketch wireframe import scan",
        group: "Canvas",
        onSelect: () => setShowUpload(true),
      },
      {
        id: "canvas:export",
        title: "Export",
        subtitle: "Download canvas as PNG or generated code as JSON",
        keywords: "export download png json image",
        group: "Canvas",
        onSelect: () => setShowExport(true),
      },
      {
        id: "canvas:zoom-reset",
        title: "Reset zoom to 100%",
        subtitle: "Return the canvas to its default scale",
        keywords: "zoom reset 100 fit",
        shortcut: "Ctrl+0",
        group: "View",
        onSelect: () => setZoom(ZOOM_DEFAULT),
      },
    ]);
  }, []);

  // Hydrate split ratio from localStorage and persist on change.
  useEffect(() => {
    const stored = localStorage.getItem("cc:splitRatio");
    if (stored) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= 0.15 && parsed <= 0.85) {
        setSplitRatio(parsed);
      }
    }
  }, []);
  useEffect(() => {
    localStorage.setItem("cc:splitRatio", String(splitRatio));
  }, [splitRatio]);

  const handleCopyCode = useCallback(async () => {
    const text = editedCode || generatedCode;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    } catch (err) {
      console.error("Clipboard write failed:", err);
    }
  }, [editedCode, generatedCode]);

  const handleSplitDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const handle = e.currentTarget as HTMLElement;
    const container = handle.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const onMove = (ev: MouseEvent) => {
      const ratio = (ev.clientX - rect.left) / rect.width;
      setSplitRatio(Math.min(0.85, Math.max(0.15, ratio)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  // Map expanded tool Ã¢â€ â€™ what SketchCanvas understands
  const toolForCanvas = (): string => {
    if (currentTool === "rectangle") return currentTool;
    if (currentTool === "hand") return "hand";
    return currentTool;
  };

  // Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
  // JSX
  // Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

  return (
    <div
      className="flex h-screen flex-col overflow-hidden select-none"
      style={{ background: "#FAFAF7", color: "#0E0E0F" }}
    >
      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Top Navbar Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <CanvasTopBar
        projectName={projectName}
        originalProjectName={originalProjectName}
        onProjectNameChange={setProjectName}
        onSaveProjectName={handleSaveProjectName}
        isSavingName={isSavingName}
        currentProjectId={currentProject?.id}
        isSaving={isSaving}
        lastSaved={lastSaved}
        saveError={error}
        onSave={handleSaveProject}
        onRunDetection={
          inputSource === "upload" ? undefined : handleRunDetection
        }
        isGenerating={isGenerating || isDetecting}
        framework={selectedFramework}
        onFrameworkChange={setSelectedFramework}
        onExport={() => setShowExport(true)}
        onOpenStackBlitz={() =>
          handleExport({
            format: "stackblitz",
            framework: selectedFramework,
            styling: "tailwind",
          })
        }
        onShare={() => setShowShare(true)}
        onUploadSketch={() => setShowUpload(true)}
        onTemplatesToggle={() => setShowTemplates(true)}
        onChatToggle={() =>
          setRightPanel(rightPanel === "chat" ? null : "chat")
        }
        onShortcutsToggle={() => setShowShortcuts((p) => !p)}
        isChatActive={rightPanel === "chat"}
      />

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Main workspace Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div className="flex flex-1 overflow-hidden">
        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Left toolbar Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {/* Left toolbar is now a floating pill mounted inside the canvas surface (see <FloatingToolbar /> below). */}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Center column Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Style ribbon is now floating at the bottom of the canvas (see <StyleRibbon /> below). */}

          {/* Ã¢â€â‚¬Ã¢â€â‚¬ Canvas area Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
          <main
            ref={mainRef}
            className="relative flex-1 min-h-0 overflow-hidden"
            style={{ background: "#FAFAF7" }}
          >
            {/* Multi-screen tab strip (feature A): floats top-center over the
                canvas / upload workspace. */}
            <div className="absolute left-1/2 top-3 z-30 -translate-x-1/2">
              <ScreenTabs
                screens={screens.map((s) => ({ id: s.id, name: s.name }))}
                activeScreenId={activeScreenId}
                onSelect={handleSelectScreen}
                onAdd={handleAddScreen}
                onRename={handleRenameScreen}
                onDelete={handleDeleteScreen}
              />
            </div>

            {inputSource === "upload" && uploadedPreview ? (
              <UploadedSketchPanel
                src={uploadedPreview.dataUrl}
                source={uploadedPreview.source}
                fileName={uploadedPreview.fileName}
                zoom={zoom}
                onBackToCanvas={handleBackToCanvas}
                onReplace={() => setShowUpload(true)}
                isGenerating={isGenerating || isDetecting}
              />
            ) : (
              <CanvasSurface
                isEmpty={
                  !hasUserInteracted &&
                  (() => {
                    const s = history.state as
                      | {
                          lines?: unknown[];
                          shapes?: unknown[];
                          componentGroups?: unknown[];
                        }
                      | undefined;
                    if (!s) return true;
                    return (
                      (s.lines?.length ?? 0) === 0 &&
                      (s.shapes?.length ?? 0) === 0 &&
                      (s.componentGroups?.length ?? 0) === 0
                    );
                  })()
                }
                onUserInteract={() => setHasUserInteracted(true)}
              >
                <div className="flex h-full items-center justify-center p-2 sm:p-4 md:p-6">
                  <ErrorBoundary
                    variant="panel"
                    title="Canvas surface failed"
                    message="The drawing area could not be loaded."
                  >
                    <SketchCanvas
                      ref={canvasRef}
                      tool={toolForCanvas()}
                      mode={currentMode}
                      gridEnabled={gridEnabled}
                      snapEnabled={snapEnabled}
                      importedDesign={importedDesign}
                      strokeColor={strokeColor}
                      fillColor={fillColor}
                      strokeWidth={strokeWidth}
                      zoom={zoom}
                      canvasState={history.state}
                      onStateChange={history.setState}
                    />
                  </ErrorBoundary>
                </div>
              </CanvasSurface>
            )}

            {/* Floating left toolbar - drawing tools (canvas mode only) */}
            {inputSource === "canvas" && (
              <ErrorBoundary
                variant="panel"
                title="Toolbar unavailable"
                message="We could not load the drawing tools."
              >
                <FloatingToolbar
                  currentTool={currentTool}
                  onSelectTool={setCurrentTool}
                />
              </ErrorBoundary>
            )}

            {/* StyleRibbon used to float here at bottom-left. It now lives
                in the DraftingToolbox PROPS tab so it never blocks the
                drawing area. See the tab content below. */}

            {/* Frosted-glass zoom pill */}
            <ErrorBoundary
              variant="panel"
              title="Zoom controls unavailable"
              message="We could not load zoom controls."
            >
              <ZoomPill
                zoom={zoom}
                onZoomChange={setZoom}
                onFitToScreen={handleFitToScreen}
              />
            </ErrorBoundary>

            {/* Code panel toggle (when hidden) — Drafting Room mono pill */}
            {!showCodePanel && (
              <button
                onClick={() => setShowCodePanel(true)}
                className="absolute bottom-4 right-4 z-30 flex items-center gap-2 px-3 py-2 text-[10px] tracking-[0.16em] uppercase transition-colors"
                style={{
                  background: T_CANVAS.paper,
                  border: `1px solid ${T_CANVAS.rule}`,
                  color: T_CANVAS.muted,
                  fontFamily:
                    "var(--font-jetbrains-mono, ui-monospace, monospace)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = T_CANVAS.graphite;
                  e.currentTarget.style.color = T_CANVAS.paper;
                  e.currentTarget.style.borderColor = T_CANVAS.graphite;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = T_CANVAS.paper;
                  e.currentTarget.style.color = T_CANVAS.muted;
                  e.currentTarget.style.borderColor = T_CANVAS.rule;
                }}
                title="Open code panel (Ctrl+E)"
              >
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
                CODE ↑
              </button>
            )}

            {/* Rotating workflow tips - bottom-center keeps clear of the
                ZoomPill (bottom-left) and code pill (bottom-right). Hidden on
                small screens where the chrome already crowds the canvas. */}
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 hidden -translate-x-1/2 md:block">
              <TipsTicker />
            </div>
          </main>

          {/* Persistent status bar - owns dimensions / mode / grid / zoom.
              Lives in the page chrome (not the Konva white box) so it can
              never be overlapped by the floating toolbar (BUG 6). */}
          <StatusBar
            width={canvasArea.width}
            height={canvasArea.height}
            tool={currentTool}
            gridEnabled={gridEnabled}
            snapEnabled={snapEnabled}
            zoom={zoom}
            onZoomIn={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
            onZoomOut={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
            onZoomReset={() => setZoom(ZOOM_DEFAULT)}
          />

          {/* Ã¢â€â‚¬Ã¢â€â‚¬ Code panel (collapsible, resizable) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
          {showCodePanel && (
            <div
              ref={codePanelRef}
              data-onboarding="code-panel"
              className="flex flex-col flex-shrink-0 border-t will-change-[height]"
              style={{
                height: codePanelHeight,
                borderColor: T_CANVAS.rule,
                background: T_DARK.bg,
              }}
            >
              {/* Drag handle — dark slab grip, cobalt on hover. */}
              <div
                onMouseDown={handleCodePanelDrag}
                onDoubleClick={() => {
                  setCodePanelHeight(350);
                  codePanelHeightRef.current = 350;
                }}
                title="Drag to resize · double-click to reset"
                className="group relative flex h-2.5 shrink-0 cursor-row-resize items-center justify-center transition-colors"
                style={{ background: T_DARK.bgRaised }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = T_DARK.cobaltWash)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = T_DARK.bgRaised)
                }
              >
                <div
                  className="h-[2px] w-10 transition-all duration-150 group-hover:w-16"
                  style={{ background: T_DARK.inkFaint }}
                />
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                {/* Tab bar — dark slab: paper-tinted hairlines, mono tabs,
                    bright ink on active. */}
                <div
                  className="flex items-center justify-between border-b px-2 py-1.5"
                  style={{
                    borderColor: T_DARK.ruleSoft,
                    background: T_DARK.bg,
                    fontFamily:
                      "var(--font-jetbrains-mono, ui-monospace, monospace)",
                  }}
                >
                  <div
                    className="flex items-center"
                    style={{ border: `1px solid ${T_DARK.rule}` }}
                  >
                    {(["code", "preview", "split"] as const).map((mode, i) => {
                      const active = codeViewMode === mode;
                      return (
                        <button
                          key={mode}
                          onClick={() => setCodeViewMode(mode)}
                          className="px-2.5 py-1 text-[10px] tracking-[0.16em] uppercase transition-colors"
                          style={{
                            background: active
                              ? T_DARK.surfaceHover
                              : "transparent",
                            color: active ? T_DARK.inkBright : T_DARK.inkMuted,
                            borderLeft:
                              i > 0 ? `1px solid ${T_DARK.rule}` : undefined,
                          }}
                          onMouseEnter={(e) => {
                            if (!active)
                              e.currentTarget.style.color = T_DARK.inkBright;
                          }}
                          onMouseLeave={(e) => {
                            if (!active)
                              e.currentTarget.style.color = T_DARK.inkMuted;
                          }}
                        >
                          {mode}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleCopyCode}
                      disabled={!generatedCode && !editedCode}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-[0.16em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                      style={{
                        background: codeCopied
                          ? T_DARK.cobaltWash
                          : T_DARK.surfaceSoft,
                        border: `1px solid ${codeCopied ? T_DARK.cobalt : T_DARK.rule}`,
                        color: codeCopied ? T_DARK.cobaltInk : T_DARK.inkMuted,
                        fontFamily:
                          "var(--font-jetbrains-mono, ui-monospace, monospace)",
                      }}
                      onMouseEnter={(e) => {
                        if (!codeCopied && (generatedCode || editedCode))
                          e.currentTarget.style.color = T_DARK.inkBright;
                      }}
                      onMouseLeave={(e) => {
                        if (!codeCopied)
                          e.currentTarget.style.color = T_DARK.inkMuted;
                      }}
                      title="Copy code to clipboard"
                    >
                      {codeCopied ? (
                        <>
                          <svg
                            className="h-3 w-3"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                          COPIED
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-3 w-3"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.75}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="9" y="9" width="13" height="13" rx="1" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                          COPY
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        const fullH = window.innerHeight - 80;
                        const isNearMax = codePanelHeight > fullH - 40;
                        const next = isNearMax ? 350 : fullH;
                        setCodePanelHeight(next);
                        codePanelHeightRef.current = next;
                      }}
                      className="flex h-6 w-6 items-center justify-center transition-colors"
                      style={{ color: T_DARK.inkMuted }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = T_DARK.inkBright;
                        e.currentTarget.style.background = T_DARK.surfaceHover;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = T_DARK.inkMuted;
                        e.currentTarget.style.background = "transparent";
                      }}
                      title="Maximize / restore code panel"
                    >
                      <svg
                        className="h-3 w-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.75}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="4 14 4 20 10 20" />
                        <polyline points="20 10 20 4 14 4" />
                        <line x1="14" y1="10" x2="20" y2="4" />
                        <line x1="4" y1="20" x2="10" y2="14" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setShowCodePanel(false)}
                      className="flex h-6 w-6 items-center justify-center transition-colors"
                      style={{ color: T_DARK.inkMuted }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = T_DARK.inkBright;
                        e.currentTarget.style.background = T_DARK.surfaceHover;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = T_DARK.inkMuted;
                        e.currentTarget.style.background = "transparent";
                      }}
                      title="Collapse code panel"
                    >
                      <svg
                        className="h-3 w-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.75}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Detection summary bar — dark slab mono strip */}
                {(generatedCode || editedCode) &&
                  (usedFallback || detectedElements.length > 0) && (
                    <div
                      className="flex items-center gap-2 border-b px-3 py-1.5 text-[10px] tracking-[0.14em] uppercase"
                      style={{
                        borderColor: T_DARK.ruleSoft,
                        background: usedFallback
                          ? T_DARK.warningWash
                          : T_DARK.bgRaised,
                        color: usedFallback ? T_DARK.warning : T_DARK.inkMuted,
                        fontFamily:
                          "var(--font-jetbrains-mono, ui-monospace, monospace)",
                      }}
                    >
                      {usedFallback ? (
                        <>
                          <span className="font-bold" aria-hidden="true">
                            [!]
                          </span>
                          <span
                            style={{ textTransform: "none", letterSpacing: 0 }}
                          >
                            {fallbackMessage ??
                              "No UI elements detected. Showing a default template. Try drawing larger, clearer boxes."}
                          </span>
                        </>
                      ) : (
                        <>
                          <span
                            className="inline-block h-1.5 w-1.5"
                            style={{ background: T_DARK.cobalt }}
                            aria-hidden="true"
                          />
                          <span style={{ color: T_DARK.inkBright }}>
                            DETECTED ·
                          </span>
                          {/* Element↔Code Linker chips: one per detected
                              element, in prompt order (cc-N = index+1).
                              Click → outline in preview + flash in code. */}
                          <span className="flex min-w-0 items-center gap-1 overflow-x-auto">
                            {detectedElements.map((el, i) => {
                              const ccId = `cc-${i + 1}`;
                              return (
                                <button
                                  key={ccId}
                                  type="button"
                                  onClick={() => handleElementChipClick(ccId)}
                                  title={`Highlight this ${(el.type || "element").toLowerCase()} in the code and preview`}
                                  className="shrink-0 px-1.5 py-0.5 text-[9px] tracking-[0.12em] uppercase transition-colors"
                                  style={{
                                    background: T_DARK.surfaceSoft,
                                    border: `1px solid ${T_DARK.rule}`,
                                    color: T_DARK.inkMuted,
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.color =
                                      T_DARK.inkBright;
                                    e.currentTarget.style.borderColor =
                                      T_DARK.cobalt;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.color =
                                      T_DARK.inkMuted;
                                    e.currentTarget.style.borderColor =
                                      T_DARK.rule;
                                  }}
                                >
                                  {i + 1}·{(el.type || "element").toUpperCase()}
                                </button>
                              );
                            })}
                          </span>
                          {(isScoringFidelity || isRepairing || fidelity) && (
                            <span
                              className="ml-auto flex items-center gap-1.5"
                              title={
                                isRepairing
                                  ? "Low score: sending the mismatch report back to the AI for one corrective pass"
                                  : fidelity
                                    ? `Self-check: the generated code was rendered and re-detected with the same model. ${fidelity.missing} missing, ${fidelity.extra} extra vs your sketch.${fidelity.before !== undefined ? " Auto-repaired once." : ""}`
                                    : "Checking how faithfully the code matches your sketch"
                              }
                            >
                              {isRepairing ? (
                                <span style={{ color: T_DARK.warning }}>
                                  FIDELITY ·{" "}
                                  {fidelity
                                    ? `${Math.round(fidelity.score * 100)}% · `
                                    : ""}
                                  REPAIRING
                                </span>
                              ) : isScoringFidelity ? (
                                <span style={{ color: T_DARK.inkMuted }}>
                                  FIDELITY · CHECKING
                                </span>
                              ) : fidelity ? (
                                <>
                                  <span
                                    className="inline-block h-1.5 w-1.5"
                                    style={{
                                      background:
                                        fidelity.score >= 0.8
                                          ? T_DARK.success
                                          : fidelity.score >= 0.5
                                            ? T_DARK.warning
                                            : T_DARK.error,
                                    }}
                                    aria-hidden="true"
                                  />
                                  <span
                                    style={{
                                      color:
                                        fidelity.score >= 0.8
                                          ? T_DARK.success
                                          : fidelity.score >= 0.5
                                            ? T_DARK.warning
                                            : T_DARK.error,
                                    }}
                                  >
                                    FIDELITY ·{" "}
                                    {fidelity.before !== undefined && (
                                      <>
                                        <s style={{ opacity: 0.6 }}>
                                          {Math.round(fidelity.before * 100)}%
                                        </s>
                                        <span aria-hidden="true"> → </span>
                                      </>
                                    )}
                                    {Math.round(fidelity.score * 100)}%
                                  </span>
                                </>
                              ) : null}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )}

                {/* Content */}
                <div className="relative flex-1 overflow-hidden">
                  {generatedCode || editedCode ? (
                    <>
                      {codeViewMode === "code" && (
                        <ErrorBoundary
                          variant="panel"
                          title="Editor failed to load"
                          message="We could not render the code editor."
                          resetKeys={[codeLanguage, editedCode, generatedCode]}
                        >
                          <MonacoCodeEditor
                            ref={monacoEditorRef}
                            value={editedCode || generatedCode}
                            language={codeLanguage}
                            onChange={(v) => setEditedCode(v || "")}
                            height="100%"
                          />
                        </ErrorBoundary>
                      )}
                      {codeViewMode === "preview" && (
                        <ErrorBoundary
                          variant="panel"
                          title="Preview unavailable"
                          message="We could not render the live preview."
                          resetKeys={[editedCode, generatedCode]}
                        >
                          <LivePreview
                            code={editedCode || generatedCode}
                            language={selectedFramework}
                            onAnnotate={handleAnnotateRefine}
                            onNavigateScreen={handlePreviewNavigate}
                          />
                        </ErrorBoundary>
                      )}
                      {codeViewMode === "split" && (
                        <div className="flex h-full">
                          <div
                            className="h-full overflow-hidden"
                            style={{
                              flexBasis: `${splitRatio * 100}%`,
                              flexShrink: 0,
                            }}
                          >
                            <ErrorBoundary
                              variant="panel"
                              title="Editor failed to load"
                              message="We could not render the code editor."
                              resetKeys={[
                                codeLanguage,
                                editedCode,
                                generatedCode,
                              ]}
                            >
                              <MonacoCodeEditor
                                ref={monacoEditorRef}
                                value={editedCode || generatedCode}
                                language={codeLanguage}
                                onChange={(v) => setEditedCode(v || "")}
                                height="100%"
                              />
                            </ErrorBoundary>
                          </div>
                          <div
                            onMouseDown={handleSplitDrag}
                            onDoubleClick={() => setSplitRatio(0.5)}
                            className="group relative flex w-px shrink-0 cursor-col-resize items-center justify-center"
                            style={{ background: T_DARK.rule }}
                            title="Drag to resize · double-click to reset"
                          >
                            {/* Wider invisible hit-target so the 1px rule is
                                still easy to grab; the rule itself stays a
                                hairline so the divider doesn't dominate the
                                composition. Cobalt washes the rule on hover. */}
                            <div
                              aria-hidden="true"
                              className="absolute inset-y-0 -left-1 -right-1 transition-colors"
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.background = `${T_DARK.cobalt}33`)
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.background =
                                  "transparent")
                              }
                            />
                          </div>
                          <div className="h-full flex-1 overflow-hidden">
                            <ErrorBoundary
                              variant="panel"
                              title="Preview unavailable"
                              message="We could not render the live preview."
                              resetKeys={[editedCode, generatedCode]}
                            >
                              <LivePreview
                                code={editedCode || generatedCode}
                                language="react"
                                onAnnotate={handleAnnotateRefine}
                                onNavigateScreen={handlePreviewNavigate}
                              />
                            </ErrorBoundary>
                          </div>
                        </div>
                      )}
                    </>
                  ) : isGenerating ? (
                    <GenerationProgress isGenerating hasPriorCode={false} />
                  ) : (
                    <div
                      className="flex h-full items-center justify-center"
                      style={{ background: T_DARK.bg }}
                    >
                      <div className="text-center">
                        <span
                          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center"
                          style={{
                            background: T_DARK.surfaceSoft,
                            border: `1px solid ${T_DARK.rule}`,
                            color: T_DARK.cobalt,
                          }}
                        >
                          <svg
                            className="h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.4}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="16 18 22 12 16 6" />
                            <polyline points="8 6 2 12 8 18" />
                          </svg>
                        </span>
                        <p
                          className="text-[11px] tracking-[0.16em] uppercase"
                          style={{
                            color: T_DARK.inkBright,
                            fontFamily:
                              "var(--font-jetbrains-mono, ui-monospace, monospace)",
                          }}
                        >
                          AWAITING SKETCH
                        </p>
                        <p
                          className="mt-1 text-[10px] tracking-[0.14em] uppercase"
                          style={{
                            color: T_DARK.inkFaint,
                            fontFamily:
                              "var(--font-jetbrains-mono, ui-monospace, monospace)",
                          }}
                        >
                          DRAW + RUN DETECTION TO GENERATE CODE
                        </p>
                      </div>
                    </div>
                  )}

                  {isGenerating && (generatedCode || editedCode) && (
                    <div
                      className="absolute inset-0 z-10 backdrop-blur-sm"
                      style={{ background: "rgba(14, 14, 15, 0.85)" }}
                    >
                      <GenerationProgress isGenerating hasPriorCode />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Right panel Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {/* ── Drafting Toolbox (right rail) ───────────────────────── */}
        <DraftingToolbox
          activeTab={(rightPanel ?? "chat") as ToolboxTabId}
          onTabChange={(id) => setRightPanel(id as typeof rightPanel)}
          collapsed={rightPanel === null}
          onCollapsedChange={(c) =>
            setRightPanel(c ? null : (rightPanel ?? "chat"))
          }
          tabs={
            [
              {
                id: "chat",
                label: "CHAT",
                shortcut: "Ctrl+/",
                icon: (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5"
                  >
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                ),
                content: (
                  <ChatInterface
                    key={currentProject?.id ?? "no-project"}
                    onSendMessage={handleChatMessage}
                    isProcessing={isGenerating}
                    hasCode={!!(editedCode || generatedCode)}
                    projectId={currentProject?.id}
                  />
                ),
              },
              {
                id: "properties",
                label: "PROPS",
                icon: (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>
                ),
                content: (
                  <div
                    className="h-full overflow-y-auto p-4 space-y-5"
                    style={{
                      background: T_CANVAS.paper,
                      fontFamily: "var(--font-inter, ui-sans-serif, system-ui)",
                    }}
                  >
                    {/* STYLE — color / width / fill / opacity for the current drawing tool */}
                    <StyleRibbon
                      currentTool={currentTool}
                      strokeColor={strokeColor}
                      fillColor={fillColor}
                      strokeWidth={strokeWidth}
                      onStrokeColorChange={setStrokeColor}
                      onFillColorChange={setFillColor}
                      onStrokeWidthChange={setStrokeWidth}
                    />

                    <div>
                      <div
                        className="mb-2 text-[10px] tracking-[0.18em] uppercase"
                        style={{
                          color: T_CANVAS.muted,
                          fontFamily:
                            "var(--font-jetbrains-mono, ui-monospace, monospace)",
                        }}
                      >
                        CANVAS
                      </div>
                      <div className="space-y-2">
                        <DraftingToggle
                          label="Show grid"
                          enabled={gridEnabled}
                          onToggle={() => setGridEnabled(!gridEnabled)}
                        />
                        <DraftingToggle
                          label="Snap to grid"
                          enabled={snapEnabled}
                          onToggle={() => setSnapEnabled(!snapEnabled)}
                        />
                      </div>
                    </div>

                    <div>
                      <div
                        className="mb-2 text-[10px] tracking-[0.18em] uppercase"
                        style={{
                          color: T_CANVAS.muted,
                          fontFamily:
                            "var(--font-jetbrains-mono, ui-monospace, monospace)",
                        }}
                      >
                        CHECKPOINTS
                      </div>
                      <button
                        onClick={handleCreateCheckpoint}
                        className="w-full px-3 py-2 text-[10px] tracking-[0.16em] uppercase transition-colors"
                        style={{
                          background: T_CANVAS.paper,
                          border: `1px dashed ${T_CANVAS.rule}`,
                          color: T_CANVAS.muted,
                          fontFamily:
                            "var(--font-jetbrains-mono, ui-monospace, monospace)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = T_CANVAS.cobalt;
                          e.currentTarget.style.borderColor = T_CANVAS.cobalt;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = T_CANVAS.muted;
                          e.currentTarget.style.borderColor = T_CANVAS.rule;
                        }}
                      >
                        + CREATE CHECKPOINT
                      </button>
                      <button
                        onClick={() => {
                          // Refresh from the DB so iterations created since
                          // page load (every generation makes one) show up.
                          if (currentProject?.id) {
                            void versionHistory.fetchVersions(
                              currentProject.id
                            );
                          }
                          setShowVersionCompare(true);
                        }}
                        className="mt-2 w-full px-3 py-2 text-[10px] tracking-[0.16em] uppercase transition-colors"
                        style={{
                          background: T_CANVAS.paper,
                          border: `1px solid ${T_CANVAS.rule}`,
                          color: T_CANVAS.muted,
                          fontFamily:
                            "var(--font-jetbrains-mono, ui-monospace, monospace)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = T_CANVAS.cobalt;
                          e.currentTarget.style.borderColor = T_CANVAS.cobalt;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = T_CANVAS.muted;
                          e.currentTarget.style.borderColor = T_CANVAS.rule;
                        }}
                      >
                        COMPARE VERSIONS
                      </button>
                      {versionHistory.versions.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {versionHistory.versions.slice(0, 5).map((v) => (
                            <div
                              key={v.id}
                              className="flex items-center justify-between px-3 py-1.5 text-[11px]"
                              style={{
                                background: T_CANVAS.vellum,
                                border: `1px solid ${T_CANVAS.rule}`,
                                color: T_CANVAS.graphite,
                              }}
                            >
                              <span className="truncate">
                                {v.description || "Checkpoint"}
                              </span>
                              <div className="ml-2 flex flex-shrink-0 items-center gap-2">
                                <button
                                  onClick={() => handleRestoreVersion(v.id)}
                                  className="text-[10px] tracking-[0.14em] uppercase"
                                  style={{
                                    color: T_CANVAS.cobalt,
                                    fontFamily:
                                      "var(--font-jetbrains-mono, ui-monospace, monospace)",
                                  }}
                                >
                                  RESTORE
                                </button>
                                <span
                                  aria-hidden="true"
                                  style={{ color: T_CANVAS.rule }}
                                >
                                  ·
                                </span>
                                <button
                                  onClick={() =>
                                    setCheckpointToDelete({
                                      id: v.id,
                                      label: v.description || "Checkpoint",
                                    })
                                  }
                                  className="text-[10px] tracking-[0.14em] uppercase"
                                  style={{
                                    color: T_CANVAS.error,
                                    fontFamily:
                                      "var(--font-jetbrains-mono, ui-monospace, monospace)",
                                  }}
                                >
                                  DELETE
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div
                        className="mb-2 text-[10px] tracking-[0.18em] uppercase"
                        style={{
                          color: T_CANVAS.muted,
                          fontFamily:
                            "var(--font-jetbrains-mono, ui-monospace, monospace)",
                        }}
                      >
                        BRAND KIT
                      </div>
                      <button
                        onClick={() => setShowBrandKit(true)}
                        className="flex w-full items-center justify-between px-3 py-2 text-[10px] tracking-[0.16em] uppercase transition-colors"
                        style={{
                          background: T_CANVAS.paper,
                          border: `1px solid ${T_CANVAS.rule}`,
                          color: T_CANVAS.muted,
                          fontFamily:
                            "var(--font-jetbrains-mono, ui-monospace, monospace)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = T_CANVAS.cobalt;
                          e.currentTarget.style.borderColor = T_CANVAS.cobalt;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = T_CANVAS.muted;
                          e.currentTarget.style.borderColor = T_CANVAS.rule;
                        }}
                      >
                        <span>
                          {brandKit ? "EDIT BRAND KIT" : "SET BRAND KIT"}
                        </span>
                        {brandKit ? (
                          <span className="flex items-center gap-1">
                            {[
                              brandKit.primaryColor,
                              brandKit.secondaryColor,
                              brandKit.accentColor,
                            ]
                              .filter(Boolean)
                              .map((c, i) => (
                                <span
                                  key={i}
                                  className="inline-block h-3 w-3"
                                  style={{
                                    background: c,
                                    border: `1px solid ${T_CANVAS.rule}`,
                                  }}
                                />
                              ))}
                          </span>
                        ) : null}
                      </button>
                    </div>
                  </div>
                ),
              },
            ].filter(
              (t) => inputSource !== "upload" || t.id !== "properties"
            ) as ToolboxTab[]
          }
        />
      </div>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Code panel toggle (when hidden) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {!showCodePanel && (
        <button
          onClick={() => setShowCodePanel(true)}
          className="hidden fixed bottom-14 right-4 z-20 flex items-center gap-2 rounded-lg bg-[#1A1A1A] border border-[#2E2E2E] px-3 py-2 text-xs font-medium text-[#A0A0A0] shadow-lg transition-all hover:border-[#FF6B00] hover:text-white hover:shadow-xl"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          Code
        </button>
      )}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Welcome dialog Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {/* Delete checkpoint confirmation */}
      <DraftingModal
        open={checkpointToDelete !== null}
        onClose={() => {
          if (!isDeletingCheckpoint) setCheckpointToDelete(null);
        }}
        slug="Danger · Delete checkpoint"
        title="Delete this checkpoint?"
        subtitle="This removes the saved snapshot. The action cannot be undone."
        maxWidth={460}
        footer={
          <div className="flex items-center justify-end gap-2">
            <ModalButton
              variant="ghost"
              onClick={() => setCheckpointToDelete(null)}
              disabled={isDeletingCheckpoint}
            >
              Cancel
            </ModalButton>
            <ModalButton
              variant="danger"
              onClick={confirmDeleteCheckpoint}
              disabled={isDeletingCheckpoint}
            >
              {isDeletingCheckpoint ? "Deleting" : "Delete checkpoint"}
            </ModalButton>
          </div>
        }
      >
        <div
          className="px-3 py-2.5"
          style={{
            background: T_CANVAS.vellum,
            border: `1px solid ${T_CANVAS.rule}`,
          }}
        >
          <div
            className="text-[10px] tracking-[0.16em] uppercase"
            style={{
              color: T_CANVAS.muted,
              fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
            }}
          >
            Checkpoint
          </div>
          <div
            className="mt-1 truncate text-[13px]"
            style={{
              color: T_CANVAS.graphite,
              fontFamily:
                "var(--font-inter, ui-sans-serif, system-ui, sans-serif)",
            }}
          >
            {checkpointToDelete?.label}
          </div>
        </div>
      </DraftingModal>

      <DraftingModal
        open={showWelcomeDialog}
        onClose={() => setShowWelcomeDialog(false)}
        slug="CANVAS · IMPORT"
        title="Design imported."
        subtitle="Your sketch from the mini canvas has been loaded. Choose how to proceed."
        maxWidth={440}
        footer={
          <div className="flex flex-col gap-2">
            <ModalButton
              variant="primary"
              onClick={() => {
                setShowWelcomeDialog(false);
                setCurrentMode("detect");
              }}
            >
              Analyze design →
            </ModalButton>
            <div className="flex gap-2">
              <ModalButton
                variant="ghost"
                onClick={() => setShowWelcomeDialog(false)}
              >
                Continue designing
              </ModalButton>
              <ModalButton
                variant="ghost"
                onClick={() => {
                  setShowWelcomeDialog(false);
                  setImportedDesign(null);
                  localStorage.removeItem("miniCanvasDesign");
                }}
              >
                Start fresh
              </ModalButton>
            </div>
          </div>
        }
      >
        <div className="pt-2 pb-1">
          <div
            className="flex items-center gap-3 px-3 py-2.5"
            style={{
              background: T_CANVAS.vellum,
              border: `1px solid ${T_CANVAS.rule}`,
            }}
          >
            <svg
              className="h-4 w-4 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: T_CANVAS.cobalt }}
            >
              <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span
              className="text-[11px] tracking-[0.12em] uppercase"
              style={{
                color: T_CANVAS.muted,
                fontFamily:
                  "var(--font-jetbrains-mono, ui-monospace, monospace)",
              }}
            >
              Mini canvas sketch ready
            </span>
          </div>
        </div>
      </DraftingModal>

      <DraftingModal
        open={screenToDelete !== null}
        onClose={() => setScreenToDelete(null)}
        slug="CANVAS · DELETE SCREEN"
        title="Delete this screen?"
        subtitle={
          screenToDelete
            ? `"${screenToDelete.name}" and its sketch plus generated code are removed from this project. This cannot be undone.`
            : undefined
        }
        maxWidth={420}
        footer={
          <div className="flex justify-end gap-2">
            <ModalButton
              variant="ghost"
              onClick={() => setScreenToDelete(null)}
            >
              Cancel
            </ModalButton>
            <ModalButton variant="danger" onClick={confirmDeleteScreen}>
              Delete screen
            </ModalButton>
          </div>
        }
      >
        <div className="pt-1 pb-1" />
      </DraftingModal>

      <OnboardingTour
        isOpen={showOnboarding}
        steps={onboardingSteps}
        stepIndex={onboardingStep}
        onNext={handleOnboardingNext}
        onBack={handleOnboardingBack}
        onSkip={handleOnboardingSkip}
        onFinish={handleOnboardingFinish}
      />

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Modals Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <ShortcutsPanel
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
      <ExportDialog
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        onExport={handleExport}
        canvasData={canvasRef.current?.getCanvasData()}
        generatedCode={editedCode || generatedCode}
      />
      <VersionCompareModal
        isOpen={showVersionCompare}
        onClose={() => setShowVersionCompare(false)}
        versions={versionHistory.versions}
        framework={selectedFramework}
        onRollback={handleRollbackVersion}
      />
      <ShareDialog
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        projectId={currentProject?.id ?? null}
      />
      <BrandKitModal
        isOpen={showBrandKit}
        onClose={() => setShowBrandKit(false)}
        projectId={currentProject?.id ?? null}
        value={brandKit}
        onApply={applyBrandKit}
      />
      <TemplatesPanel
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onInsertTemplate={handleInsertTemplate}
      />
      <ComponentPalette
        isOpen={showComponents}
        onClose={() => setShowComponents(false)}
        onInsertComponent={handleInsertComponent}
      />
      <UploadSketchModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onDetect={handleUploadDetection}
        isGenerating={isGenerating || isDetecting}
      />
      {/* Detection-in-flight loader: /api/detect has no other visible
          progress surface (GenerationProgress is gated on isGenerating),
          so without this the upload path shows nothing until the review
          overlay pops. Hidden once the review session opens. */}
      {isDetecting && !reviewSession && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "rgba(14, 14, 15, 0.62)" }}
        >
          <div
            className="flex flex-col items-center gap-4 px-12 py-9"
            style={{
              background: T_CANVAS.paper,
              border: `1px solid ${T_CANVAS.rule}`,
              boxShadow: "6px 6px 0 rgba(14, 14, 15, 0.18)",
            }}
          >
            <span
              className="h-8 w-8 animate-spin rounded-full border-2"
              style={{
                borderColor: T_CANVAS.rule,
                borderTopColor: T_CANVAS.cobalt,
              }}
            />
            <div className="text-center">
              <p
                className="text-[11px] uppercase tracking-[0.18em]"
                style={{
                  color: T_CANVAS.graphite,
                  fontFamily:
                    "var(--font-jetbrains-mono, ui-monospace, monospace)",
                }}
              >
                DETECTING ELEMENTS
              </p>
              <p
                className="mt-1.5 text-[10px] uppercase tracking-[0.14em]"
                style={{
                  color: T_CANVAS.muted,
                  fontFamily:
                    "var(--font-jetbrains-mono, ui-monospace, monospace)",
                }}
              >
                READING SKETCH · BOXES OPEN FOR REVIEW NEXT
              </p>
            </div>
          </div>
        </div>
      )}
      {reviewSession && (
        <DetectionReviewOverlay
          image={reviewSession.image}
          imageWidth={reviewSession.imageWidth}
          imageHeight={reviewSession.imageHeight}
          initialElements={reviewSession.elements}
          onGenerate={handleReviewGenerate}
          onCancel={() => setReviewSession(null)}
        />
      )}
      {/* Duplicate floating save indicator removed (BUG 3) - the header's
          single save-dot in <Navbar /> is now the only save-status surface. */}
    </div>
  );
}
