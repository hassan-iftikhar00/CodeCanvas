"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ProjectCard from "@/components/dashboard/ProjectCard";
import {
  normalizeProject,
  readRecentProjectActivity,
  readStarredProjectIds,
  recordProjectActivity,
  toggleStarredProject,
  type DashboardProject,
  type RecentProjectActivity,
} from "@/lib/dashboard-projects";

type SortOption = "recent" | "oldest" | "alphabetical";
type DateFilter = "all" | "7d" | "30d";

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
  const supabase = createClient();
  const router = useRouter();

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

  const handleDeleteProject = async (id: string) => {
    try {
      const { error } = await supabase.from("projects").delete().eq("id", id);

      if (error) {
        throw error;
      }

      setProjects((current) => current.filter((project) => project.id !== id));
      setStarredProjectIds((current) =>
        current.filter((projectId) => projectId !== id)
      );
      setRecentActivity((current) =>
        current.filter((entry) => entry.projectId !== id)
      );
    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };

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
      <div className="space-y-8 p-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Projects</h1>
            <p className="mt-1 text-[#A0A0A0]">
              Search, organize, and jump back into your sketch-to-code work.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <StatPill label="Total" value={String(projects.length)} />
            <StatPill label="Starred" value={String(starredCount)} />
            <button
              onClick={handleCreateProject}
              className="flex items-center gap-2 rounded-xl bg-[#FF6B00] px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#E66000] hover:shadow-[0_0_20px_rgba(255,107,0,0.3)]"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Project
            </button>
          </div>
        </div>

        <section className="rounded-3xl border border-[#2E2E2E] bg-[#121212] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Recent activity
              </h2>
              <p className="text-sm text-[#8A8A8A]">
                Your latest opened and newly created projects.
              </p>
            </div>
          </div>

          {recentProjectCards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#2E2E2E] bg-[#0D0D0D] px-4 py-8 text-center text-sm text-[#777777]">
              Open a project or create one from the dashboard to build your
              recent activity feed.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {recentProjectCards.map(({ entry, project }) => (
                <button
                  key={`${entry.projectId}-${entry.timestamp}`}
                  onClick={() => {
                    setRecentActivity(
                      recordProjectActivity(project.id, "opened")
                    );
                    router.push(`/canvas?id=${project.id}`);
                  }}
                  className="rounded-2xl border border-[#242424] bg-[#0D0D0D] p-4 text-left transition-all hover:border-[#FF6B00]/60 hover:bg-[#111111]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-[#20160D] px-2 py-1 text-[10px] uppercase tracking-[0.22em] text-[#FFB97A]">
                      {entry.type}
                    </span>
                    <span className="text-xs text-[#717171]">
                      {formatDistanceToNow(new Date(entry.timestamp), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <div className="mt-4 text-base font-semibold text-white">
                    {project.title}
                  </div>
                  <div className="mt-1 text-sm text-[#8A8A8A]">
                    {project.framework.toUpperCase()} · Updated{" "}
                    {formatDistanceToNow(new Date(project.updatedAt), {
                      addSuffix: true,
                    })}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-[#2E2E2E] bg-[#121212] p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,0.6fr))]">
            <label className="flex items-center gap-3 rounded-2xl border border-[#2E2E2E] bg-[#0D0D0D] px-4 py-3">
              <svg
                className="h-4 w-4 text-[#666666]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="m21 21-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by title, framework, or description"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#666666]"
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

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2E2E2E] border-t-[#FF6B00]" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#2E2E2E] bg-[#1A1A1A]/50 py-24 text-center">
            <div className="mb-4 rounded-full bg-[#2E2E2E] p-4">
              <svg
                className="h-8 w-8 text-[#666666]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white">
              {projects.length === 0
                ? "No projects yet"
                : "No projects match these filters"}
            </h3>
            <p className="mt-1 text-[#A0A0A0]">
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
              className="mt-6 rounded-lg border border-[#2E2E2E] bg-[#1A1A1A] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#2E2E2E]"
            >
              {projects.length === 0 ? "Create Project" : "Clear Filters"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                onDelete={handleDeleteProject}
                onRename={handleRenameProject}
                onToggleStar={handleToggleStar}
                isStarred={starredProjectIds.includes(project.id)}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#2E2E2E] bg-[#121212] px-4 py-2">
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#777777]">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
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
    <label className="rounded-2xl border border-[#2E2E2E] bg-[#0D0D0D] px-4 py-3">
      <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-[#777777]">
        {label}
      </div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent text-sm text-white outline-none"
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className="bg-[#111111]"
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
