"use client";

import { useState } from "react";
import { templates, TEMPLATE_CATEGORIES, type Template } from "@/data/templates";

interface TemplatesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertTemplate: (template: Template) => void;
}

export default function TemplatesPanel({ isOpen, onClose, onInsertTemplate }: TemplatesPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTemplates = templates.filter((template) => {
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-10 bg-black/30 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel - positioned next to left sidebar */}
      <div className="fixed left-16 top-0 z-30 h-screen w-80 animate-slide-in-left glass-strong shadow-2xl">
        {/* Header */}
        <div className="border-b border-[var(--grey-700)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Templates</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--grey-700)] hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[var(--grey-700)] bg-[var(--grey-900)] py-2 pl-10 pr-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:border-[var(--orange-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--orange-glow)]"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="overflow-x-auto border-b border-[var(--grey-700)] px-4 py-2">
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${selectedCategory === "all"
                  ? "bg-[var(--orange-primary)] text-white shadow-[var(--shadow-orange-glow-sm)]"
                  : "bg-[var(--grey-800)] text-[var(--text-secondary)] hover:bg-[var(--grey-700)] hover:text-white"
                }`}
            >
              All
            </button>
            {TEMPLATE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${selectedCategory === cat.id
                    ? "bg-[var(--orange-primary)] text-white shadow-[var(--shadow-orange-glow-sm)]"
                    : "bg-[var(--grey-800)] text-[var(--text-secondary)] hover:bg-[var(--grey-700)] hover:text-white"
                  }`}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Templates List */}
        <div className="h-[calc(100vh-180px)] overflow-y-auto p-4">
          {filteredTemplates.length === 0 ? (
            <div className="py-12 text-center">
              <svg
                className="mx-auto mb-3 h-12 w-12 text-[var(--text-muted)] opacity-50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-[var(--text-muted)]">No templates found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    onInsertTemplate(template);
                    onClose();
                  }}
                  className="group w-full rounded-xl border border-[var(--grey-700)] bg-[var(--grey-900)] p-4 text-left transition-all hover:border-[var(--orange-primary)] hover:bg-[var(--grey-800)] hover:shadow-[var(--shadow-orange-glow-sm)]"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <h3 className="font-semibold text-white">{template.name}</h3>
                    <svg
                      className="h-5 w-5 text-[var(--text-muted)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--orange-primary)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <p className="mb-2 text-xs text-[var(--text-muted)]">
                    {template.description}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {template.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-[var(--grey-800)] px-2 py-0.5 text-xs text-[var(--text-secondary)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

