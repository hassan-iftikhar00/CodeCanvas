"use client";

import { useState } from "react";

export type ExportFormat = "png" | "svg" | "json" | "zip" | "copy";
export type CodeFramework = "react" | "vue" | "html" | "nextjs";
export type StylingOption = "tailwind" | "css" | "styled-components";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
  canvasData?: any;
  generatedCode?: string;
}

export interface ExportOptions {
  format: ExportFormat;
  framework?: CodeFramework;
  styling?: StylingOption;
  quality?: number;
  includeAssets?: boolean;
}

export default function ExportDialog({
  isOpen,
  onClose,
  onExport,
  canvasData,
  generatedCode,
}: ExportDialogProps) {
  const [exportType, setExportType] = useState<"image" | "code">("code");
  const [imageFormat, setImageFormat] = useState<"png" | "svg">("png");
  const [codeFormat, setCodeFormat] = useState<"zip" | "json" | "copy">("copy");
  const [framework, setFramework] = useState<CodeFramework>("html");
  const [styling, setStyling] = useState<StylingOption>("tailwind");
  const [quality, setQuality] = useState(100);
  const [includeAssets, setIncludeAssets] = useState(true);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyToClipboard = async () => {
    if (!generatedCode) {
      alert("No code to copy!");
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert("Failed to copy code to clipboard");
    }
  };

  const handleExport = () => {
    const options: ExportOptions = {
      format: exportType === "image" ? imageFormat : codeFormat,
      framework: exportType === "code" ? framework : undefined,
      styling: exportType === "code" ? styling : undefined,
      quality: exportType === "image" && imageFormat === "png" ? quality : undefined,
      includeAssets: exportType === "code" ? includeAssets : undefined,
    };

    if (codeFormat === "copy") {
      handleCopyToClipboard();
    } else {
      onExport(options);
    }
    
    if (codeFormat !== "copy") {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-[#2E2E2E] bg-[#1A1A1A] shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-[#2E2E2E] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Export Project</h2>
              <p className="mt-1 text-sm text-[#A0A0A0]">
                Choose your export format and options
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-[#A0A0A0] transition-all hover:bg-[#2E2E2E] hover:text-white"
              aria-label="Close"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Export Type Toggle */}
        <div className="px-6 pt-6">
          <div className="flex gap-2 rounded-xl bg-[#0A0A0A] border border-[#2E2E2E] p-1">
            <button
              onClick={() => setExportType("code")}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                exportType === "code"
                  ? "bg-white text-[#0A0A0A] shadow-sm"
                  : "text-[#A0A0A0] hover:text-white"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Code Export
              </div>
            </button>
            <button
              onClick={() => setExportType("image")}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                exportType === "image"
                  ? "bg-white text-[#0A0A0A] shadow-sm"
                  : "text-[#A0A0A0] hover:text-white"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Image Export
              </div>
            </button>
          </div>
        </div>

        {/* Export Options */}
        <div className="p-6">
          {exportType === "code" ? (
            <div className="space-y-4">
              {/* Code Format */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Export Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setCodeFormat("copy")}
                    className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                      codeFormat === "copy"
                        ? "border-[#FF6B00] bg-[#FF6B00]/20 text-white"
                        : "border-[#2E2E2E] bg-[#0A0A0A] text-[#A0A0A0] hover:border-[#4A4A4A] hover:text-white"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </div>
                  </button>
                  <button
                    onClick={() => setCodeFormat("zip")}
                    className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                      codeFormat === "zip"
                        ? "border-[#FF6B00] bg-[#FF6B00]/20 text-white"
                        : "border-[#2E2E2E] bg-[#0A0A0A] text-[#A0A0A0] hover:border-[#4A4A4A] hover:text-white"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      ZIP
                    </div>
                  </button>
                  <button
                    onClick={() => setCodeFormat("json")}
                    className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                      codeFormat === "json"
                        ? "border-[#FF6B00] bg-[#FF6B00]/20 text-white"
                        : "border-[#2E2E2E] bg-[#0A0A0A] text-[#A0A0A0] hover:border-[#4A4A4A] hover:text-white"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      JSON
                    </div>
                  </button>
                </div>
              </div>

              {/* Preview Code Snippet */}
              {generatedCode && codeFormat === "copy" && (
                <div className="rounded-lg border border-[#2E2E2E] bg-[#0A0A0A] p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#A0A0A0]">Code Preview</span>
                    <span className="text-xs text-[#666666]">{generatedCode.length} chars</span>
                  </div>
                  <pre className="max-h-32 overflow-auto rounded border border-[#2E2E2E] bg-black p-2 text-xs text-[#E0E0E0]">
                    {generatedCode.substring(0, 500)}...
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Image Format */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Image Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setImageFormat("png")}
                    className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                      imageFormat === "png"
                        ? "border-[#FF6B00] bg-[#FF6B00]/20 text-white"
                        : "border-[#2E2E2E] bg-[#0A0A0A] text-[#A0A0A0] hover:border-[#4A4A4A] hover:text-white"
                    }`}
                  >
                    PNG
                  </button>
                  <button
                    onClick={() => setImageFormat("svg")}
                    className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                      imageFormat === "svg"
                        ? "border-[#FF6B00] bg-[#FF6B00]/20 text-white"
                        : "border-[#2E2E2E] bg-[#0A0A0A] text-[#A0A0A0] hover:border-[#4A4A4A] hover:text-white"
                    }`}
                  >
                    SVG
                  </button>
                </div>
              </div>

              {/* Quality Slider (only for PNG) */}
              {imageFormat === "png" && (
                <div>
                  <label className="mb-2 flex items-center justify-between text-sm font-semibold text-white">
                    <span>Quality</span>
                    <span className="text-[#FF6B00]">{quality}%</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="w-full accent-[#FF6B00]"
                  />
                  <div className="mt-1 flex justify-between text-xs text-[#A0A0A0]">
                    <span>Low</span>
                    <span>High</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-[#2E2E2E] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-[#2E2E2E] bg-transparent px-6 py-2.5 text-sm font-semibold text-[#A0A0A0] transition-all hover:border-[#4A4A4A] hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="rounded-lg bg-[#FF6B00] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(255,107,0,0.3)] transition-all hover:bg-[#E66000] hover:shadow-[0_0_30px_rgba(255,107,0,0.5)]"
          >
            <div className="flex items-center gap-2">
              {copied ? (
                <>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {codeFormat === "copy" ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    )}
                  </svg>
                  {codeFormat === "copy" ? "Copy to Clipboard" : "Export"}
                </>
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
