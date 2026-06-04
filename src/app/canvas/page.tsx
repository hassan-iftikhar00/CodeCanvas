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
import type { SketchCanvasRef } from "@/components/canvas/SketchCanvas";
import { createClient } from "@/lib/supabase/client";

import { useHistory } from "@/hooks/useHistory";
import ShortcutsPanel from "@/components/ShortcutsPanel";
import LayerPanel, { type Layer } from "@/components/canvas/LayerPanel";
import ExportDialog, { type ExportOptions } from "@/components/ExportDialog";
import TemplatesPanel from "@/components/canvas/TemplatesPanel";
import SaveIndicator from "@/components/SaveIndicator";
import ZoomPill from "@/components/canvas/ZoomPill";
import FloatingToolbar from "@/components/canvas/FloatingToolbar";
import CanvasSurface from "@/components/canvas/CanvasSurface";
import StyleRibbon from "@/components/canvas/StyleRibbon";
import Navbar from "@/components/Navbar";
import ErrorBoundary from "@/components/ErrorBoundary";
import CodePanelSkeleton from "@/components/canvas/CodePanelSkeleton";
import OnboardingTour, {
  type OnboardingStep,
} from "@/components/onboarding/OnboardingTour";
import {
  useProjectSave,
  useAutoSave,
  type CanvasData,
} from "@/hooks/useProjectSave";
import type { Template } from "@/data/templates";

import MonacoCodeEditor from "@/components/canvas/MonacoCodeEditor";
import LivePreview from "@/components/canvas/LivePreview";
import ChatInterface from "@/components/canvas/ChatInterface";
import ComponentPalette from "@/components/canvas/ComponentPalette";
import { useVersionHistory } from "@/hooks/useVersionHistory";
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
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_DEFAULT,
  ZOOM_STEP,
  CODE_PANEL_MIN_HEIGHT,
  CODE_PANEL_MAX_HEIGHT,
} from "@/types/canvas";

// Apply imported zoom + code-panel constants where bounds are enforced.
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
const clampCodePanelHeight = (h: number) =>
  Math.min(CODE_PANEL_MAX_HEIGHT, Math.max(CODE_PANEL_MIN_HEIGHT, h));

const SketchCanvas = dynamic(
  () => import("@/components/canvas/SketchCanvasWithHistory"),
  { ssr: false }
);

const GENERATE_CODE_ENDPOINT = "/api/generate-code";
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
      className="flex h-screen flex-col bg-[var(--cc-bg-canvas)]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="h-12 border-b border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] px-4 py-3">
        <div className="skeleton h-6 w-48" />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 p-6">
          <div className="h-full rounded-[var(--cc-radius-card)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] p-4">
            <div className="skeleton h-full w-full" />
          </div>
        </div>
        <div className="hidden w-72 border-l border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] p-4 lg:block">
          <div className="skeleton h-4 w-24" />
          <div className="mt-4 space-y-2">
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-10 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

