"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { motion } from "motion/react";
import { recordProjectActivity } from "@/lib/dashboard-projects";

interface Project {
  id: string;
  title: string;
  description?: string | null;
  framework: string;
  thumbnailUrl?: string | null;
  updated_at: string;
}

interface ProjectCardProps {
  project: Project;
  onRequestDelete: (project: Project, triggerButton: HTMLButtonElement) => void;
  onRename: (id: string, newName: string) => void;
  onToggleStar: (id: string) => void;
  isStarred: boolean;
  deleteDisabled?: boolean;
}

export default function ProjectCard({
  project,
  onRequestDelete,
  onToggleStar,
  isStarred,
  deleteDisabled = false,
}: ProjectCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: [0.22, 0.9, 0.28, 1] }}
      className="group relative flex flex-col overflow-hidden rounded-[var(--cc-radius-card)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] transition-colors hover:border-[var(--cc-border-emphasis)]"
    >
      {/* Thumbnail */}
      <Link
        href={`/canvas?id=${project.id}`}
        className="relative aspect-video w-full overflow-hidden bg-[var(--cc-bg-canvas)] cc-dot-grid"
        onClick={() => recordProjectActivity(project.id, "opened")}
      >
        {project.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.thumbnailUrl}
            alt={project.title}
            className="relative z-10 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--cc-text-muted)]">
            <svg
              className="h-10 w-10 opacity-50 transition-transform duration-200 group-hover:scale-110 group-hover:text-[var(--cc-accent)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.25}
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="rounded-full bg-[var(--cc-accent)] px-3 py-1.5 text-[12px] font-semibold text-white shadow-[0_0_20px_var(--cc-accent-glow-strong)]">
            Open project
          </span>
        </div>
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3
                className="truncate text-[13px] font-semibold text-[var(--cc-text-primary)]"
                title={project.title}
              >
                {project.title}
              </h3>
              {isStarred && (
                <span className="flex-none rounded-[var(--cc-radius-tag)] bg-[var(--cc-accent-glow)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-[var(--cc-accent)]">
                  Starred
                </span>
              )}
            </div>
            {project.description && (
              <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--cc-text-secondary)]">
                {project.description}
              </p>
            )}
          </div>

          <div className="flex flex-none items-center gap-0.5">
            <motion.button
              whileTap={{ scale: 0.9 }}
              type="button"
              aria-label={
                isStarred ? "Remove star from project" : "Star project"
              }
              className={`rounded-[var(--cc-radius-tag)] p-1.5 transition-colors ${
                isStarred
                  ? "text-[var(--cc-accent)] hover:bg-[var(--cc-bg-elevated)]"
                  : "text-[var(--cc-text-muted)] hover:bg-[var(--cc-bg-elevated)] hover:text-[var(--cc-text-primary)]"
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleStar(project.id);
              }}
              title={isStarred ? "Remove star" : "Star project"}
            >
              <svg
                className="h-3.5 w-3.5"
                fill={isStarred ? "currentColor" : "none"}
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="m11.48 3.499 2.255 4.569 5.042.733-3.648 3.555.861 5.022L11.48 15l-4.51 2.378.861-5.022-3.648-3.555 5.042-.733L11.48 3.5Z"
                />
              </svg>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              type="button"
              aria-label={`Delete ${project.title}`}
              disabled={deleteDisabled}
              className="rounded-[var(--cc-radius-tag)] p-1.5 text-[var(--cc-text-muted)] transition-colors hover:bg-[rgba(239,68,68,0.12)] hover:text-[var(--cc-error)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRequestDelete(project, e.currentTarget);
              }}
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </motion.button>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--cc-text-muted)]">
          <span>
            Edited{" "}
            {formatDistanceToNow(new Date(project.updated_at), {
              addSuffix: true,
            })}
          </span>
          <span className="rounded-[var(--cc-radius-tag)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-elevated)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--cc-text-secondary)]">
            {project.framework}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
