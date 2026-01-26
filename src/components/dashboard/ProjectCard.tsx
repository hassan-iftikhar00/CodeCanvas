import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  updated_at: string;
}

interface ProjectCardProps {
  project: Project;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
}

export default function ProjectCard({ project, onDelete, onRename }: ProjectCardProps) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-[#2E2E2E] bg-[#1A1A1A] transition-all hover:border-[#FF6B00] hover:shadow-lg">
      {/* Thumbnail */}
      <Link href={`/canvas?id=${project.id}`} className="relative aspect-video w-full overflow-hidden bg-[#0A0A0A]">
        {project.thumbnail ? (
          <img src={project.thumbnail} alt={project.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#2E2E2E]">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
          <h3 className="truncate text-base font-semibold text-white" title={project.name}>
            {project.name}
          </h3>
          
          <div className="relative">
            <button className="rounded p-1 text-[#666666] hover:bg-[#2E2E2E] hover:text-white"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if(confirm("Are you sure you want to delete this project?")) onDelete(project.id);
              }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="mt-auto pt-4 flex items-center justify-between text-xs text-[#666666]">
          <span>Edited {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}</span>
        </div>
      </div>
    </div>
  );
}
