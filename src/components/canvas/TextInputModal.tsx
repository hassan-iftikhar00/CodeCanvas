"use client";

import { useEffect, useRef } from "react";
import DraftingModal, { ModalButton } from "./DraftingModal";
import { T_CANVAS } from "./canvasTokens";

interface TextInputModalProps {
  open: boolean;
  value: string;
  isEditing: boolean;
  kind?: "text" | "button";
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function TextInputModal({
  open,
  value,
  isEditing,
  kind = "text",
  onChange,
  onSubmit,
  onCancel,
}: TextInputModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isButton = kind === "button";

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [open]);

  return (
    <DraftingModal
      open={open}
      onClose={onCancel}
      slug={isButton ? "BUTTON TOOL" : "TEXT TOOL"}
      title={
        isButton
          ? isEditing
            ? "Edit button label"
            : "Add button"
          : isEditing
            ? "Edit text"
            : "Add text"
      }
      subtitle="Press Enter to add, Shift+Enter for a new line, or Escape to cancel."
      maxWidth={520}
    >
      <div className="space-y-4">
        <div>
          <label
            htmlFor="text-input-modal-value"
            className="mb-2 block text-[13px] tracking-[0.18em] uppercase"
            style={{
              color: T_CANVAS.muted,
              fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
            }}
          >
            {isButton ? "Button label" : "Text"}
          </label>
          <textarea
            id="text-input-modal-value"
            ref={textareaRef}
            rows={5}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
            placeholder="Enter your text (Shift+Enter for new line)"
            className="w-full resize-none px-3 py-2 text-sm leading-normal"
            style={{
              background: T_CANVAS.paper,
              border: `1px solid ${T_CANVAS.rule}`,
              color: T_CANVAS.graphite,
              caretColor: T_CANVAS.cobalt,
              fontFamily:
                "var(--font-inter, ui-sans-serif, system-ui, sans-serif)",
              outline: "none",
            }}
          />
        </div>

        <div className="flex gap-2">
          <ModalButton variant="primary" onClick={onSubmit} type="button">
            {isEditing ? "Save" : "Add"}
          </ModalButton>
          <ModalButton variant="ghost" onClick={onCancel} type="button">
            Cancel
          </ModalButton>
        </div>
      </div>
    </DraftingModal>
  );
}
