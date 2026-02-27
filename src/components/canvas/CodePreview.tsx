"use client";

import { useState, useEffect, useRef } from "react";
import { Monitor, Tablet, Smartphone, RotateCw } from "lucide-react";

interface CodePreviewProps {
  code: string;
  mode: "code" | "preview" | "split";
  onModeChange: (mode: "code" | "preview" | "split") => void;
}

export default function CodePreview({
  code,
  mode,
  onModeChange,
}: CodePreviewProps) {
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">(
    "desktop"
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const viewportSizes = {
    desktop: { width: "100%", height: "100%" },
    tablet: { width: "768px", height: "1024px" },
    mobile: { width: "375px", height: "667px" },
  };

  // Refresh iframe content when code changes
  useEffect(() => {
    if (iframeRef.current && code) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;

      if (doc) {
        doc.open();
        doc.write(code);
        doc.close();
      }
    }
  }, [code]);

  const handleRefresh = () => {
    if (iframeRef.current) {
      const iframe = iframeRef.current;
      iframe.src = iframe.src; // Force reload
    }
  };

  if (mode === "code") {
    return null; // Code view handled by Monaco editor
  }

  const currentMode: string = mode;

  return (
    <div className="flex h-full flex-col bg-[var(--grey-900)]">
      {/* Preview Controls */}
      <div className="flex items-center justify-between border-b border-[var(--grey-700)] px-4 py-2">
        {/* Mode Tabs */}
        <div className="flex gap-1 rounded-lg bg-[var(--grey-800)] p-1">
          <button
            onClick={() => onModeChange("code")}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-all ${
              currentMode === "code"
                ? "bg-white text-[var(--grey-900)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-white"
            }`}
          >
            Code
          </button>
          <button
            onClick={() => onModeChange("preview")}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-all ${
              mode === "preview"
                ? "bg-white text-[var(--grey-900)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-white"
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => onModeChange("split")}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-all ${
              mode === "split"
                ? "bg-white text-[var(--grey-900)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-white"
            }`}
          >
            Split
          </button>
        </div>

        {/* Viewport Controls */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-[var(--grey-800)] p-1">
            <button
              onClick={() => setViewport("desktop")}
              className={`rounded p-2 transition-all ${
                viewport === "desktop"
                  ? "bg-[var(--orange-primary)] text-white"
                  : "text-[var(--text-secondary)] hover:text-white"
              }`}
              title="Desktop"
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewport("tablet")}
              className={`rounded p-2 transition-all ${
                viewport === "tablet"
                  ? "bg-[var(--orange-primary)] text-white"
                  : "text-[var(--text-secondary)] hover:text-white"
              }`}
              title="Tablet"
            >
              <Tablet className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewport("mobile")}
              className={`rounded p-2 transition-all ${
                viewport === "mobile"
                  ? "bg-[var(--orange-primary)] text-white"
                  : "text-[var(--text-secondary)] hover:text-white"
              }`}
              title="Mobile"
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={handleRefresh}
            className="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--grey-700)] hover:text-white"
            title="Refresh Preview"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 overflow-auto bg-[var(--grey-800)] p-4">
        <div className="flex h-full items-center justify-center">
          {code ? (
            <div
              className="bg-white shadow-xl transition-all"
              style={{
                width: viewportSizes[viewport].width,
                height: viewportSizes[viewport].height,
                maxWidth: "100%",
                maxHeight: "100%",
              }}
            >
              <iframe
                ref={iframeRef}
                title="Code Preview"
                className="h-full w-full border-0"
                sandbox="allow-scripts"
              />
            </div>
          ) : (
            <div className="text-center">
              <Monitor className="mx-auto mb-3 h-16 w-16 text-[var(--text-muted)] opacity-30" />
              <p className="text-sm text-[var(--text-muted)]">
                No code generated yet
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Draw on canvas and click "Run Detection"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
