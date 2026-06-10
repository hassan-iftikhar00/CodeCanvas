"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion } from "motion/react";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import { createClient } from "@/lib/supabase/client";
import Pricing from "@/components/Pricing";
import Testimonials from "@/components/Testimonials";
import Footer from "@/components/Footer";

const GridScan = dynamic(() => import("@/components/GridScan"), {
  ssr: false,
});

// ============================================================
// Fonts - Warm Studio (LIGHT mode)
// ============================================================
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

// ============================================================
// Tokens - Warm Studio (light variant only for this pilot)
// ============================================================
const T = {
  bg: "#F1E9D8",
  surface: "#FAF4E4",
  elevated: "#FFFEFA",
  ink: "#2A1F18",
  muted: "#7A6B5A",
  subtle: "#A89888",
  hairline: "#E3D9C3",
  accent: "#BD5B3D",
  accentHover: "#8E3E25",
  accentSoft: "#F1D9CE",
  counter: "#3F5E4F",
  anchor: "#1A1410",
  anchorText: "#F1E9D8",
  anchorMuted: "#A89888",
};

// ============================================================
// Motion CSS
// ============================================================
const motionCSS = `
@keyframes lp-pulse { 0%,100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 1; transform: scale(1.4); } }
@keyframes lp-draw { from { stroke-dashoffset: 400; } to { stroke-dashoffset: 0; } }
@keyframes lp-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes lp-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
@keyframes lp-glow {
  0%, 100% { text-shadow: 0 0 30px rgba(189,91,61,0.25); }
  50% { text-shadow: 0 0 50px rgba(189,91,61,0.5); }
}
.lp-pulse { animation: lp-pulse 2s ease-in-out infinite; }
.lp-blink { animation: lp-blink 1s steps(1) infinite; }
.lp-float { animation: lp-float 3.4s ease-in-out infinite; }
.lp-draw { stroke-dasharray: 400; animation: lp-draw 2.6s cubic-bezier(0.65,0,0.35,1) infinite alternate; }
.lp-glow { animation: lp-glow 3s ease-in-out infinite; }
.lp-btn { transition: transform 200ms cubic-bezier(0.16,1,0.3,1), background 200ms ease-out, box-shadow 200ms ease-out; }
.lp-btn:active { transform: scale(0.97); }
.lp-paper {
  background-image: url("data:image/svg+xml;utf8,<svg viewBox='0 0 240 240' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.17  0 0 0 0 0.12  0 0 0 0 0.10  0 0 0 0.05 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  background-size: 240px 240px;
}
`;

// ============================================================
// Logo & wordmark - terracotta C
// ============================================================
function Logo({
  size = 28,
  color = T.accent,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      fill={color}
      aria-label="CodeCanvas"
    >
      <rect x="55" y="15" width="130" height="46" rx="12" />
      <rect x="15" y="65" width="46" height="74" rx="12" />
      <rect x="55" y="143" width="130" height="46" rx="12" />
    </svg>
  );
}

function Wordmark({
  color = T.ink,
  size = 18,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <span
      style={{
        fontFamily: "var(--font-fraunces)",
        fontWeight: 600,
        fontSize: size,
        letterSpacing: "-0.02em",
        color,
      }}
    >
      Code<span style={{ fontStyle: "italic", fontWeight: 500 }}>Canvas</span>
    </span>
  );
}

