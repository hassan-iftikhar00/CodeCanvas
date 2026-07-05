"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  templates,
  TEMPLATE_CATEGORIES,
  type Template,
} from "@/data/templates";
import DraftingModal from "./DraftingModal";
import { T_CANVAS } from "./canvasTokens";
import SketchThumbnail, {
  hasSketchContent,
} from "@/components/SketchThumbnail";

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
  const searchRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [isOpen]);

  return (
    <DraftingModal
      open={isOpen}
      onClose={onClose}
      slug="LIBRARY · TEMPLATES"
      title="Pick a starter."
      subtitle="Insert a pre-drawn sketch to bootstrap your canvas."
      maxWidth={760}
      footer={
        <div
          className="flex items-center justify-between text-[10px] tracking-[0.16em] uppercase"
          style={{
            color: T_CANVAS.muted,
            fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
          }}
        >
          <span>
            {filtered.length} TEMPLATE{filtered.length === 1 ? "" : "S"}
          </span>
          <span>
            PRESS{" "}
            <kbd
              className="inline-flex min-w-[24px] items-center justify-center px-1.5 py-0.5 text-[10px]"
              style={{
                background: T_CANVAS.paper,
                border: `1px solid ${T_CANVAS.rule}`,
                color: T_CANVAS.graphite,
              }}
            >
              Esc
            </kbd>{" "}
            TO CLOSE
          </span>
        </div>
      }
    >
      {/* SEARCH */}
      <div className="mb-4">
        <div
          className="flex items-center gap-2 px-3 py-1.5"
          style={{
            background: T_CANVAS.paper,
            border: `1px solid ${T_CANVAS.rule}`,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            className="h-3.5 w-3.5"
            style={{ color: T_CANVAS.muted }}
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
            placeholder="SEARCH BY NAME, DESCRIPTION, OR TAG..."
            aria-label="Search templates"
            className="flex-1 bg-transparent text-[11px] tracking-[0.14em] uppercase outline-none placeholder:opacity-60"
            style={{
              color: T_CANVAS.graphite,
              fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="text-[10px]"
              style={{ color: T_CANVAS.muted }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                className="h-3 w-3"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* CATEGORIES */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <CategoryPill
          active={selectedCategory === "all"}
          onClick={() => setSelectedCategory("all")}
        >
          ALL
        </CategoryPill>
        {TEMPLATE_CATEGORIES.map((cat) => (
          <CategoryPill
            key={cat.id}
            active={selectedCategory === cat.id}
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.label.toUpperCase()}
          </CategoryPill>
        ))}
      </div>

      {/* GRID */}
      {filtered.length === 0 ? (
        <EmptyState query={searchQuery} />
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
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
    </DraftingModal>
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
      className="px-3 py-1 text-[10px] tracking-[0.16em] uppercase transition-colors"
      style={{
        background: active ? T_CANVAS.graphite : T_CANVAS.paper,
        border: `1px solid ${active ? T_CANVAS.graphite : T_CANVAS.rule}`,
        color: active ? T_CANVAS.paper : T_CANVAS.muted,
        fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.color = T_CANVAS.graphite;
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.color = T_CANVAS.muted;
      }}
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
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.14 }}
      className="group flex flex-col overflow-hidden text-left"
      style={{
        background: T_CANVAS.paper,
        border: `1px solid ${T_CANVAS.rule}`,
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.borderColor = T_CANVAS.cobalt)
      }
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = T_CANVAS.rule)}
    >
      <div
        className="relative aspect-[4/3] w-full"
        style={{
          background: T_CANVAS.vellum,
          borderBottom: `1px solid ${T_CANVAS.rule}`,
        }}
      >
        {hasSketchContent(template.canvasData) && (
          <SketchThumbnail canvasData={template.canvasData} />
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3
            className="truncate text-[12px]"
            style={{
              color: T_CANVAS.graphite,
              fontFamily:
                "var(--font-inter, ui-sans-serif, system-ui, sans-serif)",
            }}
          >
            {template.name}
          </h3>
          <span
            className="flex-none px-1.5 py-0.5 text-[9px] tracking-[0.16em] uppercase"
            style={{
              background: T_CANVAS.vellum,
              color: T_CANVAS.muted,
              fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
            }}
          >
            {template.category}
          </span>
        </div>
        <p
          className="line-clamp-2 text-[11px]"
          style={{
            color: T_CANVAS.muted,
            fontFamily:
              "var(--font-inter, ui-sans-serif, system-ui, sans-serif)",
          }}
        >
          {template.description}
        </p>
      </div>
    </motion.button>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 text-center"
      style={{
        background: T_CANVAS.vellum,
        border: `1px dashed ${T_CANVAS.rule}`,
      }}
    >
      <span
        className="mb-3 flex h-10 w-10 items-center justify-center"
        style={{
          background: T_CANVAS.paper,
          border: `1px solid ${T_CANVAS.rule}`,
          color: T_CANVAS.muted,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-4 w-4"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </span>
      <p
        className="text-[12px] tracking-[0.14em] uppercase"
        style={{
          color: T_CANVAS.graphite,
          fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
        }}
      >
        NO TEMPLATES FOUND{query ? ` FOR "${query.toUpperCase()}"` : ""}
      </p>
      <p
        className="mt-2 text-[11px]"
        style={{
          color: T_CANVAS.muted,
          fontFamily: "var(--font-inter, ui-sans-serif, system-ui)",
        }}
      >
        Try a different category or search term.
      </p>
    </div>
  );
}
