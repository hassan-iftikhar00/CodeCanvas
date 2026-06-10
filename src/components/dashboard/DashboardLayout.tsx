"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import ErrorBoundary from "@/components/ErrorBoundary";
import { openCommandPalette } from "@/components/CommandPalette";
import ThemeToggle from "@/components/theme/ThemeToggle";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface UserProfile {
  full_name: string | null;
  avatar_url: string | null;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/");
      } else {
        setUser(user);

        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profile) {
          setUserProfile(profile);
        }
      }
    };
    getUser();
  }, [router, supabase]);

  // Close user menu on outside click
  useEffect(() => {
    if (!showUserMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showUserMenu]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  const initials =
    (userProfile?.full_name || user?.email)?.[0]?.toUpperCase() || "U";

  return (
    <div className="flex min-h-screen bg-[var(--cc-bg-canvas)] text-[var(--cc-text-primary)] lg:h-screen">
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-30 bg-black/60 backdrop-blur-[2px] transition-opacity lg:hidden ${
          isSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] transition-transform duration-200 lg:static lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-12 items-center justify-between gap-2 border-b border-[var(--cc-border-subtle)] px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-6 w-6" />
            <span className="text-[14px] font-semibold tracking-tight">
              CodeCanvas
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="rounded-[var(--cc-radius-button)] p-1 text-[var(--cc-text-secondary)] transition-colors hover:bg-[var(--cc-bg-elevated)] hover:text-[var(--cc-text-primary)] lg:hidden"
            aria-label="Close sidebar"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 p-2">
          <NavItem
            href="/dashboard"
            label="Projects"
            active={pathname === "/dashboard"}
            onNavigate={() => setIsSidebarOpen(false)}
            icon={
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            }
          />

          <NavItem
            href="/canvas"
            label="Canvas"
            onNavigate={() => setIsSidebarOpen(false)}
            icon={
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            }
          />

          <NavItem
            href="/profile"
            label="Profile"
            active={pathname === "/profile"}
            onNavigate={() => setIsSidebarOpen(false)}
            icon={
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            }
          />

        </nav>

        {/* User card */}
        <div className="border-t border-[var(--cc-border-subtle)] p-2">
          <Link
            href="/profile"
            onClick={() => setIsSidebarOpen(false)}
            className="flex items-center gap-2.5 rounded-[var(--cc-radius-button)] px-2 py-2 transition-colors hover:bg-[var(--cc-bg-elevated)]"
          >
            <Avatar
              size={28}
              avatarUrl={userProfile?.avatar_url}
              initials={initials}
            />
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-[12px] font-medium text-[var(--cc-text-primary)]">
                {userProfile?.full_name || user?.email || "User"}
              </p>
              <p className="text-[11px] text-[var(--cc-text-muted)]">
                View profile
              </p>
            </div>
          </Link>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/");
              setIsSidebarOpen(false);
            }}
            className="mt-1 w-full rounded-[var(--cc-radius-button)] px-2 py-1.5 text-left text-[11px] text-[var(--cc-text-muted)] transition-colors hover:bg-[var(--cc-bg-elevated)] hover:text-[var(--cc-text-primary)]"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex min-h-[3rem] items-center justify-between gap-2 border-b border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] px-3 sm:px-4">
          <div className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-[var(--cc-radius-button)] text-[var(--cc-text-secondary)] transition-colors hover:bg-[var(--cc-bg-elevated)] hover:text-[var(--cc-text-primary)] lg:hidden"
              aria-label="Open sidebar"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={openCommandPalette}
              aria-label="Open command palette"
              className="flex w-full items-center gap-2 rounded-[var(--cc-radius-button)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-canvas)] px-3 py-1.5 text-[12px] text-[var(--cc-text-secondary)] transition-colors hover:border-[var(--cc-border-emphasis)] hover:text-[var(--cc-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)] sm:w-auto"
            >
              <svg
                className="h-3.5 w-3.5"
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
              <span className="hidden sm:inline">
                Search projects and commands
              </span>
              <kbd className="hidden rounded-[var(--cc-radius-tag)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-elevated)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--cc-text-muted)] md:inline-flex">
                Ctrl K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user && (
              <div className="relative" ref={userMenuRef}>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setShowUserMenu((v) => !v)}
                  aria-label="Open profile menu"
                  aria-expanded={showUserMenu}
                  className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[var(--cc-accent)] text-[12px] font-semibold text-white transition-shadow hover:shadow-[0_0_0_2px_var(--cc-accent-glow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]"
                >
                  <Avatar
                    size={28}
                    avatarUrl={userProfile?.avatar_url}
                    initials={initials}
                  />
                </motion.button>

                <AnimatePresence>
                  {showUserMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: [0.22, 0.9, 0.28, 1] }}
                      className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-[var(--cc-radius-card)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.7)]"
                      role="menu"
                    >
                      <div className="border-b border-[var(--cc-border-subtle)] px-3 py-2.5">
                        <div className="text-[12px] font-medium text-[var(--cc-text-primary)]">
                          {userProfile?.full_name || user?.email || "User"}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-[var(--cc-text-muted)]">
                          {user?.email}
                        </div>
                      </div>

                      <div className="py-1">
                        <MenuItem
                          href="/dashboard"
                          label="Dashboard"
                          icon="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                        />
                        <MenuItem
                          href="/profile"
                          label="Profile"
                          icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />

                        <div className="my-1 h-px bg-[var(--cc-border-subtle)]" />

                        <button
                          onClick={async () => {
                            await supabase.auth.signOut();
                            router.push("/");
                          }}
                          role="menuitem"
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] text-[var(--cc-error)] transition-colors hover:bg-[var(--cc-bg-elevated)]"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                            />
                          </svg>
                          Sign out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[var(--cc-bg-canvas)]">
          <ErrorBoundary
            variant="panel"
            title="Dashboard issue"
            message="We could not load this section. Try again."
          >
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon,
  active = false,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-2.5 rounded-[var(--cc-radius-button)] px-2.5 py-2 text-[13px] font-medium transition-colors ${
        active
          ? "bg-[var(--cc-bg-elevated)] text-[var(--cc-text-primary)]"
          : "text-[var(--cc-text-secondary)] hover:bg-[var(--cc-bg-elevated)] hover:text-[var(--cc-text-primary)]"
      }`}
    >
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        {icon}
      </svg>
      {label}
    </Link>
  );
}

function MenuItem({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2.5 px-3 py-2 text-[12px] text-[var(--cc-text-secondary)] transition-colors hover:bg-[var(--cc-bg-elevated)] hover:text-[var(--cc-text-primary)]"
    >
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
      </svg>
      {label}
    </Link>
  );
}

function Avatar({
  size,
  avatarUrl,
  initials,
}: {
  size: number;
  avatarUrl?: string | null;
  initials: string;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className="flex flex-none items-center justify-center overflow-hidden rounded-full bg-[var(--cc-accent)] font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size <= 24 ? 10 : size <= 32 ? 11 : 14,
      }}
    >
      {avatarUrl && !imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full rounded-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        initials
      )}
    </div>
  );
}
