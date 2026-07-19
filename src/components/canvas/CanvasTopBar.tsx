"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { T_CANVAS, CanvasMark } from "./canvasTokens";

interface CanvasTopBarProps {
  projectName?: string;
  originalProjectName?: string;
  onProjectNameChange?: (name: string) => void;
  onSaveProjectName?: () => void;
  isSavingName?: boolean;
  currentProjectId?: string | null;

  isSaving?: boolean;
  lastSaved?: Date | null;
  saveError?: string | null;

  onSave?: () => void;
  onRunDetection?: () => void;
  isGenerating?: boolean;
  framework?: "react" | "html" | "vue";
  onFrameworkChange?: (f: "react" | "html" | "vue") => void;
  onExport?: () => void;
  onOpenStackBlitz?: () => void;
  onShare?: () => void;
  onUploadSketch?: () => void;
  onChatToggle?: () => void;
  onTemplatesToggle?: () => void;
  onShortcutsToggle?: () => void;
  isChatActive?: boolean;

  showBackButton?: boolean;
  backButtonHref?: string;
  showLogo?: boolean;
}

interface UserState {
  id: string;
  email?: string;
  user_metadata?: {
    avatar_url?: string;
    full_name?: string;
    name?: string;
    preferred_username?: string;
  };
}

interface ProfileState {
  avatar_url?: string;
  full_name?: string;
  username?: string;
}

