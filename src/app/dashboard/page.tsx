"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ProjectCard from "@/components/dashboard/ProjectCard";
import {
  normalizeProject,
  readRecentProjectActivity,
  readStarredProjectIds,
  recordProjectActivity,
  writeRecentProjectActivity,
  writeStarredProjectIds,
  toggleStarredProject,
  type DashboardProject,
  type RecentProjectActivity,
} from "@/lib/dashboard-projects";

type SortOption = "recent" | "oldest" | "alphabetical";
type DateFilter = "all" | "7d" | "30d";

interface DeleteSnapshot {
  project: DashboardProject;
  index: number;
  wasStarred: boolean;
  recentEntries: RecentProjectActivity[];
}

type ProjectCardProject = {
  id: string;
  title: string;
  description?: string | null;
  framework: string;
  thumbnailUrl?: string | null;
  updated_at: string;
};

export default function DashboardPage() {
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [frameworkFilter, setFrameworkFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [starredProjectIds, setStarredProjectIds] = useState<string[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentProjectActivity[]>(
    []
  );
  const [deleteDialogProject, setDeleteDialogProject] =
    useState<DashboardProject | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null
  );
  const supabase = createClient();
  const router = useRouter();
  const deleteDialogRef = useRef<HTMLDivElement | null>(null);
  const deleteCancelRef = useRef<HTMLButtonElement | null>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const newProjectButtonRef = useRef<HTMLButtonElement | null>(null);
  const deleteSnapshotRef = useRef<DeleteSnapshot | null>(null);

  const restoreDeleteFocus = useCallback(() => {
    window.setTimeout(() => {
      if (deleteTriggerRef.current?.isConnected) {
        deleteTriggerRef.current.focus();
        return;
      }

      newProjectButtonRef.current?.focus();
    }, 0);
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return;
      }

      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) {
        throw error;
      }

      setProjects((data ?? []).map(normalizeProject));
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchProjects();
    setStarredProjectIds(readStarredProjectIds());
    setRecentActivity(readRecentProjectActivity());
  }, [fetchProjects]);

  const handleCreateProject = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return;
    }

    try {
      let createdProject: Record<string, unknown> | null = null;

      const canonicalInsert = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          title: "Untitled Project",
          canvas_data: {},
          framework: "react",
        })
        .select()
        .single();

      if (canonicalInsert.error) {
        const legacyInsert = await supabase
          .from("projects")
          .insert({
            user_id: user.id,
            name: "Untitled Project",
            canvas_data: {},
          })
          .select()
          .single();

        if (legacyInsert.error) {
          throw legacyInsert.error;
        }

        createdProject = legacyInsert.data;
      } else {
        createdProject = canonicalInsert.data;
      }

      if (!createdProject?.id) {
        return;
      }

      const normalizedProject = normalizeProject(createdProject);
      setProjects((current) => [normalizedProject, ...current]);
      setRecentActivity(recordProjectActivity(normalizedProject.id, "created"));
      router.push(`/canvas?id=${normalizedProject.id}`);
    } catch (error) {
      console.error("Error creating project:", error);
    }
  };

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialogProject(null);
    setDeleteError(null);
    deleteSnapshotRef.current = null;
    restoreDeleteFocus();
  }, [restoreDeleteFocus]);

  const handleRequestDelete = useCallback(
    (project: ProjectCardProject, triggerButton: HTMLButtonElement) => {
      if (deleteDialogProject || deletingProjectId) {
        return;
      }

      const projectToDelete = projects.find((item) => item.id === project.id);
      if (!projectToDelete) {
        return;
      }

      deleteTriggerRef.current = triggerButton;
      deleteSnapshotRef.current = {
        project: projectToDelete,
        index: projects.findIndex((item) => item.id === projectToDelete.id),
        wasStarred: starredProjectIds.includes(projectToDelete.id),
        recentEntries: recentActivity.filter(
          (entry) => entry.projectId === projectToDelete.id
        ),
      };

      setDeleteError(null);
      setDeleteDialogProject(projectToDelete);
    },
    [
      deleteDialogProject,
      deletingProjectId,
      projects,
      recentActivity,
      starredProjectIds,
    ]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteDialogProject || deletingProjectId) {
      return;
    }

    const snapshot = deleteSnapshotRef.current;
    if (!snapshot) {
      return;
    }

    const projectId = deleteDialogProject.id;
    setDeletingProjectId(projectId);

    setProjects((current) =>
      current.filter((project) => project.id !== projectId)
    );
    setStarredProjectIds((current) =>
      current.filter((projectIdToKeep) => projectIdToKeep !== projectId)
    );
    setRecentActivity((current) =>
      current.filter((entry) => entry.projectId !== projectId)
    );

    try {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId);

      if (error) {
        throw error;
      }

      setStarredProjectIds((current) => {
        const next = current.filter(
          (projectIdToKeep) => projectIdToKeep !== projectId
        );
        writeStarredProjectIds(next);
        return next;
      });

      setRecentActivity((current) => {
        const next = current.filter((entry) => entry.projectId !== projectId);
        writeRecentProjectActivity(next);
        return next;
      });
    } catch (error) {
      console.error("Error deleting project:", error);
      setDeleteError("Could not delete the project. Please try again.");

      setProjects((current) => {
        if (current.some((project) => project.id === snapshot.project.id)) {
          return current;
        }

        const insertIndex = Math.min(snapshot.index, current.length);
        return [
          ...current.slice(0, insertIndex),
          snapshot.project,
          ...current.slice(insertIndex),
        ];
      });

      setStarredProjectIds((current) => {
        if (snapshot.wasStarred && !current.includes(snapshot.project.id)) {
          return [snapshot.project.id, ...current];
        }

        return current;
      });

      setRecentActivity((current) => {
        const withoutDeletedProject = current.filter(
          (entry) => entry.projectId !== snapshot.project.id
        );
        const restoredEntries = snapshot.recentEntries.filter(
          (entry) =>
            !withoutDeletedProject.some(
              (currentEntry) =>
                currentEntry.projectId === entry.projectId &&
                currentEntry.type === entry.type &&
                currentEntry.timestamp === entry.timestamp
            )
        );

        return [...restoredEntries, ...withoutDeletedProject];
      });
    } finally {
      setDeletingProjectId(null);
      deleteSnapshotRef.current = null;
      setDeleteDialogProject(null);
      restoreDeleteFocus();
    }
  }, [deleteDialogProject, deletingProjectId, restoreDeleteFocus, supabase]);

  const handleDeleteDialogKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        if (deletingProjectId) {
          return;
        }

        event.preventDefault();
        closeDeleteDialog();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements =
        deleteDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

      if (!focusableElements || focusableElements.length === 0) {
        return;
      }

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (
          activeElement === firstFocusable ||
          !activeElement ||
          !deleteDialogRef.current?.contains(activeElement)
        ) {
          event.preventDefault();
          lastFocusable.focus();
        }
        return;
      }

      if (activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    },
    [closeDeleteDialog, deletingProjectId]
  );

  useEffect(() => {
    if (!deleteDialogProject) {
      return;
    }

    deleteCancelRef.current?.focus();
  }, [deleteDialogProject]);

  const handleRenameProject = async (id: string, newName: string) => {
    setProjects((current) =>
      current.map((project) =>
        project.id === id ? { ...project, title: newName } : project
      )
    );
  };

  const handleToggleStar = (id: string) => {
    setStarredProjectIds(toggleStarredProject(id));
  };

  const frameworkOptions = useMemo(() => {
    const uniqueFrameworks = Array.from(
      new Set(projects.map((project) => project.framework))
    ).sort();

    return ["all", ...uniqueFrameworks];
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const now = Date.now();
    const query = searchQuery.trim().toLowerCase();

    const result = projects.filter((project) => {
      const matchesSearch =
        !query ||
        project.title.toLowerCase().includes(query) ||
        project.framework.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query);

      const matchesFramework =
        frameworkFilter === "all" || project.framework === frameworkFilter;

      const projectDate = new Date(project.updatedAt).getTime();
      const matchesDate =
        dateFilter === "all" ||
        (dateFilter === "7d" && projectDate >= now - 7 * 24 * 60 * 60 * 1000) ||
        (dateFilter === "30d" && projectDate >= now - 30 * 24 * 60 * 60 * 1000);

      return matchesSearch && matchesFramework && matchesDate;
    });

    result.sort((left, right) => {
      const leftStarred = starredProjectIds.includes(left.id) ? 1 : 0;
      const rightStarred = starredProjectIds.includes(right.id) ? 1 : 0;

      if (leftStarred !== rightStarred) {
        return rightStarred - leftStarred;
      }

      if (sortBy === "alphabetical") {
        return left.title.localeCompare(right.title);
      }

      const leftTime = new Date(left.updatedAt).getTime();
      const rightTime = new Date(right.updatedAt).getTime();

      if (sortBy === "oldest") {
        return leftTime - rightTime;
      }

      return rightTime - leftTime;
    });

    return result;
  }, [
    dateFilter,
    frameworkFilter,
    projects,
    searchQuery,
    sortBy,
    starredProjectIds,
  ]);

  const recentProjectCards = useMemo(() => {
    return recentActivity
      .map((entry) => {
        const project = projects.find((item) => item.id === entry.projectId);
        if (!project) {
          return null;
        }

        return {
          entry,
          project,
        };
      })
      .filter(
        (
          item
        ): item is {
          entry: RecentProjectActivity;
          project: DashboardProject;
        } => !!item
      )
      .slice(0, 4);
  }, [projects, recentActivity]);

  const starredCount = starredProjectIds.filter((id) =>
    projects.some((project) => project.id === id)
  ).length;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6 lg:p-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-[var(--cc-text-primary)]">
              Projects
            </h1>
            <p className="mt-1 text-[13px] text-[var(--cc-text-secondary)]">
              Search, organize, and jump back into your sketch-to-code work.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <StatPill label="Total" value={String(projects.length)} />
            <StatPill label="Starred" value={String(starredCount)} />
            <motion.button
              whileTap={{ scale: 0.96 }}
              ref={newProjectButtonRef}
              onClick={handleCreateProject}
              className="flex items-center gap-1.5 rounded-[var(--cc-radius-button)] bg-[var(--cc-accent)] px-3.5 py-2 text-[13px] font-semibold text-white transition-all hover:shadow-[0_0_20px_var(--cc-accent-glow-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--cc-bg-canvas)]"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New project
            </motion.button>
          </div>
        </div>

        <section className="rounded-[var(--cc-radius-card)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] p-5">
          <div className="mb-4">
            <h2 className="text-[14px] font-semibold text-[var(--cc-text-primary)]">
              Recent activity
            </h2>
            <p className="text-[12px] text-[var(--cc-text-muted)]">
              Your latest opened and newly created projects.
            </p>
          </div>

          {recentProjectCards.length === 0 ? (
            <div className="rounded-[var(--cc-radius-card)] border border-dashed border-[var(--cc-border-subtle)] bg-[var(--cc-bg-canvas)] px-4 py-8 text-center text-[12px] text-[var(--cc-text-muted)]">
              Open a project or create one from the dashboard to build your
              recent activity feed.
            </div>
          ) : (
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              {recentProjectCards.map(({ entry, project }) => (
                <motion.button
                  whileHover={{ y: -2 }}
                  transition={{
                    duration: 0.18,
                    ease: [0.22, 0.9, 0.28, 1],
                  }}
                  key={`${entry.projectId}-${entry.timestamp}`}
                  onClick={() => {
                    setRecentActivity(
                      recordProjectActivity(project.id, "opened")
                    );
                    router.push(`/canvas?id=${project.id}`);
                  }}
                  className="rounded-[var(--cc-radius-card)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-canvas)] p-3.5 text-left transition-colors hover:border-[var(--cc-border-emphasis)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-[var(--cc-radius-tag)] bg-[var(--cc-accent-glow)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-[var(--cc-accent)]">
                      {entry.type}
                    </span>
                    <span className="text-[10px] text-[var(--cc-text-muted)]">
                      {formatDistanceToNow(new Date(entry.timestamp), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <div className="mt-3 truncate text-[13px] font-semibold text-[var(--cc-text-primary)]">
                    {project.title}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-[var(--cc-text-secondary)]">
                    {project.framework.toUpperCase()} · Updated{" "}
                    {formatDistanceToNow(new Date(project.updatedAt), {
                      addSuffix: true,
                    })}
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[var(--cc-radius-card)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] p-4">
          <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,0.6fr))]">
            <label className="flex items-center gap-2.5 rounded-[var(--cc-radius-button)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-canvas)] px-3 py-2.5 transition-colors focus-within:border-[var(--cc-accent)] focus-within:shadow-[0_0_0_3px_var(--cc-accent-glow)]">
              <svg
                className="h-4 w-4 flex-none text-[var(--cc-text-muted)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by title, framework, or description"
                aria-label="Search projects"
                className="w-full bg-transparent text-[13px] text-[var(--cc-text-primary)] placeholder:text-[var(--cc-text-muted)] focus:outline-none"
              />
            </label>

            <FilterSelect
              label="Framework"
              value={frameworkFilter}
              onChange={setFrameworkFilter}
              options={frameworkOptions.map((option) => ({
                value: option,
                label:
                  option === "all" ? "All frameworks" : option.toUpperCase(),
              }))}
            />

            <FilterSelect
              label="Updated"
              value={dateFilter}
              onChange={(value) => setDateFilter(value as DateFilter)}
              options={[
                { value: "all", label: "Any time" },
                { value: "7d", label: "Last 7 days" },
                { value: "30d", label: "Last 30 days" },
              ]}
            />

            <FilterSelect
              label="Sort"
              value={sortBy}
              onChange={(value) => setSortBy(value as SortOption)}
              options={[
                { value: "recent", label: "Recent first" },
                { value: "oldest", label: "Oldest first" },
                { value: "alphabetical", label: "Alphabetical" },
              ]}
            />
          </div>
        </section>

        {deleteError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            role="alert"
            aria-live="polite"
            className="rounded-[var(--cc-radius-card)] border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-[13px] text-[var(--cc-error)]"
          >
            {deleteError}
          </motion.div>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--cc-border-subtle)] border-t-[var(--cc-accent)]" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[var(--cc-radius-card)] border border-dashed border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)]/50 py-20 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-elevated)] text-[var(--cc-text-muted)]">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-[14px] font-semibold text-[var(--cc-text-primary)]">
              {projects.length === 0
                ? "No projects yet"
                : "No projects match these filters"}
            </h3>
            <p className="mt-1 text-[12px] text-[var(--cc-text-secondary)]">
              {projects.length === 0
                ? "Create your first project to get started."
                : "Try another search term, framework, or date range."}
            </p>
            <button
              onClick={
                projects.length === 0
                  ? handleCreateProject
                  : () => {
                      setSearchQuery("");
                      setFrameworkFilter("all");
                      setDateFilter("all");
                      setSortBy("recent");
                    }
              }
              className="mt-5 rounded-[var(--cc-radius-button)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-elevated)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--cc-text-primary)] transition-colors hover:border-[var(--cc-border-emphasis)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]"
            >
              {projects.length === 0 ? "Create project" : "Clear filters"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={{
                  id: project.id,
                  title: project.title,
                  description: project.description,
                  framework: project.framework,
                  thumbnailUrl: project.thumbnailUrl,
                  updated_at: project.updatedAt,
                }}
                onRequestDelete={handleRequestDelete}
                onRename={handleRenameProject}
                onToggleStar={handleToggleStar}
                isStarred={starredProjectIds.includes(project.id)}
                deleteDisabled={Boolean(
                  deleteDialogProject || deletingProjectId
                )}
              />
            ))}
          </div>
        )}

        <AnimatePresence>
          {deleteDialogProject && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-[4px]"
              onClick={() => {
                if (!deletingProjectId) {
                  closeDeleteDialog();
                }
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 4 }}
                transition={{ duration: 0.2, ease: [0.22, 1.4, 0.32, 1] }}
                ref={deleteDialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-project-title"
                aria-describedby="delete-project-description"
                tabIndex={-1}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={handleDeleteDialogKeyDown}
                className="w-full max-w-md rounded-[12px] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] p-5 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)]"
              >
                <div className="flex items-start gap-3.5">
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[var(--cc-radius-button)] bg-[rgba(239,68,68,0.12)] text-[var(--cc-error)]">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2
                      id="delete-project-title"
                      className="text-[15px] font-semibold text-[var(--cc-text-primary)]"
                    >
                      Delete project?
                    </h2>
                    <p
                      id="delete-project-description"
                      className="mt-1 text-[12px] text-[var(--cc-text-secondary)]"
                    >
                      Are you sure you want to delete this project? This action
                      cannot be undone.
                    </p>
                    <p className="mt-2 truncate text-[12px] font-medium text-[var(--cc-text-primary)]">
                      {deleteDialogProject.title}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    ref={deleteCancelRef}
                    type="button"
                    onClick={closeDeleteDialog}
                    disabled={Boolean(deletingProjectId)}
                    className="rounded-[var(--cc-radius-button)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-elevated)] px-3.5 py-2 text-[13px] font-semibold text-[var(--cc-text-primary)] transition-colors hover:border-[var(--cc-border-emphasis)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={Boolean(deletingProjectId)}
                    aria-busy={Boolean(deletingProjectId)}
                    className="cc-danger inline-flex items-center justify-center gap-2 rounded-[var(--cc-radius-button)] bg-[var(--cc-error)] px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-error)]"
                  >
                    {deletingProjectId ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Deleting...
                      </>
                    ) : (
                      "Delete"
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[var(--cc-radius-button)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] px-3 py-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--cc-text-muted)]">
        {label}
      </span>
      <span className="text-[14px] font-semibold text-[var(--cc-text-primary)]">
        {value}
      </span>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="rounded-[var(--cc-radius-button)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-canvas)] px-3 py-2 transition-colors focus-within:border-[var(--cc-accent)] focus-within:shadow-[0_0_0_3px_var(--cc-accent-glow)]">
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--cc-text-muted)]">
        {label}
      </div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-0.5 w-full bg-transparent text-[13px] text-[var(--cc-text-primary)] focus:outline-none"
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className="bg-[var(--cc-bg-surface)]"
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
