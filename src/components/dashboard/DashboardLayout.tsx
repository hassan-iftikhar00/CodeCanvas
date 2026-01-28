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

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
      } else {
        setUser(user);
      }
    };
    getUser();
  }, [router, supabase]);

  return (
    <div className="flex h-screen bg-[#0A0A0A] text-white">

      {/* Sidebar */}
      <aside className="w-64 border-r border-[#2E2E2E] flex flex-col">
        <div className="p-6 border-b border-[#2E2E2E]">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-linear-to-br from-[#FF6B00] to-[#FF8833]" />
            <span className="text-lg font-bold">CodeCanvas</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <Link 
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg bg-[#2E2E2E] px-3 py-2 text-sm font-medium text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Projects
          </Link>

          {/* Templates Option */}
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-white transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Templates
          </button>

          {/* Tools Option - new icon, with tools functionality */}
          <button
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-white transition-colors"
            title="Tools"
            onClick={() => window.location.href = '/canvas'}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 21m5.25-4l.75 4M4.5 10.5l15 0M6.75 7.5l10.5 0" />
            </svg>
            Tools
          </button>

          {/* Settings Option */}
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-white transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-[#2E2E2E]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[#FF6B00] flex items-center justify-center text-white font-bold">
              {user?.email?.[0].toUpperCase() || "U"}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-white">{user?.email}</p>
              <button 
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push("/auth/login");
                }}
                className="text-xs text-[#A0A0A0] hover:text-white"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
