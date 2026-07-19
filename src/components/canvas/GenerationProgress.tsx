"use client";

import { useEffect, useState } from "react";
import { T_DARK } from "./canvasTokens";

interface GenerationProgressProps {
  isGenerating: boolean;
  hasPriorCode?: boolean;
}

interface Stage {
  startAt: number;
  title: string;
  description: string;
}

// Stage timings calibrated to the observed backend latency profile:
// Roboflow ~1-2s, then Gemini Flash dominates the remaining ~25-28s.
const STAGES: Stage[] = [
  {
    startAt: 0,
    title: "READING SKETCH",
    description: "Preparing the canvas image for detection.",
  },
  {
    startAt: 2,
    title: "DETECTING ELEMENTS",
    description: "Running the object detector on your sketch.",
  },
  {
    startAt: 5,
    title: "COMPOSING CODE",
    description: "Gemini is writing your component.",
  },
  {
    startAt: 25,
    title: "POLISHING OUTPUT",
    description: "Cleaning up · almost there.",
  },
  {
    startAt: 45,
    title: "TAKING LONGER THAN USUAL",
    description: "AI calls can spike during peak hours.",
  },
];

const EXPECTED_DURATION_S = 30;
// The real request duration is unknowable up front, so the bar must never
// claim completion while the request is still in flight. This curve rises
// fast early, then decelerates toward (never reaching) PROGRESS_CEILING —
// the remaining gap only closes when the code actually arrives (at which
// point this component unmounts and the result replaces it).
const PROGRESS_CEILING = 0.94;
function progressCurve(elapsedS: number): number {
  return PROGRESS_CEILING * (1 - Math.exp(-elapsedS / EXPECTED_DURATION_S));
}

export default function GenerationProgress({
  isGenerating,
  hasPriorCode = false,
}: GenerationProgressProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isGenerating) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [isGenerating]);

  if (!isGenerating) return null;

  const stage =
    [...STAGES].reverse().find((s) => elapsed >= s.startAt) ?? STAGES[0];
  const progress = progressCurve(elapsed);
  const stageIndex = STAGES.findIndex((s) => s === stage);

  return (
    <div
      className="flex h-full w-full items-center justify-center px-6"
      style={{
        background: T_DARK.bg,
        fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
      }}
    >
      <div className="w-full max-w-md">
        {/* MONO SLUG */}
        <div
          className="mb-5 flex items-center justify-between text-[10px] tracking-[0.18em] uppercase"
          style={{ color: T_DARK.inkMuted }}
        >
          <span style={{ color: T_DARK.inkBright }}>
            {hasPriorCode ? "REGENERATING" : "GENERATING"} · {stageIndex + 1} /{" "}
            {STAGES.length - 1}
          </span>
        </div>

        {/* STAGE TITLE */}
        <div
          className="text-[20px] tracking-[-0.01em]"
          style={{
            color: T_DARK.inkBright,
            fontFamily:
              "var(--font-instrument-serif, ui-serif, Georgia, serif)",
          }}
        >
          {stage.title.toLowerCase()}.
        </div>
        <div
          className="mt-2 text-[12px] leading-[1.5]"
          style={{
            color: T_DARK.inkMuted,
            fontFamily:
              "var(--font-inter, ui-sans-serif, system-ui, sans-serif)",
          }}
        >
          {stage.description}
        </div>

        {/* PROGRESS BAR — 1px hairline */}
        <div
          className="relative mt-6 h-px w-full"
          style={{ background: T_DARK.rule }}
        >
          <div
            className="absolute inset-y-0 left-0 h-px transition-[width] duration-300 ease-out"
            style={{
              width: `${progress * 100}%`,
              background: T_DARK.cobalt,
              opacity: 1,
            }}
          />
        </div>

        {/* STAGE TICKS */}
        <div className="mt-3 flex items-center justify-between">
          {STAGES.slice(0, -1).map((s) => {
            const reached = elapsed >= s.startAt;
            const current = s === stage;
            return (
              <div
                key={s.title}
                className="flex flex-1 flex-col items-start gap-1"
              >
                <span
                  className="inline-block h-1.5 w-1.5"
                  style={{
                    background: reached ? T_DARK.cobalt : T_DARK.ruleSoft,
                  }}
                />
                <span
                  className="text-[9px] tracking-[0.14em] uppercase"
                  style={{
                    color: current
                      ? T_DARK.inkBright
                      : reached
                        ? T_DARK.inkMuted
                        : T_DARK.inkDim,
                  }}
                >
                  {s.title.split(" ")[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
