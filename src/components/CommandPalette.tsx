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
import { DRAFTING_TOKENS as T } from "@/lib/drafting-room/tokens";

const MONO = "var(--font-jetbrains-mono, ui-monospace, monospace)";
const SANS = "var(--font-inter, ui-sans-serif, system-ui, sans-serif)";

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
const OPEN_SHORTCUTS_EVENT = "codecanvas:open-shortcuts-panel";

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

// Asks whichever page hosts the migrated `ShortcutsPanel` to open it. Used by
// the command palette so its "Keyboard shortcuts" command points at the new
// Drafting Room modal instead of rendering a duplicate inline view.
export function openShortcutsPanel() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_SHORTCUTS_EVENT));
  }
}

export const SHORTCUTS_PANEL_EVENT = OPEN_SHORTCUTS_EVENT;

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
      }
    };
    const onOpenPalette = () => {
      setIsOpen(true);
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
        subtitle: "Open the shortcuts reference",
        keywords: "shortcuts help keyboard",
        kind: "command",
        group: "Help",
        shortcut: "?",
        onSelect: () => {
          // Close the palette and ask the host page to open the migrated
          // ShortcutsPanel (single source of truth, drafting room theme).
          setIsOpen(false);
          openShortcutsPanel();
        },
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
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
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
  }, [filteredActions, isOpen, selectedIndex]);

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
          className="fixed inset-0 z-(--z-modal,50) flex items-start justify-center px-4 pt-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 0.9, 0.28, 1] }}
          style={{ fontFamily: SANS }}
        >
          <div
            aria-hidden="true"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 backdrop-blur-[2px]"
            style={{ background: "rgba(14, 14, 15, 0.55)" }}
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
            className="relative z-(--z-popover,60) w-full max-w-2xl overflow-hidden"
            style={{
              background: T.paper,
              border: `1px solid ${T.rule}`,
              boxShadow:
                "0 24px 48px -16px rgba(14,14,15,0.45), 0 2px 8px rgba(14,14,15,0.2)",
            }}
          >
            {/* Header slug · same editorial spine as DraftingModal */}
            <div
              className="flex items-center justify-between border-b px-4 py-2"
              style={{
                background: T.vellum,
                borderColor: T.rule,
                fontFamily: MONO,
              }}
            >
              <div
                className="flex items-center gap-2 text-[10px] tracking-[0.18em] uppercase"
                style={{ color: T.muted }}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-1.5 w-1.5"
                  style={{ background: T.cobalt }}
                />
                <span style={{ color: T.graphite }}>COMMAND</span>
                <span>·</span>
                <span>NAVIGATE</span>
              </div>
              <kbd
                className="px-2 py-0.5 text-[10px] tracking-[0.14em] uppercase"
                style={{
                  background: T.paper,
                  border: `1px solid ${T.rule}`,
                  color: T.muted,
                  fontFamily: MONO,
                }}
              >
                Ctrl+K
              </kbd>
            </div>

            {/* Search row */}
            <div
              className="border-b px-4 py-3"
              style={{ borderColor: T.rule, background: T.paper }}
            >
              <div
                className="flex items-center gap-3 px-3 py-2"
                style={{
                  background: T.paper,
                  border: `1px solid ${T.rule}`,
                }}
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  style={{ color: T.cobalt }}
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
                  className="w-full bg-transparent text-[13px] outline-none placeholder:opacity-60"
                  style={{
                    color: T.graphite,
                    fontFamily: SANS,
                  }}
                />
                <kbd
                  className="px-1.5 py-0.5 text-[10px] tracking-[0.14em] uppercase"
                  style={{
                    background: T.vellum,
                    border: `1px solid ${T.rule}`,
                    color: T.muted,
                    fontFamily: MONO,
                  }}
                >
                  Esc
                </kbd>
              </div>
            </div>

            {/* Listbox */}
            <div
              ref={listRef}
              id="palette-listbox"
              role="listbox"
              aria-label="Available commands"
              className="max-h-112 overflow-y-auto"
              style={{
                background: T.paper,
                scrollbarColor: `${T.graphite} transparent`,
              }}
            >
              <style jsx global>{`
                #palette-listbox::-webkit-scrollbar {
                  width: 10px;
                  height: 10px;
                }
                #palette-listbox::-webkit-scrollbar-track {
                  background: transparent;
                }
                #palette-listbox::-webkit-scrollbar-thumb {
                  background: ${T.rule};
                  border: 2px solid transparent;
                  border-radius: 9999px;
                }
                #palette-listbox::-webkit-scrollbar-thumb:hover {
                  background: ${T.graphite};
                }
                #palette-listbox::-webkit-scrollbar-thumb:active {
                  background: ${T.cobalt};
                }
              `}</style>
              {filteredActions.length === 0 ? (
                <div
                  className="mx-3 my-6 border px-4 py-10 text-center"
                  style={{
                    background: T.vellum,
                    borderColor: T.rule,
                    borderStyle: "dashed",
                  }}
                >
                  <p
                    className="text-[11px] tracking-[0.14em] uppercase"
                    style={{ color: T.muted, fontFamily: MONO }}
                  >
                    NO RESULTS
                  </p>
                  <p
                    className="mt-1 text-[12px]"
                    style={{ color: T.muted, fontFamily: SANS }}
                  >
                    Nothing matches &ldquo;{query}&rdquo;.
                  </p>
                </div>
              ) : (
                groupedActions.map(({ group, items, startIndex }) => (
                  <div key={group}>
                    <div
                      className="border-b px-4 py-1 text-[10px] tracking-[0.2em] uppercase"
                      style={{
                        background: T.vellum,
                        borderColor: T.rule,
                        color: T.muted,
                        fontFamily: MONO,
                      }}
                    >
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
                          className="relative flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors focus-visible:outline-none"
                          style={{
                            background: isSelected ? T.vellum : T.paper,
                            color: T.graphite,
                            borderBottom: `1px solid ${T.rule}33`,
                          }}
                        >
                          {/* Cobalt left rail when selected · same affordance
                              as the toolbar active mark */}
                          {isSelected ? (
                            <span
                              aria-hidden="true"
                              className="absolute left-0 top-0 bottom-0 w-0.5"
                              style={{ background: T.cobalt }}
                            />
                          ) : null}
                          <div className="min-w-0">
                            <div
                              className="truncate text-[13px]"
                              style={{
                                color: T.graphite,
                                fontFamily: SANS,
                              }}
                            >
                              {action.title}
                            </div>
                            <div
                              className="mt-0.5 truncate text-[11px]"
                              style={{
                                color: T.muted,
                                fontFamily: SANS,
                              }}
                            >
                              {action.subtitle}
                            </div>
                          </div>
                          <div className="ml-3 flex flex-none items-center gap-2">
                            {action.kind === "command" && action.shortcut ? (
                              <kbd
                                className="px-1.5 py-0.5 text-[10px] tracking-[0.06em]"
                                style={{
                                  background: T.vellum,
                                  border: `1px solid ${T.rule}`,
                                  color: T.graphite,
                                  fontFamily: MONO,
                                }}
                              >
                                {action.shortcut}
                              </kbd>
                            ) : null}
                            <span
                              className="px-2 py-0.5 text-[10px] tracking-[0.18em] uppercase"
                              style={{
                                background:
                                  action.kind === "project"
                                    ? T.cobaltWash
                                    : T.paper,
                                border: `1px solid ${
                                  action.kind === "project" ? T.cobalt : T.rule
                                }`,
                                color:
                                  action.kind === "project"
                                    ? T.cobaltInk
                                    : T.muted,
                                fontFamily: MONO,
                              }}
                            >
                              {action.kind === "project" ? "PROJECT" : "CMD"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer · mono hint bar */}
            <div
              className="flex items-center justify-between border-t px-4 py-1.5 text-[10px] tracking-[0.16em] uppercase"
              style={{
                background: T.vellum,
                borderColor: T.rule,
                color: T.muted,
                fontFamily: MONO,
              }}
            >
              <div className="flex items-center gap-4">
                <FooterHint k="↑↓" label="NAVIGATE" />
                <FooterHint k="↵" label="SELECT" />
                <FooterHint k="ESC" label="CLOSE" />
              </div>
              <span>
                {filteredActions.length} RESULT
                {filteredActions.length === 1 ? "" : "S"}
              </span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function FooterHint({ k, label }: { k: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd
        className="px-1.5 py-0.5 text-[10px]"
        style={{
          background: T.paper,
          border: `1px solid ${T.rule}`,
          color: T.graphite,
          fontFamily: MONO,
        }}
      >
        {k}
      </kbd>
      <span>{label}</span>
    </span>
  );
}
