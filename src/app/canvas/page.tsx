"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
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
import ZoomControls from "@/components/canvas/ZoomControls";
import Navbar from "@/components/Navbar";
import { useProjectSave, useAutoSave } from "@/hooks/useProjectSave";
import type { Template } from "@/data/templates";

import MonacoCodeEditor from "@/components/canvas/MonacoCodeEditor";
import LivePreview from "@/components/canvas/LivePreview";
import ChatInterface from "@/components/canvas/ChatInterface";
import ComponentPalette from "@/components/canvas/ComponentPalette";
import { useVersionHistory } from "@/hooks/useVersionHistory";

const SketchCanvas = dynamic(
  () => import("@/components/canvas/SketchCanvasWithHistory"),
  { ssr: false }
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Tool =
  | "select"
  | "hand"
  | "pen"
  | "rectangle"
  | "circle"
  | "ellipse"
  | "triangle"
  | "arrow"
  | "text"
  | "erase"
  | "bin";
type Mode = "sketch" | "detect" | "refine" | "preview";
type RightPanel = "properties" | "layers" | "chat" | null;

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------
const TOOLS: {
  id: Tool;
  label: string;
  shortcut: string;
  icon: React.ReactNode;
  group: "pointer" | "draw" | "shape" | "annotate" | "modify";
}[] = [
  {
    id: "select",
    label: "Select",
    shortcut: "V",
    group: "pointer",
    icon: (
      <svg
        className="h-[18px] w-[18px]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
        <path d="M13 13l6 6" />
      </svg>
    ),
  },
  {
    id: "hand",
    label: "Hand",
    shortcut: "H",
    group: "pointer",
    icon: (
      <svg
        className="h-[18px] w-[18px]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 11V6a2 2 0 0 0-4 0v1" />
        <path d="M14 10V4a2 2 0 0 0-4 0v2" />
        <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
        <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
      </svg>
    ),
  },
  {
    id: "pen",
    label: "Pen",
    shortcut: "P",
    group: "draw",
    icon: (
      <svg
        className="h-[18px] w-[18px]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="M2 2l7.586 7.586" />
        <circle cx="11" cy="11" r="2" />
      </svg>
    ),
  },
  {
    id: "rectangle",
    label: "Rectangle",
    shortcut: "R",
    group: "shape",
    icon: (
      <svg
        className="h-[18px] w-[18px]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
      </svg>
    ),
  },
  {
    id: "circle",
    label: "Circle",
    shortcut: "O",
    group: "shape",
    icon: (
      <svg
        className="h-[18px] w-[18px]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
  },
  {
    id: "ellipse",
    label: "Ellipse",
    shortcut: "L",
    group: "shape",
    icon: (
      <svg
        className="h-[18px] w-[18px]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <ellipse cx="12" cy="12" rx="10" ry="6" />
      </svg>
    ),
  },
  {
    id: "triangle",
    label: "Triangle",
    shortcut: "G",
    group: "shape",
    icon: (
      <svg
        className="h-[18px] w-[18px]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2L2 22h20L12 2z" />
      </svg>
    ),
  },
  {
    id: "arrow",
    label: "Arrow",
    shortcut: "A",
    group: "shape",
    icon: (
      <svg
        className="h-[18px] w-[18px]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    ),
  },
  {
    id: "text",
    label: "Text",
    shortcut: "T",
    group: "annotate",
    icon: (
      <svg
        className="h-[18px] w-[18px]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="4 7 4 4 20 4 20 7" />
        <line x1="9" y1="20" x2="15" y2="20" />
        <line x1="12" y1="4" x2="12" y2="20" />
      </svg>
    ),
  },
  {
    id: "erase",
    label: "Eraser",
    shortcut: "E",
    group: "modify",
    icon: (
      <svg
        className="h-[18px] w-[18px]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 20H7L3 16c-.6-.6-.6-1.5 0-2.1l10-10c.6-.6 1.5-.6 2.1 0l6 6c.6.6.6 1.5 0 2.1L14 19" />
        <path d="M7 20l-4-4" />
      </svg>
    ),
  },
  {
    id: "bin",
    label: "Delete",
    shortcut: "X",
    group: "modify",
    icon: (
      <svg
        className="h-[18px] w-[18px]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    ),
  },
];

// Quick color presets
const COLOR_PRESETS = [
  "#000000",
  "#ffffff",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
];

const STROKE_WIDTHS = [1, 2, 3, 5, 8, 12];

// 
// CANVAS PAGE
// 
export default function CanvasPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#0A0A0A]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FF6B00] border-t-transparent" />
        </div>
      }
    >
      <CanvasPageInner />
    </Suspense>
  );
}

function CanvasPageInner() {
  //  Core state 
  const [currentTool, setCurrentTool] = useState<Tool>("pen");
  const [currentMode, setCurrentMode] = useState<Mode>("sketch");
  const [rightPanel, setRightPanel] = useState<RightPanel>("chat");
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [codePanelHeight, setCodePanelHeight] = useState(350);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);
  const [importedDesign, setImportedDesign] = useState<
    { x: number; y: number }[][] | null
  >(null);

  // -- Panels / modals --
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showComponents, setShowComponents] = useState(false);

  //  Layers 
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

  //  Tool properties 
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [fillColor, setFillColor] = useState("transparent");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [zoom, setZoom] = useState(100);

  //  Project saving 
  const {
    saveProject,
    updateProject,
    updateProjectName,
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

  //  Code / AI 
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [editedCode, setEditedCode] = useState("");
  const [codeViewMode, setCodeViewMode] = useState<
    "code" | "preview" | "split"
  >("code");
  const [codeLanguage] = useState<"html" | "css" | "javascript" | "typescript">(
    "html"
  );
  const [detectedElements, setDetectedElements] = useState<
    Array<{ type: string; bounds: unknown }>
  >([]);

  //  History & versions 
  const history = useHistory({
    initialState: { lines: [] as unknown[], shapes: [] as unknown[] },
    maxHistory: 50,
  });
  const { isSaving: isAutoSaving } = useAutoSave(
    currentProject?.id || null,
    history.state
  );
  const isSaving = isManualSaving || isAutoSaving;
  const versionHistory = useVersionHistory();

  //  Refs 
  const canvasRef = useRef<SketchCanvasRef>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const codePanelDragRef = useRef(false);

  //  User 
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [userProfile, setUserProfile] = useState<Record<
    string,
    unknown
  > | null>(null);

  // 
  // Effects
  // 

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
            .select("*")
            .eq("id", u.id)
            .single();
          if (profile) setUserProfile(profile as Record<string, unknown>);
        }
      } catch {
        setUser(null);
      }
    };
    getUser();
  }, [supabase]);

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
          setCurrentProject({ id: project.id, name: project.name });
          setProjectName(project.name);
          setOriginalProjectName(project.name);
          if (project.canvas_data) {
            setTimeout(() => {
              if (canvasRef.current && project.canvas_data.lines) {
                canvasRef.current.clearCanvas();
                canvasRef.current.insertTemplate(project.canvas_data);
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
    if (currentProject?.id && !currentProject.id.startsWith("temp-")) {
      versionHistory.fetchVersions(currentProject.id);
    }
  }, [currentProject?.id, versionHistory]);

  // Save project handler
  const handleSaveProject = useCallback(async () => {
    const canvasData = canvasRef.current?.getCanvasData();
    if (!canvasData) return;

    // Generate thumbnail from canvas
    const thumbnail = canvasRef.current?.exportAsDataURL("image/jpeg", 0.6);

    if (currentProject?.id && !currentProject.id.startsWith("temp-")) {
      const success = await updateProject(currentProject.id, canvasData, thumbnail);
      if (success) {
        console.log("Project saved successfully");
      }
    } else {
      const newId = await saveProject(
        projectName || "Untitled Project",
        canvasData,
        thumbnail
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

  //  Keyboard shortcuts 
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
          setZoom((z) => Math.min(z + 10, 300));
        }
        if (e.key === "-") {
          e.preventDefault();
          setZoom((z) => Math.max(z - 10, 100));
        }
        if (e.key === "0") {
          e.preventDefault();
          setZoom(100);
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

  //  Scroll-wheel zoom 
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -5 : 5;
        setZoom((z) => Math.min(300, Math.max(100, z + delta)));
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  // 
  // Handlers
  // 

  const handleSaveProjectName = async () => {
    if (!currentProject?.id || !projectName.trim()) return;
    setIsSavingName(true);
    try {
      const success = await updateProjectName(
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

  const handleChatMessage = async (message: string) => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "chat",
          messages: [{ role: "user", content: message }],
          currentCode: editedCode || generatedCode,
          projectId: currentProject?.id,
          framework: "html",
          styling: "tailwind",
        }),
      });
      if (!response.ok) throw new Error("Failed to process request");
      const result = await response.json();
      setGeneratedCode(result.code);
      setEditedCode(result.code);
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
      alert("Please save the project first");
      return;
    }
    const description = prompt("Enter checkpoint description (optional):");
    const canvasData = canvasRef.current?.getCanvasData();
    if (canvasData)
      await versionHistory.createVersion(
        currentProject.id,
        canvasData,
        description || undefined
      );
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
      const dataURL = canvasRef.current?.exportAsPNG();
      if (dataURL) {
        const a = document.createElement("a");
        a.href = dataURL;
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
      canvasRef.current.insertTemplate(template.canvasData, template.name);
  };
  const handleInsertComponent = (component: { name?: string; canvasData: unknown }) => {
    if (canvasRef.current)
      canvasRef.current.insertTemplate(component.canvasData, component.name || 'Component');
  };

  const handleFitToScreen = () => setZoom(100);

  // Detection / AI
  const handleRunDetection = async () => {
    if (!canvasRef.current) return;
    setIsGenerating(true);
    setGeneratedCode("");
    setDetectedElements([]);
    try {
      const canvasData = canvasRef.current.getCanvasData();
      if (!canvasData || canvasData.lines.length === 0) {
        alert("Please draw something on the canvas first!");
        return;
      }
      let projectId = currentProject?.id;
      if (!projectId) {
        projectId = `temp-${Date.now()}`;
        setCurrentProject({ id: projectId, name: "Untitled Project" });
      }
      const response = await fetch("/api/generate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasData,
          framework: "html",
          styling: "tailwind",
          description: "",
          projectId,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to generate code");
      }
      const result = await response.json();
      setGeneratedCode(result.code);
      setEditedCode(result.code);
      setDetectedElements(result.detectedElements || []);
      setCurrentMode("preview");
      setShowCodePanel(true);
    } catch (err) {
      console.error("Error running detection:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Failed to generate code. Please try again."
      );
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
        setCodePanelHeight(Math.min(600, Math.max(200, startH + delta)));
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

  // Map expanded tool  what SketchCanvas understands
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

  // 
  // JSX
  // 

  return (
    <div className="flex h-screen flex-col bg-[#0A0A0A] overflow-hidden select-none">
      {/*  Top Navbar  */}
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
        onChatToggle={() =>
          setRightPanel(rightPanel === "chat" ? null : "chat")
        }
        onHistoryToggle={() => {}}
        isChatActive={rightPanel === "chat"}
        isHistoryActive={false}
      />

      {/*  Main workspace  */}
      <div className="flex flex-1 overflow-hidden">
        {/*  Left toolbar  */}
        <aside className="flex w-[52px] flex-col items-center border-r border-[#1E1E1E] bg-[#111111] py-2">
          {/* Tool groups */}
          {(["pointer", "draw", "shape", "annotate", "modify"] as const).map(
            (group, gi) => (
              <div key={group} className="w-full">
                {gi > 0 && (
                  <div className="mx-auto my-1.5 h-px w-7 bg-[#2A2A2A]" />
                )}
                {TOOLS.filter((t) => t.group === group).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setCurrentTool(t.id)}
                    title={`${t.label} (${t.shortcut})`}
                    className={`group relative mx-auto flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-150 ${
                      currentTool === t.id
                        ? "bg-[#FF6B00] text-white shadow-[0_0_12px_rgba(255,107,0,.35)]"
                        : "text-[#B0B0B0] hover:bg-[#1E1E1E] hover:text-white"
                    }`}
                  >
                    {t.icon}
                    {/* Tooltip */}
                    <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md bg-[#1A1A1A] border border-[#2E2E2E] px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">
                      {t.label}{" "}
                      <kbd className="ml-1 rounded bg-[#2E2E2E] px-1 py-0.5 text-[10px] text-[#A0A0A0]">
                        {t.shortcut}
                      </kbd>
                    </span>
                  </button>
                ))}
              </div>
            )
          )}

          <div className="flex-1" />

          {/* Bottom quick-access */}
          <div className="mx-auto mb-1 h-px w-7 bg-[#2A2A2A]" />

          <button
            onClick={() => setShowTemplates(true)}
            title="Templates"
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-[#B0B0B0] transition-all hover:bg-[#1E1E1E] hover:text-white"
          >
            <svg
              className="h-[18px] w-[18px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </button>

          <button
            onClick={() => setShowComponents(true)}
            title="Components"
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-[#B0B0B0] transition-all hover:bg-[#1E1E1E] hover:text-white"
          >
            <svg
              className="h-[18px] w-[18px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </button>

          <button
            onClick={() => setShowShortcuts(true)}
            title="Keyboard Shortcuts (?)"
            className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-lg text-[#B0B0B0] transition-all hover:bg-[#1E1E1E] hover:text-white"
          >
            <svg
              className="h-[18px] w-[18px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>
        </aside>

        {/*  Center column  */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/*  Sub-toolbar: style ribbon  */}
          <div className="flex h-11 items-center gap-3 border-b border-[#1E1E1E] bg-[#111111] px-3 overflow-x-auto">
            {/* Stroke color */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#999]">
                Stroke
              </span>
              <div className="flex items-center gap-1">
                {COLOR_PRESETS.slice(0, 6).map((c) => (
                  <button
                    key={`s-${c}`}
                    onClick={() => setStrokeColor(c)}
                    className={`h-5 w-5 rounded-full border-2 transition-all ${
                      strokeColor === c
                        ? "border-[#FF6B00] scale-110"
                        : "border-transparent hover:border-[#555]"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <label className="relative ml-0.5 h-5 w-5 cursor-pointer">
                  <input
                    type="color"
                    value={strokeColor}
                    onChange={(e) => setStrokeColor(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                  <div className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-[#555]">
                    <svg
                      className="h-3 w-3 text-[#888]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                </label>
              </div>
            </div>

            <div className="h-5 w-px bg-[#2A2A2A]" />

            {/* Fill color */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#999]">
                Fill
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setFillColor("transparent")}
                  className={`h-5 w-5 rounded-full border-2 transition-all ${
                    fillColor === "transparent"
                      ? "border-[#FF6B00] scale-110"
                      : "border-transparent hover:border-[#555]"
                  }`}
                  title="No fill"
                >
                  <svg
                    className="h-full w-full text-[#999]"
                    viewBox="0 0 24 24"
                  >
                    <line
                      x1="4"
                      y1="4"
                      x2="20"
                      y2="20"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                </button>
                {COLOR_PRESETS.slice(0, 5).map((c) => (
                  <button
                    key={`f-${c}`}
                    onClick={() => setFillColor(c)}
                    className={`h-5 w-5 rounded-full border-2 transition-all ${
                      fillColor === c
                        ? "border-[#FF6B00] scale-110"
                        : "border-transparent hover:border-[#555]"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <label className="relative ml-0.5 h-5 w-5 cursor-pointer">
                  <input
                    type="color"
                    value={fillColor === "transparent" ? "#ffffff" : fillColor}
                    onChange={(e) => setFillColor(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                  <div className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-[#555]">
                    <svg
                      className="h-3 w-3 text-[#888]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                </label>
              </div>
            </div>

            <div className="h-5 w-px bg-[#2A2A2A]" />

            {/* Stroke width */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#999]">
                Width
              </span>
              <div className="flex items-center gap-0.5">
                {STROKE_WIDTHS.map((w) => (
                  <button
                    key={w}
                    onClick={() => setStrokeWidth(w)}
                    title={`${w}px`}
                    className={`flex h-7 w-7 items-center justify-center rounded transition-all ${
                      strokeWidth === w
                        ? "bg-[#FF6B00]/20 text-[#FF6B00]"
                        : "text-[#999] hover:bg-[#1E1E1E] hover:text-white"
                    }`}
                  >
                    <div
                      className="rounded-full bg-current"
                      style={{
                        width: Math.min(w + 2, 14),
                        height: Math.min(w + 2, 14),
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="h-5 w-px bg-[#2A2A2A]" />

            {/* Grid & Snap */}
            <button
              onClick={() => setGridEnabled((p) => !p)}
              title="Toggle Grid"
              className={`flex h-7 items-center gap-1 rounded px-2 text-[11px] font-medium transition-all ${
                gridEnabled
                  ? "bg-[#FF6B00]/15 text-[#FF6B00]"
                  : "text-[#999] hover:bg-[#1E1E1E] hover:text-white"
              }`}
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M3 3h18v18H3V3zM3 9h18M3 15h18M9 3v18M15 3v18" />
              </svg>
              Grid
            </button>
            <button
              onClick={() => setSnapEnabled((p) => !p)}
              title="Toggle Snap"
              className={`flex h-7 items-center gap-1 rounded px-2 text-[11px] font-medium transition-all ${
                snapEnabled
                  ? "bg-[#FF6B00]/15 text-[#FF6B00]"
                  : "text-[#999] hover:bg-[#1E1E1E] hover:text-white"
              }`}
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M19 10L19 5L14 5" />
                <path d="M5 14L5 19L10 19" />
              </svg>
              Snap
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Undo / Redo */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => history.undo()}
                disabled={!history.canUndo}
                title="Undo (Ctrl+Z)"
                className="flex h-7 w-7 items-center justify-center rounded text-[#B0B0B0] transition-all hover:bg-[#1E1E1E] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 7v6h6" />
                  <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                </svg>
              </button>
              <button
                onClick={() => history.redo()}
                disabled={!history.canRedo}
                title="Redo (Ctrl+Shift+Z)"
                className="flex h-7 w-7 items-center justify-center rounded text-[#B0B0B0] transition-all hover:bg-[#1E1E1E] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 7v6h-6" />
                  <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
                </svg>
              </button>
            </div>

            <div className="h-5 w-px bg-[#2A2A2A]" />

            {/* Right panel toggles */}
            <div className="flex items-center gap-0.5">
              {[
                {
                  panel: "properties" as RightPanel,
                  label: "Properties",
                  icon: (
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  ),
                },
                {
                  panel: "layers" as RightPanel,
                  label: "Layers",
                  icon: (
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                  ),
                },
                {
                  panel: "chat" as RightPanel,
                  label: "AI Chat",
                  icon: (
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  ),
                },
              ].map(({ panel, label, icon }) => (
                <button
                  key={panel}
                  onClick={() =>
                    setRightPanel(rightPanel === panel ? null : panel)
                  }
                  title={label}
                  className={`flex h-7 w-7 items-center justify-center rounded transition-all ${
                    rightPanel === panel
                      ? "bg-[#FF6B00]/15 text-[#FF6B00]"
                      : "text-[#B0B0B0] hover:bg-[#1E1E1E] hover:text-white"
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/*  Canvas area  */}
          <main className="relative flex-1 overflow-hidden bg-[#0A0A0A]">
            <div className="flex h-full items-center justify-center p-2 sm:p-4 md:p-6">
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
            </div>

            {/* Zoom controls overlay */}
            <ZoomControls
              zoom={zoom}
              onZoomChange={setZoom}
              onFitToScreen={handleFitToScreen}
            />

            {/* Code panel toggle button - inside canvas area */}
            {!showCodePanel && (
              <button
                onClick={() => setShowCodePanel(true)}
                className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-lg bg-[#1A1A1A] border border-[#2E2E2E] px-3 py-2 text-xs font-medium text-[#A0A0A0] shadow-lg transition-all hover:border-[#FF6B00] hover:text-white hover:shadow-xl"
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

          {/*  Code panel (collapsible, resizable)  */}
          {showCodePanel && (
            <div
              className="border-t border-[#1E1E1E] bg-[#111111]"
              style={{ height: codePanelHeight }}
            >
              {/* Drag handle */}
              <div
                onMouseDown={handleCodePanelDrag}
                className="group flex h-2 cursor-row-resize items-center justify-center hover:bg-[#FF6B00]/10"
              >
                <div className="h-0.5 w-8 rounded-full bg-[#2E2E2E] transition-colors group-hover:bg-[#FF6B00]" />
              </div>

              <div className="flex h-[calc(100%-8px)] flex-col">
                {/* Tab bar */}
                <div className="flex items-center justify-between border-b border-[#1E1E1E] px-3 py-1.5">
                  <div className="flex gap-1">
                    {(["code", "preview", "split"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setCodeViewMode(mode)}
                        className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-all ${
                          codeViewMode === mode
                            ? "bg-white text-[#0A0A0A]"
                            : "text-[#B0B0B0] hover:bg-[#1E1E1E] hover:text-white"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowCodePanel(false)}
                    className="rounded p-1 text-[#B0B0B0] transition-colors hover:bg-[#1E1E1E] hover:text-white"
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

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                  {generatedCode || editedCode ? (
                    <>
                      {codeViewMode === "code" && (
                        <MonacoCodeEditor
                          value={editedCode || generatedCode}
                          language={codeLanguage}
                          onChange={(v) => setEditedCode(v || "")}
                          height="100%"
                        />
                      )}
                      {codeViewMode === "preview" && (
                        <LivePreview
                          code={editedCode || generatedCode}
                          language="html"
                        />
                      )}
                      {codeViewMode === "split" && (
                        <div className="flex h-full">
                          <div className="flex-1 border-r border-[#1E1E1E]">
                            <MonacoCodeEditor
                              value={editedCode || generatedCode}
                              language={codeLanguage}
                              onChange={(v) => setEditedCode(v || "")}
                              height="100%"
                            />
                          </div>
                          <div className="flex-1">
                            <LivePreview
                              code={editedCode || generatedCode}
                              language="html"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center text-[#999]">
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
          )}
        </div>

        {/*  Right panel  */}
        {rightPanel && (
          <aside className="w-72 overflow-y-auto border-l border-[#1E1E1E] bg-[#111111]">
            {/* Properties panel */}
            {rightPanel === "properties" && (
              <div className="p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#888]">
                    Properties
                  </h2>
                  <button
                    onClick={() => setRightPanel(null)}
                    className="rounded p-1 text-[#999] hover:bg-[#1E1E1E] hover:text-white"
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
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-[#999]">
                    Canvas
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center justify-between rounded-lg bg-[#0A0A0A] px-3 py-2">
                      <span className="text-xs text-[#A0A0A0]">Show Grid</span>
                      <button
                        onClick={() => setGridEnabled(!gridEnabled)}
                        className={`relative h-5 w-9 rounded-full transition-colors ${gridEnabled ? "bg-[#FF6B00]" : "bg-[#2E2E2E]"}`}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${gridEnabled ? "translate-x-4" : "translate-x-0"}`}
                        />
                      </button>
                    </label>
                    <label className="flex items-center justify-between rounded-lg bg-[#0A0A0A] px-3 py-2">
                      <span className="text-xs text-[#A0A0A0]">
                        Snap to Grid
                      </span>
                      <button
                        onClick={() => setSnapEnabled(!snapEnabled)}
                        className={`relative h-5 w-9 rounded-full transition-colors ${snapEnabled ? "bg-[#FF6B00]" : "bg-[#2E2E2E]"}`}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${snapEnabled ? "translate-x-4" : "translate-x-0"}`}
                        />
                      </button>
                    </label>
                  </div>
                </div>

                {/* Version Checkpoints */}
                <div className="mt-6">
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#999]">
                    Checkpoints
                  </h3>
                  <button
                    onClick={handleCreateCheckpoint}
                    className="w-full rounded-lg border border-dashed border-[#2E2E2E] bg-[#0A0A0A] px-3 py-2 text-xs text-[#A0A0A0] transition-all hover:border-[#FF6B00] hover:text-[#FF6B00]"
                  >
                    + Create Checkpoint
                  </button>
                  {versionHistory.versions.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {versionHistory.versions.slice(0, 3).map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between rounded-lg bg-[#0A0A0A] px-3 py-1.5"
                        >
                          <span className="truncate text-xs text-[#A0A0A0]">
                            {v.description || "Checkpoint"}
                          </span>
                          <button
                            onClick={() => handleRestoreVersion(v.id)}
                            className="ml-2 text-[10px] text-[#FF6B00] hover:underline"
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
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#888]">
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
                      className="rounded p-1 text-[#999] hover:bg-[#1E1E1E] hover:text-white"
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
                      className="rounded p-1 text-[#999] hover:bg-[#1E1E1E] hover:text-white"
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
              </div>
            )}

            {/* Chat panel */}
            {rightPanel === "chat" && (
              <ChatInterface
                onSendMessage={handleChatMessage}
                isProcessing={isGenerating}
              />
            )}
          </aside>
        )}
      </div>
      {/* -- Welcome dialog -- */}
      {showWelcomeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#2E2E2E] bg-[#1A1A1A] p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-[#FF6B00]/20 p-3">
                <svg
                  className="h-6 w-6 text-[#FF6B00]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">Design Imported!</h2>
            </div>
            <p className="mb-6 text-[#A0A0A0]">
              Your sketch from the mini canvas has been imported. What would you
              like to do?
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setShowWelcomeDialog(false)}
                className="w-full rounded-lg border border-[#2E2E2E] bg-[#2E2E2E] px-6 py-3 font-semibold text-white transition-all hover:bg-[#3E3E3E]"
              >
                Continue Designing
              </button>
              <button
                onClick={() => {
                  setShowWelcomeDialog(false);
                  setCurrentMode("detect");
                }}
                className="w-full rounded-lg bg-[#FF6B00]/20 border border-[#FF6B00]/50 px-6 py-3 font-semibold text-white transition-all hover:bg-[#FF6B00]/30 hover:shadow-[0_0_20px_rgba(255,107,0,0.4)]"
              >
                Ready to Roll - Analyze Design
              </button>
              <button
                onClick={() => {
                  setShowWelcomeDialog(false);
                  setImportedDesign(null);
                  localStorage.removeItem("miniCanvasDesign");
                }}
                className="w-full rounded-lg border border-[#2E2E2E] bg-transparent px-6 py-3 text-sm text-[#A0A0A0] transition-all hover:bg-[#2E2E2E] hover:text-white"
              >
                Start Fresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- Modals -- */}
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
      <SaveIndicator isSaving={isSaving} lastSaved={lastSaved} error={error} />
    </div>
  );
}
