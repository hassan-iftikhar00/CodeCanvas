"use client";

import { ReactNode, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { T_CANVAS } from "./canvasTokens";

/**
 * Drafting Room modal scaffold. Paper sheet on a paper-tinted backdrop,
 * with mono title block (TYPE · LABEL) and an optional footer for actions.
 *
 * Body content owns its own padding so we don't force a uniform spacing
 * on every consumer. Footer is optional — pass null to omit.
 */

interface DraftingModalProps {
  open: boolean;
  onClose: () => void;
  slug: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
  dataOnboarding?: string;
}

export default function DraftingModal({
  open,
  onClose,
  slug,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 640,
  dataOnboarding,
}: DraftingModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-onboarding={dataOnboarding}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{
            background: `${T_CANVAS.graphite}8C`,
            backdropFilter: "blur(4px)",
          }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${slug.replace(/\s+/g, "-")}-title`}
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22, ease: [0.22, 0.9, 0.28, 1] }}
            className="w-full max-h-[90vh] flex flex-col"
            style={{
              maxWidth,
              background: T_CANVAS.paper,
              border: `1px solid ${T_CANVAS.rule}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* TITLE BLOCK */}
            <div
              className="flex items-center justify-between border-b px-5 py-2.5 text-[10px] tracking-[0.16em] uppercase shrink-0"
              style={{
                borderColor: T_CANVAS.rule,
                color: T_CANVAS.muted,
                fontFamily:
                  "var(--font-jetbrains-mono, ui-monospace, monospace)",
              }}
            >
              <span style={{ color: T_CANVAS.graphite }}>{slug}</span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-5 w-5 items-center justify-center transition-colors"
                style={{ color: T_CANVAS.muted }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = T_CANVAS.graphite)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = T_CANVAS.muted)
                }
              >
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* HEADER — editorial serif */}
            <div className="shrink-0 px-6 pt-6 pb-3">
              <h2
                id={`${slug.replace(/\s+/g, "-")}-title`}
                className="text-[28px] leading-[1.05] tracking-[-0.02em]"
                style={{
                  color: T_CANVAS.graphite,
                  fontFamily:
                    "var(--font-instrument-serif, ui-serif, Georgia, serif)",
                  fontWeight: 400,
                }}
              >
                {title}
              </h2>
              {subtitle && (
                <p
                  className="mt-1.5 text-[13px] leading-[1.55]"
                  style={{
                    color: T_CANVAS.muted,
                    fontFamily:
                      "var(--font-inter, ui-sans-serif, system-ui, sans-serif)",
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>

            {/* BODY */}
            <div
              className="drafting-modal-body flex-1 overflow-y-auto px-6 pb-6"
              style={{
                scrollbarColor: `${T_CANVAS.graphite} transparent`,
              }}
            >
              <style jsx global>{`
                .drafting-modal-body::-webkit-scrollbar {
                  width: 10px;
                  height: 10px;
                }
                .drafting-modal-body::-webkit-scrollbar-track {
                  background: transparent;
                }
                .drafting-modal-body::-webkit-scrollbar-thumb {
                  background: ${T_CANVAS.rule};
                  border: 2px solid transparent;
                  border-radius: 9999px;
                }
                .drafting-modal-body::-webkit-scrollbar-thumb:hover {
                  background: ${T_CANVAS.graphite};
                }
              `}</style>
              {children}
            </div>

            {/* FOOTER */}
            {footer && (
              <div
                className="shrink-0 border-t px-6 py-3.5"
                style={{
                  borderColor: T_CANVAS.rule,
                  background: T_CANVAS.vellum,
                }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── COMMON BUTTONS ─────────────────────────────────────────────────────────

export function ModalButton({
  variant = "ghost",
  onClick,
  disabled,
  children,
  type = "button",
}: {
  variant?: "primary" | "ghost" | "danger";
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  type?: "button" | "submit";
}) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  const bg = isPrimary
    ? T_CANVAS.cobalt
    : isDanger
      ? T_CANVAS.error
      : T_CANVAS.paper;
  const border = isPrimary
    ? T_CANVAS.cobalt
    : isDanger
      ? T_CANVAS.error
      : T_CANVAS.rule;
  const fg = isPrimary || isDanger ? T_CANVAS.paper : T_CANVAS.graphite;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-4 py-2 text-[10px] tracking-[0.18em] uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        color: fg,
        fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
        minHeight: 36,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        if (isPrimary) {
          e.currentTarget.style.background = T_CANVAS.cobaltInk;
          e.currentTarget.style.borderColor = T_CANVAS.cobaltInk;
        } else if (isDanger) {
          e.currentTarget.style.opacity = "0.85";
        } else {
          e.currentTarget.style.background = T_CANVAS.graphite;
          e.currentTarget.style.color = T_CANVAS.paper;
          e.currentTarget.style.borderColor = T_CANVAS.graphite;
        }
      }}
      onMouseLeave={(e) => {
        if (isPrimary) {
          e.currentTarget.style.background = T_CANVAS.cobalt;
          e.currentTarget.style.borderColor = T_CANVAS.cobalt;
        } else if (isDanger) {
          e.currentTarget.style.opacity = "1";
        } else {
          e.currentTarget.style.background = T_CANVAS.paper;
          e.currentTarget.style.color = T_CANVAS.graphite;
          e.currentTarget.style.borderColor = T_CANVAS.rule;
        }
      }}
    >
      {children}
    </button>
  );
}

// ─── COMMON SECTION ────────────────────────────────────────────────────────

export function ModalSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-5">
      <div
        className="mb-2 text-[10px] tracking-[0.18em] uppercase"
        style={{
          color: T_CANVAS.muted,
          fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── OPTION CARD ───────────────────────────────────────────────────────────

export function ModalOption({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex flex-col items-start gap-1.5 px-3 py-2.5 text-left transition-colors w-full h-full"
      style={{
        background: active ? T_CANVAS.cobaltWash : T_CANVAS.paper,
        border: `1px solid ${active ? T_CANVAS.cobalt : T_CANVAS.rule}`,
        color: active ? T_CANVAS.cobaltInk : T_CANVAS.graphite,
        fontFamily: "var(--font-inter, ui-sans-serif, system-ui, sans-serif)",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.borderColor = T_CANVAS.cobalt;
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.borderColor = T_CANVAS.rule;
      }}
    >
      {icon && (
        <span
          className="flex h-4 w-4 items-center justify-center"
          style={{ color: active ? T_CANVAS.cobalt : T_CANVAS.muted }}
        >
          {icon}
        </span>
      )}
      <span
        className="text-[11px] tracking-[0.14em] uppercase"
        style={{
          color: active ? T_CANVAS.cobaltInk : T_CANVAS.graphite,
          fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
        }}
      >
        {label}
      </span>
      {hint && (
        <span className="text-[11px]" style={{ color: T_CANVAS.muted }}>
          {hint}
        </span>
      )}
    </button>
  );
}
