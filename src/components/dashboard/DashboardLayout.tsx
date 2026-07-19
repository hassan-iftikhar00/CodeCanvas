"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import ErrorBoundary from "@/components/ErrorBoundary";
import { openCommandPalette } from "@/components/CommandPalette";
import { DRAFTING_TOKENS as T } from "@/lib/drafting-room/tokens";
import { DraftingMark } from "@/lib/drafting-room/marks";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface UserProfile {
  full_name: string | null;
  avatar_url: string | null;
}

const MONO = "var(--font-jetbrains-mono, ui-monospace, monospace)";
const SANS = "var(--font-inter, ui-sans-serif, system-ui)";

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

  const displayName = userProfile?.full_name || user?.email || "User";

  return (
    <div
      className="flex min-h-screen lg:h-screen"
      style={{
        background: T.paper,
        color: T.graphite,
        fontFamily: SANS,
      }}
    >
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-30 transition-opacity lg:hidden ${
          isSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        style={{ background: "rgba(14, 14, 15, 0.55)" }}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r transition-transform duration-200 lg:static lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: T.paper,
          borderColor: T.rule,
        }}
      >
        {/* Logo title block */}
        <div
          className="flex h-12.5 items-center justify-between gap-2 border-b px-4"
          style={{
            background: T.vellum,
            borderColor: T.rule,
            fontFamily: MONO,
          }}
        >
          <Link
            href="/dashboard"
            className="flex items-center gap-2"
            style={{ color: T.graphite }}
          >
            <DraftingMark size={20} color={T.graphite} />
            <span
              className="text-[13px] tracking-[0.18em] uppercase"
              style={{ color: T.graphite }}
            >
              CodeCanvas
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="flex h-7 w-7 items-center justify-center transition-colors lg:hidden"
            style={{ color: T.muted, border: `1px solid ${T.rule}` }}
            aria-label="Close sidebar"
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
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Section slug */}
        <div
          className="px-4 pt-4 pb-1 text-[13px] tracking-[0.18em] uppercase"
          style={{ color: T.muted, fontFamily: MONO }}
        >
          Navigate
        </div>

        <nav className="flex-1 space-y-0.5 px-2 pt-1">
          <NavItem
            href="/dashboard"
            label="PROJECTS"
            active={pathname === "/dashboard"}
            onNavigate={() => setIsSidebarOpen(false)}
            icon={
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            }
          />

          <NavItem
            href="/canvas"
            label="CANVAS"
            active={pathname === "/canvas"}
            onNavigate={() => setIsSidebarOpen(false)}
            icon={
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            }
          />

          <NavItem
            href="/profile"
            label="PROFILE"
            active={pathname === "/profile"}
            onNavigate={() => setIsSidebarOpen(false)}
            icon={
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            }
          />
        </nav>

        {/* User card */}
        <div
          className="border-t px-2 py-2"
          style={{
            background: T.vellum,
            borderColor: T.rule,
          }}
        >
          <Link
            href="/profile"
            onClick={() => setIsSidebarOpen(false)}
            className="flex items-center gap-2.5 px-2 py-2 transition-colors"
            style={{ color: T.graphite }}
            onMouseEnter={(e) => (e.currentTarget.style.background = T.paper)}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <Avatar
              size={28}
              avatarUrl={userProfile?.avatar_url}
              initials={initials}
            />
            <div className="flex-1 overflow-hidden">
              <p
                className="truncate text-[13px]"
                style={{ color: T.graphite, fontFamily: SANS }}
              >
                {displayName}
              </p>
              <p
                className="text-[13px] tracking-[0.14em] uppercase"
                style={{ color: T.muted, fontFamily: MONO }}
              >
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
            className="mt-1 w-full px-2 py-1.5 text-left text-[13px] tracking-[0.16em] uppercase transition-colors"
            style={{ color: T.muted, fontFamily: MONO }}
            onMouseEnter={(e) => (e.currentTarget.style.color = T.error)}
            onMouseLeave={(e) => (e.currentTarget.style.color = T.muted)}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header
          className="flex min-h-12.5 items-center justify-between gap-2 border-b px-3 py-2 sm:px-4"
          style={{
            background: T.paper,
            borderColor: T.rule,
            fontFamily: MONO,
          }}
          role="banner"
        >
          <div className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="flex h-8 w-8 items-center justify-center transition-colors lg:hidden"
              style={{
                color: T.muted,
                border: `1px solid ${T.rule}`,
              }}
              aria-label="Open sidebar"
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
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <button
              onClick={openCommandPalette}
              aria-label="Open command palette"
              className="group flex h-8 w-full items-center gap-2 px-3 text-[13px] tracking-[0.04em] transition-colors focus-visible:outline-none sm:w-auto sm:min-w-[280px]"
              style={{
                background: T.vellum,
                border: `1px solid ${T.rule}`,
                color: T.muted,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = T.cobalt;
                e.currentTarget.style.color = T.graphite;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = T.rule;
                e.currentTarget.style.color = T.muted;
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
                style={{ color: T.cobalt }}
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <span className="hidden sm:inline" style={{ fontFamily: SANS }}>
                Search projects and commands
              </span>
              <span
                className="ml-auto hidden items-center gap-1 md:inline-flex"
                style={{ color: T.muted }}
              >
                <kbd
                  className="px-1.5 py-0.5 text-[12px] tracking-[0.1em]"
                  style={{
                    background: T.paper,
                    border: `1px solid ${T.rule}`,
                    color: T.graphite,
                  }}
                >
                  Ctrl K
                </kbd>
              </span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            {user && (
              <div className="relative" ref={userMenuRef}>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setShowUserMenu((v) => !v)}
                  aria-label="Open profile menu"
                  aria-expanded={showUserMenu}
                  className="flex h-7 w-7 items-center justify-center overflow-hidden text-[13px] tracking-[0.12em] uppercase"
                  style={{
                    background: T.graphite,
                    color: T.paper,
                    border: `1px solid ${T.rule}`,
                  }}
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
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.14 }}
                      className="absolute right-0 top-full z-50 mt-2 w-60"
                      style={{
                        background: T.paper,
                        border: `1px solid ${T.rule}`,
                      }}
                      role="menu"
                    >
                      <div
                        className="border-b px-3 py-2.5"
                        style={{ borderColor: T.rule }}
                      >
                        <div
                          className="truncate text-[13px]"
                          style={{ color: T.graphite, fontFamily: SANS }}
                        >
                          {displayName}
                        </div>
                        <div
                          className="mt-0.5 truncate text-[13px] tracking-[0.04em]"
                          style={{ color: T.muted, fontFamily: MONO }}
                        >
                          {user?.email}
                        </div>
                      </div>

                      <div className="py-1">
                        <MenuLink href="/dashboard" label="DASHBOARD">
                          <svg
                            className="h-3.5 w-3.5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.75}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <rect x="3" y="3" width="7" height="9" />
                            <rect x="14" y="3" width="7" height="5" />
                            <rect x="14" y="12" width="7" height="9" />
                            <rect x="3" y="16" width="7" height="5" />
                          </svg>
                        </MenuLink>
                        <MenuLink href="/profile" label="PROFILE">
                          <svg
                            className="h-3.5 w-3.5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.75}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </MenuLink>

                        <div
                          className="my-1 mx-2 h-px"
                          style={{ background: T.rule, opacity: 0.4 }}
                        />

                        <button
                          onClick={async () => {
                            await supabase.auth.signOut();
                            router.push("/");
                          }}
                          role="menuitem"
                          className="flex w-full items-center gap-2 px-3 py-2 text-[13px] tracking-[0.16em] uppercase transition-colors"
                          style={{ color: T.error, fontFamily: MONO }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.opacity = "0.75")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.opacity = "1")
                          }
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.75}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                          </svg>
                          LOG OUT
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </header>

        <main
          className="flex-1 overflow-y-auto"
          style={{ background: T.vellum }}
        >
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
      className="group relative flex items-center gap-2.5 px-3 py-2 text-[13px] tracking-[0.16em] uppercase transition-colors"
      style={{
        background: active ? T.vellum : "transparent",
        color: active ? T.graphite : T.muted,
        fontFamily: MONO,
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.color = T.graphite;
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.color = T.muted;
      }}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[2px]"
          style={{ background: T.cobalt }}
        />
      )}
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
      style={{ color: T.muted, fontFamily: MONO }}
      onMouseEnter={(e) => (e.currentTarget.style.color = T.graphite)}
      onMouseLeave={(e) => (e.currentTarget.style.color = T.muted)}
    >
      <span className="flex h-4 w-4 items-center justify-center">
        {children}
      </span>
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
      className="flex flex-none items-center justify-center overflow-hidden"
      style={{
        width: size,
        height: size,
        fontSize: size <= 24 ? 10 : size <= 32 ? 11 : 14,
        background: T.graphite,
        color: T.paper,
        fontFamily: MONO,
        letterSpacing: "0.06em",
      }}
    >
      {avatarUrl && !imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        initials
      )}
    </div>
  );
}
