"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DraftingModal, {
  ModalButton,
  ModalSection,
  ModalOption,
} from "./DraftingModal";
import { T_CANVAS } from "./canvasTokens";

// Source of the uploaded image. Drives backend preprocessing:
//   upload-photo  -> binarize (photo of a paper/whiteboard sketch)
//   upload-clean  -> crop only (clean digital wireframe export)
export type UploadSource = "upload-photo" | "upload-clean";

export interface UploadDetectionPayload {
  /** Full data URL (data:image/...;base64,...) to send as sketchImage. */
  dataUrl: string;
  source: UploadSource;
  /** Natural pixel dimensions, used to seed a minimal canvasData. */
  width: number;
  height: number;
  /** Original filename from the user's device (e.g. "wireframe.png"). */
  fileName?: string;
}

interface UploadSketchModalProps {
  open: boolean;
  onClose: () => void;
  onDetect: (payload: UploadDetectionPayload) => void;
  isGenerating?: boolean;
}

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const ACCEPTED_LABEL = "PNG, JPG or WEBP";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB raw (base64 inflates ~33%; backend cap is 20 MB)

export default function UploadSketchModal({
  open,
  onClose,
  onDetect,
  isGenerating = false,
}: UploadSketchModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<UploadDetectionPayload | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [source, setSource] = useState<UploadSource>("upload-photo");
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const reset = useCallback(() => {
    setPreview(null);
    setFileName("");
    setSource("upload-photo");
    setError(null);
    setDragActive(false);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  // Clear only the chosen file, keeping the image-type toggle where the user
  // set it. Used by the "Remove" button under the preview.
  const clearSelection = useCallback(() => {
    setPreview(null);
    setFileName("");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // Start fresh every time the modal opens. Detection closes the modal via
  // setShowUpload(false) (not handleClose), so without this the previous file
  // and its preview would still be sitting here on the next open, including the
  // "Replace image" reopen from the uploaded-sketch panel.
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const readFile = useCallback(
    (file: File) => {
      setError(null);

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(
          `Unsupported file type. Use ${ACCEPTED_LABEL}. (iPhone HEIC photos are not supported, share as JPG.)`
        );
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("Image is too large. Max size is 10 MB.");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        if (!dataUrl) {
          setError("Could not read that file. Try another image.");
          return;
        }
        // Load to capture natural dimensions for the backend canvasData seed.
        const img = new Image();
        img.onload = () => {
          setPreview({
            dataUrl,
            source,
            width: img.naturalWidth || 1000,
            height: img.naturalHeight || 600,
          });
          setFileName(file.name);
        };
        img.onerror = () => {
          setError("That image could not be decoded. Try another file.");
        };
        img.src = dataUrl;
      };
      reader.onerror = () => {
        setError("Could not read that file. Try another image.");
      };
      reader.readAsDataURL(file);
    },
    [source]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  const handleDetect = () => {
    if (!preview || isGenerating) return;
    onDetect({ ...preview, source, fileName: fileName || undefined });
  };

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <ModalButton
        variant="ghost"
        onClick={handleClose}
        disabled={isGenerating}
      >
        Cancel
      </ModalButton>
      <ModalButton
        variant="primary"
        onClick={handleDetect}
        disabled={!preview || isGenerating}
      >
        {isGenerating ? "Detecting" : "Run detection"}
      </ModalButton>
    </div>
  );

  return (
    <DraftingModal
      open={open}
      onClose={handleClose}
      slug="INPUT · UPLOAD"
      title="Upload a sketch"
      subtitle="Drop a photo of a hand-drawn wireframe, or a clean digital wireframe image. It runs through the same detection and code generation as a drawing."
      footer={footer}
      maxWidth={560}
    >
      {/* DROP ZONE / PREVIEW */}
      <ModalSection label="Image">
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          aria-label="Upload an image: click to browse or drag and drop"
          className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center cursor-pointer transition-colors"
          style={{
            background: dragActive ? T_CANVAS.cobaltWash : T_CANVAS.vellum,
            border: `1px dashed ${dragActive ? T_CANVAS.cobalt : T_CANVAS.rule}`,
            minHeight: 200,
          }}
        >
          {preview ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview.dataUrl}
                alt="Uploaded sketch preview"
                className="max-h-[240px] max-w-full object-contain"
                style={{ border: `1px solid ${T_CANVAS.rule}` }}
              />
              <span className="text-[13px]" style={{ color: T_CANVAS.muted }}>
                {fileName}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={(e) => {
                    e.stopPropagation();
                    inputRef.current?.click();
                  }}
                  className="px-2.5 py-1 text-[13px] uppercase tracking-[0.14em] transition-colors disabled:opacity-50"
                  style={{
                    background: T_CANVAS.paper,
                    border: `1px solid ${T_CANVAS.rule}`,
                    color: T_CANVAS.graphite,
                    fontFamily:
                      "var(--font-jetbrains-mono, ui-monospace, monospace)",
                    cursor: isGenerating ? "not-allowed" : "pointer",
                  }}
                >
                  Replace
                </button>
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSelection();
                  }}
                  className="px-2.5 py-1 text-[13px] uppercase tracking-[0.14em] transition-colors disabled:opacity-50"
                  style={{
                    background: T_CANVAS.paper,
                    border: `1px solid ${T_CANVAS.rule}`,
                    color: T_CANVAS.error,
                    fontFamily:
                      "var(--font-jetbrains-mono, ui-monospace, monospace)",
                    cursor: isGenerating ? "not-allowed" : "pointer",
                  }}
                >
                  Remove
                </button>
              </div>
            </>
          ) : (
            <>
              <span
                className="flex h-9 w-9 items-center justify-center"
                style={{
                  color: T_CANVAS.muted,
                  border: `1px solid ${T_CANVAS.rule}`,
                }}
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </span>
              <span
                className="text-[13px]"
                style={{
                  color: T_CANVAS.graphite,
                  fontFamily:
                    "var(--font-inter, ui-sans-serif, system-ui, sans-serif)",
                }}
              >
                Click to browse or drag an image here
              </span>
              <span className="text-[13px]" style={{ color: T_CANVAS.muted }}>
                {ACCEPTED_LABEL} · up to 10 MB
              </span>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={onInputChange}
          className="hidden"
        />
        {error && (
          <p className="mt-2 text-[13px]" style={{ color: T_CANVAS.error }}>
            {error}
          </p>
        )}
      </ModalSection>

      {/* SOURCE TYPE */}
      <ModalSection label="Image type">
        <div className="grid grid-cols-2 gap-2">
          <ModalOption
            active={source === "upload-photo"}
            onClick={() => setSource("upload-photo")}
            label="Photo / scan"
            hint="Camera photo or scan of a paper or whiteboard sketch. Background noise and shadows are cleaned up automatically."
          />
          <ModalOption
            active={source === "upload-clean"}
            onClick={() => setSource("upload-clean")}
            label="Digital wireframe"
            hint="Exported from Figma, Balsamiq, draw.io, etc. Crisp lines are kept as-is, no cleanup applied."
          />
        </div>
        <p className="mt-2 text-[13px]" style={{ color: T_CANVAS.muted }}>
          Works best with a clear wireframe on a light background. One sketch
          per image.
        </p>
      </ModalSection>
    </DraftingModal>
  );
}