export default function CanvasTopBar({
  projectName,
  originalProjectName,
  onProjectNameChange,
  onSaveProjectName,
  isSavingName,
  currentProjectId,
  isSaving,
  lastSaved,
  saveError,
  onSave,
  onRunDetection,
  isGenerating,
  framework = "react",
  onFrameworkChange,
  onExport,
  onOpenStackBlitz,
  onShare,
  onUploadSketch,
  onChatToggle,
  onTemplatesToggle,
  onShortcutsToggle,
  isChatActive,
  showBackButton = true,
  backButtonHref = "/dashboard",
  showLogo = true,
}: CanvasTopBarProps) {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<UserState | null>(null);
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { user: u },
        } = await supabase.auth.getUser();
        if (u) {
          setUser({
            id: u.id,
            email: u.email ?? undefined,
            user_metadata: u.user_metadata as UserState["user_metadata"],
          });
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", u.id)
            .single();
          if (data) setProfile(data as ProfileState);
        }
      } catch {
        setUser(null);
      }
    };
    getUser();
  }, [supabase]);

  useEffect(() => {
    if (!showUserMenu) return;
    const onClick = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [showUserMenu]);

  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingName]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const commitNameEdit = () => {
    if (
      currentProjectId &&
      projectName &&
      projectName.trim() &&
      projectName !== originalProjectName &&
      onSaveProjectName
    ) {
      onSaveProjectName();
    }
    setEditingName(false);
  };

  const onNameKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      onProjectNameChange?.(originalProjectName ?? "");
      setEditingName(false);
    }
  };

  type SaveState = "idle" | "saving" | "saved" | "error";
  const saveState: SaveState = saveError
    ? "error"
    : isSaving
      ? "saving"
      : lastSaved
        ? "saved"
        : "idle";

  const dotColor: Record<SaveState, string> = {
    idle: T_CANVAS.muted,
    saving: T_CANVAS.cobalt,
    saved: T_CANVAS.success,
    error: T_CANVAS.error,
  };

  const saveLabel: Record<SaveState, string> = {
    idle: "NOT SAVED",
    saving: "SAVING",
    saved: lastSaved ? `SAVED · ${formatRelative(lastSaved)}` : "SAVED",
    error: "SAVE FAILED",
  };

  const displayName =
    profile?.full_name ??
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    "User";

  const avatarLetter = (
    profile?.full_name ??
    user?.user_metadata?.full_name ??
    user?.email ??
    "U"
  )
    .charAt(0)
    .toUpperCase();

  const avatarUrl =
    profile?.avatar_url ?? user?.user_metadata?.avatar_url ?? null;

  useEffect(() => {
    setAvatarError(false);
  }, [avatarUrl]);

  return (
    <header
      className="flex min-h-[3rem] items-center justify-between gap-2 border-b px-3 py-2 sm:px-4"
      style={{
        background: T_CANVAS.paper,
        borderColor: T_CANVAS.rule,
        fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
      }}
      role="banner"
    >
      {/* LEFT — back · logo · project name · save dot */}
      <div className="flex min-w-0 items-center gap-2">
        {showBackButton && (
          <Link
            href={backButtonHref}
            aria-label="Back to dashboard"
            className="flex h-8 w-8 items-center justify-center transition-colors"
            style={{
              color: T_CANVAS.muted,
              border: `1px solid ${T_CANVAS.rule}`,
            }}
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
        )}

        {showLogo && (
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-1"
            style={{ color: T_CANVAS.graphite }}
          >
            <CanvasMark size={20} color={T_CANVAS.graphite} />
            <span
              className="hidden text-[13px] tracking-[0.18em] uppercase sm:inline"
              style={{ color: T_CANVAS.graphite }}
            >
              CodeCanvas
            </span>
          </Link>
        )}

        {projectName !== undefined && (
          <>
            <span
              aria-hidden="true"
              className="mx-1 h-3 w-px"
              style={{ background: T_CANVAS.rule, opacity: 0.4 }}
            />

            {onProjectNameChange ? (
              editingName ? (
                <input
                  ref={nameInputRef}
                  type="text"
                  value={projectName}
                  onChange={(e) => onProjectNameChange(e.target.value)}
                  onBlur={commitNameEdit}
                  onKeyDown={onNameKey}
                  aria-label="Project name"
                  className="h-7 min-w-[140px] max-w-[260px] px-2 text-[13px] outline-none"
                  style={{
                    background: T_CANVAS.vellum,
                    border: `1px solid ${T_CANVAS.cobalt}`,
                    color: T_CANVAS.graphite,
                    fontFamily: "var(--font-inter, ui-sans-serif, system-ui)",
                  }}
                />
              ) : (
                <button
                  type="button"
                  onDoubleClick={() => setEditingName(true)}
                  onClick={() => setEditingName(true)}
                  title="Double-click to rename"
                  className="group flex h-7 max-w-[280px] items-center gap-1.5 truncate px-2 text-[13px] tracking-[0.04em] transition-colors"
                  style={{
                    color: T_CANVAS.graphite,
                    fontFamily: "var(--font-inter, ui-sans-serif, system-ui)",
                  }}
                >
                  <span className="truncate">{projectName || "Untitled"}</span>
                  <svg
                    className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </button>
              )
            ) : null}

            <span
              className="flex items-center gap-1.5"
              role="status"
              aria-live="polite"
              title={saveLabel[saveState]}
            >
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5"
                style={{
                  background: dotColor[saveState],
                  animation:
                    saveState === "saving"
                      ? "ct-pulse 1.4s ease-in-out infinite"
                      : undefined,
                }}
              />
              <span
                className="hidden text-[13px] tracking-[0.16em] uppercase xl:inline"
                style={{ color: T_CANVAS.muted }}
              >
                {saveLabel[saveState]}
              </span>
              {isSavingName ? (
                <span
                  className="text-[13px]"
                  style={{ color: T_CANVAS.cobalt }}
                >
                  ·
                </span>
              ) : null}
            </span>
          </>
        )}
      </div>

      {/* RIGHT — actions cluster */}
      <div className="flex flex-wrap items-center justify-end gap-1">
        {onUploadSketch ? (
          <ToolbarButton
            onClick={onUploadSketch}
            label="UPLOAD"
            hideLabelBelow="lg"
          >
            <UploadIcon />
          </ToolbarButton>
        ) : null}

        {onTemplatesToggle ? (
          <ToolbarButton
            onClick={onTemplatesToggle}
            label="TEMPLATES"
            hideLabelBelow="lg"
          >
            <TemplatesIcon />
          </ToolbarButton>
        ) : null}

        {onSave ? (
          <ToolbarButton
            onClick={onSave}
            disabled={isSaving}
            label="SAVE"
            shortcut="Ctrl+S"
            hideLabelBelow="lg"
          >
            <SaveIcon />
          </ToolbarButton>
        ) : null}

        {onChatToggle ? (
          <ToolbarButton
            onClick={onChatToggle}
            label="CHAT"
            hideLabelBelow="xl"
            active={isChatActive}
          >
            <ChatIcon />
          </ToolbarButton>
        ) : null}

        {onShare ? (
          <ToolbarButton onClick={onShare} label="SHARE" hideLabelBelow="xl">
            <ShareIcon />
          </ToolbarButton>
        ) : null}

        {onShortcutsToggle ? (
          <ToolbarButton
            onClick={onShortcutsToggle}
            label="SHORTCUTS"
            shortcut="?"
            hideLabelBelow="xl"
          >
            <KeyboardIcon />
          </ToolbarButton>
        ) : null}

        {onFrameworkChange ? (
          <div
            className="ml-1 flex items-center"
            style={{ border: `1px solid ${T_CANVAS.rule}` }}
            role="group"
            aria-label="Output framework"
          >
            {(["react", "html", "vue"] as const).map((f, i) => {
              const active = framework === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => onFrameworkChange(f)}
                  aria-pressed={active}
                  title={f.toUpperCase()}
                  className="px-2.5 py-1 text-[13px] tracking-[0.14em] uppercase transition-colors"
                  style={{
                    background: active ? T_CANVAS.graphite : "transparent",
                    color: active ? T_CANVAS.paper : T_CANVAS.muted,
                    borderLeft:
                      i > 0 ? `1px solid ${T_CANVAS.rule}` : undefined,
                    fontFamily:
                      "var(--font-jetbrains-mono, ui-monospace, monospace)",
                  }}
                  onMouseEnter={(e) => {
                    if (!active)
                      e.currentTarget.style.color = T_CANVAS.graphite;
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.color = T_CANVAS.muted;
                  }}
                >
                  {f.toUpperCase()}
                </button>
              );
            })}
          </div>
        ) : null}
        {onExport ? (
          // Split control: left half opens the export dialog, right half
          // launches the project straight into StackBlitz.
          <div
            className="flex items-stretch"
            style={{ border: `1px solid ${T_CANVAS.rule}` }}
            role="group"
            aria-label="Export actions"
          >
            <button
              type="button"
              onClick={onExport}
              title="Export"
              data-onboarding="export-action"
              className="flex items-center gap-1.5 px-2.5 py-1 text-[13px] tracking-[0.16em] uppercase transition-colors"
              style={{ background: "transparent", color: T_CANVAS.muted }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = T_CANVAS.graphite)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = T_CANVAS.muted)
              }
            >
              <span className="flex h-4 w-4 items-center justify-center">
                <ExportIcon />
              </span>
              <span className="hidden xl:inline">EXPORT</span>
            </button>
            {onOpenStackBlitz ? (
              <button
                type="button"
                onClick={onOpenStackBlitz}
                title="Open in StackBlitz"
                className="flex items-center gap-1.5 px-2.5 py-1 text-[13px] tracking-[0.16em] uppercase transition-opacity hover:opacity-85"
                style={{
                  background: T_CANVAS.graphite,
                  color: T_CANVAS.paper,
                  borderLeft: `1px solid ${T_CANVAS.rule}`,
                }}
              >
                <span className="flex h-4 w-4 items-center justify-center">
                  <BoltIcon />
                </span>
                <span className="hidden xl:inline">STACKBLITZ</span>
              </button>
            ) : null}
          </div>
        ) : null}

        {onRunDetection ? (
          <button
            onClick={onRunDetection}
            disabled={isGenerating}
            data-onboarding="generate-action"
            className="ml-1 flex h-8 items-center gap-1.5 px-3 text-[13px] tracking-[0.16em] uppercase transition-colors"
            style={{
              background: isGenerating ? T_CANVAS.cobaltInk : T_CANVAS.cobalt,
              border: `1px solid ${isGenerating ? T_CANVAS.cobaltInk : T_CANVAS.cobalt}`,
              color: T_CANVAS.paper,
              cursor: isGenerating ? "not-allowed" : "pointer",
              opacity: isGenerating ? 0.85 : 1,
            }}
            title="Run detection (generate code)"
          >
            {isGenerating ? (
              <>
                <span
                  className="h-3 w-3"
                  style={{
                    border: `1.5px solid ${T_CANVAS.paper}`,
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "ct-spin 0.9s linear infinite",
                  }}
                />
                <span className="hidden md:inline">DETECTING</span>
              </>
            ) : (
              <>
                <SparkleIcon />
                <span className="hidden md:inline">RUN DETECTION →</span>
              </>
            )}
          </button>
        ) : null}

        {user ? (
          <div ref={userMenuRef} className="relative ml-1">
            <button
              onClick={() => setShowUserMenu((v) => !v)}
              aria-label="User menu"
              aria-expanded={showUserMenu}
              aria-haspopup="menu"
              className="flex h-7 w-7 items-center justify-center text-[13px] tracking-[0.12em] uppercase"
              style={{
                background: T_CANVAS.graphite,
                color: T_CANVAS.paper,
                border: `1px solid ${T_CANVAS.rule}`,
              }}
            >
              {avatarUrl && !avatarError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  width={28}
                  height={28}
                  referrerPolicy="no-referrer"
                  className="h-7 w-7 object-cover"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <span aria-hidden="true">{avatarLetter}</span>
              )}
            </button>

            <AnimatePresence>
              {showUserMenu ? (
                <motion.div
                  role="menu"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.14 }}
                  className="absolute right-0 top-full z-50 mt-2 w-60"
                  style={{
                    background: T_CANVAS.paper,
                    border: `1px solid ${T_CANVAS.rule}`,
                  }}
                >
                  <div
                    className="border-b px-3 py-2.5"
                    style={{ borderColor: T_CANVAS.rule }}
                  >
                    <div
                      className="truncate text-[13px]"
                      style={{
                        color: T_CANVAS.graphite,
                        fontFamily:
                          "var(--font-inter, ui-sans-serif, system-ui)",
                      }}
                    >
                      {displayName}
                    </div>
                    <div
                      className="truncate text-[13px] tracking-[0.04em]"
                      style={{ color: T_CANVAS.muted }}
                    >
                      {user.email}
                    </div>
                  </div>
                  <div className="py-1">
                    <MenuLink href="/dashboard" label="DASHBOARD">
                      <DashboardIcon />
                    </MenuLink>
                    <MenuLink href="/profile" label="PROFILE">
                      <ProfileIcon />
                    </MenuLink>
                    <div
                      className="my-1 mx-2 h-px"
                      style={{ background: T_CANVAS.rule, opacity: 0.4 }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        handleLogout();
                      }}
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3 py-2 text-[13px] tracking-[0.16em] uppercase transition-colors hover:opacity-80"
                      style={{ color: T_CANVAS.error }}
                    >
                      <LogoutIcon />
                      LOG OUT
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}
      </div>

      <style jsx>{`
        @keyframes ct-spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes ct-pulse {
          0%,
          100% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.4);
          }
        }
      `}</style>
    </header>
  );
}

