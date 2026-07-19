"use client";

import { useState } from "react";
import DraftingModal, {
  ModalButton,
  ModalSection,
  ModalOption,
} from "@/components/canvas/DraftingModal";
import { T_CANVAS } from "@/components/canvas/canvasTokens";

export type ExportFormat =
  | "png"
  | "svg"
  | "json"
  | "zip"
  | "copy"
  | "stackblitz";
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
  generatedCode,
}: ExportDialogProps) {
  const [exportType, setExportType] = useState<"image" | "code">("code");
  const [imageFormat, setImageFormat] = useState<"png" | "svg">("png");
  const [codeFormat, setCodeFormat] = useState<
    "zip" | "json" | "copy" | "stackblitz"
  >("copy");
  const [framework] = useState<CodeFramework>("react");
  const [styling] = useState<StylingOption>("tailwind");
  const [quality, setQuality] = useState(100);
  const [copied, setCopied] = useState(false);

  const handleCopyToClipboard = async () => {
    if (!generatedCode) {
      alert("No code to copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Failed to copy code to clipboard.");
    }
  };

  const handleExport = () => {
    const options: ExportOptions = {
      format: exportType === "image" ? imageFormat : codeFormat,
      framework: exportType === "code" ? framework : undefined,
      styling: exportType === "code" ? styling : undefined,
      quality:
        exportType === "image" && imageFormat === "png" ? quality : undefined,
      includeAssets: exportType === "code" ? true : undefined,
    };
    // Copy stays in-modal so the user sees the COPIED confirmation state.
    // Everything else delegates to the parent and closes the dialog.
    if (exportType === "code" && codeFormat === "copy") {
      handleCopyToClipboard();
      return;
    }
    onExport(options);
    onClose();
  };

  const isCopyMode = exportType === "code" && codeFormat === "copy";
  const isStackBlitzMode = exportType === "code" && codeFormat === "stackblitz";

  return (
    <DraftingModal
      open={isOpen}
      onClose={onClose}
      slug="EXPORT · CHOOSE FORMAT"
      title="Export your work."
      subtitle="Pick how you want to take this away. Code goes to your editor, image to your slide deck."
      dataOnboarding="export-dialog"
      footer={
        <div className="flex items-center justify-between">
          <ModalButton onClick={onClose}>CANCEL</ModalButton>
          <ModalButton variant="primary" onClick={handleExport}>
            {copied ? (
              <>
                <CheckIcon />
                COPIED
              </>
            ) : isCopyMode ? (
              <>
                <CopyIcon />
                COPY TO CLIPBOARD
              </>
            ) : isStackBlitzMode ? (
              <>
                <BoltIcon />
                OPEN IN STACKBLITZ
              </>
            ) : (
              <>
                <DownloadIcon />
                EXPORT →
              </>
            )}
          </ModalButton>
        </div>
      }
    >
      {/* TYPE TOGGLE — code / image */}
      <ModalSection label="EXPORT TYPE">
        <div className="grid grid-cols-2 gap-2">
          <ModalOption
            active={exportType === "code"}
            onClick={() => setExportType("code")}
            icon={<CodeIcon />}
            label="CODE"
            hint="Components, ZIP, JSON"
          />
          <ModalOption
            active={exportType === "image"}
            onClick={() => setExportType("image")}
            icon={<ImageIcon />}
            label="IMAGE"
            hint="PNG or SVG of the sketch"
          />
        </div>
      </ModalSection>

      {exportType === "code" ? (
        <>
          <ModalSection label="METHOD">
            <div className="grid grid-cols-4 gap-2">
              <ModalOption
                active={codeFormat === "copy"}
                onClick={() => setCodeFormat("copy")}
                icon={<CopyIcon />}
                label="COPY"
              />
              <ModalOption
                active={codeFormat === "zip"}
                onClick={() => setCodeFormat("zip")}
                icon={<DownloadIcon />}
                label="ZIP"
              />
              <ModalOption
                active={codeFormat === "json"}
                onClick={() => setCodeFormat("json")}
                icon={<JsonIcon />}
                label="JSON"
              />
              <ModalOption
                active={codeFormat === "stackblitz"}
                onClick={() => setCodeFormat("stackblitz")}
                icon={<BoltIcon />}
                label="STACKBLITZ"
                hint="Open live in browser"
              />
            </div>
          </ModalSection>

          {generatedCode && codeFormat === "copy" && (
            <ModalSection label="PREVIEW">
              <div
                className="text-[13px]"
                style={{
                  background: T_CANVAS.vellum,
                  border: `1px solid ${T_CANVAS.rule}`,
                }}
              >
                <style jsx global>{`
                  .export-preview-scroll::-webkit-scrollbar-track {
                    background: transparent;
                  }
                `}</style>
                <div
                  className="flex items-center justify-between border-b px-3 py-1.5 text-[13px] tracking-[0.14em] uppercase"
                  style={{
                    borderColor: T_CANVAS.rule,
                    color: T_CANVAS.muted,
                    fontFamily:
                      "var(--font-jetbrains-mono, ui-monospace, monospace)",
                  }}
                >
                  <span>~/output.tsx</span>
                  <span>{generatedCode.length} CHARS</span>
                </div>
                <pre
                  className="export-preview-scroll max-h-32 overflow-auto p-3 text-[13px] leading-normal"
                  style={{
                    color: T_CANVAS.graphite,
                    scrollbarColor: `${T_CANVAS.graphite} transparent`,
                    fontFamily:
                      "var(--font-jetbrains-mono, ui-monospace, monospace)",
                  }}
                >
                  {generatedCode.substring(0, 500)}
                  {generatedCode.length > 500 ? "..." : ""}
                </pre>
              </div>
            </ModalSection>
          )}
        </>
      ) : (
        <>
          <ModalSection label="FORMAT">
            <div className="grid grid-cols-2 gap-2">
              <ModalOption
                active={imageFormat === "png"}
                onClick={() => setImageFormat("png")}
                icon={<ImageIcon />}
                label="PNG"
                hint="Raster, includes background"
              />
              <ModalOption
                active={imageFormat === "svg"}
                onClick={() => setImageFormat("svg")}
                icon={<VectorIcon />}
                label="SVG"
                hint="Vector, scales infinitely"
              />
            </div>
          </ModalSection>

          {imageFormat === "png" && (
            <ModalSection label="QUALITY">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  aria-label="Export quality"
                  className="h-px flex-1 cursor-pointer appearance-none"
                  style={{
                    background: `linear-gradient(to right, ${T_CANVAS.cobalt} 0%, ${T_CANVAS.cobalt} ${quality}%, ${T_CANVAS.rule} ${quality}%, ${T_CANVAS.rule} 100%)`,
                  }}
                />
                <span
                  className="w-12 text-right text-[13px] tabular-nums tracking-[0.06em]"
                  style={{
                    color: T_CANVAS.graphite,
                    fontFamily:
                      "var(--font-jetbrains-mono, ui-monospace, monospace)",
                  }}
                >
                  {quality}%
                </span>
              </div>
            </ModalSection>
          )}
        </>
      )}
    </DraftingModal>
  );
}

// ─── ICONS ──────────────────────────────────────────────────────────────────

const ic = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  className: "h-4 w-4",
  "aria-hidden": true,
};

function CodeIcon() {
  return (
    <svg {...ic}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
function ImageIcon() {
  return (
    <svg {...ic}>
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg {...ic}>
      <rect x="9" y="9" width="13" height="13" rx="1" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg {...ic}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
function JsonIcon() {
  return (
    <svg {...ic}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="15" y2="17" />
    </svg>
  );
}
function VectorIcon() {
  return (
    <svg {...ic}>
      <polygon points="12 2 22 12 12 22 2 12" />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg {...ic}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg {...ic}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
