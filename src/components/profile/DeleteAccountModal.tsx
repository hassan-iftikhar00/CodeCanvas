"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

const CONFIRMATION_PHRASE = "DELETE MY ACCOUNT";

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

  // Reset state and auto-focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setInputValue("");
      setError(null);
      setIsDeleting(false);
      setDeletionComplete(false);
      // Defer focus so AnimatePresence has time to mount
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (!isDeleting) onClose();
  }, [isDeleting, onClose]);

  // Escape key + focus trap
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
      // onConfirm redirects the page - show a brief success state as a fallback
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
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Dialog */}
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
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[var(--cc-radius-card)] border border-[rgba(239,68,68,0.25)] bg-[var(--cc-bg-surface)] p-6 shadow-2xl"
          >
            {deletionComplete ? (
              /* ── Success state ── */
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(34,197,94,0.12)]">
                  <svg
                    className="h-6 w-6 text-[var(--cc-success)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p className="text-[14px] font-semibold text-[var(--cc-text-primary)]">
                  Account deleted
                </p>
                <p className="text-[12px] text-[var(--cc-text-secondary)]">
                  Redirecting you now…
                </p>
              </div>
            ) : (
              /* ── Confirmation state ── */
              <>
                {/* Header */}
                <div className="mb-5 flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[rgba(239,68,68,0.12)]">
                    <svg
                      className="h-5 w-5 text-[var(--cc-error)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2
                      id="delete-account-title"
                      className="text-[15px] font-semibold text-[var(--cc-text-primary)]"
                    >
                      Delete account permanently
                    </h2>
                    <p
                      id="delete-account-desc"
                      className="mt-0.5 text-[12px] text-[var(--cc-text-secondary)]"
                    >
                      This action cannot be undone.
                    </p>
                  </div>
                </div>

                {/* What gets deleted */}
                <div className="mb-5 rounded-[var(--cc-radius-button)] border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.06)] px-4 py-3">
                  <p className="mb-2 text-[12px] font-semibold text-[var(--cc-error)]">
                    Permanently removed:
                  </p>
                  <ul className="space-y-1.5 text-[12px] text-[var(--cc-text-secondary)]">
                    {[
                      "Your account and login credentials",
                      "All projects and canvas data",
                      "All version history and generated code",
                      "Profile picture and personal information",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <span className="h-1 w-1 flex-none rounded-full bg-[rgba(239,68,68,0.6)]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Confirmation input */}
                <div className="mb-5">
                  <label
                    htmlFor="delete-account-input"
                    className="mb-1.5 block text-[12px] font-medium text-[var(--cc-text-secondary)]"
                  >
                    Type{" "}
                    <span className="font-mono font-bold text-[var(--cc-error)]">
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
                    className="w-full rounded-[var(--cc-radius-button)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-canvas)] px-3 py-2 font-mono text-[13px] text-[var(--cc-text-primary)] placeholder:text-[var(--cc-text-muted)] transition-colors focus:border-[rgba(239,68,68,0.6)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)] disabled:cursor-not-allowed disabled:opacity-50"
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
                      className="mb-4 flex items-start gap-2 rounded-[var(--cc-radius-button)] border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] px-3 py-2.5 text-[12px] text-[var(--cc-error)]"
                    >
                      <svg
                        className="mt-0.5 h-3.5 w-3.5 flex-none"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isDeleting}
                    className="rounded-[var(--cc-radius-button)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-elevated)] px-4 py-2 text-[13px] font-semibold text-[var(--cc-text-primary)] transition-colors hover:border-[var(--cc-border-emphasis)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={!isConfirmed || isDeleting}
                    className="inline-flex items-center gap-1.5 rounded-[var(--cc-radius-button)] bg-red-600 px-4 py-2 text-[13px] font-semibold text-white transition-all hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isDeleting ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Deleting account…
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        Delete my account
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
