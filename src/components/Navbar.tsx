"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SaveIndicator from "./SaveIndicator";

interface NavbarProps {
  // Project-related props (optional for dashboard)
  projectName?: string;
  originalProjectName?: string;
  onProjectNameChange?: (name: string) => void;
  onSaveProjectName?: () => void;
  isSavingName?: boolean;
  currentProjectId?: string | null;

  // Save indicator props (optional)
  isSaving?: boolean;
  lastSaved?: Date | null;
  saveError?: string | null;

  // Save action
  onSave?: () => void;

  // Action buttons (optional - for canvas page)
  onRunDetection?: () => void;
  isGenerating?: boolean;
  onExport?: () => void;
  onChatToggle?: () => void;
  onHistoryToggle?: () => void;
  isChatActive?: boolean;
  isHistoryActive?: boolean;

  // Optional back button
  showBackButton?: boolean;
  backButtonHref?: string;

  // Optional logo display
  showLogo?: boolean;
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
  onRunDetection,
  isGenerating,
  onExport,
  onChatToggle,
  onHistoryToggle,
  isChatActive,
  isHistoryActive,
  onSave,
  showBackButton = true,
  backButtonHref = "/dashboard",
  showLogo = true,
}: NavbarProps) {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setUser(user);

          // Fetch profile data from database
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

          if (profile) {
            setUserProfile(profile);
          }
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        setUser(null);
      }
    };
    getUser();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <header className="flex items-center justify-between border-b border-[#2E2E2E] bg-[#1A1A1A] px-2 sm:px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        {showBackButton && (
          <Link
            href={backButtonHref}
            className="p-1.5 text-[#A0A0A0] transition-colors hover:text-white"
            title="Back to Dashboard"
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
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </Link>
        )}
        {showLogo && (
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm sm:text-base font-bold text-white transition-colors hover:text-[#FF6B00]"
          >
            <img
              src="/logo.png"
              alt="CodeCanvas Logo"
              className="w-6 h-6 sm:w-7 sm:h-7"
            />
            <span>CodeCanvas</span>
          </Link>
        )}

        {/* Project Name Input (Canvas Page Only) */}
        {projectName !== undefined &&
          onProjectNameChange &&
          onSaveProjectName && (
            <div className="relative">
              <input
                type="text"
                value={projectName}
                onChange={(e) => onProjectNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    currentProjectId &&
                    projectName !== originalProjectName
                  ) {
                    onSaveProjectName();
                  }
                }}
                className="rounded-lg border border-[#2E2E2E] bg-[#0A0A0A] px-2 py-1.5 pr-8 text-xs font-medium text-white focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]/30 w-28 sm:w-32"
                placeholder="Untitled"
              />
              {/* Save button - only shows when name changed */}
              {projectName !== originalProjectName && projectName.trim() && (
                <button
                  onClick={onSaveProjectName}
                  disabled={isSavingName || !currentProjectId}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full bg-white text-[#0A0A0A] transition-all hover:bg-[#FF6B00] hover:text-white disabled:opacity-50"
                  title="Save project name (Enter)"
                >
                  {isSavingName ? (
                    <svg
                      className="h-3.5 w-3.5 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
              )}
            </div>
          )}
      </div>

      <div className="flex items-center gap-1">
        {/* Canvas-specific action buttons */}
        {onRunDetection && (
          <>
            {/* Save Button */}
            {onSave && (
              <button
                onClick={onSave}
                disabled={isSaving}
                className="flex items-center gap-1 rounded-lg bg-[#2E2E2E] px-2 py-1.5 text-xs font-semibold text-white transition-all hover:bg-white hover:text-[#0A0A0A] disabled:opacity-50"
                title="Save Project (Ctrl+S)"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <path d="M17 21v-8H7v8" />
                  <path d="M7 3v5h8" />
                </svg>
                <span className="hidden lg:inline">
                  {isSaving ? "Saving..." : "Save"}
                </span>
              </button>
            )}

            {/* Run Detection Button */}
            <button
              onClick={onRunDetection}
              disabled={isGenerating}
              className="flex items-center gap-1 rounded-lg bg-[#FF6B00]/20 border border-[#FF6B00]/50 px-2 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[#FF6B00]/30 hover:border-[#FF6B00] disabled:opacity-50 disabled:cursor-not-allowed"
              title="Run Detection"
            >
              {isGenerating ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span className="hidden md:inline">Analyzing</span>
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M13 7H7v6h6V7z" />
                    <path
                      fillRule="evenodd"
                      d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="hidden md:inline">Detect</span>
                </>
              )}
            </button>

            {onExport && (
              <button
                onClick={onExport}
                className="flex items-center gap-1 rounded-lg bg-[#2E2E2E] px-2 py-1.5 text-xs font-semibold text-white transition-all hover:bg-white hover:text-[#0A0A0A]"
                title="Export"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span className="hidden lg:inline">Export</span>
              </button>
            )}

            {onChatToggle && (
              <button
                onClick={onChatToggle}
                className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-all ${
                  isChatActive
                    ? "bg-white text-[#0A0A0A]"
                    : "bg-[#2E2E2E] text-white hover:bg-white hover:text-[#0A0A0A]"
                }`}
                title="AI Chat"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
                <span className="hidden lg:inline">Chat</span>
              </button>
            )}

            {onHistoryToggle && (
              <button
                onClick={onHistoryToggle}
                className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-all ${
                  isHistoryActive
                    ? "bg-white text-[#0A0A0A]"
                    : "bg-[#2E2E2E] text-white hover:bg-white hover:text-[#0A0A0A]"
                }`}
                title="Version History"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
            )}
          </>
        )}

        {/* Save Indicator */}
        {isSaving !== undefined && (
          <div className="hidden 2xl:block w-28 shrink-0">
            <SaveIndicator
              isSaving={isSaving}
              lastSaved={lastSaved ?? null}
              error={saveError ?? null}
            />
          </div>
        )}

        {/* User Profile */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center justify-center rounded-full p-1 transition-colors hover:ring-2 hover:ring-[#FF6B00]/30"
              title="Profile Menu"
            >
              {/* Profile Picture or Initials */}
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-semibold text-white overflow-hidden">
                {userProfile?.avatar_url || user.user_metadata?.avatar_url ? (
                  <img
                    src={
                      userProfile?.avatar_url || user.user_metadata.avatar_url
                    }
                    alt="Profile"
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <span>
                    {(userProfile?.full_name || user.user_metadata?.full_name)
                      ?.charAt(0)
                      ?.toUpperCase() ||
                      user.email?.charAt(0).toUpperCase() ||
                      "U"}
                  </span>
                )}
              </div>
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div
                className="absolute right-0 top-full mt-2 z-100 w-64 rounded-lg border border-[#2E2E2E] bg-[#1A1A1A] shadow-xl opacity-100"
                style={{
                  backdropFilter: "none",
                  WebkitBackdropFilter: "none",
                }}
              >
                {/* User Info in Dropdown */}
                <div className="border-b border-[#2E2E2E] px-4 py-3">
                  <div className="mb-1 text-sm font-medium text-white">
                    {userProfile?.full_name ||
                      user.user_metadata?.full_name ||
                      user.user_metadata?.name ||
                      "User"}
                  </div>
                  <div className="text-xs text-[#A0A0A0]">{user.email}</div>
                  {user.user_metadata?.preferred_username && (
                    <div className="mt-1 text-xs text-[#A0A0A0]">
                      @{user.user_metadata.preferred_username}
                    </div>
                  )}
                </div>

                {/* Menu Items */}
                <div className="py-2">
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-3 px-4 py-2 text-sm text-[#A0A0A0] transition-colors hover:bg-[#2E2E2E] hover:text-white"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                      />
                    </svg>
                    Dashboard
                  </Link>

                  <Link
                    href="/profile"
                    className="flex items-center gap-3 px-4 py-2 text-sm text-[#A0A0A0] transition-colors hover:bg-[#2E2E2E] hover:text-white"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    Profile
                  </Link>

                  <div className="my-2 h-px bg-[#2E2E2E]" />

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      handleLogout();
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-[#2E2E2E] hover:text-red-300"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Fallback Logout Button */}
        {!user && (
          <button
            onClick={handleLogout}
            className="rounded-lg p-2 text-[#A0A0A0] transition-colors hover:bg-[#2E2E2E] hover:text-white"
            title="Logout"
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
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}