// ───────────────────────── Subcomponents ─────────────────────────

interface ToolbarButtonProps {
  children: React.ReactNode;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  hideLabelBelow?: "lg" | "xl";
  onClick: () => void;
  dataOnboardingId?: string;
}

function ToolbarButton({
  children,
  label,
  shortcut,
  active,
  disabled,
  hideLabelBelow = "lg",
  onClick,
  dataOnboardingId,
}: ToolbarButtonProps) {
  const labelHide = hideLabelBelow === "xl" ? "xl:inline" : "lg:inline";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      data-onboarding={dataOnboardingId}
      className="flex h-8 items-center gap-1.5 px-2 text-[13px] tracking-[0.16em] uppercase transition-colors disabled:opacity-50"
      style={{
        background: active ? T_CANVAS.graphite : "transparent",
        color: active ? T_CANVAS.paper : T_CANVAS.muted,
        border: `1px solid ${active ? T_CANVAS.graphite : "transparent"}`,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active) {
          e.currentTarget.style.color = T_CANVAS.graphite;
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = T_CANVAS.muted;
        }
      }}
    >
      <span className="flex h-4 w-4 items-center justify-center">
        {children}
      </span>
      <span className={`hidden ${labelHide}`}>{label}</span>
    </button>
  );
}

function MenuLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2 px-3 py-2 text-[13px] tracking-[0.16em] uppercase transition-colors"
      style={{ color: T_CANVAS.muted }}
      onMouseEnter={(e) => (e.currentTarget.style.color = T_CANVAS.graphite)}
      onMouseLeave={(e) => (e.currentTarget.style.color = T_CANVAS.muted)}
    >
      <span className="flex h-4 w-4 items-center justify-center">
        {children}
      </span>
      {label}
    </Link>
  );
}

// ───────────────────────── Helpers ─────────────────────────

function formatRelative(date: Date): string {
  const sec = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (sec < 60) return `${sec}S AGO`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}M AGO`;
  const hr = Math.floor(min / 60);
  return `${hr}H AGO`;
}

// ───────────────────────── Icons ─────────────────────────

const iconProps = {
  className: "h-3.5 w-3.5",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function SaveIcon() {
  return (
    <svg {...iconProps}>
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  );
}
function ExportIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg {...iconProps}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.6" y1="10.5" x2="15.4" y2="6.5" />
      <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
function TemplatesIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function KeyboardIcon() {
  return (
    <svg {...iconProps}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3"
      aria-hidden="true"
    >
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M3 12h3" />
      <path d="M18 12h3" />
      <path d="M5.6 5.6l2.1 2.1" />
      <path d="M16.3 16.3l2.1 2.1" />
      <path d="M5.6 18.4l2.1-2.1" />
      <path d="M16.3 7.7l2.1-2.1" />
    </svg>
  );
}
function DashboardIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  );
}
function ProfileIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg {...iconProps}>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
