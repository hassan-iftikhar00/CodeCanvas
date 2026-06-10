"use client";

import { useEffect, useState } from "react";

interface GenerationProgressProps {
  isGenerating: boolean;
  hasPriorCode?: boolean;
}

interface Stage {
  startAt: number;
  title: string;
  description: string;
}

// Stage timings are calibrated to the observed backend latency profile:
// Roboflow ~1–2s, then Gemini Flash dominates the remaining ~25–28s.
const STAGES: Stage[] = [
  { startAt: 0, title: "Reading your sketch", description: "Preparing the canvas image for detection." },
  { startAt: 2, title: "Detecting UI elements", description: "Running the object detector on your sketch." },
  { startAt: 5, title: "Generating code with AI", description: "Gemini is composing your component." },
  { startAt: 25, title: "Polishing the output", description: "Cleaning up — almost there." },
  { startAt: 45, title: "Taking longer than usual", description: "AI calls can spike during peak hours." },
];

const EXPECTED_DURATION_S = 30;

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
  const progress = Math.min(elapsed / EXPECTED_DURATION_S, 1);

  return (
    <div className="flex h-full w-full items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#1E1E1E] border-t-[#FF6B00]" />
        </div>

        <div className="mb-1 text-center text-[14px] font-semibold text-white">
          {stage.title}
        </div>
        <div className="mb-5 text-center text-[12px] text-[#888]">
          {stage.description}
        </div>

        <div className="relative h-1 w-full overflow-hidden rounded-full bg-[#1E1E1E]">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[#FF6B00] transition-[width] duration-300 ease-out"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] tabular-nums text-[#666]">
          <span>{hasPriorCode ? "Regenerating" : "Generating"}</span>
          <span>{elapsed}s</span>
        </div>
      </div>
    </div>
  );
}
