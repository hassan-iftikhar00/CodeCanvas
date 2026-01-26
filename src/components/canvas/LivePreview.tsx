"use client";

import React, { useState, useEffect, useRef } from "react";

interface LivePreviewProps {
  code: string;
  language?: "html" | "react";
}

type DeviceType = "desktop" | "laptop" | "tablet" | "mobile";
type Orientation = "portrait" | "landscape";

const DEVICE_PRESETS = {
  desktop: { width: 1920, height: 1080, label: "Desktop" },
  laptop: { width: 1440, height: 900, label: "Laptop" },
  tablet: { width: 768, height: 1024, label: "Tablet" },
  mobile: { width: 375, height: 667, label: "Mobile" },
};

export default function LivePreview({ code, language = "html" }: LivePreviewProps) {
  const [device, setDevice] = useState<DeviceType>("desktop");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [scale, setScale] = useState(1);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getDeviceDimensions = () => {
    const preset = DEVICE_PRESETS[device];
    if (orientation === "landscape") {
      return { width: preset.height, height: preset.width };
    }
    return { width: preset.width, height: preset.height };
  };

  const dimensions = getDeviceDimensions();

  useEffect(() => {
    if (!containerRef.current) return;

    const updateScale = () => {
      const container = containerRef.current!;
      const containerWidth = container.clientWidth - 48; // padding
      const containerHeight = container.clientHeight - 48;

      const scaleX = containerWidth / dimensions.width;
      const scaleY = containerHeight / dimensions.height;
      const newScale = Math.min(scaleX, scaleY, 1);

      setScale(newScale);
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [dimensions.width, dimensions.height]);

  useEffect(() => {
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

    if (!iframeDoc) return;

    let htmlContent = code;

    if (!code.includes("<!DOCTYPE") && !code.includes("<html")) {
      htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline';">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body>
${code}
<script>
  const originalLog = console.log;
  console.log = function(...args) {
    originalLog.apply(console, args);
    window.parent.postMessage({ type: 'console', data: args.map(a => String(a)).join(' ') }, '*');
  };
  
  window.onerror = function(msg, url, line) {
    window.parent.postMessage({ type: 'error', data: \`Error: \${msg} at line \${line}\` }, '*');
    return false;
  };
</script>
</body>
</html>
      `;
    }

    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();
  }, [code]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "console" || event.data.type === "error") {
        setConsoleOutput((prev) => [...prev, event.data.data]);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
    setConsoleOutput([]);
  };

  const handleOpenInNewWindow = () => {
    const newWindow = window.open("", "_blank");
    if (newWindow) {
      newWindow.document.write(code);
      newWindow.document.close();
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#0A0A0A]">
      <div className="flex items-center justify-between border-b border-[#2E2E2E] bg-[#1A1A1A] px-4 py-2">
        <div className="flex items-center gap-2">
          {Object.entries(DEVICE_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => setDevice(key as DeviceType)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                device === key
                  ? "bg-white text-[#0A0A0A]"
                  : "bg-[#2E2E2E] text-[#A0A0A0] hover:bg-white/10 hover:text-white"
              }`}
              title={`${preset.label} (${preset.width}x${preset.height})`}
            >
              {preset.label}
            </button>
          ))}

          {device !== "desktop" && (
            <button
              onClick={() =>
                setOrientation((prev) => (prev === "portrait" ? "landscape" : "portrait"))
              }
              className="ml-2 rounded-lg bg-[#2E2E2E] p-2 text-white transition-all hover:bg-white/10"
              title="Toggle Orientation"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConsole(!showConsole)}
            className="rounded-lg bg-[#2E2E2E] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-white/10"
          >
            Console {consoleOutput.length > 0 && `(${consoleOutput.length})`}
          </button>

          <button
            onClick={handleRefresh}
            className="rounded-lg bg-[#2E2E2E] p-2 text-white transition-all hover:bg-white/10"
            title="Refresh Preview"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

          <button
            onClick={handleOpenInNewWindow}
            className="rounded-lg bg-[#2E2E2E] p-2 text-white transition-all hover:bg-white/10"
            title="Open in New Window"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </button>

          <span className="text-xs text-[#666666]">
            {dimensions.width} × {dimensions.height} @ {Math.round(scale * 100)}%
          </span>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto bg-[#0A0A0A] p-6">
        <div
          className="mx-auto bg-white shadow-2xl"
          style={{
            width: dimensions.width,
            height: dimensions.height,
            transform: `scale(${scale})`,
            transformOrigin: "top center",
          }}
        >
          <iframe
            ref={iframeRef}
            title="Live Preview"
            sandbox="allow-scripts allow-same-origin allow-forms"
            className="h-full w-full border-0"
          />
        </div>
      </div>

      {showConsole && (
        <div className="border-t border-[#2E2E2E] bg-[#1A1A1A] p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Console Output</h3>
            <button
              onClick={() => setConsoleOutput([])}
              className="text-xs text-[#A0A0A0] hover:text-white"
            >
              Clear
            </button>
          </div>
          <div className="max-h-32 overflow-auto rounded-lg bg-[#0A0A0A] p-3 font-mono text-xs text-white">
            {consoleOutput.length === 0 ? (
              <div className="text-[#666666]">No console output</div>
            ) : (
              consoleOutput.map((output, i) => (
                <div key={i} className="py-1">
                  &gt; {output}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
