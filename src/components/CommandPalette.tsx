"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import {
  normalizeProject,
  recordProjectActivity,
  type DashboardProject,
} from "@/lib/dashboard-projects";

export interface CanvasCommand {
  id: string;
  title: string;
  subtitle: string;
  keywords?: string;
  shortcut?: string;
  group?: string;
  onSelect: () => void | Promise<void>;
}

type PaletteAction =
  | {
      id: string;
      title: string;
      subtitle: string;
      keywords: string;
      shortcut?: string;
      group: string;
      kind: "command";
      onSelect: () => void | Promise<void>;
    }
  | {
      id: string;
      title: string;
      subtitle: string;
      keywords: string;
      group: string;
      kind: "project";
      project: DashboardProject;
      onSelect: () => void | Promise<void>;
    };

const COMMAND_PALETTE_EVENT = "codecanvas:open-command-palette";
const REGISTER_EVENT = "codecanvas:register-canvas-commands";

let canvasCommandRegistry: CanvasCommand[] = [];

const dispatchRegistryChange = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(REGISTER_EVENT));
  }
};

export function openCommandPalette() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(COMMAND_PALETTE_EVENT));
  }
}

export function registerCanvasCommands(commands: CanvasCommand[]): () => void {
  canvasCommandRegistry = [...canvasCommandRegistry, ...commands];
  dispatchRegistryChange();
  const ids = new Set(commands.map((c) => c.id));
  return () => {
    canvasCommandRegistry = canvasCommandRegistry.filter((c) => !ids.has(c.id));
    dispatchRegistryChange();
  };
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function CommandPalette() {
  const router = useRouter();
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [canvasCommands, setCanvasCommands] = useState<CanvasCommand[]>(
    () => canvasCommandRegistry
  );

  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

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
    if (error) return;
    setProjects((data ?? []).map(normalizeProject));
  }, [supabase]);

  // Subscribe to canvas command registry changes
  useEffect(() => {
    const sync = () => setCanvasCommands([...canvasCommandRegistry]);
    window.addEventListener(REGISTER_EVENT, sync);
    return () => window.removeEventListener(REGISTER_EVENT, sync);
  }, []);

  // Global open/close: Ctrl/Cmd+K
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (isShortcut) {
        event.preventDefault();
        setIsOpen((current) => !current);
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

  // Focus management: trap focus when open, restore on close
  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    fetchProjects();
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, fetchProjects]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setShowShortcuts(false);
    }
  }, [isOpen]);

  const createProject = useCallback(async () => {
    if (isCreatingProject) return;
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
        if (legacyInsert.error) throw legacyInsert.error;
        createdProject = legacyInsert.data;
      } else {
        createdProject = canonicalInsert.data;
      }
      if (!createdProject?.id) return;
      const normalizedProject = normalizeProject(createdProject);
      recordProjectActivity(normalizedProject.id, "created");
      setIsOpen(false);
      router.push(`/canvas?id=${normalizedProject.id}`);
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
        kind: "command",
        group: "General",
        shortcut: "N",
        onSelect: createProject,
      },
      {
        id: "open-dashboard",
        title: "Open dashboard",
        subtitle: "Go to your projects home",
        keywords: "dashboard home projects",
        kind: "command",
        group: "Navigation",
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
        kind: "command",
        group: "Navigation",
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
        kind: "command",
        group: "Help",
        shortcut: "?",
        onSelect: () => setShowShortcuts(true),
      },
    ],
    [createProject, isCreatingProject, router]
  );

  const canvasActions = useMemo<PaletteAction[]>(
    () =>
      canvasCommands.map((c) => ({
        id: c.id,
        title: c.title,
        subtitle: c.subtitle,
        keywords: c.keywords ?? "",
        shortcut: c.shortcut,
        group: c.group ?? "Canvas",
        kind: "command" as const,
        onSelect: async () => {
          await c.onSelect();
          setIsOpen(false);
        },
      })),
    [canvasCommands]
  );

  const projectActions = useMemo<PaletteAction[]>(
    () =>
      projects.map((project) => ({
        id: `project-${project.id}`,
        title: project.title,
        subtitle: `${project.framework.toUpperCase()} project`,
        keywords: `${project.title} ${project.framework} open project`,
        kind: "project" as const,
        group: "Projects",
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
    const q = query.trim().toLowerCase();
    const all = [...canvasActions, ...baseActions, ...projectActions];
    if (!q) return all;
    return all.filter((a) =>
      `${a.title} ${a.subtitle} ${a.keywords}`.toLowerCase().includes(q)
    );
  }, [baseActions, canvasActions, projectActions, query]);

  const groupedActions = useMemo(() => {
    const groups = new Map<string, PaletteAction[]>();
    filteredActions.forEach((a) => {
      const list = groups.get(a.group) ?? [];
      list.push(a);
      groups.set(a.group, list);
    });
    let cursor = 0;
    return Array.from(groups.entries()).map(([group, items]) => {
      const startIndex = cursor;
      cursor += items.length;
      return { group, items, startIndex };
    });
  }, [filteredActions]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, showShortcuts]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen || showShortcuts) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((c) =>
          Math.min(c + 1, Math.max(filteredActions.length - 1, 0))
        );
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((c) => Math.max(c - 1, 0));
      } else if (event.key === "Enter") {
        const action = filteredActions[selectedIndex];
        if (action) {
          event.preventDefault();
          void action.onSelect();
        }
      } else if (event.key === "Tab") {
        // Focus trap inside dialog
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusables =
          dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filteredActions, isOpen, selectedIndex, showShortcuts]);

  // Auto-scroll selected into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector<HTMLElement>(
      `[data-cmd-index="${selectedIndex}"]`
    );
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="palette"
          className="fixed inset-0 z-[var(--z-modal,50)] flex items-start justify-center px-4 pt-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 0.9, 0.28, 1] }}
        >
          <div
            aria-hidden="true"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1.4, 0.32, 1] }}
            className="relative z-[var(--z-popover,60)] w-full max-w-2xl overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-grey)] bg-[var(--grey-800)] shadow-[var(--shadow-2xl)]"
          >
            <div className="border-b border-[var(--border-grey)] px-4 py-3">
              <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-grey)] bg-[var(--grey-900)] px-4 py-3 focus-within:border-[var(--orange-primary)] focus-within:shadow-[0_0_0_3px_var(--orange-glow)] transition-shadow">
                <svg
                  aria-hidden="true"
                  className="h-5 w-5 text-[var(--text-muted)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m21 21-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search commands, projects, navigation..."
                  aria-label="Search commands"
                  aria-controls="palette-listbox"
                  aria-activedescendant={
                    filteredActions[selectedIndex]?.id ?? undefined
                  }
                  className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                />
                <kbd className="rounded-full border border-[var(--border-grey)] px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-[var(--text-secondary)]">
                  Esc
                </kbd>
              </div>
            </div>

            {showShortcuts ? (
              <div className="space-y-3 px-4 py-4 text-sm text-[var(--text-secondary)]">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                    Keyboard shortcuts
                  </h2>
                  <button
                    onClick={() => setShowShortcuts(false)}
                    className="rounded-full border border-[var(--border-grey)] px-3 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--orange-primary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--orange-primary)]"
                  >
                    Back
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <ShortcutRow
                    shortcut="Ctrl/Cmd + K"
                    label="Toggle command palette"
                  />
                  <ShortcutRow shortcut="Esc" label="Close overlays" />
                  <ShortcutRow shortcut="Ctrl/Cmd + S" label="Save project" />
                  <ShortcutRow shortcut="Ctrl/Cmd + Z" label="Undo" />
                  <ShortcutRow shortcut="Ctrl/Cmd + Shift + Z" label="Redo" />
                  <ShortcutRow
                    shortcut="Ctrl/Cmd + \\"
                    label="Toggle right panel"
                  />
                  <ShortcutRow
                    shortcut="Ctrl/Cmd + `"
                    label="Toggle code panel"
                  />
                  <ShortcutRow shortcut="?" label="Show shortcuts" />
                </div>
              </div>
            ) : (
              <div
                ref={listRef}
                id="palette-listbox"
                role="listbox"
                aria-label="Available commands"
                className="max-h-[28rem] overflow-y-auto px-2 py-2"
              >
                {filteredActions.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                    No results for &ldquo;{query}&rdquo;.
                  </div>
                ) : (
                  groupedActions.map(({ group, items, startIndex }) => (
                    <div key={group} className="mb-2 last:mb-0">
                      <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                        {group}
                      </div>
                      {items.map((action, i) => {
                        const idx = startIndex + i;
                        const isSelected = selectedIndex === idx;
                        return (
                          <button
                            key={action.id}
                            id={action.id}
                            data-cmd-index={idx}
                            role="option"
                            aria-selected={isSelected}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            onClick={() => void action.onSelect()}
                            className={`flex w-full items-center justify-between rounded-[var(--radius-md)] px-3 py-2.5 text-left transition-colors focus-visible:outline-none ${
                              isSelected
                                ? "bg-[var(--grey-700)] text-[var(--text-primary)]"
                                : "text-[var(--text-secondary)] hover:bg-[var(--grey-700)]/60"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                {action.title}
                              </div>
                              <div className="mt-0.5 text-xs text-[var(--text-muted)] truncate">
                                {action.subtitle}
                              </div>
                            </div>
                            <div className="ml-3 flex flex-none items-center gap-2">
                              {action.kind === "command" && action.shortcut ? (
                                <kbd className="rounded-[var(--radius-xs)] border border-[var(--border-grey)] bg-[var(--grey-900)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-secondary)]">
                                  {action.shortcut}
                                </kbd>
                              ) : null}
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${
                                  action.kind === "project"
                                    ? "bg-[var(--success-bg)] text-[var(--success-light)]"
                                    : "bg-[var(--orange-subtle)] text-[var(--orange-300)]"
                                }`}
                              >
                                {action.kind === "project"
                                  ? "Project"
                                  : "Command"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-[var(--border-grey)] bg-[var(--grey-900)] px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
              <div className="flex items-center gap-3">
                <span>
                  <kbd className="font-mono">↑↓</kbd> Navigate
                </span>
                <span>
                  <kbd className="font-mono">↵</kbd> Select
                </span>
                <span>
                  <kbd className="font-mono">Esc</kbd> Close
                </span>
              </div>
              <span>
                {filteredActions.length} result
                {filteredActions.length === 1 ? "" : "s"}
              </span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ShortcutRow({ shortcut, label }: { shortcut: string; label: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-grey)] bg-[var(--grey-900)] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--text-muted)]">
        {shortcut}
      </div>
      <div className="mt-1 text-sm text-[var(--text-primary)]">{label}</div>
    </div>
  );
}
