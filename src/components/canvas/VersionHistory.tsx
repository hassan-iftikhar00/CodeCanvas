"use client";

import React from "react";
import { formatDistanceToNow } from "date-fns";
import { Check, Clock } from "lucide-react";

interface ProjectVersion {
  id: string;
  project_id: string;
  version_number: number;
  canvas_data: any;
  created_at: string;
  description?: string;
}

interface VersionHistoryProps {
  projectId: string;
  versions: ProjectVersion[];
  loading: boolean;
  onRestore: (versionId: string) => void;
  onDelete: (versionId: string) => void;
  onCreateCheckpoint: () => void;
}

/**
 * Version History Sidebar Component
 * Displays timeline of project versions with restore/delete capabilities
 */
export default function VersionHistory({
  projectId,
  versions,
  loading,
  onRestore,
  onDelete,
  onCreateCheckpoint,
}: VersionHistoryProps) {
  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return new Date(dateString).toLocaleDateString();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-[#2E2E2E] bg-[#1A1A1A] px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">
            Version History
          </h2>
          <span className="rounded-full bg-[#2E2E2E] px-2 py-0.5 text-xs font-medium text-white">
            {versions.length}
          </span>
        </div>

        <button
          onClick={onCreateCheckpoint}
          className="w-full rounded-lg bg-[#FF6B00]/20 border border-[#FF6B00]/50 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-[#FF6B00]/30 hover:border-[#FF6B00]"
        >
          <Check className="mr-2 inline-block h-4 w-4" />
          Create Checkpoint
        </button>
      </div>

      {/* Version List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2E2E2E] border-t-[#FF6B00]" />
              <span className="text-xs text-[#A0A0A0]">Loading versions...</span>
            </div>
          </div>
        ) : versions.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <div className="text-center">
              <Clock className="mx-auto mb-3 h-12 w-12 text-[#4A4A4A]" />
              <p className="text-sm text-[#A0A0A0]">No version history yet</p>
              <p className="mt-1 text-xs text-[#666666]">
                Versions are created automatically when you save
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Timeline */}
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-[#2E2E2E]" />

              {versions.map((version, index) => (
                <div key={version.id} className="relative flex gap-4">
                  {/* Timeline dot */}
                  <div className="relative z-10 flex-shrink-0">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${
                        index === 0
                          ? "border-[#FF6B00] bg-[#FF6B00]/20"
                          : "border-[#2E2E2E] bg-[#1A1A1A]"
                      }`}
                    >
                      <span
                        className={`text-sm font-bold ${
                          index === 0 ? "text-[#FF6B00]" : "text-[#A0A0A0]"
                        }`}
                      >
                        v{version.version_number}
                      </span>
                    </div>
                  </div>

                  {/* Version card */}
                  <div className="mb-4 flex-1">
                    <div
                      className={`rounded-lg border p-3 transition-all ${
                        index === 0
                          ? "border-[#FF6B00] bg-[#1A1A1A] shadow-[0_0_15px_rgba(255,107,0,0.15)]"
                          : "border-[#2E2E2E] bg-[#0A0A0A] hover:border-[#4A4A4A]"
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-white">
                              Version {version.version_number}
                            </h3>
                            {index === 0 && (
                              <span className="rounded-full bg-[#FF6B00]/20 px-2 py-0.5 text-xs font-medium text-[#FF6B00]">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-[#A0A0A0]">
                            {formatDate(version.created_at)}
                          </p>
                          {version.description && (
                            <p className="mt-2 text-sm text-[#CCCCCC]">
                              {version.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {index !== 0 && (
                          <>
                            <button
                              onClick={() => onRestore(version.id)}
                              className="flex-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-white/20"
                            >
                              Restore
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Delete this version?')) {
                                  onDelete(version.id);
                                }
                              }}
                              className="flex-1 rounded-lg bg-[#2E2E2E] px-3 py-1.5 text-xs font-medium text-[#A0A0A0] transition-all hover:bg-red-900/20 hover:text-red-400"
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {index === 0 && (
                          <div className="text-xs text-[#666666]">
                            This is the current version
                          </div>
                        )}
                      </div>

                      {/* Canvas data preview */}
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs text-[#A0A0A0] hover:text-white">
                          View canvas data
                        </summary>
                        <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-[#0A0A0A] p-2 text-xs text-[#CCCCCC]">
                          {JSON.stringify(version.canvas_data, null, 2)}
                        </pre>
                      </details>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
