"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { recordProjectActivity } from "@/lib/dashboard-projects";
import { DRAFTING_TOKENS as T } from "@/lib/drafting-room/tokens";
import SketchThumbnail, {
  hasSketchContent,
} from "@/components/SketchThumbnail";
import type { CanvasData } from "@/hooks/useProjectSave";

interface Project {
  id: string;
  title: string;
  description?: string | null;
  framework: string;
  thumbnailUrl?: string | null;
  canvasData?: CanvasData | null;
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

const MONO = "var(--font-jetbrains-mono, ui-monospace, monospace)";
const SANS = "var(--font-inter, ui-sans-serif, system-ui)";

export default function ProjectCard({
  project,
  onRequestDelete,
  onToggleStar,
  isStarred,
  deleteDisabled = false,
}: ProjectCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: [0.22, 0.9, 0.28, 1] }}
      className="group relative flex flex-col overflow-hidden transition-colors"
      style={{
        background: T.paper,
        border: `1px solid ${hovered ? T.cobalt : T.rule}`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Title strip — mono "PROJECT · {framework}" */}
      <div
        className="flex items-center justify-between gap-2 border-b px-3 py-1.5 text-[10px] tracking-[0.16em] uppercase"
        style={{
          background: T.vellum,
          borderColor: T.rule,
          color: T.muted,
          fontFamily: MONO,
        }}
      >
        <span style={{ color: T.graphite }}>Project</span>
        <span>{project.framework.toUpperCase()}</span>
      </div>

      {/* Thumbnail */}
      <Link
        href={`/canvas?id=${project.id}`}
        className="relative aspect-video w-full overflow-hidden"
        style={{
          background: T.vellum,
          backgroundImage: `
            linear-gradient(to right, ${T.tick}22 1px, transparent 1px),
            linear-gradient(to bottom, ${T.tick}22 1px, transparent 1px)
          `,
          backgroundSize: "16px 16px",
          borderBottom: `1px solid ${T.rule}`,
        }}
        onClick={() => recordProjectActivity(project.id, "opened")}
      >
        {project.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.thumbnailUrl}
            alt={project.title}
            className="relative z-10 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : project.canvasData?.uploadedSketch?.dataUrl ? (
          // Upload-based project: no drawn strokes to render, show the
          // uploaded sketch image itself.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.canvasData.uploadedSketch.dataUrl}
            alt={project.title}
            className="relative z-10 h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : hasSketchContent(project.canvasData) ? (
          <SketchThumbnail canvasData={project.canvasData!} />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ color: T.muted }}
          >
            <svg
              className="h-9 w-9 transition-colors"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.25}
              aria-hidden="true"
              style={{ color: hovered ? T.cobalt : T.muted, opacity: 0.6 }}
            >
              <rect x="3" y="3" width="18" height="18" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
          </div>
        )}

        {/* Hover overlay */}
        <div
          className="absolute inset-0 z-20 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{ background: "rgba(14, 14, 15, 0.55)" }}
        >
          <span
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] tracking-[0.18em] uppercase"
            style={{
              background: T.cobalt,
              color: T.paper,
              border: `1px solid ${T.cobalt}`,
              fontFamily: MONO,
            }}
          >
            Open
            <svg
              className="h-3 w-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3
                className="truncate text-[14px] leading-tight"
                title={project.title}
                style={{
                  color: T.graphite,
                  fontFamily: SANS,
                  fontWeight: 500,
                }}
              >
                {project.title}
              </h3>
              {isStarred && (
                <span
                  className="flex-none px-1.5 py-0.5 text-[9px] tracking-[0.18em] uppercase"
                  style={{
                    background: T.cobaltWash,
                    color: T.cobaltInk,
                    border: `1px solid ${T.cobalt}`,
                    fontFamily: MONO,
                  }}
                >
                  Starred
                </span>
              )}
            </div>
            {project.description && (
              <p
                className="mt-1 line-clamp-2 text-[11px] leading-relaxed"
                style={{ color: T.muted, fontFamily: SANS }}
              >
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
              className="flex h-7 w-7 items-center justify-center transition-colors"
              style={{
                color: isStarred ? T.cobalt : T.muted,
                background: "transparent",
                border: `1px solid transparent`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = isStarred
                  ? T.cobaltInk
                  : T.graphite;
                e.currentTarget.style.borderColor = T.rule;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = isStarred ? T.cobalt : T.muted;
                e.currentTarget.style.borderColor = "transparent";
              }}
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
                  strokeWidth={1.75}
                  d="m11.48 3.499 2.255 4.569 5.042.733-3.648 3.555.861 5.022L11.48 15l-4.51 2.378.861-5.022-3.648-3.555 5.042-.733L11.48 3.5Z"
                />
              </svg>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              type="button"
              aria-label={`Delete ${project.title}`}
              disabled={deleteDisabled}
              className="flex h-7 w-7 items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                color: T.muted,
                background: "transparent",
                border: `1px solid transparent`,
              }}
              onMouseEnter={(e) => {
                if (deleteDisabled) return;
                e.currentTarget.style.color = T.error;
                e.currentTarget.style.borderColor = T.error;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = T.muted;
                e.currentTarget.style.borderColor = "transparent";
              }}
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
                  strokeWidth={1.75}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </motion.button>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span
            className="text-[10px] tracking-[0.14em] uppercase"
            style={{ color: T.muted, fontFamily: MONO }}
          >
            Edited{" "}
            {formatDistanceToNow(new Date(project.updated_at), {
              addSuffix: true,
            })}
          </span>
          {isStarred ? null : (
            <span
              aria-hidden="true"
              className="inline-block h-1 w-1"
              style={{ background: T.tick }}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}