function CanvasPageInner() {
  const toast = useToast();
  // Ã¢â€â‚¬Ã¢â€â‚¬ Core state Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [currentTool, setCurrentTool] = useState<Tool>("pen");
  const [currentMode, setCurrentMode] = useState<Mode>("sketch");
  const [rightPanel, setRightPanel] = useState<RightPanel>(() => {
    if (typeof window === "undefined") return "chat";
    return window.matchMedia("(max-width: 1023px)").matches ? null : "chat";
  });
  const [isMobileView, setIsMobileView] = useState(false);
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [isCanvasEmpty, setIsCanvasEmpty] = useState(true);
  const [codePanelHeight, setCodePanelHeight] = useState(350);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [codeCopied, setCodeCopied] = useState(false);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);
  const [showMobileWarning, setShowMobileWarning] = useState(true);
  const [importedDesign, setImportedDesign] = useState<
    { x: number; y: number }[][] | null
  >(null);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Panels / modals Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showComponents, setShowComponents] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const exportOpenedByTourRef = useRef(false);
  const rightPanelRef = useRef<RightPanel>(rightPanel);

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

  // Ã¢â€â‚¬Ã¢â€â‚¬ History & versions Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const history = useHistory({
    initialState: { lines: [], shapes: [] } as CanvasData,
    maxHistory: 50,
  });
  const { isSaving: isAutoSaving } = useAutoSave(
    currentProject?.id || null,
    history.state
  );
  const isSaving = isManualSaving || isAutoSaving;
  const versionHistory = useVersionHistory();

  // Ã¢â€â‚¬Ã¢â€â‚¬ Refs Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const canvasRef = useRef<SketchCanvasRef>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const codePanelDragRef = useRef(false);

  // Ã¢â€â‚¬Ã¢â€â‚¬ User Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [userProfile, setUserProfile] = useState<Record<string, unknown> | null>(
    null
  );
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
        description:
          "Preview, copy, or export your generated frontend code.",
        targetSelector: "[data-onboarding='export-dialog']",
        placement: "bottom",
      },
    ],
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkEmpty = () => {
      const data = canvasRef.current?.getCanvasData();
      if (!data) return;
      const empty =
        (data.lines?.length ?? 0) === 0 &&
        (data.shapes?.length ?? 0) === 0 &&
        (data.componentGroups?.length ?? 0) === 0;
      setIsCanvasEmpty(empty);
    };
    checkEmpty();
    const intervalId = window.setInterval(checkEmpty, 200);
    return () => window.clearInterval(intervalId);
  }, [currentProject?.id]);

  useEffect(() => {
    rightPanelRef.current = rightPanel;
  }, [rightPanel]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => {
      const isMobile = media.matches;
      setIsMobileView(isMobile);
      if (isMobile && rightPanelRef.current) {
        setRightPanel(null);
      }
    };
    update();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  // Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
  // Effects
  // Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

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
        (userProfile as { onboarding_completed?: boolean })
          .onboarding_completed
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
          if (project.canvas_data) {
            setTimeout(() => {
              if (canvasRef.current && project.canvas_data.lines) {
                canvasRef.current.clearCanvas();
                canvasRef.current.insertTemplate(
                  project.canvas_data as Parameters<
                    SketchCanvasRef["insertTemplate"]
                  >[0]
                );
              }
            }, 500);
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

  // Save project handler
  const handleSaveProject = useCallback(async () => {
    const canvasData = canvasRef.current?.getCanvasData();
    if (!canvasData) return;

    if (currentProject?.id && !currentProject.id.startsWith("temp-")) {
      const success = await updateProject(currentProject.id, canvasData);
      if (success) {
        console.log("Project saved successfully");
      }
    } else {
      const newId = await saveProject(
        projectName || "Untitled Project",
        canvasData
      );
      if (newId) {
        setCurrentProject({
          id: newId,
          name: projectName || "Untitled Project",
        });
        window.history.replaceState({}, "", `/canvas?id=${newId}`);
      }
    }
  }, [currentProject, projectName, saveProject, updateProject]);

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
      }

      return projectId;
    },
    [currentProject?.id, projectName, saveProject]
  );

  // Ã¢â€â‚¬Ã¢â€â‚¬ Keyboard shortcuts Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
          r: "rectangle",
          o: "circle",
          l: "ellipse",
          g: "triangle",
          a: "arrow",
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
          framework: "react",
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
  const handleRestoreVersion = async (versionId: string) => {
    const canvasData = await versionHistory.restoreVersion(versionId);
    if (canvasData && canvasRef.current) {
      canvasRef.current.clearCanvas();
      canvasRef.current.insertTemplate(canvasData);
    }
  };
  const handleDeleteVersion = async (versionId: string) => {
    await versionHistory.deleteVersion(versionId);
  };

  const persistOnboardingCompletion = useCallback(async () => {
    if (!user?.id) return;
    try {
      await supabase
        .from("profiles")
        .upsert(
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
    setOnboardingStep((step) =>
      Math.min(step + 1, onboardingSteps.length - 1)
    );
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
  const handleExport = (options: ExportOptions) => {
    if (options.format === "png") {
      const result = canvasRef.current?.exportAsPNG();
      if (result?.dataURL) {
        const a = document.createElement("a");
        a.href = result.dataURL;
        a.download = `${projectName || "canvas"}.png`;
        a.click();
      }
      return;
    }
    if (options.format === "json") {
      const code = generatedCode || "// No code generated yet";
      const blob = new Blob([code], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "codecanvas-export.json";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Templates & components
  const handleInsertTemplate = (template: Template) => {
    if (canvasRef.current)
      canvasRef.current.insertTemplate(template.canvasData);
  };
  const handleInsertComponent = (component: { canvasData: unknown }) => {
    if (canvasRef.current) {
      canvasRef.current.insertTemplate(
        component.canvasData as Parameters<SketchCanvasRef["insertTemplate"]>[0]
      );
    }
  };

  const handleFitToScreen = () => setZoom(100);

  // Detection / AI
  const handleRunDetection = async () => {
    if (!canvasRef.current) return;
    setIsGenerating(true);
    setGeneratedCode("");
    setDetectedElements([]);
    setUsedFallback(false);
    try {
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
      const projectId = await ensureGenerationProject(canvasData);
      if (!projectId) {
        throw new Error("Failed to create a project before generation");
      }
      const exportResult = canvasRef.current.exportAsPNG?.();
      const sketchImage = exportResult?.dataURL || undefined;
      // Transform that maps canvas-coords → exported-image pixel coords.
      // The exported PNG is a tight crop of the canvas at pixelRatio=2, so
      // canvas (cx, cy) lands at image ((cx - offsetX) * scale, (cy - offsetY) * scale).
      // Pre-applying this here means the backend gets text annotations in
      // the same coord space Roboflow returns bboxes in — no scaling needed
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

      const response = await fetch(GENERATE_CODE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "generate",
          canvasData,
          framework: "react",
          styling: "tailwind",
          description: "",
          projectId,
          sketchImage,
          textAnnotations,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to generate code");
      }
      const result = await response.json();
      setGeneratedCode(result.code);
      setEditedCode(result.code);
      setDetectedElements(result.detectedElements ?? result.elements ?? []);
      setUsedFallback(Boolean(result.usedFallback));
      setCurrentMode("preview");
      setShowCodePanel(true);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to generate code. Please try again.";
      toast.error(message, { title: "Generation failed" });
    } finally {
      setIsGenerating(false);
    }
  };

  // Code panel resize via drag
  const handleCodePanelDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      codePanelDragRef.current = true;
      const startY = e.clientY;
      const startH = codePanelHeight;
      const onMove = (ev: MouseEvent) => {
        const delta = startY - ev.clientY;
        setCodePanelHeight(clampCodePanelHeight(startH + delta));
      };
      const onUp = () => {
        codePanelDragRef.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [codePanelHeight]
  );

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
        shortcut: "Ctrl/⌘S",
        group: "Canvas",
        onSelect: () => saveProjectRef.current(),
      },
      {
        id: "canvas:toggle-code-panel",
        title: "Toggle code panel",
        subtitle: "Show or hide the generated code editor",
        keywords: "code panel editor monaco",
        shortcut: "Ctrl/⌘`",
        group: "View",
        onSelect: () => setShowCodePanel((p) => !p),
      },
      {
        id: "canvas:toggle-right-panel",
        title: "Toggle right panel",
        subtitle: "Switch between properties, layers, and chat",
        keywords: "panel sidebar properties layers chat",
        shortcut: "Ctrl/⌘\\",
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
        shortcut: "Ctrl/⌘0",
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
    if (
      ["rectangle", "circle", "ellipse", "triangle", "arrow"].includes(
        currentTool
      )
    )
      return currentTool;
    if (currentTool === "hand") return "hand";
    return currentTool;
  };

  // Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
  // JSX
  // Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

  return (
    <div className="flex h-[100svh] flex-col bg-[var(--cc-bg-canvas)] overflow-hidden select-none lg:h-screen">
      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Top Navbar Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <ErrorBoundary
        variant="panel"
        title="Editor header unavailable"
        message="We could not load the top bar. The editor is still available."
      >
        <Navbar
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
          onRunDetection={handleRunDetection}
          isGenerating={isGenerating}
          onExport={() => setShowExport(true)}
          onTemplatesToggle={() => setShowTemplates(true)}
          onChatToggle={() =>
            setRightPanel(rightPanel === "chat" ? null : "chat")
          }
          onHistoryToggle={() => {}}
          isChatActive={rightPanel === "chat"}
          isHistoryActive={false}
        />
      </ErrorBoundary>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Main workspace Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div className="flex flex-1 overflow-hidden">
        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Left toolbar Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {/* Left toolbar is now a floating pill mounted inside the canvas surface (see <FloatingToolbar /> below). */}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Center column Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Style ribbon is now floating at the bottom of the canvas (see <StyleRibbon /> below). */}

          {/* Ã¢â€â‚¬Ã¢â€â‚¬ Canvas area Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
          <ErrorBoundary
            variant="panel"
            title="Canvas unavailable"
            message="We could not render the canvas. Try again."
            resetKeys={[currentMode, currentTool, zoom]}
          >
            <main className="relative flex-1 overflow-hidden bg-[var(--cc-bg-canvas)]">
              {showMobileWarning ? (
                <div className="absolute left-3 right-3 top-3 z-40 sm:hidden">
                  <div className="rounded-[var(--cc-radius-card)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)]/95 p-3 text-[12px] text-[var(--cc-text-secondary)] shadow-[0_12px_30px_-18px_rgba(0,0,0,0.6)] backdrop-blur">
                    <div className="flex items-start gap-2">
                      <svg
                        className="mt-0.5 h-4 w-4 flex-none text-[var(--cc-accent)]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                        />
                      </svg>
                      <div className="flex-1">
                        <p className="text-[12px] font-semibold text-[var(--cc-text-primary)]">
                          Canvas works best on desktop.
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--cc-text-secondary)]">
                          For the best experience, use a larger screen.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowMobileWarning(false)}
                        className="rounded-[var(--cc-radius-button)] p-1 text-[var(--cc-text-muted)] transition-colors hover:bg-[var(--cc-bg-elevated)] hover:text-[var(--cc-text-primary)]"
                        aria-label="Dismiss mobile warning"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
              <CanvasSurface
                isEmpty={isCanvasEmpty}
                onUserInteract={() => setIsCanvasEmpty(false)}
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

              {/* Floating left toolbar — drawing tools */}
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

              {/* Floating bottom style ribbon — slides in/out per tool */}
              <ErrorBoundary
                variant="panel"
                title="Style controls unavailable"
                message="We could not load the styling controls."
              >
                <StyleRibbon
                  currentTool={currentTool}
                  strokeColor={strokeColor}
                  fillColor={fillColor}
                  strokeWidth={strokeWidth}
                  onStrokeColorChange={setStrokeColor}
                  onFillColorChange={setFillColor}
                  onStrokeWidthChange={setStrokeWidth}
                />
              </ErrorBoundary>

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

              {/* Code panel toggle (when hidden) */}
              {!showCodePanel && (
                <button
                  onClick={() => setShowCodePanel(true)}
                  className="absolute bottom-4 right-4 z-30 flex items-center gap-2 rounded-lg border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--cc-text-secondary)] shadow-lg transition-all hover:border-[var(--cc-accent)] hover:text-[var(--cc-text-primary)] hover:shadow-xl"
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
            </main>
          </ErrorBoundary>

          {/* Ã¢â€â‚¬Ã¢â€â‚¬ Code panel (collapsible, resizable) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
          {showCodePanel && (
            <ErrorBoundary
              variant="panel"
              title="Code panel unavailable"
              message="We could not render the code panel. Try again."
              resetKeys={[codeViewMode, generatedCode, editedCode, splitRatio]}
            >
              <div
                data-onboarding="code-panel"
                className="border-t border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)]"
                style={{ height: codePanelHeight }}
              >
              {/* Drag handle */}
              <div
                onMouseDown={handleCodePanelDrag}
                className="group flex h-2 cursor-row-resize items-center justify-center hover:bg-[var(--cc-accent-bg-soft)]"
              >
                <div className="h-0.5 w-8 rounded-full bg-[var(--cc-border-subtle)] transition-colors group-hover:bg-[var(--cc-accent)]" />
              </div>

              <div className="flex h-[calc(100%-8px)] flex-col">
                {/* Tab bar */}
                <div className="flex items-center justify-between border-b border-[var(--cc-border-subtle)] px-3 py-1.5">
                  <div className="flex gap-1">
                    {(["code", "preview", "split"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setCodeViewMode(mode)}
                        className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-all ${
                          codeViewMode === mode
                            ? "bg-[var(--cc-toggle-active-bg)] text-[var(--cc-toggle-active-text)]"
                            : "text-[var(--cc-text-secondary)] hover:bg-[var(--cc-bg-elevated)] hover:text-[var(--cc-text-primary)]"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleCopyCode}
                      disabled={!generatedCode && !editedCode}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--cc-text-secondary)] transition-colors hover:bg-[var(--cc-bg-elevated)] hover:text-[var(--cc-text-primary)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--cc-text-secondary)]"
                      title="Copy code to clipboard"
                    >
                      {codeCopied ? (
                        <>
                          <svg
                            className="h-3.5 w-3.5 text-green-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-green-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-3.5 w-3.5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                          Copy
                        </>
                      )}
                    </button>
                    <div className="mx-1 h-4 w-px bg-[var(--cc-border-subtle)]" />
                    <button
                      onClick={() => setShowCodePanel(false)}
                      className="rounded p-1 text-[var(--cc-text-secondary)] transition-colors hover:bg-[var(--cc-bg-elevated)] hover:text-[var(--cc-text-primary)]"
                      title="Collapse code panel"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Detection summary bar */}
                {(generatedCode || editedCode) &&
                  (usedFallback || detectedElements.length > 0) && (
                    <div
                      className={`flex items-center gap-2 border-b px-3 py-1.5 text-[11px] ${
                        usedFallback
                          ? "border-yellow-500/30 bg-yellow-500/5 text-yellow-300"
                          : "border-[var(--cc-border-subtle)] bg-[var(--cc-bg-canvas)] text-[var(--cc-text-secondary)]"
                      }`}
                    >
                      {usedFallback ? (
                        <>
                          <svg
                            className="h-3.5 w-3.5 shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                          </svg>
                          <span>
                            No UI elements detected. Showing a default
                            template. Try drawing larger, clearer boxes.
                          </span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-3.5 w-3.5 shrink-0 text-[var(--cc-accent)]"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-medium text-[var(--cc-text-primary)]">
                            Detected:
                          </span>
                          <span>
                            {Object.entries(
                              detectedElements.reduce<Record<string, number>>(
                                (acc, el) => {
                                  const t = (
                                    el.type || "element"
                                  ).toLowerCase();
                                  acc[t] = (acc[t] || 0) + 1;
                                  return acc;
                                },
                                {}
                              )
                            )
                              .map(
                                ([type, count]) =>
                                  `${count} ${type}${count > 1 ? "s" : ""}`
                              )
                              .join(" · ")}
                          </span>
                        </>
                      )}
                    </div>
                  )}

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                  {isGenerating && !generatedCode && !editedCode ? (
                    <CodePanelSkeleton />
                  ) : generatedCode || editedCode ? (
                    <>
                      {codeViewMode === "code" && (
                        <ErrorBoundary
                          variant="panel"
                          title="Editor failed to load"
                          message="We could not render the code editor."
                          resetKeys={[codeLanguage, editedCode, generatedCode]}
                        >
                          <MonacoCodeEditor
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
                          title="Preview failed to load"
                          message="We could not render the preview."
                          resetKeys={[editedCode, generatedCode]}
                        >
                          <LivePreview
                            code={editedCode || generatedCode}
                            language="react"
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
                              resetKeys={[codeLanguage, editedCode, generatedCode]}
                            >
                              <MonacoCodeEditor
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
                            className="group relative flex w-1.5 shrink-0 cursor-col-resize items-center justify-center bg-[var(--cc-border-subtle)] hover:bg-[var(--cc-accent-bg-soft)]"
                            title="Drag to resize · double-click to reset"
                          >
                            <div className="h-8 w-0.5 rounded-full bg-[var(--cc-border-emphasis)] transition-colors group-hover:bg-[var(--cc-accent)]" />
                          </div>
                          <div className="h-full flex-1 overflow-hidden">
                            <ErrorBoundary
                              variant="panel"
                              title="Preview failed to load"
                              message="We could not render the preview."
                              resetKeys={[editedCode, generatedCode]}
                            >
                              <LivePreview
                                code={editedCode || generatedCode}
                                language="react"
                              />
                            </ErrorBoundary>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center text-[var(--cc-text-muted)]">
                      <div className="text-center">
                        <svg
                          className="mx-auto mb-2 h-10 w-10 opacity-40"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        <p className="text-xs">
                          Draw on the canvas and click &quot;Run Detection&quot;
                          to generate code
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              </div>
            </ErrorBoundary>
          )}
        </div>

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Right panel Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {rightPanel && (
          <>
            {isMobileView ? (
              <div
                className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px]"
                onClick={() => setRightPanel(null)}
              />
            ) : null}
            <ErrorBoundary
              variant="panel"
              title="Panel unavailable"
              message="This panel failed to load. You can keep working elsewhere."
              resetKeys={[rightPanel, currentProject?.id]}
            >
              <aside
                className={`overflow-y-auto border-l border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] ${
                  isMobileView
                    ? "fixed inset-y-0 right-0 z-40 w-full max-w-[320px] shadow-[0_20px_50px_-24px_rgba(0,0,0,0.7)]"
                    : "w-72"
                }`}
              >
            {/* Properties panel */}
            {rightPanel === "properties" && (
              <div className="p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--cc-text-muted)]">
                    Properties
                  </h2>
                  <button
                    onClick={() => setRightPanel(null)}
                    className="rounded p-1 text-[var(--cc-text-secondary)] hover:bg-[var(--cc-bg-elevated)] hover:text-[var(--cc-text-primary)]"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Grid Settings */}
                <div className="mb-4">
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-[var(--cc-text-muted)]">
                    Canvas
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center justify-between rounded-lg bg-[var(--cc-bg-canvas)] px-3 py-2">
                      <span className="text-xs text-[var(--cc-text-secondary)]">Show Grid</span>
                      <button
                        onClick={() => setGridEnabled(!gridEnabled)}
                        className={`relative h-5 w-9 rounded-full transition-colors ${gridEnabled ? "bg-[var(--cc-accent)]" : "bg-[var(--cc-border-subtle)]"}`}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-[var(--cc-text-inverse)] transition-transform ${gridEnabled ? "translate-x-[18px]" : "translate-x-0.5"}`}
                        />
                      </button>
                    </label>
                    <label className="flex items-center justify-between rounded-lg bg-[var(--cc-bg-canvas)] px-3 py-2">
                      <span className="text-xs text-[var(--cc-text-secondary)]">
                        Snap to Grid
                      </span>
                      <button
                        onClick={() => setSnapEnabled(!snapEnabled)}
                        className={`relative h-5 w-9 rounded-full transition-colors ${snapEnabled ? "bg-[var(--cc-accent)]" : "bg-[var(--cc-border-subtle)]"}`}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-[var(--cc-text-inverse)] transition-transform ${snapEnabled ? "translate-x-[18px]" : "translate-x-0.5"}`}
                        />
                      </button>
                    </label>
                  </div>
                </div>

                {/* Version Checkpoints */}
                <div className="mt-6">
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--cc-text-muted)]">
                    Checkpoints
                  </h3>
                  <button
                    onClick={handleCreateCheckpoint}
                    className="w-full rounded-lg border border-dashed border-[var(--cc-border-subtle)] bg-[var(--cc-bg-canvas)] px-3 py-2 text-xs text-[var(--cc-text-secondary)] transition-all hover:border-[var(--cc-accent)] hover:text-[var(--cc-accent)]"
                  >
                    + Create Checkpoint
                  </button>
                  {versionHistory.versions.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {versionHistory.versions.slice(0, 3).map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between rounded-lg bg-[var(--cc-bg-canvas)] px-3 py-1.5"
                        >
                          <span className="truncate text-xs text-[var(--cc-text-secondary)]">
                            {v.description || "Checkpoint"}
                          </span>
                          <button
                            onClick={() => handleRestoreVersion(v.id)}
                            className="ml-2 text-[10px] text-[var(--cc-accent)] hover:underline"
                          >
                            Restore
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Layers panel */}
            {rightPanel === "layers" && (
              <div className="p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--cc-text-muted)]">
                    Layers
                  </h2>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const newLayer: Layer = {
                          id: `layer-${Date.now()}`,
                          name: `Layer ${layers.length + 1}`,
                          type: "pen",
                          visible: true,
                          locked: false,
                          opacity: 1,
                        };
                        setLayers((prev) => [...prev, newLayer]);
                        setSelectedLayerId(newLayer.id);
                      }}
                      className="rounded p-1 text-[var(--cc-text-secondary)] hover:bg-[var(--cc-bg-elevated)] hover:text-[var(--cc-text-primary)]"
                      title="Add Layer"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setRightPanel(null)}
                      className="rounded p-1 text-[var(--cc-text-secondary)] hover:bg-[var(--cc-bg-elevated)] hover:text-[var(--cc-text-primary)]"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <ErrorBoundary
                  variant="panel"
                  title="Layers unavailable"
                  message="We could not load the layers list."
                  resetKeys={[layers.length, selectedLayerId]}
                >
                  <LayerPanel
                    layers={layers}
                    selectedLayerId={selectedLayerId}
                    onSelectLayer={handleSelectLayer}
                    onToggleVisibility={handleToggleVisibility}
                    onToggleLock={handleToggleLock}
                    onDeleteLayer={handleDeleteLayer}
                    onDuplicateLayer={handleDuplicateLayer}
                    onRenameLayer={handleRenameLayer}
                  />
                </ErrorBoundary>
              </div>
            )}

            {/* Chat panel — sketch-first workflow: hasCode gates chat input */}
            {rightPanel === "chat" && (
              <ErrorBoundary
                variant="panel"
                title="Chat unavailable"
                message="We could not load the chat panel."
                resetKeys={[currentProject?.id, editedCode, generatedCode]}
              >
                <ChatInterface
                  key={currentProject?.id ?? "no-project"}
                  onSendMessage={handleChatMessage}
                  isProcessing={isGenerating}
                  hasCode={!!(editedCode || generatedCode)}
                  projectId={currentProject?.id}
                />
              </ErrorBoundary>
            )}
              </aside>
            </ErrorBoundary>
          </>
        )}
      </div>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Code panel toggle (when hidden) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {!showCodePanel && (
        <button
          onClick={() => setShowCodePanel(true)}
          className="hidden fixed bottom-14 right-4 z-20 flex items-center gap-2 rounded-lg border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--cc-text-secondary)] shadow-lg transition-all hover:border-[var(--cc-accent)] hover:text-[var(--cc-text-primary)] hover:shadow-xl"
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
      {showWelcomeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-[var(--cc-accent-bg-soft)] p-3">
                <svg
                  className="h-6 w-6 text-[var(--cc-accent)]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-[var(--cc-text-primary)]">Design Imported!</h2>
            </div>
            <p className="mb-6 text-[var(--cc-text-secondary)]">
              Your sketch from the mini canvas has been imported. What would you
              like to do?
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setShowWelcomeDialog(false)}
                className="w-full rounded-lg border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-elevated)] px-6 py-3 font-semibold text-[var(--cc-text-primary)] transition-all hover:bg-[var(--cc-bg-canvas)]"
              >
                Continue Designing
              </button>
              <button
                onClick={() => {
                  setShowWelcomeDialog(false);
                  setCurrentMode("detect");
                }}
                className="w-full rounded-lg border border-[var(--cc-accent-border-soft)] bg-[var(--cc-accent-bg-soft)] px-6 py-3 font-semibold text-[var(--cc-text-primary)] transition-all hover:shadow-[0_0_20px_var(--cc-accent-glow-strong)]"
              >
                Analyze Design
              </button>
              <button
                onClick={() => {
                  setShowWelcomeDialog(false);
                  setImportedDesign(null);
                  localStorage.removeItem("miniCanvasDesign");
                }}
                className="w-full rounded-lg border border-[var(--cc-border-subtle)] bg-transparent px-6 py-3 text-sm text-[var(--cc-text-secondary)] transition-all hover:bg-[var(--cc-bg-elevated)] hover:text-[var(--cc-text-primary)]"
              >
                Start Fresh
              </button>
            </div>
          </div>
        </div>
      )}

      <ErrorBoundary
        variant="panel"
        title="Onboarding unavailable"
        message="We could not load the onboarding tour."
      >
        <OnboardingTour
          isOpen={showOnboarding}
          steps={onboardingSteps}
          stepIndex={onboardingStep}
          onNext={handleOnboardingNext}
          onBack={handleOnboardingBack}
          onSkip={handleOnboardingSkip}
          onFinish={handleOnboardingFinish}
        />
      </ErrorBoundary>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Modals Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <ErrorBoundary
        variant="panel"
        title="Overlay unavailable"
        message="We could not load this dialog."
      >
        <>
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
          <SaveIndicator
            isSaving={isSaving}
            lastSaved={lastSaved}
            error={error}
          />
        </>
      </ErrorBoundary>
    </div>
  );
}
