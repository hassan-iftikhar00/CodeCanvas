/**
 * Example integration for enhanced canvas page with new components
 * Copy this code into canvas/page.tsx to integrate all new features
 */

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { SketchCanvasRef } from "@/components/canvas/SketchCanvas";
import { createClient } from "@/lib/supabase/client";

// Import new components
import { useHistory } from "@/hooks/useHistory";
import ShortcutsPanel from "@/components/ShortcutsPanel";
import LayerPanel, { type Layer } from "@/components/canvas/LayerPanel";
import ExportDialog, { type ExportOptions } from "@/components/ExportDialog";

const SketchCanvas = dynamic(() => import("@/components/canvas/SketchCanvas"), {
  ssr: false,
});

type Tool = "pen" | "shape" | "text" | "erase" | "select";
type Mode = "sketch" | "detect" | "refine" | "preview";

interface CanvasState {
  lines: any[];
  selectedTool: Tool;
}

export default function EnhancedCanvasPage() {
  const [currentTool, setCurrentTool] = useState<Tool>("pen");
  const [currentMode, setCurrentMode] = useState<Mode>("sketch");
  const [showInspector, setShowInspector] = useState(true);
  const [showCodePanel, setShowCodePanel] = useState(true);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(false);

  // NEW: Enhanced state management
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [layers, setLayers] = useState<Layer[]>([
    { id: "layer-1", name: "Layer 1", type: "pen", visible: true, locked: false, opacity: 1 },
  ]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>("layer-1");

  // NEW: Undo/Redo with history hook
  const { state: canvasState, setState: setCanvasState, undo, redo, canUndo, canRedo } = useHistory<CanvasState>({
    initialState: { lines: [], selectedTool: "pen" },
    maxHistory: 50,
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string>("");

  const canvasRef = useRef<SketchCanvasRef>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  // NEW: Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Shortcuts panel
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
      
      // Tool shortcuts
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case "p": setCurrentTool("pen"); break;
          case "s": setCurrentTool("shape"); break;
          case "t": setCurrentTool("text"); break;
          case "e": setCurrentTool("erase"); break;
          case "v": setCurrentTool("select"); break;
          case "g": setGridEnabled((prev) => !prev); break;
        }
      }
      
      // View toggles
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "\\") {
          e.preventDefault();
          setShowInspector((prev) => !prev);
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
      const canvasData = canvasRef.current?.getCanvasData();
      // TODO: Implement image export logic
      alert(`Exporting as ${options.format.toUpperCase()}...`);
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

  // Existing functions...
  const handleRunDetection = async () => {
    // ... existing code ...
  };

  return (
    <div className="flex h-screen flex-col bg-[#0A0A0A]">
      {/* Top Toolbar - Enhanced */}
      <header className="flex items-center justify-between border-b border-[#2E2E2E] bg-[#1A1A1A] px-4 py-3 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xl font-bold text-white transition-colors hover:text-[#FF6B00]">
            CodeCanvas
          </Link>
          <div className="h-6 w-px bg-[#2E2E2E]" />
          
          {/* NEW: Undo/Redo buttons with state */}
          <div className="flex items-center gap-1">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="rounded-lg p-2 text-[#A0A0A0] transition-colors hover:bg-[#2E2E2E] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              title="Undo (Ctrl+Z)"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="rounded-lg p-2 text-[#A0A0A0] transition-colors hover:bg-[#2E2E2E] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              title="Redo (Ctrl+Shift+Z)"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
              </svg>
            </button>
          </div>

          {/* NEW: Shortcuts button */}
          <button
            onClick={() => setShowShortcuts(true)}
            className="rounded-lg bg-[#2E2E2E] px-3 py-1.5 text-xs font-medium text-[#A0A0A0] transition-colors hover:bg-white hover:text-[#0A0A0A]"
            title="Keyboard Shortcuts (?)"
          >
            <kbd className="font-mono">?</kbd> Shortcuts
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowExport(true)}
            className="rounded-lg bg-[#2E2E2E] px-4 py-2 text-sm font-semibold text-white transition-all duration-[var(--duration-fast)] hover:bg-white hover:text-[#0A0A0A]"
          >
            Export
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Inspector with Layer Panel */}
        {showInspector && (
          <aside className="w-80 overflow-y-auto border-r border-[#2E2E2E] bg-[#1A1A1A] p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-white">
                Layers
              </h2>
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
          </aside>
        )}

        {/* Canvas Area */}
        <main className="relative flex-1 overflow-hidden bg-[#0A0A0A]">
          <div className="flex h-full items-center justify-center p-8">
            <SketchCanvas
              ref={canvasRef}
              tool={currentTool}
              mode={currentMode}
              gridEnabled={gridEnabled}
              snapEnabled={snapEnabled}
            />
          </div>
        </main>
      </div>

      {/* NEW: Modals */}
      <ShortcutsPanel isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <ExportDialog
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        onExport={handleExport}
      />
    </div>
  );
}
