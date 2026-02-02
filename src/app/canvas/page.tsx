"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { SketchCanvasRef } from "@/components/canvas/SketchCanvas";
import { createClient } from "@/lib/supabase/client";

// NEW: Import enhanced components
import { useHistory } from "@/hooks/useHistory";
import ShortcutsPanel from "@/components/ShortcutsPanel";
import LayerPanel, { type Layer } from "@/components/canvas/LayerPanel";
import ExportDialog, { type ExportOptions } from "@/components/ExportDialog";
import ToolPalette from "@/components/canvas/ToolPalette";
import TemplatesPanel from "@/components/canvas/TemplatesPanel";
import SaveIndicator from "@/components/SaveIndicator";
import ZoomControls from "@/components/canvas/ZoomControls";
import { useProjectSave, useAutoSave } from "@/hooks/useProjectSave";
import type { Template } from "@/data/templates";

// Phase 1: New components
import MonacoCodeEditor from "@/components/canvas/MonacoCodeEditor";
import LivePreview from "@/components/canvas/LivePreview";
import VersionHistory from "@/components/canvas/VersionHistory";
import ChatInterface from "@/components/canvas/ChatInterface";
import ComponentPalette from "@/components/canvas/ComponentPalette";
import { useVersionHistory } from "@/hooks/useVersionHistory";

// Dynamically import canvas to avoid SSR issues
const SketchCanvas = dynamic(() => import("@/components/canvas/SketchCanvasWithHistory"), {
  ssr: false,
});

type Tool = "pen" | "shape" | "text" | "select" | "bin";
type Mode = "sketch" | "detect" | "refine" | "preview";

