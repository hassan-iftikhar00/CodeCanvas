"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  MousePointer2,
  Monitor,
  Smartphone,
  RefreshCw,
  ExternalLink,
  Download,
} from "lucide-react";

export default function DemoTheatre() {
  const [stage, setStage] = useState(0);
  const [cursorPos, setCursorPos] = useState({ x: 250, y: 145 });
  const [strokePath, setStrokePath] = useState<{ x: number; y: number }[]>([]);
  const [codeText, setCodeText] = useState("");
  const [progress, setProgress] = useState(0);
  const [buttonText, setButtonText] = useState("");
  const [instructionText, setInstructionText] = useState("");
  const [isCodeComplete, setIsCodeComplete] = useState(false);

  // The code to display with typewriter effect
  const fullCode = `function ActionButton() {
  return (
    <button className="rounded-xl 
      bg-[#FF6B00]/20 
      border border-[#FF6B00]/50 
      backdrop-blur-md 
      px-8 py-4 
      font-semibold 
      text-white 
      transition-all 
      hover:bg-[#FF6B00]/30 
      hover:shadow-[0_0_20px_rgba(255,107,0,0.4)]">
      Get Started
    </button>
  );
}`;

  useEffect(() => {
    // Stage 0-5s: Draw a button-like shape with cursor + type instructions
    if (stage === 0) {
      const canvasWidth = 500;
      const canvasHeight = 350;
      const drawDuration = 2500; // 2.5s for drawing
      const textTypeDuration = 1000; // 1s for button text
      const instructionTypeDuration = 1500; // 1.5s for instructions
      const totalDuration =
        drawDuration + textTypeDuration + instructionTypeDuration;
      const startTime = Date.now();

      // Button shape path - centered rounded rectangle that looks like "Get Started"
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;
      const btnWidth = 180;
      const btnHeight = 60;
      const radius = 12;

      // Create a rounded rectangle path (approximated with line segments for the curves)
      const path = [
        // Start at top-left after the corner
        { x: centerX - btnWidth / 2 + radius, y: centerY - btnHeight / 2 },
        // Top edge
        { x: centerX + btnWidth / 2 - radius, y: centerY - btnHeight / 2 },
        // Top-right corner (4 points for curve)
        { x: centerX + btnWidth / 2 - radius / 2, y: centerY - btnHeight / 2 },
        { x: centerX + btnWidth / 2, y: centerY - btnHeight / 2 + radius / 2 },
        { x: centerX + btnWidth / 2, y: centerY - btnHeight / 2 + radius },
        // Right edge
        { x: centerX + btnWidth / 2, y: centerY + btnHeight / 2 - radius },
        // Bottom-right corner
        { x: centerX + btnWidth / 2, y: centerY + btnHeight / 2 - radius / 2 },
        { x: centerX + btnWidth / 2 - radius / 2, y: centerY + btnHeight / 2 },
        { x: centerX + btnWidth / 2 - radius, y: centerY + btnHeight / 2 },
        // Bottom edge
        { x: centerX - btnWidth / 2 + radius, y: centerY + btnHeight / 2 },
        // Bottom-left corner
        { x: centerX - btnWidth / 2 + radius / 2, y: centerY + btnHeight / 2 },
        { x: centerX - btnWidth / 2, y: centerY + btnHeight / 2 - radius / 2 },
        { x: centerX - btnWidth / 2, y: centerY + btnHeight / 2 - radius },
        // Left edge
        { x: centerX - btnWidth / 2, y: centerY - btnHeight / 2 + radius },
        // Top-left corner
        { x: centerX - btnWidth / 2, y: centerY - btnHeight / 2 + radius / 2 },
        { x: centerX - btnWidth / 2 + radius / 2, y: centerY - btnHeight / 2 },
        // Close path
        { x: centerX - btnWidth / 2 + radius, y: centerY - btnHeight / 2 },
      ];

      // Calculate total distance
      let totalDistance = 0;
      for (let i = 0; i < path.length - 1; i++) {
        totalDistance += Math.sqrt(
          Math.pow(path[i + 1].x - path[i].x, 2) +
            Math.pow(path[i + 1].y - path[i].y, 2)
        );
      }

      const buttonTextFull = "Get Started";
      const instructionTextFull = "Make it orange with glass effect & glow";

      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;

        // Phase 1: Draw button outline (0-2.5s)
        if (elapsed < drawDuration) {
          const progress = elapsed / drawDuration;
          const currentDistance = progress * totalDistance;
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
        }
        // Phase 2: Type button text (2.5s-3.5s)
        else if (elapsed < drawDuration + textTypeDuration) {
          const textProgress = (elapsed - drawDuration) / textTypeDuration;
          const charIndex = Math.floor(textProgress * buttonTextFull.length);
          setButtonText(buttonTextFull.substring(0, charIndex));
        }
        // Phase 3: Type instructions (3.5s-5s)
        else if (elapsed < totalDuration) {
          setButtonText(buttonTextFull); // Ensure full text is shown
          const instructionProgress =
            (elapsed - drawDuration - textTypeDuration) /
            instructionTypeDuration;
          const charIndex = Math.floor(
            instructionProgress * instructionTextFull.length
          );
          setInstructionText(instructionTextFull.substring(0, charIndex));
        }
        // Complete
        else {
          clearInterval(interval);
          setButtonText(buttonTextFull);
          setInstructionText(instructionTextFull);
          setTimeout(() => setStage(1), 500);
        }
      }, 16); // ~60fps

      return () => clearInterval(interval);
    }

    // Stage 1: Processing animation (2 seconds)
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

    // Stage 2: Typewriter effect (3 seconds)
    if (stage === 2) {
      const duration = 3000;
      const charsPerFrame = fullCode.length / (duration / 30);
      let currentIndex = 0;

      const interval = setInterval(() => {
        currentIndex += charsPerFrame;
        if (currentIndex >= fullCode.length) {
          setCodeText(fullCode);
          setIsCodeComplete(true);
          clearInterval(interval);
        } else {
          setCodeText(fullCode.substring(0, Math.floor(currentIndex)));
        }
      }, 30);

      return () => clearInterval(interval);
    }
  }, [stage, fullCode]);

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
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-8 relative">
      {/* Fixed Replay Button - Top Left Corner */}
      <button
        onClick={restartDemo}
        className="fixed top-4 left-4 z-50 rounded-full bg-[#1A1A1A]/80 hover:bg-[#FF6B00] border border-[#2E2E2E] hover:border-[#FF6B00] p-2 text-[#A0A0A0] hover:text-white transition-all backdrop-blur-sm"
        title="Replay Demo"
      >
        <RefreshCw className="w-4 h-4" />
      </button>

      <div className="w-full max-w-6xl">
        {/* Stage 0: Drawing Canvas */}
        {stage === 0 && (
          <div className="flex flex-col items-center justify-center space-y-8">
            <div className="inline-flex items-center rounded-full bg-[#2E2E2E] px-4 py-1.5 text-sm font-medium text-[#A0A0A0] mb-2">
              ✨ Sketch-to-code in seconds
            </div>
            <h1 className="text-5xl font-bold text-white mb-4">
              Draw Your <span className="text-[#FF6B00]">Vision</span>
            </h1>
            <div
              className="relative bg-white rounded-xl shadow-2xl border-2 border-[#2E2E2E]"
              style={{ width: 500, height: 350 }}
            >
              {/* Stroke Path */}
              <svg
                className="absolute inset-0 pointer-events-none rounded-xl"
                style={{ width: 500, height: 350 }}
              >
                <polyline
                  points={strokePath.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="#111217"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              {/* "Get Started" text being typed inside button */}
              {buttonText && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[#111217] font-semibold text-base pointer-events-none">
                  {buttonText}
                  {buttonText.length < 11 && (
                    <span className="animate-pulse">|</span>
                  )}
                </div>
              )}

              {/* Animated Cursor - only show during drawing phase */}
              {strokePath.length < 200 && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: cursorPos.x - 2,
                    top: cursorPos.y - 2,
                  }}
                >
                  <MousePointer2 className="text-[#FF6B00] w-6 h-6" />
                </div>
              )}
            </div>

            {/* Instruction Input Field - appears after drawing */}
            {strokePath.length > 150 && (
              <div className="w-full max-w-md animate-fade-in">
                <div className="rounded-xl border-2 border-[#2E2E2E] bg-[#1A1A1A] p-4 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-[#FF6B00]/20 flex items-center justify-center">
                      <span className="text-[#FF6B00] text-sm">💬</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-[#A0A0A0] mb-1">
                        Additional Instructions (optional)
                      </p>
                      <p className="text-white font-mono text-sm">
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
            <div className="relative">
              <Loader2 className="w-16 h-16 text-[#FF6B00] animate-spin" />
              <div className="absolute inset-0 w-16 h-16 rounded-full bg-[#FF6B00]/20 blur-xl animate-pulse" />
            </div>
            <h2 className="text-4xl font-bold text-white">
              Generating Code with <span className="text-[#FF6B00]">AI</span>...
            </h2>
            <div className="w-96 h-3 bg-[#2E2E2E] rounded-full overflow-hidden border border-[#2E2E2E]">
              <div
                className="h-full bg-[#FF6B00] shadow-[0_0_10px_rgba(255,107,0,0.5)] transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[#A0A0A0] text-lg">
              Analyzing your sketch • Generating components • Optimizing code
            </p>
          </div>
        )}

        {/* Stage 2: Split Screen - Code & Preview */}
        {stage === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="inline-flex items-center rounded-full bg-[#FF6B00]/20 border border-[#FF6B00]/50 px-4 py-1.5 text-sm font-medium text-[#FF6B00] mb-4">
                ✨ Ready to Export
              </div>
              <h2 className="text-4xl font-bold text-white">
                Your Code is <span className="text-[#FF6B00]">Ready!</span>
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {/* Left: Code Editor */}
              <div className="bg-[#1A1A1A] rounded-xl shadow-2xl p-6 border border-[#2E2E2E]">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="ml-4 text-sm text-[#A0A0A0]">
                    ActionButton.tsx
                  </span>
                </div>
                <pre className="text-sm text-[#E0E0E0] font-mono leading-relaxed overflow-auto max-h-96">
                  <code>{codeText}</code>
                </pre>
              </div>

              {/* Right: Live Preview - Only show after code is complete */}
              {isCodeComplete && (
                <div className="bg-[#1A1A1A] border border-[#2E2E2E] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-fade-in">
                  {/* Preview Toolbar */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#2E2E2E] bg-[#0A0A0A]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#A0A0A0] uppercase tracking-wide">
                        Live Preview
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Desktop/Mobile Toggle */}
                      <div className="flex items-center gap-1 bg-[#2E2E2E] rounded-lg p-1">
                        <button className="px-2 py-1 rounded bg-[#FF6B00] text-white text-xs font-medium">
                          <Monitor className="w-3 h-3" />
                        </button>
                        <button className="px-2 py-1 rounded text-[#A0A0A0] hover:text-white text-xs font-medium">
                          <Smartphone className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Action Buttons */}
                      <button
                        className="p-1.5 rounded-lg hover:bg-[#2E2E2E] text-[#A0A0A0] hover:text-white transition-colors"
                        title="Refresh"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>

                      <button
                        className="p-1.5 rounded-lg hover:bg-[#2E2E2E] text-[#A0A0A0] hover:text-white transition-colors"
                        title="Open in new tab"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>

                      <button
                        className="p-1.5 rounded-lg hover:bg-[#2E2E2E] text-[#A0A0A0] hover:text-white transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Preview Content */}
                  <div className="flex-1 bg-linear-to-br from-[#1A1A1A] to-[#0A0A0A] p-8 flex items-center justify-center min-h-75">
                    <div className="text-center space-y-6">
                      {/* Simulated Browser Content */}
                      {/* <div className="inline-flex items-center gap-3 px-4 py-2 rounded-lg bg-[#2E2E2E]/50 border border-[#2E2E2E]">
                      <div className="w-6 h-6 rounded bg-[#FF6B00] flex items-center justify-center text-white font-bold text-xs">
                        CC
                      </div>
                      <span className="text-sm font-semibold text-white">
                        CodeCanvas
                      </span>
                    </div> */}

                      {/* The Generated Button */}
                      <button className="rounded-xl bg-[#FF6B00]/20 border border-[#FF6B00]/50 backdrop-blur-md px-8 py-4 font-semibold text-white transition-all hover:bg-[#FF6B00]/30 hover:shadow-[0_0_20px_rgba(255,107,0,0.4)] hover:scale-105">
                        Get Started
                      </button>
                    </div>
                  </div>

                  {/* Preview Footer */}
                  <div className="px-4 py-2 border-t border-[#2E2E2E] bg-[#0A0A0A] flex items-center justify-between">
                    <span className="text-xs text-[#666666]">
                      Desktop • 1920x1080
                    </span>

                    {/* Preview Info */}
                    <div className="flex items-center justify-center gap-2 text-xs text-[#A0A0A0]">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span>Live • Auto-updating</span>
                    </div>
                    <span className="text-xs text-[#FF6B00]">
                      ⚡ Generated in 2.3s
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
