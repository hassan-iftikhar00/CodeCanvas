"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DraftingModal, {
  ModalButton,
  ModalSection,
} from "@/components/canvas/DraftingModal";
import { T_CANVAS } from "@/components/canvas/canvasTokens";

/**
 * Brand Kit (App Uplift feature H): per-project design tokens. The user sets
 * brand colors and a font once; every generation stamps them into the Gemini
 * prompt (styling-only block — strict fidelity untouched). Persisted in
 * projects.brand_kit (jsonb) so the kit survives reloads and applies to every
 * regeneration of the project.
 */

export interface BrandKit {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
}

const FONT_OPTIONS = [
  "",
  "Inter",
  "Poppins",
  "Roboto",
  "Montserrat",
  "Playfair Display",
  "Georgia",
] as const;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

interface BrandKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
  value: BrandKit | null;
  onApply: (kit: BrandKit | null) => void;
}

export default function BrandKitModal({
  isOpen,
  onClose,
  projectId,
  value,
  onApply,
}: BrandKitModalProps) {
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [accent, setAccent] = useState("");
  const [font, setFont] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPrimary(value?.primaryColor ?? "");
    setSecondary(value?.secondaryColor ?? "");
    setAccent(value?.accentColor ?? "");
    setFont(value?.fontFamily ?? "");
    setError(null);
  }, [isOpen, value]);

  // Load the selectable Google fonts once so the dropdown can preview each
  // option in its actual face (Georgia and the default are system fonts).
  useEffect(() => {
    if (!isOpen) return;
    const id = "cc-brand-kit-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&family=Roboto:wght@400;500&family=Montserrat:wght@400;600&family=Playfair+Display:wght@400;700&display=swap";
    document.head.appendChild(link);
  }, [isOpen]);

  const buildKit = (): BrandKit | null => {
    const kit: BrandKit = {};
    if (primary) kit.primaryColor = primary;
    if (secondary) kit.secondaryColor = secondary;
    if (accent) kit.accentColor = accent;
    if (font) kit.fontFamily = font;
    return Object.keys(kit).length > 0 ? kit : null;
  };

  const validate = (): string | null => {
    for (const [label, hex] of [
      ["Primary", primary],
      ["Secondary", secondary],
      ["Accent", accent],
    ] as const) {
      if (hex && !HEX_RE.test(hex)) {
        return `${label} color must be a 6-digit hex value like #0F62FE.`;
      }
    }
    return null;
  };

  const persist = async (kit: BrandKit | null): Promise<boolean> => {
    if (!projectId) return true; // unsaved project: session-only kit
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("projects")
      .update({ brand_kit: kit })
      .eq("id", projectId);
    if (updateError) {
      setError("Could not save the brand kit. Try again.");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    const kit = buildKit();
    const ok = await persist(kit);
    setSaving(false);
    if (ok) {
      onApply(kit);
      onClose();
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setError(null);
    const ok = await persist(null);
    setSaving(false);
    if (ok) {
      onApply(null);
      onClose();
    }
  };

  return (
    <DraftingModal
      open={isOpen}
      onClose={onClose}
      slug="BRAND · KIT"
      title="Set your brand once."
      subtitle="Colors and font apply to every generation of this project. They style the output; they never add or remove elements."
      maxWidth={520}
      footer={
        <div className="flex items-center justify-between">
          <ModalButton onClick={handleClear} disabled={saving}>
            CLEAR KIT
          </ModalButton>
          <div className="flex items-center gap-2">
            <ModalButton onClick={onClose} disabled={saving}>
              CANCEL
            </ModalButton>
            <ModalButton
              variant="primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "SAVING" : "SAVE KIT"}
            </ModalButton>
          </div>
        </div>
      }
    >
      <ModalSection label="COLORS">
        <div className="space-y-2.5">
          <ColorRow
            label="PRIMARY"
            hint="Buttons, active links, key accents"
            value={primary}
            onChange={setPrimary}
          />
          <ColorRow
            label="SECONDARY"
            hint="Secondary buttons, borders, tints"
            value={secondary}
            onChange={setSecondary}
          />
          <ColorRow
            label="ACCENT"
            hint="Sparing highlights (links, badges)"
            value={accent}
            onChange={setAccent}
          />
        </div>
      </ModalSection>

      <ModalSection label="TYPOGRAPHY">
        <select
          value={font}
          onChange={(e) => setFont(e.target.value)}
          aria-label="Brand font family"
          className="h-9 w-full px-2 text-[13px] outline-none"
          style={{
            background: T_CANVAS.paper,
            border: `1px solid ${T_CANVAS.rule}`,
            color: T_CANVAS.graphite,
            // Show the picked font in the closed select too.
            fontFamily: font
              ? `'${font}', ui-sans-serif, system-ui`
              : "var(--font-inter, ui-sans-serif, system-ui)",
          }}
        >
          {FONT_OPTIONS.map((f) => (
            <option
              key={f}
              value={f}
              style={f ? { fontFamily: `'${f}', ui-sans-serif` } : undefined}
            >
              {f === "" ? "Default (system font)" : f}
            </option>
          ))}
        </select>
        {font ? (
          <p
            className="mt-2 px-1 text-[15px]"
            style={{
              color: T_CANVAS.graphite,
              fontFamily: `'${font}', ui-sans-serif, system-ui`,
            }}
          >
            The quick brown fox jumps over the lazy dog. 0123456789
          </p>
        ) : null}
      </ModalSection>

      {!projectId ? (
        <p className="text-[13px]" style={{ color: T_CANVAS.muted }}>
          The project is not saved yet, so this kit applies to this session
          only. Save the project to keep it.
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 text-[13px]" style={{ color: T_CANVAS.error }}>
          {error}
        </p>
      ) : null}
    </DraftingModal>
  );
}

function ColorRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className="flex items-center gap-2 px-2.5 py-2"
      style={{
        border: `1px solid ${T_CANVAS.rule}`,
        background: T_CANVAS.paper,
      }}
    >
      <input
        type="color"
        value={HEX_RE.test(value) ? value : "#888888"}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        aria-label={`${label} color picker`}
        className="h-7 w-9 shrink-0 cursor-pointer border-0 p-0"
        style={{ background: "transparent" }}
      />
      <div className="min-w-0 flex-1">
        <div
          className="text-[13px] tracking-[0.16em] uppercase"
          style={{
            color: T_CANVAS.graphite,
            fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
          }}
        >
          {label}
        </div>
        <div className="truncate text-[13px]" style={{ color: T_CANVAS.muted }}>
          {hint}
        </div>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        placeholder="#000000"
        aria-label={`${label} hex value`}
        className="h-7 w-24 px-2 text-[13px] uppercase outline-none"
        style={{
          background: T_CANVAS.vellum,
          border: `1px solid ${T_CANVAS.rule}`,
          color: T_CANVAS.graphite,
          fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
        }}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={`Clear ${label} color`}
          className="flex h-5 w-5 shrink-0 items-center justify-center text-[13px] transition-colors"
          style={{ color: T_CANVAS.muted }}
          onMouseEnter={(e) => (e.currentTarget.style.color = T_CANVAS.error)}
          onMouseLeave={(e) => (e.currentTarget.style.color = T_CANVAS.muted)}
        >
          <svg
            className="h-3 w-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
          >
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
