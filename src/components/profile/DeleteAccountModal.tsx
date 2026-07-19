"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { DRAFTING_TOKENS as T } from "@/lib/drafting-room/tokens";

const CONFIRMATION_PHRASE = "DELETE MY ACCOUNT";

const MONO = "var(--font-jetbrains-mono, ui-monospace, monospace)";
const SANS = "var(--font-inter, ui-sans-serif, system-ui)";
const SERIF = "var(--font-instrument-serif, ui-serif, Georgia, serif)";

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteAccountModal({
  isOpen,
  onClose,
  onConfirm,
}: DeleteAccountModalProps) {
  const [inputValue, setInputValue] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionComplete, setDeletionComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const isConfirmed = inputValue === CONFIRMATION_PHRASE;

  useEffect(() => {
    if (isOpen) {
      setInputValue("");
      setError(null);
      setIsDeleting(false);
      setDeletionComplete(false);
      const previouslyFocused = document.activeElement as HTMLElement | null;
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => {
        clearTimeout(t);
        previouslyFocused?.focus();
      };
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (!isDeleting) onClose();
  }, [isDeleting, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
        return;
      }

      if (e.key === "Tab") {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled])"
        );
        if (!focusable || focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting) return;

    setIsDeleting(true);
    setError(null);

    try {
      await onConfirm();
      setDeletionComplete(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again."
      );
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-6"
          style={{
            background: "rgba(14, 14, 15, 0.55)",
            backdropFilter: "blur(4px)",
          }}
          onClick={handleClose}
        >
          <motion.div
            key="dialog"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            aria-describedby="delete-account-desc"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.18, ease: [0.22, 0.9, 0.28, 1] }}
            className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-y-auto"
            style={{
              background: T.paper,
              border: `1px solid ${T.error}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title strip */}
            <div
              className="flex items-center justify-between border-b px-5 py-2 text-[13px] tracking-[0.16em] uppercase"
              style={{
                background: `${T.error}10`,
                borderColor: T.error,
                color: T.error,
                fontFamily: MONO,
              }}
            >
              <span>Danger · Delete account</span>
              <button
                type="button"
                onClick={handleClose}
                disabled={isDeleting}
                aria-label="Close"
                className="relative flex h-5 w-5 items-center justify-center transition-colors before:absolute before:-inset-3 before:content-[''] disabled:opacity-40"
                style={{ color: T.error }}
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

            {deletionComplete ? (
              /* Success state */
              <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                <div
                  className="flex h-10 w-10 items-center justify-center"
                  style={{
                    border: `1px solid ${T.success}`,
                    background: `${T.success}10`,
                    color: T.success,
                  }}
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div
                  className="text-[13px] tracking-[0.18em] uppercase"
                  style={{ color: T.muted, fontFamily: MONO }}
                >
                  Confirmed
                </div>
                <h2
                  className="text-[24px] leading-[1.1]"
                  style={{
                    color: T.graphite,
                    fontFamily: SERIF,
                    fontWeight: 400,
                  }}
                >
                  Account deleted.
                </h2>
                <p
                  className="text-[13px]"
                  style={{ color: T.muted, fontFamily: SANS }}
                >
                  Redirecting you now...
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="px-6 pt-5 pb-3">
                  <h2
                    id="delete-account-title"
                    className="text-[26px] leading-[1.1] tracking-[-0.01em]"
                    style={{
                      color: T.graphite,
                      fontFamily: SERIF,
                      fontWeight: 400,
                    }}
                  >
                    Delete account?
                  </h2>
                  <p
                    id="delete-account-desc"
                    className="mt-1.5 text-[13px] leading-[1.55]"
                    style={{ color: T.muted, fontFamily: SANS }}
                  >
                    This action cannot be undone. Read carefully before
                    confirming.
                  </p>
                </div>

                {/* What gets deleted */}
                <div className="px-6">
                  <div
                    className="px-3 py-2.5"
                    style={{
                      background: T.vellum,
                      border: `1px solid ${T.rule}`,
                    }}
                  >
                    <div
                      className="text-[13px] tracking-[0.16em] uppercase"
                      style={{ color: T.error, fontFamily: MONO }}
                    >
                      Permanently removed
                    </div>
                    <ul
                      className="mt-2 space-y-1 text-[13px]"
                      style={{ color: T.graphite, fontFamily: SANS }}
                    >
                      {[
                        "Your account and login credentials",
                        "All projects and canvas data",
                        "All version history and generated code",
                        "Profile picture and personal information",
                      ].map((item) => (
                        <li key={item} className="flex items-center gap-2">
                          <span
                            className="inline-block h-1 w-1 flex-none"
                            style={{ background: T.error }}
                            aria-hidden="true"
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Confirmation input */}
                <div className="px-6 pt-4 pb-2">
                  <label
                    htmlFor="delete-account-input"
                    className="mb-1.5 block text-[13px] tracking-[0.16em] uppercase"
                    style={{ color: T.muted, fontFamily: MONO }}
                  >
                    Type{" "}
                    <span
                      style={{
                        color: T.error,
                        fontFamily: MONO,
                        letterSpacing: "0.06em",
                      }}
                    >
                      &quot;{CONFIRMATION_PHRASE}&quot;
                    </span>{" "}
                    to confirm
                  </label>
                  <input
                    ref={inputRef}
                    id="delete-account-input"
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      if (error) setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && isConfirmed && !isDeleting) {
                        handleDelete();
                      }
                    }}
                    disabled={isDeleting}
                    placeholder={CONFIRMATION_PHRASE}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full px-3 py-2 text-[13px] transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      background: T.paper,
                      border: `1px solid ${isConfirmed ? T.error : T.rule}`,
                      color: T.graphite,
                      fontFamily: MONO,
                      letterSpacing: "0.04em",
                    }}
                    onFocus={(e) =>
                      (e.currentTarget.style.borderColor = T.error)
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor = isConfirmed
                        ? T.error
                        : T.rule)
                    }
                  />
                </div>

                {/* Error banner */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      role="alert"
                      className="mx-6 mb-2 flex items-start gap-2 px-3 py-2 text-[13px]"
                      style={{
                        border: `1px solid ${T.error}`,
                        background: `${T.error}10`,
                        color: T.error,
                        fontFamily: SANS,
                      }}
                    >
                      <span
                        className="mt-[2px] inline-block h-1.5 w-1.5 flex-none"
                        style={{ background: T.error }}
                        aria-hidden="true"
                      />
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Actions */}
                <div
                  className="flex items-center justify-end gap-2 border-t px-6 py-3.5"
                  style={{
                    background: T.vellum,
                    borderColor: T.rule,
                  }}
                >
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isDeleting}
                    className="px-4 py-2 text-[13px] tracking-[0.18em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      background: T.paper,
                      border: `1px solid ${T.rule}`,
                      color: T.graphite,
                      fontFamily: MONO,
                      minHeight: 36,
                    }}
                    onMouseEnter={(e) => {
                      if (isDeleting) return;
                      e.currentTarget.style.background = T.graphite;
                      e.currentTarget.style.color = T.paper;
                      e.currentTarget.style.borderColor = T.graphite;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = T.paper;
                      e.currentTarget.style.color = T.graphite;
                      e.currentTarget.style.borderColor = T.rule;
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={!isConfirmed || isDeleting}
                    className="inline-flex items-center gap-2 px-4 py-2 text-[13px] tracking-[0.18em] uppercase transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      background: T.error,
                      color: T.paper,
                      border: `1px solid ${T.error}`,
                      fontFamily: MONO,
                      minHeight: 36,
                    }}
                    onMouseEnter={(e) => {
                      if (!isConfirmed || isDeleting) return;
                      e.currentTarget.style.opacity = "0.85";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "1";
                    }}
                  >
                    {isDeleting ? (
                      <>
                        <span
                          className="h-3 w-3 animate-spin"
                          style={{
                            border: `1.5px solid ${T.paper}`,
                            borderTopColor: "transparent",
                            borderRadius: "50%",
                          }}
                        />
                        Deleting
                      </>
                    ) : (
                      "Delete my account →"
                    )}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
