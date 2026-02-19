"use client";

import { useState, useEffect, useRef } from "react";

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
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
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
                  d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
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
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </button>
          </div>

          <button
            onClick={handleRefresh}
            className="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--grey-700)] hover:text-white"
            title="Refresh Preview"
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
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
              <svg
                className="mx-auto mb-3 h-16 w-16 text-[var(--text-muted)] opacity-30"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
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
