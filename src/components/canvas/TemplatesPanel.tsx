"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  templates,
  TEMPLATE_CATEGORIES,
  type Template,
} from "@/data/templates";

interface TemplatesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertTemplate: (template: Template) => void;
}

export default function TemplatesPanel({
  isOpen,
  onClose,
  onInsertTemplate,
}: TemplatesPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const filtered = templates.filter((t) => {
    const matchesCategory =
      selectedCategory === "all" || t.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  // Focus management
  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => searchRef.current?.focus());
    return () => {
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen]);

  // Esc to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="templates-modal"
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 0.9, 0.28, 1] }}
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close templates"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-[4px]"
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="templates-title"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ duration: 0.22, ease: [0.22, 1.4, 0.32, 1] }}
            className="relative z-[61] flex w-full max-w-[720px] max-h-[80vh] flex-col overflow-hidden rounded-[12px] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--cc-border-subtle)] px-5 py-4">
              <div>
                <h2
                  id="templates-title"
                  className="text-[16px] font-semibold text-[var(--cc-text-primary)]"
                >
                  Templates
                </h2>
                <p className="mt-0.5 text-[12px] text-[var(--cc-text-secondary)]">
                  Insert a starter sketch to bootstrap your canvas
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-[var(--cc-radius-button)] text-[var(--cc-text-secondary)] transition-colors hover:bg-[var(--cc-bg-elevated)] hover:text-[var(--cc-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  className="h-4 w-4"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Search */}
            <div className="border-b border-[var(--cc-border-subtle)] px-5 py-3">
              <div className="flex items-center gap-2 rounded-[var(--cc-radius-button)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-canvas)] px-3 py-2 transition-colors focus-within:border-[var(--cc-accent)] focus-within:shadow-[0_0_0_3px_var(--cc-accent-glow)]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  className="h-4 w-4 text-[var(--cc-text-muted)]"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search templates by name, description, or tag..."
                  aria-label="Search templates"
                  className="flex-1 bg-transparent text-[13px] text-[var(--cc-text-primary)] placeholder:text-[var(--cc-text-muted)] focus:outline-none"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                    className="rounded-[var(--cc-radius-tag)] px-1 text-[var(--cc-text-muted)] transition-colors hover:text-[var(--cc-text-primary)]"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      className="h-3.5 w-3.5"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                ) : null}
              </div>
            </div>

            {/* Categories */}
            <div className="border-b border-[var(--cc-border-subtle)] px-5 py-3">
              <div className="flex flex-wrap gap-1.5">
                <CategoryPill
                  active={selectedCategory === "all"}
                  onClick={() => setSelectedCategory("all")}
                >
                  All
                </CategoryPill>
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <CategoryPill
                    key={cat.id}
                    active={selectedCategory === cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    <span aria-hidden="true">{cat.icon}</span> {cat.label}
                  </CategoryPill>
                ))}
              </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {filtered.length === 0 ? (
                <EmptyState query={searchQuery} />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onInsert={() => {
                        onInsertTemplate(template);
                        onClose();
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-[var(--cc-border-subtle)] bg-[var(--cc-bg-elevated)] px-5 py-2.5 text-[11px] text-[var(--cc-text-muted)]">
              <span>
                {filtered.length} template{filtered.length === 1 ? "" : "s"}
              </span>
              <span>
                Press{" "}
                <kbd className="mx-0.5 rounded-[var(--cc-radius-tag)] bg-[var(--cc-bg-canvas)] px-1.5 py-0.5 font-mono">
                  Esc
                </kbd>{" "}
                to close
              </span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function CategoryPill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)] ${
        active
          ? "bg-[var(--cc-accent)] text-white"
          : "bg-[var(--cc-bg-elevated)] text-[var(--cc-text-secondary)] hover:bg-[var(--cc-border-subtle)] hover:text-[var(--cc-text-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

function TemplateCard({
  template,
  onInsert,
}: {
  template: Template;
  onInsert: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onInsert}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.18, ease: [0.22, 0.9, 0.28, 1] }}
      className="group flex flex-col overflow-hidden rounded-[var(--cc-radius-card)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-elevated)] text-left transition-colors hover:border-[var(--cc-accent)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]"
    >
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--cc-bg-canvas)]">
        <div className="absolute inset-0 cc-dot-grid opacity-60" />
        <div className="absolute inset-0 flex items-center justify-center text-[var(--cc-text-muted)]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.25}
            className="h-10 w-10 opacity-50 transition-transform duration-200 group-hover:scale-110 group-hover:text-[var(--cc-accent)]"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </svg>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[13px] font-medium text-[var(--cc-text-primary)] truncate">
            {template.name}
          </h3>
          <span className="flex-none rounded-[var(--cc-radius-tag)] bg-[var(--cc-bg-canvas)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--cc-text-muted)]">
            {template.category}
          </span>
        </div>
        <p className="text-[11px] text-[var(--cc-text-secondary)] line-clamp-2">
          {template.description}
        </p>
      </div>
    </motion.button>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-elevated)] text-[var(--cc-text-muted)]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-5 w-5"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </span>
      <p className="text-[13px] text-[var(--cc-text-secondary)]">
        No templates found{query ? ` for "${query}"` : ""}.
      </p>
      <p className="mt-1 text-[11px] text-[var(--cc-text-muted)]">
        Try a different category or search term.
      </p>
    </div>
  );
}
