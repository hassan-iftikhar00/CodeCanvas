"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/");
      } else {
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
    };
    getUser();
  }, [router, supabase]);

  return (
    <div className="flex h-screen bg-[#0A0A0A] text-white">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#2E2E2E] flex flex-col">
        <div className="px-4 py-5 border-b border-[#2E2E2E]">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="CodeCanvas Logo" className="w-8 h-8" />
            <span className="text-xl font-bold">CodeCanvas</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg bg-[#2E2E2E] px-3 py-2 text-sm font-medium text-white"
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
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
            Projects
          </Link>

          {/* Templates Option */}
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-white transition-colors">
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
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            Templates
          </button>

          {/* Tools Option - new icon, with tools functionality */}
          <button
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-white transition-colors"
            title="Tools"
            onClick={() => (window.location.href = "/canvas")}
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
                d="M9.75 17L9 21m5.25-4l.75 4M4.5 10.5l15 0M6.75 7.5l10.5 0"
              />
            </svg>
            Tools
          </button>

          {/* Profile Option */}
          <Link
            href="/profile"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-white transition-colors"
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
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            Profile
          </Link>

          {/* Settings Option */}
          <Link
            href="/profile"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-white transition-colors"
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
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Settings
          </Link>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-[#2E2E2E] mt-auto">
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-lg hover:bg-[#1A1A1A] px-2 py-2 -mx-2 transition-colors"
          >
            <div className="h-10 w-10 rounded-full bg-[#FF6B00] flex items-center justify-center text-white font-bold overflow-hidden">
              {userProfile?.avatar_url ? (
                <img
                  src={userProfile.avatar_url}
                  alt="Profile"
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                (userProfile?.full_name || user?.email)?.[0]?.toUpperCase() ||
                "U"
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-white">
                {userProfile?.full_name || user?.email || "User"}
              </p>
              <p className="text-xs text-[#A0A0A0]">View Profile</p>
            </div>
          </Link>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/");
            }}
            className="mt-2 w-full text-xs text-[#A0A0A0] hover:text-white text-left px-2 py-1 rounded hover:bg-[#1A1A1A] transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="border-b border-[#2E2E2E] bg-[#1A1A1A] px-6 py-3 flex items-center justify-end">
          {/* User Profile with Dropdown */}
          {user && (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center justify-center rounded-full p-1 transition-colors hover:ring-2 hover:ring-[#FF6B00]/30"
                title="Profile Menu"
              >
                <div className="h-8 w-8 rounded-full bg-[#FF6B00] flex items-center justify-center text-white text-sm font-bold overflow-hidden">
                  {userProfile?.avatar_url ? (
                    <img
                      src={userProfile.avatar_url}
                      alt="Profile"
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    (userProfile?.full_name ||
                      user?.email)?.[0]?.toUpperCase() || "U"
                  )}
                </div>
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 z-100 w-64 rounded-lg border border-[#2E2E2E] bg-[#1A1A1A] shadow-xl">
                  {/* User Info in Dropdown */}
                  <div className="border-b border-[#2E2E2E] px-4 py-3">
                    <div className="mb-1 text-sm font-medium text-white">
                      {userProfile?.full_name || user?.email || "User"}
                    </div>
                    <div className="text-xs text-[#A0A0A0]">{user?.email}</div>
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
                      onClick={async () => {
                        await supabase.auth.signOut();
                        router.push("/");
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
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
