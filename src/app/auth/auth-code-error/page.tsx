"use client";

import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <svg
              className="h-8 w-8 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">
            Authentication Failed
          </h2>
          <p className="mt-2 text-sm text-[#A0A0A0]">
            We couldn&apos;t complete your sign-in with Google.
          </p>
        </div>

        <div className="rounded-2xl border border-[#2E2E2E] bg-[#1A1A1A] p-6">
          <h3 className="mb-3 font-semibold text-white">Possible reasons:</h3>
          <ul className="space-y-2 text-sm text-[#A0A0A0]">
            <li className="flex gap-2">
              <span className="text-[#FF6B00]">•</span>
              <span>The authentication code expired</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#FF6B00]">•</span>
              <span>Your browser blocked third-party cookies</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#FF6B00]">•</span>
              <span>The redirect URL isn&apos;t whitelisted in Supabase</span>
            </li>
          </ul>

          <div className="mt-6 space-y-3">
            <Link
              href="/auth/login"
              className="block w-full rounded-lg bg-[#FF6B00]/20 border border-[#FF6B00]/50 px-6 py-3 text-center font-semibold text-white transition-all hover:bg-[#FF6B00]/30 hover:border-[#FF6B00]"
            >
              Try Again
            </Link>
            <Link
              href="/"
              className="block w-full rounded-lg border border-[#2E2E2E] bg-transparent px-6 py-3 text-center text-sm font-medium text-[#A0A0A0] transition-all hover:bg-[#2E2E2E] hover:text-white"
            >
              Back to Home
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-[#2E2E2E] bg-[#1A1A1A]/50 p-4">
          <p className="text-xs text-[#666666]">
            <strong className="text-[#A0A0A0]">Developer tip:</strong> Check
            your browser console (F12) for detailed error messages, or verify
            your Supabase Dashboard &rarr; Authentication &rarr; URL
            Configuration settings.
          </p>
        </div>
      </div>
    </div>
  );
}