// ============================================================
// PAGE - original structure, Warm Studio skin
// ============================================================
export default function Home() {
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<{ x: number; y: number }[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<
    { x: number; y: number }[]
  >([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleContinueDesign = async () => {
    localStorage.setItem("miniCanvasDesign", JSON.stringify(strokes));
    const target = "/canvas?fromMini=true";
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/auth/login?redirectTo=${encodeURIComponent(target)}`);
    } else {
      router.push(target);
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setCurrentStroke([
      { x: e.clientX - rect.left, y: e.clientY - rect.top },
    ]);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setCurrentStroke((prev) => [
      ...prev,
      { x: e.clientX - rect.left, y: e.clientY - rect.top },
    ]);
  };

  const endDrawing = () => {
    if (currentStroke.length > 0) {
      setStrokes((prev) => [...prev, currentStroke]);
      setCurrentStroke([]);
    }
    setIsDrawing(false);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Warm dot grid
    ctx.fillStyle = T.hairline;
    for (let x = 8; x < rect.width; x += 18) {
      for (let y = 8; y < rect.height; y += 18) {
        ctx.beginPath();
        ctx.arc(x, y, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Cocoa ink strokes
    ctx.strokeStyle = T.ink;
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    [...strokes, currentStroke].forEach((stroke) => {
      if (stroke.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      stroke.forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.stroke();
    });
  }, [strokes, currentStroke]);

  const clearCanvas = () => {
    setStrokes([]);
    setCurrentStroke([]);
  };

  return (
    <div
      className={`${fraunces.variable} ${inter.variable} ${jetbrains.variable} min-h-screen`}
      style={{
        background: T.bg,
        color: T.ink,
        fontFamily: "var(--font-inter)",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: motionCSS }} />

      {/* ───────── Navigation Header ───────── */}
      <nav
        className="relative z-20 border-b backdrop-blur"
        style={{
          borderColor: T.hairline,
          background: "rgba(241,233,216,0.82)",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <Logo size={32} color={T.accent} />
              <Wordmark color={T.ink} size={20} />
            </Link>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link
                href="/auth/login"
                className="rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm"
                style={{ color: T.muted }}
              >
                Log in
              </Link>
              <Link
                href="/canvas"
                className="lp-btn rounded-xl px-3 py-2 text-xs font-medium sm:px-5 sm:py-2.5 sm:text-sm"
                style={{
                  background: T.accent,
                  color: T.surface,
                  boxShadow: "0 8px 20px -10px rgba(189,91,61,0.55)",
                }}
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ───────── Hero Section ───────── */}
      <main className="relative overflow-hidden">
        {/* Warm paper texture + radial accent (replaces dark GridScan visually for light mode) */}
        <div
          className="lp-paper pointer-events-none absolute inset-0 z-0 opacity-[0.06] mix-blend-multiply"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-32 -top-32 z-0 h-[520px] w-[520px] rounded-full opacity-50"
          style={{
            background:
              "radial-gradient(circle at center, rgba(189,91,61,0.16) 0%, transparent 70%)",
          }}
          aria-hidden
        />
        {/* GridScan - cursor-reactive shader grid (Three.js).
            IMPORTANT: this wrapper MUST be pointer-events-auto so the
            component's internal mousemove listener (GridScan.tsx, line ~398)
            can receive cursor coords. The hero content overlay at z-10 is
            pointer-events-none with selective auto on interactive children,
            so cursor passes through the empty hero space and hits GridScan
            below - the same pattern React Bits' Dot Grid uses for proximity
            response and click shockwaves. */}
        <div className="absolute inset-0 z-0 pointer-events-auto">
          <GridScan
            sensitivity={0.75}
            lineThickness={1.3}
            linesColor="#D8CDB4"
            gridScale={0.18}
            lineStyle="solid"
            lineJitter={0.04}
            scanColor="#BD5B3D"
            scanOpacity={0.18}
            scanDirection="pingpong"
            scanDuration={2.4}
            scanDelay={1.8}
            scanGlow={0.8}
            scanSoftness={1.8}
            scanPhaseTaper={0.9}
            scanOnClick
            snapBackDelay={350}
            enablePost
            bloomIntensity={0.25}
            chromaticAberration={0.0002}
            noiseIntensity={0.003}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24 pointer-events-none">
          <div className="grid gap-8 sm:gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            {/* Left: Hero Copy */}
            <div className="space-y-6 sm:space-y-8 pointer-events-auto">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium"
                style={{
                  background: T.surface,
                  borderColor: T.hairline,
                  color: T.muted,
                }}
              >
                <span
                  className="lp-pulse h-1.5 w-1.5 rounded-full"
                  style={{ background: T.counter }}
                />
                Sketch-to-code in seconds
              </motion.div>

              <div className="space-y-0">
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.7,
                    delay: 0.1,
                    ease: [0.65, 0, 0.35, 1],
                  }}
                  className="text-4xl tracking-[-0.025em] sm:text-5xl md:text-6xl lg:text-7xl"
                  style={{
                    fontFamily: "var(--font-fraunces)",
                    fontWeight: 500,
                    color: T.ink,
                    lineHeight: 0.95,
                  }}
                >
                  Draw.
                </motion.h1>
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.7,
                    delay: 0.2,
                    ease: [0.65, 0, 0.35, 1],
                  }}
                  className="text-4xl tracking-[-0.025em] sm:text-5xl md:text-6xl lg:text-7xl"
                  style={{
                    fontFamily: "var(--font-fraunces)",
                    fontWeight: 500,
                    color: T.ink,
                    lineHeight: 0.95,
                  }}
                >
                  Describe.
                </motion.h1>
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.7,
                    delay: 0.3,
                    ease: [0.65, 0, 0.35, 1],
                  }}
                  className="lp-glow text-4xl italic tracking-[-0.025em] sm:text-5xl md:text-6xl lg:text-7xl"
                  style={{
                    fontFamily: "var(--font-fraunces)",
                    fontWeight: 500,
                    color: T.accent,
                    lineHeight: 0.95,
                  }}
                >
                  Ship.
                </motion.h1>
              </div>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.6,
                  delay: 0.5,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="max-w-lg text-base leading-relaxed sm:text-lg md:text-xl"
                style={{ color: T.muted }}
              >
                Convert rough sketches into production-ready frontends - live
                preview and one-click export.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.6,
                  delay: 0.6,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="flex flex-col gap-3 sm:flex-row sm:gap-4"
              >
                <Link
                  href="/canvas"
                  className="lp-btn group inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold sm:px-8 sm:py-4 sm:text-base"
                  style={{
                    background: T.accent,
                    color: T.surface,
                    boxShadow: "0 14px 36px -14px rgba(189,91,61,0.55)",
                  }}
                >
                  Open Canvas
                  <svg
                    className="h-4 w-4 transition-transform group-hover:translate-x-1 sm:h-5 sm:w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </Link>

                <button
                  className="lp-btn inline-flex items-center justify-center rounded-xl border-2 px-6 py-3 text-sm font-semibold sm:px-8 sm:py-[10px] sm:text-base"
                  style={{
                    borderColor: T.ink,
                    color: T.ink,
                    background: "transparent",
                  }}
                >
                  Watch Demo
                </button>
              </motion.div>

              {/* Feature Pills */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.85 }}
                className="flex flex-wrap gap-3 pt-4"
              >
                {[
                  "Live Preview",
                  "AI-Powered Recognition",
                  "One-Click Export",
                ].map((label) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium"
                    style={{
                      background: T.surface,
                      borderColor: T.hairline,
                      color: T.ink,
                    }}
                  >
                    <span style={{ color: T.accent }}>
                      <svg
                        className="h-4 w-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                    {label}
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right: Interactive Mini Canvas */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                duration: 0.8,
                delay: 0.4,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="relative pointer-events-auto"
            >
              <div
                className="relative overflow-hidden rounded-2xl border"
                style={{
                  background: T.surface,
                  borderColor: T.hairline,
                  boxShadow: "0 30px 60px -30px rgba(42,31,24,0.18)",
                }}
              >
                <div
                  className="flex items-center justify-between border-b px-4 py-3"
                  style={{ borderColor: T.hairline }}
                >
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: T.ink }}
                  >
                    Try it now <span style={{ color: T.muted }}>|</span> Draw a
                    button
                  </h3>
                  <button
                    onClick={clearCanvas}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{
                      background: T.bg,
                      color: T.muted,
                      fontFamily: "var(--font-jetbrains)",
                    }}
                  >
                    Clear
                  </button>
                </div>

                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    className="w-full cursor-crosshair"
                    style={{
                      width: "100%",
                      height: "300px",
                      background: T.elevated,
                    }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={endDrawing}
                    onMouseLeave={endDrawing}
                  />
                  {strokes.length === 0 && (
                    <div
                      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2"
                      style={{ color: T.subtle }}
                    >
                      <svg
                        width="36"
                        height="36"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={T.accent}
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path
                          className="lp-draw"
                          d="M4 18 L 7 12 L 12 16 L 17 8 L 20 12"
                        />
                      </svg>
                      <span
                        className="text-[11px]"
                        style={{ fontFamily: "var(--font-jetbrains)" }}
                      >
                        any pen · any speed · rough is fine
                      </span>
                    </div>
                  )}
                </div>

                {strokes.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="border-t p-4"
                    style={{ borderColor: T.hairline }}
                  >
                    <p
                      className="mb-2 text-xs font-semibold uppercase tracking-wide"
                      style={{
                        color: T.muted,
                        fontFamily: "var(--font-jetbrains)",
                      }}
                    >
                      Live Preview
                    </p>
                    <button
                      onClick={handleContinueDesign}
                      className="lp-btn w-full rounded-xl px-6 py-3 font-semibold"
                      style={{
                        background: T.accent,
                        color: T.surface,
                        boxShadow:
                          "0 12px 30px -12px rgba(189,91,61,0.55)",
                      }}
                    >
                      Continue in Canvas
                    </button>
                  </motion.div>
                )}

                {/* Mono status strip - the tool signature */}
                <div
                  className="flex items-center justify-between px-4 py-2 text-[10px]"
                  style={{
                    background: T.anchor,
                    color: T.anchorMuted,
                    fontFamily: "var(--font-jetbrains)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span style={{ color: T.anchorText }}>
                      ~/sketch.canvas
                    </span>
                    <span>480 × 300</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span style={{ color: T.accent }}>● PEN</span>
                    <span>{strokes.length} strokes</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* ───────── Features Section ───────── */}
      <section
        className="border-t py-16 sm:py-24"
        style={{
          borderColor: T.hairline,
          background: T.surface,
        }}
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          {/* Video Demo */}
          <div className="mb-24">
            <div className="mb-8 text-center">
              <h2
                className="text-3xl tracking-[-0.02em] sm:text-4xl"
                style={{
                  fontFamily: "var(--font-fraunces)",
                  fontWeight: 600,
                  color: T.ink,
                }}
              >
                See It In Action
              </h2>
              <p
                className="mt-4 text-lg"
                style={{ color: T.muted }}
              >
                Watch how CodeCanvas transforms sketches into production-ready
                code
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="relative mx-auto max-w-5xl"
            >
              <div
                className="relative overflow-hidden rounded-2xl border p-4"
                style={{
                  borderColor: T.hairline,
                  background: T.elevated,
                  boxShadow: "0 40px 80px -40px rgba(42,31,24,0.25)",
                }}
              >
                <video
                  className="w-full rounded-lg"
                  autoPlay
                  loop
                  muted
                  playsInline
                >
                  <source
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/demo-video.mp4`}
                    type="video/mp4"
                  />
                  Your browser does not support the video tag.
                </video>
              </div>

              <div
                className="pointer-events-none absolute -left-10 top-1/2 h-40 w-40 rounded-full opacity-50"
                style={{
                  background:
                    "radial-gradient(circle, rgba(189,91,61,0.25) 0%, transparent 70%)",
                }}
              />
              <div
                className="pointer-events-none absolute -right-10 top-1/4 h-40 w-40 rounded-full opacity-30"
                style={{
                  background:
                    "radial-gradient(circle, rgba(63,94,79,0.2) 0%, transparent 70%)",
                }}
              />
            </motion.div>
          </div>

          <div className="mb-16 text-center">
            <h2
              className="text-3xl tracking-[-0.02em] sm:text-4xl"
              style={{
                fontFamily: "var(--font-fraunces)",
                fontWeight: 600,
                color: T.ink,
              }}
            >
              Why CodeCanvas?
            </h2>
            <p className="mt-4 text-lg" style={{ color: T.muted }}>
              Fast, intuitive, and built for makers
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Natural Sketching",
                description:
                  "Draw components just like on paper. Our model understands your intent.",
              },
              {
                title: "Smart Recognition",
                description:
                  "Detects buttons, inputs, and layouts and converts them to clean code.",
              },
              {
                title: "Live Preview",
                description:
                  "See your design come to life with real-time code generation.",
              },
              {
                title: "Natural Language",
                description:
                  "Describe interactions and behavior, and the logic is generated for you.",
              },
              {
                title: "Export Ready",
                description:
                  "Download code with proper structure and sensible defaults.",
              },
              {
                title: "Style Freedom",
                description:
                  "Choose your framework, styling approach, and coding patterns.",
              },
            ].map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{
                  duration: 0.5,
                  delay: idx * 0.06,
                  ease: [0.16, 1, 0.3, 1],
                }}
                whileHover={{ y: -3 }}
                className="group rounded-2xl border p-6 transition-all"
                style={{
                  background: T.elevated,
                  borderColor: T.hairline,
                }}
              >
                <div
                  className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{
                    background: T.accentSoft,
                    color: T.accent,
                  }}
                >
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h3
                  className="mb-2 text-lg tracking-tight"
                  style={{
                    fontFamily: "var(--font-fraunces)",
                    fontWeight: 600,
                    color: T.ink,
                  }}
                >
                  {feature.title}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: T.muted }}
                >
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Pricing - temporarily disabled, will migrate to Warm Studio later ───────── */}
      {/* <Pricing /> */}

      {/* ───────── Testimonials - untouched component ───────── */}
      <Testimonials />

      {/* ───────── CTA Section ───────── */}
      <section
        className="relative overflow-hidden border-t py-16 sm:py-24"
        style={{
          borderColor: "rgba(227,217,195,0.1)",
          background: T.anchor,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(circle at 30% 50%, rgba(214,122,90,0.25) 0%, transparent 60%), radial-gradient(circle at 80% 50%, rgba(125,181,138,0.15) 0%, transparent 60%)",
          }}
          aria-hidden
        />
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="lp-float inline-block">
              <Logo size={48} color="#D67A5A" />
            </div>
            <h2
              className="mt-8 text-4xl tracking-[-0.02em] sm:text-5xl"
              style={{
                fontFamily: "var(--font-fraunces)",
                fontWeight: 500,
                color: T.anchorText,
                lineHeight: 1.05,
              }}
            >
              Ready to build faster?
            </h2>
            <p
              className="mt-6 text-lg leading-8"
              style={{ color: T.anchorMuted }}
            >
              Start sketching your next project today. No credit card required.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link
                href="/canvas"
                className="lp-btn inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 text-base font-semibold"
                style={{
                  background: "#D67A5A",
                  color: T.anchor,
                  boxShadow: "0 16px 40px -12px rgba(214,122,90,0.6)",
                }}
              >
                Get Started Free
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ───────── Footer - untouched component ───────── */}
      <Footer />
    </div>
  );
}
