"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/theme/ThemeToggle";

interface NavbarProps {
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
  onExport?: () => void;
  onChatToggle?: () => void;
  onHistoryToggle?: () => void;
  onTemplatesToggle?: () => void;
  isChatActive?: boolean;
  isHistoryActive?: boolean;

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

export default function Navbar({
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
  onExport,
  onChatToggle,
  onHistoryToggle,
  onTemplatesToggle,
  isChatActive,
  showBackButton = true,
  backButtonHref = "/dashboard",
  showLogo = true,
}: NavbarProps) {
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

  // Close user menu on outside click
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

  // Focus name input on edit
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

  // Save dot state
  type SaveState = "idle" | "saving" | "saved" | "error";
  const saveState: SaveState = saveError
    ? "error"
    : isSaving
      ? "saving"
      : lastSaved
        ? "saved"
        : "idle";

  const dotColor: Record<SaveState, string> = {
    idle: "bg-[var(--cc-text-muted)]",
    saving: "bg-[var(--cc-success)] cc-dot-pulse",
    saved: "bg-[var(--cc-success)]",
    error: "bg-[var(--cc-error)]",
  };

  const saveLabel: Record<SaveState, string> = {
    idle: "Not saved",
    saving: "Saving...",
    saved: lastSaved ? `Saved · ${formatRelative(lastSaved)}` : "Saved",
    error: "Save failed",
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

  // Reset error state when the URL we're trying to load changes,
  // so a fresh URL gets a fresh chance before we fall back to the letter.
  useEffect(() => {
    setAvatarError(false);
  }, [avatarUrl]);

  return (
    <header
      className="flex min-h-[3rem] flex-wrap items-center justify-between gap-2 border-b border-[#1e1e1e] bg-[var(--cc-bg-surface)] px-2 sm:px-3"
      role="banner"
    >
      {/* Left cluster — back, logo, project name + save dot */}
      <div className="flex min-w-0 items-center gap-2">
        {showBackButton && (
          <Link
            href={backButtonHref}
            aria-label="Back to dashboard"
            className="flex h-8 w-8 items-center justify-center rounded-[var(--cc-radius-button)] text-[var(--cc-text-secondary)] transition-colors hover:bg-[var(--cc-bg-elevated)] hover:text-[var(--cc-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
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
            className="flex items-center gap-2 text-[13px] font-semibold text-[var(--cc-text-primary)] transition-colors hover:text-[var(--cc-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)] rounded-[var(--cc-radius-button)] px-1"
          >
            <Image
              src="/logo.png"
              alt=""
              aria-hidden="true"
              width={20}
              height={20}
              className="h-5 w-5"
            />
            <span className="hidden sm:inline">CodeCanvas</span>
          </Link>
        )}

        {/* Divider */}
        {projectName !== undefined ? (
          <span
            aria-hidden="true"
            className="mx-1 h-4 w-px bg-[var(--cc-border-subtle)]"
          />
        ) : null}

        {/* Project name — double-click to edit */}
        {projectName !== undefined && onProjectNameChange ? (
          <div className="flex min-w-0 items-center gap-2">
            {editingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={projectName}
                onChange={(e) => onProjectNameChange(e.target.value)}
                onBlur={commitNameEdit}
                onKeyDown={onNameKey}
                aria-label="Project name"
                className="h-7 min-w-[120px] max-w-[200px] rounded-[var(--cc-radius-button)] border border-[var(--cc-accent)] bg-[var(--cc-bg-elevated)] px-2 text-[12px] font-medium text-[var(--cc-text-primary)] outline-none ring-2 ring-[var(--cc-accent-glow)] sm:min-w-[140px] sm:max-w-[280px] sm:text-[13px]"
              />
            ) : (
              <button
                type="button"
                onDoubleClick={() => setEditingName(true)}
                onClick={() => setEditingName(true)}
                title="Double-click to rename"
                className="group flex h-7 max-w-[200px] items-center gap-1 truncate rounded-[var(--cc-radius-button)] px-2 text-[12px] font-medium text-[var(--cc-text-primary)] transition-colors hover:bg-[var(--cc-bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)] sm:max-w-[280px] sm:text-[13px]"
              >
                <span className="truncate">{projectName || "Untitled"}</span>
                <svg
                  className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
                </svg>
              </button>
            )}

            {/* Auto-save dot */}
            <span
              className="flex items-center gap-1.5"
              role="status"
              aria-live="polite"
              title={saveLabel[saveState]}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${dotColor[saveState]}`}
              />
              <span className="hidden text-[11px] text-[var(--cc-text-secondary)] xl:inline">
                {saveLabel[saveState]}
              </span>
              {isSavingName ? (
                <span className="text-[11px] text-[var(--cc-accent)]">·</span>
              ) : null}
            </span>
          </div>
        ) : null}
      </div>

      {/* Right cluster — actions */}
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <ThemeToggle />
        {onTemplatesToggle ? (
          <HeaderButton
            onClick={onTemplatesToggle}
            label="Templates"
            hideLabelBelow="lg"
          >
            <TemplatesIcon />
          </HeaderButton>
        ) : null}

        {onSave ? (
          <HeaderButton
            onClick={onSave}
            disabled={isSaving}
            label="Save"
            shortcut="Ctrl/⌘S"
            hideLabelBelow="lg"
          >
            <SaveIcon />
          </HeaderButton>
        ) : null}

        {onExport ? (
          <HeaderButton
            onClick={onExport}
            label="Export"
            hideLabelBelow="xl"
            dataOnboardingId="export-action"
          >
            <ExportIcon />
          </HeaderButton>
        ) : null}

        {onChatToggle ? (
          <HeaderButton
            onClick={onChatToggle}
            label="Chat"
            hideLabelBelow="xl"
            active={isChatActive}
          >
            <ChatIcon />
          </HeaderButton>
        ) : null}

        {onHistoryToggle ? (
          <HeaderButton
            onClick={onHistoryToggle}
            label="History"
            hideLabelBelow="xl"
          >
            <HistoryIcon />
          </HeaderButton>
        ) : null}

        {/* Run Detection — primary accent */}
        {onRunDetection ? (
          <button
            onClick={onRunDetection}
            disabled={isGenerating}
            data-onboarding="generate-action"
            className="group ml-1 flex h-8 items-center gap-1.5 rounded-[var(--cc-radius-button)] bg-[var(--cc-accent)] px-3 text-[12px] font-medium text-white transition-all duration-150 hover:shadow-[0_0_18px_var(--cc-accent-glow-strong)] active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--cc-bg-surface)] focus-visible:ring-[var(--cc-accent)]"
            title="Run detection (generate code)"
          >
            {isGenerating ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                <span className="hidden md:inline">Detecting...</span>
              </>
            ) : (
              <>
                <SparkleIcon />
                <span className="hidden md:inline">Run Detection</span>
              </>
            )}
          </button>
        ) : null}

        {/* Avatar */}
        {user ? (
          <div ref={userMenuRef} className="relative ml-1">
            <button
              onClick={() => setShowUserMenu((v) => !v)}
              aria-label="User menu"
              aria-expanded={showUserMenu}
              aria-haspopup="menu"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] text-[11px] font-semibold text-white transition-all hover:ring-2 hover:ring-[var(--cc-accent-glow-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]"
            >
              {avatarUrl && !avatarError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  width={28}
                  height={28}
                  referrerPolicy="no-referrer"
                  className="h-7 w-7 rounded-full object-cover"
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
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: [0.22, 0.9, 0.28, 1] }}
                  className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-[var(--cc-radius-card)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-elevated)] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.6)]"
                >
                  <div className="border-b border-[var(--cc-border-subtle)] px-3 py-3">
                    <div className="text-[13px] font-medium text-[var(--cc-text-primary)] truncate">
                      {displayName}
                    </div>
                    <div className="text-[11px] text-[var(--cc-text-secondary)] truncate">
                      {user.email}
                    </div>
                  </div>
                  <div className="py-1">
                    <MenuLink href="/dashboard" label="Dashboard">
                      <DashboardIcon />
                    </MenuLink>
                    <MenuLink href="/profile" label="Profile">
                      <ProfileIcon />
                    </MenuLink>
                    <div className="my-1 mx-2 h-px bg-[var(--cc-border-subtle)]" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        handleLogout();
                      }}
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-[var(--cc-error)] transition-colors hover:bg-[var(--cc-bg-canvas)]"
                    >
                      <LogoutIcon />
                      Log out
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}
      </div>
    </header>
  );
}

// ───────────────────────── Subcomponents ─────────────────────────

interface HeaderButtonProps {
  children: React.ReactNode;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  hideLabelBelow?: "lg" | "xl";
  onClick: () => void;
  dataOnboardingId?: string;
}

function HeaderButton({
  children,
  label,
  shortcut,
  active,
  disabled,
  hideLabelBelow = "lg",
  onClick,
  dataOnboardingId,
}: HeaderButtonProps) {
  const labelHide = hideLabelBelow === "xl" ? "xl:inline" : "lg:inline";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      data-onboarding={dataOnboardingId}
      className={`flex h-8 items-center gap-1.5 rounded-[var(--cc-radius-button)] px-2.5 text-[12px] font-medium transition-all duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)] ${
        active
          ? "bg-[var(--cc-bg-elevated)] text-[var(--cc-text-primary)]"
          : "text-[var(--cc-text-secondary)] hover:bg-[var(--cc-bg-elevated)] hover:text-[var(--cc-text-primary)]"
      }`}
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
      className="flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--cc-text-secondary)] transition-colors hover:bg-[var(--cc-bg-canvas)] hover:text-[var(--cc-text-primary)]"
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
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

// ───────────────────────── Icons ─────────────────────────

const iconProps = {
  className: "h-4 w-4",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
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
function ChatIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}
function HistoryIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
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
function SparkleIcon() {
  return (
    <svg {...iconProps} className="h-3.5 w-3.5">
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
