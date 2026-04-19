"use client";

export interface DashboardProject {
  id: string;
  title: string;
  description: string | null;
  framework: string;
  thumbnailUrl: string | null;
  updatedAt: string;
  createdAt: string;
  raw: Record<string, unknown>;
}

export interface RecentProjectActivity {
  projectId: string;
  type: "created" | "opened";
  timestamp: string;
}

const STARRED_PROJECTS_KEY = "codecanvas.starredProjects";
const RECENT_ACTIVITY_KEY = "codecanvas.recentProjectActivity";
const RECENT_ACTIVITY_LIMIT = 10;

function readString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function readNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

export function normalizeProject(
  project: Record<string, unknown>
): DashboardProject {
  return {
    id: readString(project.id, crypto.randomUUID()),
    title: readString(project.title ?? project.name, "Untitled Project"),
    description: readNullableString(project.description),
    framework: readString(project.framework, "react").toLowerCase(),
    thumbnailUrl: readNullableString(
      project.thumbnail_url ?? project.thumbnail
    ),
    updatedAt:
      readNullableString(project.updated_at) ??
      readString(project.created_at, new Date().toISOString()),
    createdAt: readString(project.created_at, new Date().toISOString()),
    raw: project,
  };
}

export function readStarredProjectIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const value = window.localStorage.getItem(STARRED_PROJECTS_KEY);
    if (!value) {
      return [];
    }

    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export function writeStarredProjectIds(projectIds: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STARRED_PROJECTS_KEY, JSON.stringify(projectIds));
}

export function toggleStarredProject(projectId: string): string[] {
  const starredProjectIds = readStarredProjectIds();
  const nextProjectIds = starredProjectIds.includes(projectId)
    ? starredProjectIds.filter((id) => id !== projectId)
    : [projectId, ...starredProjectIds];

  writeStarredProjectIds(nextProjectIds);
  return nextProjectIds;
}

export function readRecentProjectActivity(): RecentProjectActivity[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const value = window.localStorage.getItem(RECENT_ACTIVITY_KEY);
    if (!value) {
      return [];
    }

    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (entry): entry is RecentProjectActivity =>
        typeof entry?.projectId === "string" &&
        typeof entry?.type === "string" &&
        typeof entry?.timestamp === "string"
    );
  } catch {
    return [];
  }
}

export function writeRecentProjectActivity(activity: RecentProjectActivity[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(RECENT_ACTIVITY_KEY, JSON.stringify(activity));
}

export function recordProjectActivity(
  projectId: string,
  type: RecentProjectActivity["type"]
) {
  if (typeof window === "undefined") {
    return [];
  }

  const currentActivity = readRecentProjectActivity().filter(
    (entry) => !(entry.projectId === projectId && entry.type === type)
  );

  const nextActivity = [
    {
      projectId,
      type,
      timestamp: new Date().toISOString(),
    },
    ...currentActivity,
  ].slice(0, RECENT_ACTIVITY_LIMIT);

  window.localStorage.setItem(
    RECENT_ACTIVITY_KEY,
    JSON.stringify(nextActivity)
  );
  return nextActivity;
}
