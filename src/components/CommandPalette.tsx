"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  normalizeProject,
  recordProjectActivity,
  type DashboardProject,
} from "@/lib/dashboard-projects";

type PaletteAction =
  | {
      id: string;
      title: string;
      subtitle: string;
      keywords: string;
      type: "command";
      onSelect: () => void | Promise<void>;
    }
  | {
      id: string;
      title: string;
      subtitle: string;
      keywords: string;
      type: "project";
      project: DashboardProject;
      onSelect: () => void | Promise<void>;
    };

const COMMAND_PALETTE_EVENT = "codecanvas:open-command-palette";

export function openCommandPalette() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(COMMAND_PALETTE_EVENT));
  }
}

export default function CommandPalette() {
  const router = useRouter();
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const fetchProjects = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setProjects([]);
      return;
    }

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(12);

    if (error) {
      console.error("Command palette project fetch failed:", error);
      return;
    }

    setProjects((data ?? []).map(normalizeProject));
  }, [supabase]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";

      if (isShortcut) {
        event.preventDefault();
        setIsOpen((current) => !current);
        setShowShortcuts(false);
      }

      if (event.key === "Escape") {
        setIsOpen(false);
        setShowShortcuts(false);
      }
    };

    const onOpenPalette = () => {
      setIsOpen(true);
      setShowShortcuts(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(COMMAND_PALETTE_EVENT, onOpenPalette);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(COMMAND_PALETTE_EVENT, onOpenPalette);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setSelectedIndex(0);
      return;
    }

    fetchProjects();
  }, [fetchProjects, isOpen]);

  const createProject = useCallback(async () => {
    if (isCreatingProject) {
      return;
    }

    setIsCreatingProject(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

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
      recordProjectActivity(normalizedProject.id, "created");
      setIsOpen(false);
      router.push(`/canvas?id=${normalizedProject.id}`);
    } catch (error) {
      console.error("Command palette create project failed:", error);
    } finally {
      setIsCreatingProject(false);
    }
  }, [isCreatingProject, router, supabase]);

  const baseActions = useMemo<PaletteAction[]>(
    () => [
      {
        id: "new-project",
        title: isCreatingProject ? "Creating project..." : "New project",
        subtitle: "Start a blank canvas project",
        keywords: "new create project canvas",
        type: "command",
        onSelect: createProject,
      },
      {
        id: "open-dashboard",
        title: "Open dashboard",
        subtitle: "Go to your projects home",
        keywords: "dashboard home projects",
        type: "command",
        onSelect: () => {
          setIsOpen(false);
          router.push("/dashboard");
        },
      },
      {
        id: "open-settings",
        title: "Open settings",
        subtitle: "Manage profile and account settings",
        keywords: "settings profile account preferences",
        type: "command",
        onSelect: () => {
          setIsOpen(false);
          router.push("/profile");
        },
      },
      {
        id: "show-shortcuts",
        title: "Keyboard shortcuts",
        subtitle: "See the main navigation shortcuts",
        keywords: "shortcuts help keyboard",
        type: "command",
        onSelect: () => {
          setShowShortcuts(true);
        },
      },
    ],
    [createProject, isCreatingProject, router]
  );

  const projectActions = useMemo<PaletteAction[]>(
    () =>
      projects.map((project) => ({
        id: `project-${project.id}`,
        title: project.title,
        subtitle: `${project.framework.toUpperCase()} project`,
        keywords: `${project.title} ${project.framework} open project`,
        type: "project",
        project,
        onSelect: () => {
          recordProjectActivity(project.id, "opened");
          setIsOpen(false);
          router.push(`/canvas?id=${project.id}`);
        },
      })),
    [projects, router]
  );

  const filteredActions = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    const allActions = [...baseActions, ...projectActions];

    if (!lowerQuery) {
      return allActions;
    }

    return allActions.filter((action) =>
      `${action.title} ${action.subtitle} ${action.keywords}`
        .toLowerCase()
        .includes(lowerQuery)
    );
  }, [baseActions, projectActions, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, showShortcuts]);

  useEffect(() => {
    if (!isOpen || showShortcuts) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((current) =>
          Math.min(current + 1, Math.max(filteredActions.length - 1, 0))
        );
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((current) => Math.max(current - 1, 0));
      }

      if (event.key === "Enter") {
        const action = filteredActions[selectedIndex];
        if (!action) {
          return;
        }

        event.preventDefault();
        void action.onSelect();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filteredActions, isOpen, selectedIndex, showShortcuts]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 px-4 pt-20 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close command palette overlay"
        className="absolute inset-0 cursor-default"
        onClick={() => {
          setIsOpen(false);
          setShowShortcuts(false);
        }}
      />

      <div className="relative z-[101] w-full max-w-2xl overflow-hidden rounded-3xl border border-[#2E2E2E] bg-[#111111] shadow-2xl">
        <div className="border-b border-[#2E2E2E] px-4 py-3">
          <div className="flex items-center gap-3 rounded-2xl border border-[#2E2E2E] bg-[#0A0A0A] px-4 py-3">
            <svg
              className="h-5 w-5 text-[#666666]"
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
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects, commands, and navigation..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#666666]"
            />
            <span className="rounded-full border border-[#2E2E2E] px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-[#888888]">
              Ctrl K
            </span>
          </div>
        </div>

        {showShortcuts ? (
          <div className="space-y-3 px-4 py-4 text-sm text-[#CFCFCF]">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                Keyboard Shortcuts
              </h2>
              <button
                onClick={() => setShowShortcuts(false)}
                className="rounded-full border border-[#2E2E2E] px-3 py-1 text-xs text-[#A0A0A0] transition-colors hover:border-[#FF6B00] hover:text-white"
              >
                Back
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <ShortcutRow
                shortcut="Ctrl/Cmd + K"
                label="Open command palette"
              />
              <ShortcutRow shortcut="Esc" label="Close overlays and menus" />
              <ShortcutRow
                shortcut="Ctrl/Cmd + S"
                label="Save project on canvas"
              />
              <ShortcutRow
                shortcut="Shift + ?"
                label="Open shortcuts panel on canvas"
              />
            </div>
          </div>
        ) : (
          <div className="max-h-[28rem] overflow-y-auto px-2 py-2">
            {filteredActions.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-[#888888]">
                No results for “{query}”.
              </div>
            ) : (
              filteredActions.map((action, index) => (
                <button
                  key={action.id}
                  onClick={() => void action.onSelect()}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-colors ${
                    selectedIndex === index
                      ? "bg-[#1B1B1B] text-white"
                      : "text-[#C5C5C5] hover:bg-[#171717] hover:text-white"
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium">{action.title}</div>
                    <div className="mt-1 text-xs text-[#8C8C8C]">
                      {action.subtitle}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.22em] ${
                      action.type === "project"
                        ? "bg-[#0F2B22] text-[#7CE5B2]"
                        : "bg-[#20160D] text-[#FFB97A]"
                    }`}
                  >
                    {action.type === "project" ? "Project" : "Command"}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ShortcutRow({ shortcut, label }: { shortcut: string; label: string }) {
  return (
    <div className="rounded-2xl border border-[#2E2E2E] bg-[#0A0A0A] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.24em] text-[#7F7F7F]">
        {shortcut}
      </div>
      <div className="mt-1 text-sm text-white">{label}</div>
    </div>
  );
}
