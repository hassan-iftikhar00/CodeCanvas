import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
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
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onToggleStar: (id: string) => void;
  isStarred: boolean;
}

export default function ProjectCard({
  project,
  onDelete,
  onToggleStar,
  isStarred,
}: ProjectCardProps) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-[#2E2E2E] bg-[#1A1A1A] transition-all hover:border-[#FF6B00] hover:shadow-lg">
      {/* Thumbnail */}
      <Link
        href={`/canvas?id=${project.id}`}
        className="relative aspect-video w-full overflow-hidden bg-[#0A0A0A]"
        onClick={() => recordProjectActivity(project.id, "opened")}
      >
        {project.thumbnailUrl ? (
          <img
            src={project.thumbnailUrl}
            alt={project.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#2E2E2E]">
            <svg
              className="h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Overlay Actions */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200">
            Open Project
          </span>
        </div>
      </Link>

      {/* Info */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3
                className="truncate text-base font-semibold text-white"
                title={project.title}
              >
                {project.title}
              </h3>
              {isStarred && (
                <span className="rounded-full bg-[#20160D] px-2 py-1 text-[10px] uppercase tracking-[0.22em] text-[#FFB97A]">
                  Starred
                </span>
              )}
            </div>
            {project.description && (
              <p className="mt-1 line-clamp-2 text-sm text-[#8C8C8C]">
                {project.description}
              </p>
            )}
          </div>

          <div className="relative flex items-center gap-1">
            <button
              className={`rounded p-1 transition-colors ${
                isStarred
                  ? "text-[#FFB97A] hover:bg-[#2E2E2E]"
                  : "text-[#666666] hover:bg-[#2E2E2E] hover:text-white"
              }`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleStar(project.id);
              }}
              title={isStarred ? "Remove star" : "Star project"}
            >
              <svg
                className="h-4 w-4"
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
            </button>
            <button
              className="rounded p-1 text-[#666666] hover:bg-[#2E2E2E] hover:text-white"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (confirm("Are you sure you want to delete this project?")) {
                  onDelete(project.id);
                }
              }}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-auto pt-4 flex items-center justify-between text-xs text-[#666666]">
          <span>
            Edited{" "}
            {formatDistanceToNow(new Date(project.updated_at), {
              addSuffix: true,
            })}
          </span>
          <span className="rounded-full border border-[#2E2E2E] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[#8C8C8C]">
            {project.framework}
          </span>
        </div>
      </div>
    </div>
  );
}