export default function CanvasPage() {
  const [currentTool, setCurrentTool] = useState<Tool>("pen");
  const [currentMode, setCurrentMode] = useState<Mode>("sketch");
  const [activeSidebar, setActiveSidebar] = useState<"inspector" | "chat" | "history" | null>("inspector");
  const [showCodePanel, setShowCodePanel] = useState(false);  // Start minimized to show more canvas space
  const [gridEnabled, setGridEnabled] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);
  const [importedDesign, setImportedDesign] = useState<
    { x: number; y: number }[][] | null
  >(null);

  // NEW: Enhanced feature states
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showComponentPalette, setShowComponentPalette] = useState(false);
  const [showToolPalette, setShowToolPalette] = useState(false);
  const [showTemplatesPanel, setShowTemplatesPanel] = useState(false);
  const [layers, setLayers] = useState<Layer[]>([
    { id: "layer-1", name: "Layer 1", type: "pen", visible: true, locked: false, opacity: 1 },
  ]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>("layer-1");

  // NEW: Tool properties
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [fillColor, setFillColor] = useState("transparent");
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [zoom, setZoom] = useState(100);

  const { saveProject, updateProject, updateProjectName, loadProject, isSaving: isManualSaving, lastSaved, error } = useProjectSave();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [originalProjectName, setOriginalProjectName] = useState("Untitled Project");
  const [isSavingName, setIsSavingName] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [detectedElements, setDetectedElements] = useState<
    Array<{ type: string; bounds: any }>
  >([]);
  const [currentProject, setCurrentProject] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // NEW: Undo/Redo with history hook
  const history = useHistory({
    initialState: {
      lines: [] as any[],
      shapes: [] as any[],
    },
    maxHistory: 50,
  });

  // Enable Auto-save
  const { isSaving: isAutoSaving } = useAutoSave(currentProject?.id || null, history.state);
  const isSaving = isManualSaving || isAutoSaving;

  // Phase 1: Code editor and preview states
  const [codeViewMode, setCodeViewMode] = useState<"code" | "preview" | "split">("code");
  const [codeLanguage, setCodeLanguage] = useState<"html" | "css" | "javascript" | "typescript">("html");
  const [editedCode, setEditedCode] = useState<string>("");

  // Phase 1: Version history states
  // Phase 1: Version history states
  // const [showVersionHistory, setShowVersionHistory] = useState(false); // Replaced by activeSidebar
  const versionHistory = useVersionHistory();

  const canvasRef = useRef<SketchCanvasRef>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

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
          setOriginalProjectName(project.name);  // Track original for comparison
          if (project.canvas_data) {
            // Load canvas data into history/state
            // If we have a ref, load it directly
            // But we need to sync with history too
            // Ideally history hook should have a 'reset' or 'load' function
            // For now, we'll try to insert it if canvas is ready
            // delay slightly to ensuring canvas is mounted
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

  const handleContinueDesigning = () => {
    setShowWelcomeDialog(false);
    // The design is already imported, user can continue
  };

  const handleReadyToRoll = () => {
    setShowWelcomeDialog(false);
    setCurrentMode("detect");
    // Switch to detect mode to analyze the design
  };

  const handleStartFresh = () => {
    setShowWelcomeDialog(false);
    setImportedDesign(null);
    localStorage.removeItem("miniCanvasDesign");
  };

  // Phase 2: Chat Handler
  const handleChatMessage = async (message: string) => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "chat",
          messages: [{ role: "user", content: message }],
          currentCode: editedCode || generatedCode,
          projectId: currentProject?.id,
          framework: "html", // Simplified for now
          styling: "tailwind",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to process request");
      }

      const result = await response.json();

      // Update code with refinement
      setGeneratedCode(result.code);
      setEditedCode(result.code);

    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  // Phase 2: Handle Project Name Save
  const handleSaveProjectName = async () => {
    if (!currentProject?.id || !projectName.trim()) return;

    setIsSavingName(true);
    try {
      const success = await updateProjectName(currentProject.id, projectName.trim());
      if (success) {
        setCurrentProject({ ...currentProject, name: projectName.trim() });
        setOriginalProjectName(projectName.trim());  // Update original after save
      }
    } finally {
      setIsSavingName(false);
    }
  };

  // Phase 1: Version history handlers
  const handleCreateCheckpoint = async () => {
    if (!currentProject?.id) {
      alert("Please save the project first");
      return;
    }

    const description = prompt("Enter checkpoint description (optional):");
    const canvasData = canvasRef.current?.getCanvasData();

    if (canvasData) {
      await versionHistory.createVersion(currentProject.id, canvasData, description || undefined);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    const canvasData = await versionHistory.restoreVersion(versionId);
    if (canvasData && canvasRef.current) {
      // Clear and reload canvas with version data
      canvasRef.current.clearCanvas();
      canvasRef.current.insertTemplate(canvasData);
      alert("Version restored successfully!");
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    await versionHistory.deleteVersion(versionId);
  };

  // Load version history when project changes
  useEffect(() => {
    if (currentProject?.id && currentProject.id.startsWith("temp-") === false) {
      versionHistory.fetchVersions(currentProject.id);
    }
  }, [currentProject?.id, versionHistory]);

  // NEW: Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Shortcuts panel toggle
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }

      // Tool shortcuts (no modifiers)
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case "p": setCurrentTool("pen"); break;
          case "s": setCurrentTool("shape"); break;
          case "t": setCurrentTool("text"); break;
          case "v": setCurrentTool("select"); break;
          case "d": setCurrentTool("bin"); break;
          case "g": setGridEnabled((prev) => !prev); break;
        }
      }

      // View toggles
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "\\") {
          e.preventDefault();
          setActiveSidebar((prev) => (prev === "inspector" ? null : "inspector"));
        }
        if (e.key === "`") {
          e.preventDefault();
          setShowCodePanel((prev) => !prev);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // NEW: Layer management functions
  const handleSelectLayer = (id: string) => {
    setSelectedLayerId(id);
  };

  const handleToggleVisibility = (id: string) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === id ? { ...layer, visible: !layer.visible } : layer
      )
    );
  };

  const handleToggleLock = (id: string) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === id ? { ...layer, locked: !layer.locked } : layer
      )
    );
  };

  const handleDeleteLayer = (id: string) => {
    setLayers((prev) => prev.filter((layer) => layer.id !== id));
    if (selectedLayerId === id) {
      setSelectedLayerId(layers[0]?.id || null);
    }
  };

  const handleDuplicateLayer = (id: string) => {
    const layer = layers.find((l) => l.id === id);
    if (layer) {
      const newLayer = {
        ...layer,
        id: `layer-${Date.now()}`,
        name: `${layer.name} Copy`,
      };
      setLayers((prev) => [...prev, newLayer]);
    }
  };

  const handleRenameLayer = (id: string, newName: string) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === id ? { ...layer, name: newName } : layer
      )
    );
  };

  // NEW: Export handler
  const handleExport = (options: ExportOptions) => {
    console.log("Exporting with options:", options);

    if (options.format === "png" || options.format === "svg") {
      // Export as image
      alert(`Exporting as ${options.format.toUpperCase()}...`);
      // TODO: Implement image export logic
    } else {
      // Export as code
      const code = generatedCode || "// No code generated yet";

      if (options.format === "json") {
        // Download as JSON
        const blob = new Blob([code], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `codecanvas-export.${options.format}`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        alert(`Exporting as ${options.framework} project...`);
        // TODO: Implement ZIP export
      }
    }
  };

  // NEW: Template insertion handler
  const handleInsertTemplate = (template: Template) => {
    console.log("Inserting template:", template.name);
    if (canvasRef.current) {
      canvasRef.current.insertTemplate(template.canvasData);
      setShowShortcuts(false); // Close other panels if open
    }
  };

  // Phase 3: Component insertion handler
  const handleInsertComponent = (component: any) => {
    console.log("Inserting component:", component.name);
    if (canvasRef.current) {
      canvasRef.current.insertTemplate(component.canvasData);
    }
  };

  // NEW: Zoom handlers
  const handleFitToScreen = () => {
    // TODO: Calculate optimal zoom to fit all content
    setZoom(100);
  };

  const handleRunDetection = async () => {
    if (!canvasRef.current) {
      console.error("Canvas ref not available");
      return;
    }

    setIsGenerating(true);
    setGeneratedCode("");
    setDetectedElements([]);

    try {
      // Get canvas data
      const canvasData = canvasRef.current.getCanvasData();

      if (!canvasData || canvasData.lines.length === 0) {
        alert("Please draw something on the canvas first!");
        return;
      }

      // Create or use existing project
      let projectId = currentProject?.id;

      if (!projectId) {
        // For now, generate a temporary project ID
        // In production, this would create a project in Supabase
        projectId = `temp-${Date.now()}`;
        setCurrentProject({ id: projectId, name: "Untitled Project" });
      }

      // Call the API
      const response = await fetch("/api/generate-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          canvasData,
          framework: "html", // HTML only
          styling: "tailwind", // Tailwind or CSS
          description: "", // Optional user description
          projectId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate code");
      }

      const result = await response.json();

      setGeneratedCode(result.code);
      setEditedCode(result.code); // Sync with editor
      setDetectedElements(result.detectedElements || []);
      setCurrentMode("preview");
      setShowCodePanel(true);
    } catch (error) {
      console.error("Error running detection:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to generate code. Please try again."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-[#0A0A0A] overflow-hidden">
      {/* Top Toolbar */}
      <header className="flex items-center justify-between border-b border-[#2E2E2E] bg-[#1A1A1A] px-4 py-3 shadow-sm overflow-hidden">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-[#A0A0A0] transition-colors hover:text-white"
            title="Back to Dashboard"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div className="h-6 w-px bg-[#2E2E2E]" />
          <Link
            href="/dashboard"
            className="text-xl font-bold text-white transition-colors hover:text-[#FF6B00]"
          >
            CodeCanvas
          </Link>
          <div className="h-6 w-px bg-[#2E2E2E]" />
          <div className="relative">
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && currentProject?.id && projectName !== originalProjectName) {
                  handleSaveProjectName();
                }
              }}
              className="rounded-lg border border-[#2E2E2E] bg-[#0A0A0A] px-3 py-1.5 pr-10 text-sm font-medium text-white focus:border-[#FF6B00] focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/20"
              placeholder="Project Name"
            />
            {/* Save button - only shows when name changed */}
            {projectName !== originalProjectName && projectName.trim() && (
              <button
                onClick={handleSaveProjectName}
                disabled={isSavingName || !currentProject?.id}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full bg-white text-[#0A0A0A] transition-all hover:bg-[#FF6B00] hover:text-white disabled:opacity-50"
                title="Save project name (Enter)"
              >
                {isSavingName ? (
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )}
          </div>

          {/* NEW: Shortcuts Button */}
          <button
            onClick={() => setShowShortcuts(true)}
            className="rounded-lg bg-[#2E2E2E] px-3 py-1.5 text-xs font-medium text-[#A0A0A0] transition-colors hover:bg-white hover:text-[#0A0A0A]"
            title="Keyboard Shortcuts (?)"
          >
            <kbd className="font-mono">?</kbd> Shortcuts
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-2 rounded-xl bg-[#0A0A0A] border border-[#2E2E2E] p-1">
          {(["sketch", "detect", "refine", "preview"] as Mode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setCurrentMode(mode)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-all duration-(--duration-fast) ${currentMode === mode
                ? "bg-white text-[#0A0A0A] shadow-sm"
                : "text-[#A0A0A0] hover:bg-[#2E2E2E] hover:text-white"
                }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Undo/Redo */}
          <div className="flex items-center gap-1">
            <button
              onClick={history.undo}
              disabled={!history.canUndo}
              className={`rounded-lg p-2 transition-colors ${history.canUndo
                ? "text-white hover:bg-[#2E2E2E]"
                : "text-[#4A4A4A] cursor-not-allowed opacity-50"
                }`}
              title="Undo (Ctrl+Z)"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                />
              </svg>
            </button>
            <button
              onClick={history.redo}
              disabled={!history.canRedo}
              className={`rounded-lg p-2 transition-colors ${history.canRedo
                ? "text-white hover:bg-[#2E2E2E]"
                : "text-[#4A4A4A] cursor-not-allowed opacity-50"
                }`}
              title="Redo (Ctrl+Shift+Z)"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"
                />
              </svg>
            </button>
          </div>

          <div className="h-6 w-px bg-[#2E2E2E]" />

          {/* Run Detection Button */}
          <button
            onClick={handleRunDetection}
            disabled={isGenerating}
            className="flex items-center gap-2 rounded-lg bg-[#FF6B00]/20 border border-[#FF6B00]/50 backdrop-blur-md px-4 py-2 text-sm font-semibold text-white transition-all duration-(--duration-fast) hover:bg-[#FF6B00]/30 hover:border-[#FF6B00] hover:scale-105 hover:shadow-[0_0_20px_rgba(255,107,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isGenerating ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Analyzing...
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M13 7H7v6h6V7z" />
                  <path
                    fillRule="evenodd"
                    d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z"
                    clipRule="evenodd"
                  />
                </svg>
                Run Detection
              </>
            )}
          </button>

          <button
            onClick={() => setShowExport(true)}
            className="rounded-lg bg-[#2E2E2E] px-4 py-2 text-sm font-semibold text-white transition-all duration-(--duration-fast) hover:bg-white hover:text-[#0A0A0A]"
          >
            Export
          </button>

          {/* Phase 1: Version History Button */}
          {/* Phase 2: Chat Button */}
          <button
            onClick={() => setActiveSidebar(activeSidebar === "chat" ? null : "chat")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${activeSidebar === "chat"
              ? "bg-white text-[#0A0A0A]"
              : "bg-[#2E2E2E] text-white hover:bg-white hover:text-[#0A0A0A]"
              }`}
            title="AI Chat"
          >
            <svg className="mr-2 inline-block h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Chat
          </button>

          {/* Phase 1: Version History Button */}
          <button
            onClick={() => setActiveSidebar(activeSidebar === "history" ? null : "history")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${activeSidebar === "history"
              ? "bg-white text-[#0A0A0A]"
              : "bg-[#2E2E2E] text-white hover:bg-white hover:text-[#0A0A0A]"
              }`}
            title="Version History"
          >
            <svg
              className="mr-2 inline-block h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            History
          </button>

          {/* Phase 1: Save Indicator - Fixed position to prevent layout shifts */}
          <div className="w-32 shrink-0">
            <SaveIndicator isSaving={isSaving} lastSaved={lastSaved} error={error} />
          </div>

          <div className="h-6 w-px bg-[#2E2E2E]" />

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="rounded-lg p-2 text-[#A0A0A0] transition-colors hover:bg-[#2E2E2E] hover:text-white"
            title="Logout"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Tool Rail */}
        <aside className="flex w-16 flex-col items-center gap-2 border-r border-[#2E2E2E] bg-[#1A1A1A] py-4 shadow-sm">
          {[
            {
              tool: "pen" as Tool,
              icon: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
              label: "Pen (P)",
            },
            {
              tool: "shape" as Tool,
              icon: "M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z",
              label: "Shapes (S)",
            },
            {
              tool: "text" as Tool,
              icon: "M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z",
              label: "Text (T)",
            },
            {
              tool: "select" as Tool,
              icon: "M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122",
              label: "Select (V)",
            },
            {
              tool: "bin" as Tool,
              icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
              label: "Delete (D)",
            },
          ].map(({ tool, icon, label }) => (
            <button
              key={tool}
              onClick={() => setCurrentTool(tool)}
              title={label}
              className={`group relative flex h-12 w-12 items-center justify-center rounded-lg transition-all duration-(--duration-fast) ${currentTool === tool
                ? "bg-white text-[#0A0A0A] shadow-md"
                : "text-[#A0A0A0] hover:bg-[#2E2E2E] hover:text-white"
                }`}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={icon}
                />
              </svg>
            </button>
          ))}
          {/* Templates, Components, and Tools buttons below main tool options */}
          <button
            onClick={() => setShowTemplatesPanel(true)}
            className={`flex h-12 w-12 items-center justify-center rounded-lg transition-all duration-(--duration-fast) ${showTemplatesPanel
              ? "bg-white text-[#0A0A0A] shadow-md"
              : "text-[#A0A0A0] hover:bg-[#2E2E2E] hover:text-white"
              }`}
            title="Templates"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          {/* Components Button */}
          <button
            onClick={() => setShowComponentPalette(true)}
            className={`flex h-12 w-12 items-center justify-center rounded-lg transition-all duration-(--duration-fast) ${showComponentPalette
              ? "bg-white text-[#0A0A0A] shadow-md"
              : "text-[#A0A0A0] hover:bg-[#2E2E2E] hover:text-white"
              }`}
            title="Components (C)"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          {/* Tools Button */}
          <button
            onClick={() => setShowToolPalette(true)}
            className={`flex h-12 w-12 items-center justify-center rounded-lg transition-all duration-(--duration-fast) ${showToolPalette
              ? "bg-white text-[#0A0A0A] shadow-md"
              : "text-[#A0A0A0] hover:bg-[#2E2E2E] hover:text-white"
              }`}
            title="Tools"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </button>

          <div className="my-2 h-px w-8 bg-[#2E2E2E]" />
          {/* Grid & Snap Toggles */}
          {/* Removed duplicate shape icon button here */}

          {/* Removed Toggle Snap button from sidebar */}
        </aside>

        {/* Center: Canvas Area */}
        <main className="relative flex-1 overflow-hidden bg-[#0A0A0A]">
          <div className="flex h-full items-center justify-center p-8">
            <SketchCanvas
              ref={canvasRef}
              tool={currentTool}
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
        </main>

        {/* Right: Inspector Panel */}
        {activeSidebar === "inspector" && (
          <aside className="w-80 overflow-y-auto border-l border-[#2E2E2E] bg-[#1A1A1A] p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-white">
                Layers
              </h2>
              <button
                onClick={() => setActiveSidebar(null)}
                className="rounded-lg p-1 text-[#A0A0A0] transition-colors hover:bg-[#2E2E2E] hover:text-white"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* NEW: Layer Panel */}
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

            {/* Detected Elements - Keep existing for now */}
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-[#2E2E2E] bg-[#0A0A0A] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">
                    Detected Elements
                  </h3>
                  <span className="rounded-full bg-[#2E2E2E] px-2 py-0.5 text-xs font-medium text-white">
                    3
                  </span>
                </div>

                <div className="space-y-2">
                  {[
                    { type: "Button", confidence: 92, props: "primary, large" },
                    { type: "Input", confidence: 88, props: "email type" },
                    { type: "Container", confidence: 95, props: "flex layout" },
                  ].map((element, idx) => (
                    <div
                      key={idx}
                      className="group cursor-pointer rounded-lg border border-[#FF6B00] bg-[#1A1A1A] p-3 transition-all shadow-[0_0_15px_rgba(255,107,0,0.15)] hover:shadow-[0_0_25px_rgba(255,107,0,0.3)]"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">
                              {element.type}
                            </span>
                            <span className="text-xs text-[#A0A0A0]">
                              {element.props}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-[#2E2E2E]">
                              <div
                                className="h-full rounded-full bg-white transition-all"
                                style={{ width: `${element.confidence}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-white">
                              {element.confidence}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-1">
                        <button className="rounded bg-white/10 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-white/20">
                          Edit
                        </button>
                        <button className="rounded bg-[#2E2E2E] px-2 py-1 text-xs font-medium text-[#A0A0A0] transition-colors hover:bg-white/10 hover:text-white">
                          Change Type
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* NLP Intent Chips */}
              <div className="rounded-lg border border-[#2E2E2E] bg-[#0A0A0A] p-4">
                <h3 className="mb-3 text-sm font-semibold text-white">
                  Detected Intents
                </h3>
                <div className="flex flex-wrap gap-2">
                  {["submit-form", "validate-email", "open-modal"].map(
                    (intent) => (
                      <button
                        key={intent}
                        className="rounded-full bg-[#2E2E2E] px-3 py-1.5 text-xs font-medium text-[#A0A0A0] transition-all hover:bg-white/10 hover:text-white"
                      >
                        {intent}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Properties Panel */}
              <div className="rounded-lg border border-[#2E2E2E] bg-[#0A0A0A] p-4">
                <h3 className="mb-3 text-sm font-semibold text-white">
                  Properties
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#A0A0A0]">
                      Element Type
                    </label>
                    <select className="w-full rounded-lg border border-[#2E2E2E] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:border-[#FF6B00] focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/20">
                      <option>Button</option>
                      <option>Input</option>
                      <option>Container</option>
                      <option>Text</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#A0A0A0]">
                      Class Name
                    </label>
                    <input
                      type="text"
                      placeholder="btn-primary"
                      className="w-full rounded-lg border border-[#2E2E2E] bg-[#1A1A1A] px-3 py-2 text-sm text-white placeholder:text-[#666666] focus:border-[#FF6B00] focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/20"
                    />
                  </div>
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* Phase 1: Version History Sidebar */}
        {activeSidebar === "history" && (
          <aside className="w-80 overflow-y-auto border-l border-[#2E2E2E] bg-[#1A1A1A] z-20 shadow-[-5px_0_15px_rgba(0,0,0,0.5)]">
            <VersionHistory
              projectId={currentProject?.id || ""}
              versions={versionHistory.versions}
              loading={versionHistory.loading}
              onRestore={handleRestoreVersion}
              onDelete={handleDeleteVersion}
              onCreateCheckpoint={handleCreateCheckpoint}
            />
          </aside>
        )}

        {/* Phase 2: Chat Sidebar */}
        {activeSidebar === "chat" && (
          <aside className="w-80 overflow-y-auto border-l border-[#2E2E2E] bg-[#1A1A1A] z-20 shadow-[-5px_0_15px_rgba(0,0,0,0.5)]">
            <ChatInterface
              onSendMessage={handleChatMessage}
              isProcessing={isGenerating}
            />
          </aside>
        )}
      </div>

      {/* Phase 1: Enhanced Code/Preview Panel with Monaco && Live Preview */}
      {showCodePanel && (
        <div
          className="border-t border-[#2E2E2E] bg-[#1A1A1A]"
          style={{ height: "400px" }}
        >
          <div className="flex h-full flex-col">
            {/* Tab header */}
            <div className="flex items-center justify-between border-b border-[#2E2E2E] px-4 py-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setCodeViewMode("code")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${codeViewMode === "code"
                    ? "bg-white text-[#0A0A0A]"
                    : "text-[#A0A0A0] hover:bg-[#2E2E2E] hover:text-white"
                    }`}
                >
                  Code
                </button>
                <button
                  onClick={() => setCodeViewMode("preview")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${codeViewMode === "preview"
                    ? "bg-white text-[#0A0A0A]"
                    : "text-[#A0A0A0] hover:bg-[#2E2E2E] hover:text-white"
                    }`}
                >
                  Preview
                </button>
                <button
                  onClick={() => setCodeViewMode("split")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${codeViewMode === "split"
                    ? "bg-white text-[#0A0A0A]"
                    : "text-[#A0A0A0] hover:bg-[#2E2E2E] hover:text-white"
                    }`}
                >
                  Split
                </button>
              </div>
              <button
                onClick={() => setShowCodePanel(false)}
                className="rounded-lg p-1 text-[#A0A0A0] transition-colors hover:bg-[#2E2E2E] hover:text-white"
                title="Close Panel"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-hidden">
              {generatedCode || editedCode ? (
                <>
                  {codeViewMode === "code" && (
                    <MonacoCodeEditor
                      value={editedCode || generatedCode}
                      language={codeLanguage}
                      onChange={(value) => setEditedCode(value || "")}
                      height="100%"
                    />
                  )}
                  {codeViewMode === "preview" && (
                    <LivePreview code={editedCode || generatedCode} language="html" />
                  )}
                  {codeViewMode === "split" && (
                    <div className="flex h-full">
                      <div className="flex-1 border-r border-[#2E2E2E]">
                        <MonacoCodeEditor
                          value={editedCode || generatedCode}
                          language={codeLanguage}
                          onChange={(value) => setEditedCode(value || "")}
                          height="100%"
                        />
                      </div>
                      <div className="flex-1">
                        <LivePreview code={editedCode || generatedCode} language="html" />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-full items-center justify-center bg-[#0A0A0A] text-[#A0A0A0]">
                  <div className="text-center">
                    <svg
                      className="mx-auto mb-3 h-12 w-12 opacity-50"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                      />
                    </svg>
                    <p className="text-sm">
                      Draw on the canvas and click &quot;Run Detection&quot; to generate code
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Show Inspector Toggle (when hidden) */}
      {!activeSidebar && (
        <button
          onClick={() => setActiveSidebar("inspector")}
          className="fixed right-4 top-20 rounded-lg bg-[#1A1A1A] border border-[#2E2E2E] p-2 shadow-lg transition-all hover:bg-white hover:border-white hover:shadow-xl"
        >
          <svg
            className="h-5 w-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 5l7 7-7 7M5 5l7 7-7 7"
            />
          </svg>
        </button>
      )}

      {/* Show Code Panel Toggle (when hidden) */}
      {!showCodePanel && (
        <button
          onClick={() => setShowCodePanel(true)}
          className="fixed bottom-4 right-4 rounded-lg bg-white p-2 shadow-lg transition-all hover:shadow-xl"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
        </button>
      )}

      {/* Welcome Dialog for Imported Design */}
      {showWelcomeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#2E2E2E] bg-[#1A1A1A] p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-[#FF6B00]/20 p-3">
                <svg
                  className="h-6 w-6 text-[#FF6B00]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
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
                onClick={handleContinueDesigning}
                className="w-full rounded-lg border border-[#2E2E2E] bg-[#2E2E2E] px-6 py-3 font-semibold text-white transition-all hover:bg-[#3E3E3E] hover:border-[#4E4E4E]"
              >
                Continue Designing
              </button>

              <button
                onClick={handleReadyToRoll}
                className="w-full rounded-lg bg-[#FF6B00]/20 border border-[#FF6B00]/50 px-6 py-3 font-semibold text-white transition-all hover:bg-[#FF6B00]/30 hover:border-[#FF6B00] hover:shadow-[0_0_20px_rgba(255,107,0,0.4)]"
              >
                Ready to Roll - Analyze Design →
              </button>

              <button
                onClick={handleStartFresh}
                className="w-full rounded-lg border border-[#2E2E2E] bg-transparent px-6 py-3 text-sm font-medium text-[#A0A0A0] transition-all hover:bg-[#2E2E2E] hover:text-white"
              >
                Start Fresh (Discard Import)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Shortcuts Panel Modal */}
      <ShortcutsPanel
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      {/* NEW: Export Dialog Modal */}
      <ExportDialog
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        onExport={handleExport}
        canvasData={canvasRef.current?.getCanvasData()}
        generatedCode={editedCode || generatedCode}
      />

      {/* NEW: Tool Palette */}
      <ToolPalette
        isOpen={showToolPalette}
        onClose={() => setShowToolPalette(false)}
        strokeColor={strokeColor}
        fillColor={fillColor}
        strokeWidth={strokeWidth}
        onStrokeColorChange={setStrokeColor}
        onFillColorChange={setFillColor}
        onStrokeWidthChange={setStrokeWidth}
      />

      {/* NEW: Templates Panel */}
      <TemplatesPanel
        isOpen={showTemplatesPanel}
        onClose={() => setShowTemplatesPanel(false)}
        onInsertTemplate={handleInsertTemplate}
      />

      {/* Phase 3: Component Palette */}
      <ComponentPalette
        isOpen={showComponentPalette}
        onClose={() => setShowComponentPalette(false)}
        onInsertComponent={handleInsertComponent}
      />

      {/* NEW: Zoom Controls */}
      <ZoomControls
        zoom={zoom}
        onZoomChange={setZoom}
        onFitToScreen={handleFitToScreen}
      />

      {/* NEW: Save Indicator */}
      <SaveIndicator isSaving={isSaving} lastSaved={lastSaved} error={error} />
    </div>
  );
}
