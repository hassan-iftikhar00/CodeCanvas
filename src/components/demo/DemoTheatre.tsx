"use client";

import { useState, useEffect } from "react";
import {
  MousePointer2,
  Monitor,
  Smartphone,
  RefreshCw,
  ExternalLink,
  Download,
} from "lucide-react";
import { DRAFTING_TOKENS as T } from "@/lib/drafting-room/tokens";

const MONO = "var(--font-jetbrains-mono, ui-monospace, monospace)";
const SANS = "var(--font-inter, ui-sans-serif, system-ui, sans-serif)";
const SERIF = "var(--font-instrument-serif, Georgia, serif)";

const DEMO_CODE = `function ActionButton() {
  return (
    <button className="
      border border-[#1A1A1C]
      bg-[#FAFAF7]
      px-8 py-3
      text-[#0E0E0F]
      font-semibold
      transition-colors
      hover:bg-[#4A4B8C]
      hover:text-[#FAFAF7]
      hover:border-[#4A4B8C]">
      Get started →
    </button>
  );
}`;

export default function DemoTheatre() {
  const [stage, setStage] = useState(0);
  const [cursorPos, setCursorPos] = useState({ x: 250, y: 145 });
  const [strokePath, setStrokePath] = useState<{ x: number; y: number }[]>([]);
  const [codeText, setCodeText] = useState("");
  const [progress, setProgress] = useState(0);
  const [buttonText, setButtonText] = useState("");
  const [instructionText, setInstructionText] = useState("");
  const [isCodeComplete, setIsCodeComplete] = useState(false);

  useEffect(() => {
    if (stage === 0) {
      const canvasWidth = 500;
      const canvasHeight = 350;
      const drawDuration = 2500;
      const textTypeDuration = 1000;
      const instructionTypeDuration = 1500;
      const totalDuration =
        drawDuration + textTypeDuration + instructionTypeDuration;
      const startTime = Date.now();

      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;
      const btnWidth = 180;
      const btnHeight = 52;

      // Sharp rectangle — Drafting Room uses no rounded corners
      const path = [
        { x: centerX - btnWidth / 2, y: centerY - btnHeight / 2 },
        { x: centerX + btnWidth / 2, y: centerY - btnHeight / 2 },
        { x: centerX + btnWidth / 2, y: centerY + btnHeight / 2 },
        { x: centerX - btnWidth / 2, y: centerY + btnHeight / 2 },
        { x: centerX - btnWidth / 2, y: centerY - btnHeight / 2 },
      ];

      let totalDistance = 0;
      for (let i = 0; i < path.length - 1; i++) {
        totalDistance += Math.sqrt(
          Math.pow(path[i + 1].x - path[i].x, 2) +
            Math.pow(path[i + 1].y - path[i].y, 2)
        );
      }

      const buttonTextFull = "Get started";
      const instructionTextFull = "Add cobalt hover state and sharp corners";

      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;

        if (elapsed < drawDuration) {
          const prog = elapsed / drawDuration;
          const currentDistance = prog * totalDistance;
          let accumulatedDistance = 0;
          let currentPos = { x: path[0].x, y: path[0].y };

          for (let i = 0; i < path.length - 1; i++) {
            const segmentLength = Math.sqrt(
              Math.pow(path[i + 1].x - path[i].x, 2) +
                Math.pow(path[i + 1].y - path[i].y, 2)
            );

            if (accumulatedDistance + segmentLength >= currentDistance) {
              const segmentProgress =
                (currentDistance - accumulatedDistance) / segmentLength;
              currentPos = {
                x: path[i].x + (path[i + 1].x - path[i].x) * segmentProgress,
                y: path[i].y + (path[i + 1].y - path[i].y) * segmentProgress,
              };
              break;
            }

            accumulatedDistance += segmentLength;
          }

          setCursorPos(currentPos);
          setStrokePath((prev) => [...prev, currentPos]);
        } else if (elapsed < drawDuration + textTypeDuration) {
          const textProgress = (elapsed - drawDuration) / textTypeDuration;
          const charIndex = Math.floor(textProgress * buttonTextFull.length);
          setButtonText(buttonTextFull.substring(0, charIndex));
        } else if (elapsed < totalDuration) {
          setButtonText(buttonTextFull);
          const instructionProgress =
            (elapsed - drawDuration - textTypeDuration) /
            instructionTypeDuration;
          const charIndex = Math.floor(
            instructionProgress * instructionTextFull.length
          );
          setInstructionText(instructionTextFull.substring(0, charIndex));
        } else {
          clearInterval(interval);
          setButtonText(buttonTextFull);
          setInstructionText(instructionTextFull);
          setTimeout(() => setStage(1), 500);
        }
      }, 16);

      return () => clearInterval(interval);
    }

    if (stage === 1) {
      const duration = 2000;
      const startTime = Date.now();

      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const prog = Math.min(elapsed / duration, 1);
        setProgress(prog * 100);

        if (prog >= 1) {
          clearInterval(interval);
          setTimeout(() => setStage(2), 300);
        }
      }, 16);

      return () => clearInterval(interval);
    }

    if (stage === 2) {
      const duration = 3000;
      const charsPerFrame = DEMO_CODE.length / (duration / 30);
      let currentIndex = 0;

      const interval = setInterval(() => {
        currentIndex += charsPerFrame;
        if (currentIndex >= DEMO_CODE.length) {
          setCodeText(DEMO_CODE);
          setIsCodeComplete(true);
          clearInterval(interval);
        } else {
          setCodeText(DEMO_CODE.substring(0, Math.floor(currentIndex)));
        }
      }, 30);

      return () => clearInterval(interval);
    }
  }, [stage]);

  const restartDemo = () => {
    setStage(0);
    setCursorPos({ x: 250, y: 145 });
    setStrokePath([]);
    setCodeText("");
    setProgress(0);
    setButtonText("");
    setInstructionText("");
    setIsCodeComplete(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-8 relative"
      style={{ background: T.paper }}
    >
      {/* Replay button */}
      <button
        onClick={restartDemo}
        className="fixed top-4 left-4 z-50 p-2 transition-colors"
        style={{
          background: T.paper,
          border: `1px solid ${T.rule}`,
          color: T.muted,
        }}
        title="Replay Demo"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = T.cobalt;
          e.currentTarget.style.borderColor = T.cobalt;
          e.currentTarget.style.color = T.paper;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = T.paper;
          e.currentTarget.style.borderColor = T.rule;
          e.currentTarget.style.color = T.muted;
        }}
      >
        <RefreshCw className="w-4 h-4" />
      </button>

      <div className="w-full max-w-6xl">
        {/* Stage 0: Drawing Canvas */}
        {stage === 0 && (
          <div className="flex flex-col items-center justify-center space-y-8">
            <div
              className="px-3 py-1 text-[10px] tracking-[0.16em] uppercase"
              style={{
                background: T.vellum,
                border: `1px solid ${T.rule}`,
                color: T.muted,
                fontFamily: MONO,
              }}
            >
              DEMO · SKETCH-TO-CODE
            </div>

            <h1
              className="text-3xl sm:text-4xl md:text-5xl text-center"
              style={{ color: T.graphite, fontFamily: SERIF }}
            >
              Draw your <span style={{ color: T.cobalt }}>vision.</span>
            </h1>

            {/* Graph-paper canvas — was a fixed 500x350px box that forced
                horizontal overflow under ~560px viewports. Now fluid: the
                outer box scales via aspect-ratio, the SVG uses a matching
                viewBox, and the cursor dot is positioned by percentage
                (of the same 500x350 logical space the draw animation runs
                in) instead of raw pixels, so everything rescales together
                without touching the animation's timing/math. */}
            <div
              className="relative w-full max-w-125 mx-auto"
              style={{
                aspectRatio: "500 / 350",
                background: T.paper,
                border: `1px solid ${T.rule}`,
                backgroundImage: `linear-gradient(to right, ${T.tick} 1px, transparent 1px), linear-gradient(to bottom, ${T.tick} 1px, transparent 1px)`,
                backgroundSize: "20px 20px",
              }}
            >
              <svg
                className="absolute inset-0 pointer-events-none"
                viewBox="0 0 500 350"
                style={{ width: "100%", height: "100%" }}
              >
                <polyline
                  points={strokePath.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke={T.graphite}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              {buttonText && (
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  style={{
                    color: T.graphite,
                    fontFamily: SANS,
                    fontWeight: 600,
                    fontSize: "14px",
                  }}
                >
                  {buttonText}
                  {buttonText.length < 11 && (
                    <span className="animate-pulse">|</span>
                  )}
                </div>
              )}

              {strokePath.length < 200 && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${(cursorPos.x / 500) * 100}%`,
                    top: `${(cursorPos.y / 350) * 100}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <MousePointer2
                    style={{ color: T.cobalt }}
                    className="w-5 h-5"
                  />
                </div>
              )}
            </div>

            {/* Instruction input — appears after drawing */}
            {strokePath.length > 150 && (
              <div className="w-full max-w-md animate-fade-in">
                <div
                  className="p-4"
                  style={{ background: T.paper, border: `1px solid ${T.rule}` }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="shrink-0 w-2 h-2 mt-1.5"
                      style={{ background: T.cobalt }}
                    />
                    <div className="flex-1">
                      <p
                        className="text-[10px] tracking-[0.14em] uppercase mb-1"
                        style={{ color: T.muted, fontFamily: MONO }}
                      >
                        INSTRUCTIONS · OPTIONAL
                      </p>
                      <p
                        className="text-sm"
                        style={{ color: T.graphite, fontFamily: MONO }}
                      >
                        {instructionText}
                        {instructionText.length > 0 &&
                          instructionText.length < 40 && (
                            <span className="animate-pulse">|</span>
                          )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stage 1: Processing */}
        {stage === 1 && (
          <div className="flex flex-col items-center justify-center space-y-8">
            {/* CSS-only cobalt spinner */}
            <div
              className="w-10 h-10 animate-spin"
              style={{
                border: `2px solid ${T.vellum}`,
                borderTopColor: T.cobalt,
              }}
            />
            <h2
              className="text-2xl sm:text-3xl md:text-4xl text-center"
              style={{ color: T.graphite, fontFamily: SERIF }}
            >
              Generating code<span style={{ color: T.cobalt }}> with AI</span>
              ...
            </h2>
            {/* 1px hairline progress bar — was a fixed 384px (w-96) that
                overflowed under ~450px viewports with page padding. */}
            <div
              className="w-full max-w-96"
              style={{
                background: T.vellum,
                border: `1px solid ${T.rule}`,
                height: 2,
              }}
            >
              <div
                className="h-full transition-all duration-100"
                style={{ width: `${progress}%`, background: T.cobalt }}
              />
            </div>
            <p
              className="text-[11px] tracking-[0.14em] uppercase"
              style={{ color: T.muted, fontFamily: MONO }}
            >
              ANALYZING SKETCH · GENERATING COMPONENTS · OPTIMIZING CODE
            </p>
          </div>
        )}

        {/* Stage 2: Split Screen — Code + Preview */}
        {stage === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div
                className="inline-flex px-3 py-1 mb-4 text-[10px] tracking-[0.16em] uppercase"
                style={{
                  background: T.cobaltWash,
                  border: `1px solid ${T.cobalt}`,
                  color: T.cobalt,
                  fontFamily: MONO,
                }}
              >
                READY TO EXPORT
              </div>
              <h2
                className="text-2xl sm:text-3xl md:text-4xl"
                style={{ color: T.graphite, fontFamily: SERIF }}
              >
                Your code is <span style={{ color: T.cobalt }}>ready.</span>
              </h2>
            </div>

            {/* Was a fixed 2-column grid — code + preview panels each need
                room, so on mobile they stack (1 col) instead of squeezing
                side-by-side. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Code panel — dark slab */}
              <div
                className="p-6"
                style={{
                  background: "#0A0A0B",
                  border: "1px solid #2A2A2D",
                }}
              >
                <div
                  className="flex items-center gap-2 mb-4 text-[10px] tracking-[0.14em] uppercase"
                  style={{ color: "#86868A", fontFamily: MONO }}
                >
                  <span>~/output.tsx</span>
                  <span style={{ color: "#2A2A2D" }}>·</span>
                  <span>TSX</span>
                </div>
                <pre
                  className="text-sm leading-relaxed overflow-auto max-h-96"
                  style={{ color: "#F2F1EC", fontFamily: MONO }}
                >
                  <code>{codeText}</code>
                </pre>
              </div>

              {/* Live preview panel */}
              {isCodeComplete && (
                <div
                  className="animate-fade-in flex flex-col"
                  style={{ border: `1px solid ${T.rule}`, background: T.paper }}
                >
                  {/* Toolbar */}
                  <div
                    className="flex items-center justify-between px-4 py-2"
                    style={{
                      borderBottom: `1px solid ${T.rule}`,
                      background: T.vellum,
                    }}
                  >
                    <span
                      className="text-[10px] tracking-[0.16em] uppercase"
                      style={{ color: T.muted, fontFamily: MONO }}
                    >
                      LIVE PREVIEW
                    </span>
                    <div className="flex items-center gap-1">
                      <div
                        className="flex items-center"
                        style={{ border: `1px solid ${T.rule}` }}
                      >
                        <button
                          className="px-2 py-1"
                          style={{ background: T.cobalt, color: T.paper }}
                        >
                          <Monitor className="w-3 h-3" />
                        </button>
                        <button
                          className="px-2 py-1"
                          style={{ background: T.paper, color: T.muted }}
                        >
                          <Smartphone className="w-3 h-3" />
                        </button>
                      </div>
                      {([RefreshCw, ExternalLink, Download] as const).map(
                        (Icon, i) => (
                          <button
                            key={i}
                            className="p-1.5 transition-colors"
                            style={{ color: T.muted }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.color = T.graphite)
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.color = T.muted)
                            }
                          >
                            <Icon className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Preview content — graph paper bg, rendered button */}
                  <div
                    className="flex-1 p-8 flex items-center justify-center"
                    style={{
                      minHeight: 300,
                      background: T.vellum,
                      backgroundImage: `linear-gradient(to right, ${T.tick} 1px, transparent 1px), linear-gradient(to bottom, ${T.tick} 1px, transparent 1px)`,
                      backgroundSize: "20px 20px",
                    }}
                  >
                    <button
                      className="px-8 py-3 font-semibold transition-colors"
                      style={{
                        background: T.paper,
                        border: `1px solid ${T.rule}`,
                        color: T.graphite,
                        fontFamily: SANS,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = T.cobalt;
                        e.currentTarget.style.borderColor = T.cobalt;
                        e.currentTarget.style.color = T.paper;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = T.paper;
                        e.currentTarget.style.borderColor = T.rule;
                        e.currentTarget.style.color = T.graphite;
                      }}
                    >
                      Get started →
                    </button>
                  </div>

                  {/* Footer */}
                  <div
                    className="px-4 py-2 flex items-center justify-between"
                    style={{
                      borderTop: `1px solid ${T.rule}`,
                      background: T.vellum,
                    }}
                  >
                    <span
                      className="text-[10px] tracking-[0.12em] uppercase"
                      style={{ color: T.muted, fontFamily: MONO }}
                    >
                      DESKTOP · 1920×1080
                    </span>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-1.5 h-1.5 animate-pulse"
                        style={{ background: "#1E6A3C" }}
                      />
                      <span
                        className="text-[10px] tracking-[0.12em] uppercase"
                        style={{ color: T.muted, fontFamily: MONO }}
                      >
                        LIVE · AUTO-UPDATING
                      </span>
                    </div>
                    <span
                      className="text-[10px] tracking-[0.12em] uppercase"
                      style={{ color: T.cobalt, fontFamily: MONO }}
                    >
                      GENERATED IN 2.3S
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
