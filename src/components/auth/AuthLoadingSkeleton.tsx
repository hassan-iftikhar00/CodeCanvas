"use client";

import { JetBrains_Mono } from "next/font/google";
import { T_AUTH } from "./AuthShell";

const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400"] });

export default function AuthLoadingSkeleton() {
  return (
    <div
      className="flex min-h-[100svh] items-center justify-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{ background: T_AUTH.paper }}
    >
      <div
        className="w-full max-w-[460px] mx-4"
        style={{ background: T_AUTH.paper, border: `1px solid ${T_AUTH.rule}` }}
      >
        <div
          className="border-b px-5 py-2.5 text-[13px] tracking-[0.16em] uppercase"
          style={{
            borderColor: T_AUTH.rule,
            color: T_AUTH.muted,
            fontFamily: mono.style.fontFamily,
          }}
        >
          LOADING SESSION
        </div>
        <div className="px-6 py-8 sm:px-8">
          <div
            className="h-8 w-3/4"
            style={{
              background: T_AUTH.vellum,
              animation: "d5-skeleton-pulse 1.6s ease-in-out infinite",
            }}
          />
          <div
            className="mt-3 h-4 w-1/2"
            style={{
              background: T_AUTH.vellum,
              animation: "d5-skeleton-pulse 1.6s ease-in-out infinite",
            }}
          />
          <div className="mt-7 space-y-5">
            <div>
              <div
                className="h-2 w-16"
                style={{
                  background: T_AUTH.vellum,
                  animation: "d5-skeleton-pulse 1.6s ease-in-out infinite",
                }}
              />
              <div
                className="mt-2 h-px w-full"
                style={{ background: T_AUTH.rule, opacity: 0.4 }}
              />
            </div>
            <div>
              <div
                className="h-2 w-20"
                style={{
                  background: T_AUTH.vellum,
                  animation: "d5-skeleton-pulse 1.6s ease-in-out infinite",
                }}
              />
              <div
                className="mt-2 h-px w-full"
                style={{ background: T_AUTH.rule, opacity: 0.4 }}
              />
            </div>
          </div>
          <div
            className="mt-7 h-11 w-full"
            style={{ background: T_AUTH.cobalt, opacity: 0.45 }}
          />
        </div>
      </div>
      <style>{`
        @keyframes d5-skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}
