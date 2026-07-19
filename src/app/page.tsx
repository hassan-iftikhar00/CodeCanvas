"use client";

/**
 * Landing page — "Drafting Room" direction
 *
 * Promoted from /design-preview-v2. Self-contained styles (scoped to .d5-root)
 * so it doesn't fight the global ThemeProvider on the rest of the app.
 *
 * Slots preserved 1:1 from the previous Warm Studio landing:
 *   nav, hero (mini-canvas + GridScan), video demo, 6 feature cards,
 *   testimonials, CTA, footer.
 * Mini-canvas drawing + supabase auth + localStorage redirect preserved exactly.
 *
 * Pricing/Testimonials components are intentionally commented out (not
 * deleted) so they can be migrated to Drafting Room and re-imported later.
 * The Footer used the old palette and had no live consumer, so its file was
 * removed; an inline Drafting Room FooterBlock lives below.
 */

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import { createClient } from "@/lib/supabase/client";
import {
  Instagram,
  Github,
  Twitter,
  Mail,
  Check,
  Send,
  Menu,
  X,
} from "lucide-react";
import { DRAFTING_TOKENS as T } from "@/lib/drafting-room/tokens";
import {
  DraftingMark as Mark,
  DraftingCross as Cross,
} from "@/lib/drafting-room/marks";

// GridScan removed from this page — the Three.js perspective tunnel fought the
// precision register. Replaced with a static graph + cobalt scan tick + crosshair
// cursor (same approach as /design-preview-v2). GridScan component is still
// available for other surfaces if we want it.

// ─── fonts ────────────────────────────────────────────────────────────────────
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--d5-serif",
  display: "swap",
});
const sans = Inter({
  subsets: ["latin"],
  variable: "--d5-sans",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--d5-mono",
  display: "swap",
});

// ─── tokens ──────────────────────────────────────────────────────────────────
// `T` and the `Mark` / `Cross` SVGs are imported from src/lib/drafting-room
// so landing, auth and canvas all draw from the same palette and brand mark.
// (See the imports at the top of this file.)

// ─── testimonial + footer data (lifted verbatim from old components) ─────────
const TESTIMONIALS = [
  {
    name: "Sarah Chen",
    role: "UI/UX Designer",
    company: "TechCorp",
    quote:
      "CodeCanvas transformed my workflow. I can sketch ideas and get production code in minutes instead of hours.",
    avatar: "SC",
  },
  {
    name: "Michael Rodriguez",
    role: "Frontend Developer",
    company: "StartupXYZ",
    quote:
      "The AI detection is incredibly accurate. It understands my sketches better than I expected.",
    avatar: "MR",
  },
  {
    name: "Emily Watson",
    role: "Product Manager",
    company: "InnovateLabs",
    quote:
      "Perfect for rapid prototyping. Our team can iterate on designs ten times faster now.",
    avatar: "EW",
  },
  {
    name: "David Kim",
    role: "Full Stack Developer",
    company: "DevStudio",
    quote:
      "Clean code generation and a great template library. Saves me hours every week.",
    avatar: "DK",
  },
  {
    name: "Lisa Thompson",
    role: "Design Lead",
    company: "Creative Co",
    quote:
      "Finally, a tool that bridges the gap between design and development perfectly.",
    avatar: "LT",
  },
];

const FOOTER_COLS: Array<{
  title: string;
  links: Array<{ label: string; href: string }>;
}> = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Stories", href: "/#stories" },
      { label: "Canvas", href: "/canvas" },
      { label: "Demo", href: "/demo" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Log in", href: "/auth/login" },
      { label: "Sign up", href: "/auth/signup" },
    ],
  },
];

// Logo mark + crosshair are imported from src/lib/drafting-room/marks.

// ═════════════════════════════════════════════════════════════════════════════
// PAGE

export default function Home() {
  // ── state + handlers — preserved verbatim from previous landing ────────────
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<{ x: number; y: number }[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<
    { x: number; y: number }[]
  >([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const supabase = createClient();

  // Auth-aware nav: if logged in, push target; if not, send to signup with
  // the target as redirectTo. Used for every "enter the product" CTA so new
  // visitors land on signup (not login) — fewer clicks to first sketch.
  const handleStartNav = async (target: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/auth/signup?redirectTo=${encodeURIComponent(target)}`);
    } else {
      router.push(target);
    }
  };

  const handleContinueDesign = async () => {
    localStorage.setItem("miniCanvasDesign", JSON.stringify(strokes));
    await handleStartNav("/canvas?fromMini=true");
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setCurrentStroke([{ x: e.clientX - rect.left, y: e.clientY - rect.top }]);
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

  const clearCanvas = () => {
    setStrokes([]);
    setCurrentStroke([]);
  };

  // ── hero cursor crosshair + coord readout — follows pointer, hides on leave
  const heroWrapRef = useRef<HTMLElement>(null);
  const crosshairRef = useRef<HTMLDivElement>(null);
  const [coord, setCoord] = useState({ x: 0, y: 0, active: false });
  const onHeroMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = heroWrapRef.current;
    const c = crosshairRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.round(e.clientX - r.left);
    const y = Math.round(e.clientY - r.top);
    if (c) {
      c.style.transform = `translate(${x}px, ${y}px)`;
      c.style.opacity = "1";
    }
    setCoord({ x, y, active: true });
  };
  const onHeroLeave = () => {
    if (crosshairRef.current) crosshairRef.current.style.opacity = "0";
    setCoord((p) => ({ ...p, active: false }));
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

    // No grid here: the hero already draws its own graph background, and a
    // second grid inside this well made the mini-canvas blend into the page.
    // Plain white surface reads as "canvas"; strokes carry the sketch feel.

    // Pen strokes in graphite
    ctx.strokeStyle = T.graphite;
    ctx.lineWidth = 2.4;
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

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className={`${serif.variable} ${sans.variable} ${mono.variable} d5-root min-h-screen`}
    >
      <style jsx global>{`
        :root {
          --d5-paper: ${T.paper};
          --d5-vellum: ${T.vellum};
          --d5-tick: ${T.tick};
          --d5-rule: ${T.rule};
          --d5-graphite: ${T.graphite};
          --d5-cobalt: ${T.cobalt};
          --d5-cobalt-ink: ${T.cobaltInk};
          --d5-cobalt-wash: ${T.cobaltWash};
          --d5-muted: ${T.muted};
        }
        .d5-root {
          background: var(--d5-paper);
          color: var(--d5-graphite);
          font-family: var(--d5-sans), ui-sans-serif, system-ui, sans-serif;
          letter-spacing: -0.005em;
        }
        .d5-mono {
          font-family: var(--d5-mono), ui-monospace, monospace;
          font-feature-settings: "zero", "ss01";
          letter-spacing: 0;
        }
        .d5-serif {
          font-family: var(--d5-serif), ui-serif, Georgia, serif;
          font-feature-settings: "liga", "dlig", "kern";
        }
        .d5-serif em {
          margin-right: 0.18em;
        }
        /* Two-layer graph: fine 8px hairline texture + coarse 32px structural.
           Coarse line is 1.5px (not 1px) so sub-pixel rendering on uncalibrated
           external displays can't lose it. Fine layer stays 1px at 0.4 opacity
           so the texture doesn't compete with the structure. */
        .d5-grid-fine {
          background-image:
            linear-gradient(to right, var(--d5-tick) 1px, transparent 1px),
            linear-gradient(to bottom, var(--d5-tick) 1px, transparent 1px);
          background-size: 8px 8px;
          opacity: 0.4;
        }
        .d5-grid {
          background-image:
            linear-gradient(to right, var(--d5-tick) 1.5px, transparent 1.5px),
            linear-gradient(to bottom, var(--d5-tick) 1.5px, transparent 1.5px);
          background-size: 32px 32px;
          opacity: 1;
        }
        .d5-reg::before,
        .d5-reg::after {
          content: "";
          position: absolute;
          width: 8px;
          height: 8px;
          border: 1px solid var(--d5-rule);
        }
        .d5-reg::before {
          top: -1px;
          left: -1px;
          border-right: 0;
          border-bottom: 0;
        }
        .d5-reg::after {
          bottom: -1px;
          right: -1px;
          border-left: 0;
          border-top: 0;
        }
        .d5-tag {
          font-family: var(--d5-mono), ui-monospace, monospace;
          font-size: 13px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--d5-muted);
        }
        /* RULE: every button has a solid fill — never transparent. The hero
           and CTA sections both have grid backgrounds, and transparent buttons
           let the grid lines bleed through their text. Paper fill on light
           pages, graphite fill on dark sections. See memory for full rule. */
        .d5-btn {
          font-family: var(--d5-mono);
          font-size: 13px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          padding: 12px 22px;
          border: 1px solid var(--d5-rule);
          background: var(--d5-paper);
          color: var(--d5-graphite);
          transition:
            background 120ms cubic-bezier(0.2, 0.7, 0.1, 1),
            color 120ms cubic-bezier(0.2, 0.7, 0.1, 1),
            border-color 120ms cubic-bezier(0.2, 0.7, 0.1, 1);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .d5-btn:hover {
          background: var(--d5-graphite);
          color: var(--d5-paper);
        }
        .d5-btn-primary {
          background: var(--d5-cobalt);
          border-color: var(--d5-cobalt);
          color: var(--d5-paper);
        }
        .d5-btn-primary:hover {
          background: var(--d5-cobalt-ink);
          border-color: var(--d5-cobalt-ink);
          color: var(--d5-paper);
        }
        .d5-btn-on-graphite {
          background: var(--d5-cobalt);
          border-color: var(--d5-cobalt);
          color: var(--d5-paper);
        }
        .d5-btn-on-graphite:hover {
          background: var(--d5-paper);
          border-color: var(--d5-paper);
          color: var(--d5-graphite);
        }
        .d5-btn-ghost-on-graphite {
          background: var(--d5-graphite);
          border-color: rgba(242, 241, 236, 0.3);
          color: var(--d5-paper);
        }
        .d5-btn-ghost-on-graphite:hover {
          background: var(--d5-paper);
          border-color: var(--d5-paper);
          color: var(--d5-graphite);
        }
        .d5-social {
          background: var(--d5-paper);
          color: var(--d5-graphite);
        }
        .d5-social:hover {
          background: var(--d5-graphite);
          color: var(--d5-paper);
        }
        .d5-social svg {
          stroke: currentColor;
        }
        .d5-input {
          background: transparent;
          border: 0;
          border-bottom: 1px solid var(--d5-rule);
          padding: 8px 0;
          font-family: var(--d5-sans);
          color: var(--d5-graphite);
          outline: none;
          width: 100%;
          font-size: 14px;
        }
        .d5-input:focus {
          border-bottom-color: var(--d5-cobalt);
        }
        .d5-root *::selection {
          background: var(--d5-cobalt-wash);
          color: var(--d5-cobalt-ink);
        }
        @keyframes d5-blink {
          50% {
            opacity: 0;
          }
        }
        @keyframes d5-tick-sweep {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes d5-pulse {
          0%,
          100% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.4);
          }
        }
        .d5-dot-pulse {
          animation: d5-pulse 2s ease-in-out infinite;
        }
      `}</style>

      <TopBar />

      {/* ─── HERO ─────────────────────────────────────────────────────────── */}
      <main
        className="relative overflow-hidden border-b"
        style={{ borderColor: T.rule, cursor: "none" }}
        ref={heroWrapRef}
        onMouseMove={onHeroMove}
        onMouseLeave={onHeroLeave}
      >
        {/* hairline graph — fine + coarse, static, on-brand */}
        <div className="absolute inset-0 d5-grid-fine pointer-events-none" />
        <div className="absolute inset-0 d5-grid pointer-events-none" />

        {/* silent margin guides */}
        <div
          className="absolute left-0 right-0 h-px pointer-events-none"
          style={{ top: 64, background: T.tick, opacity: 0.5 }}
        />
        <div
          className="absolute left-0 right-0 h-px pointer-events-none"
          style={{ bottom: 64, background: T.tick, opacity: 0.5 }}
        />

        {/* cobalt scan tick — slow traverse along bottom edge */}
        <div className="absolute left-0 bottom-0 w-full h-px pointer-events-none overflow-hidden">
          <div
            className="absolute h-px"
            style={{
              width: 140,
              background: T.cobalt,
              animation: "d5-tick-sweep 9s linear infinite",
            }}
          />
        </div>

        {/* cursor crosshair (mix-blend-difference) */}
        <div
          ref={crosshairRef}
          className="pointer-events-none absolute top-0 left-0"
          style={{
            width: 0,
            height: 0,
            mixBlendMode: "difference",
            opacity: 0,
            transition: "opacity 120ms linear",
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 40 40"
            style={{ transform: "translate(-50%, -50%)", color: T.cobalt }}
          >
            <circle
              cx="20"
              cy="20"
              r="8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
            <line
              x1="20"
              y1="0"
              x2="20"
              y2="14"
              stroke="currentColor"
              strokeWidth="1"
            />
            <line
              x1="20"
              y1="26"
              x2="20"
              y2="40"
              stroke="currentColor"
              strokeWidth="1"
            />
            <line
              x1="0"
              y1="20"
              x2="14"
              y2="20"
              stroke="currentColor"
              strokeWidth="1"
            />
            <line
              x1="26"
              y1="20"
              x2="40"
              y2="20"
              stroke="currentColor"
              strokeWidth="1"
            />
            <circle cx="20" cy="20" r="1.2" fill="currentColor" />
          </svg>
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6 pt-20 pb-24 sm:pt-24 sm:pb-28 lg:px-10 pointer-events-none">
          {/* slug + coord row — left: figure ID, right: live cursor coords (drafting tool readout) */}
          <div
            className="d5-mono mb-12 flex items-center justify-between text-[13px] tracking-[0.16em] uppercase pointer-events-auto"
            style={{ color: T.muted }}
          >
            <span>
              FIG. 01 / TOOL VIEW · LIVE
              {strokes.length > 0 && (
                <span style={{ color: T.cobalt }}>
                  {" · "}
                  {strokes.length} STROKES
                </span>
              )}
            </span>
            <span className="flex items-center gap-3 tabular-nums">
              <Cross size={8} />
              <span>
                x:{" "}
                <span style={{ color: T.graphite }}>
                  {coord.active ? coord.x.toString().padStart(4, "0") : "····"}
                </span>
              </span>
              <span>
                y:{" "}
                <span style={{ color: T.graphite }}>
                  {coord.active ? coord.y.toString().padStart(4, "0") : "····"}
                </span>
              </span>
            </span>
          </div>

          <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-16">
            {/* ── LEFT: Hero copy ─────────────────────────────────────────── */}
            <div
              className="lg:col-span-7 pointer-events-auto relative"
              style={{
                background: T.paper,
                border: `1px solid ${T.rule}`,
              }}
            >
              {/* title block — mirrors the canvas card's UNTITLED · DRAFT strip */}
              <div
                className="d5-mono flex items-center justify-between border-b px-5 py-2.5 text-[13px] tracking-[0.16em] uppercase"
                style={{ borderColor: T.rule, color: T.muted }}
              >
                <span style={{ color: T.graphite }}>BRIEF · v0.1</span>
                <span className="flex items-center gap-2">
                  <span
                    className="d5-dot-pulse inline-block h-1.5 w-1.5"
                    style={{ background: T.cobalt }}
                  />
                  EDITORIAL
                </span>
              </div>

              <div className="space-y-8 p-6 sm:p-8">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="inline-flex items-center gap-2 d5-mono text-[13px] tracking-[0.18em] uppercase border px-3 py-1.5"
                  style={{
                    borderColor: T.rule,
                    color: T.graphite,
                    background: T.paper,
                  }}
                >
                  <span
                    className="d5-dot-pulse inline-block h-1.5 w-1.5"
                    style={{ background: T.cobalt }}
                  />
                  Sketch to code · v0.1
                </motion.div>

                <div className="space-y-0">
                  {(["Draw.", "Describe.", "Ship."] as const).map((word, i) => (
                    <motion.h1
                      key={word}
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.7,
                        delay: 0.1 + i * 0.1,
                        ease: [0.65, 0, 0.35, 1],
                      }}
                      className="d5-serif break-words"
                      style={{
                        // Floor was 56px, a fixed value below the ~622px
                        // viewport where 9vw stops exceeding it — every
                        // phone (320-414px) rendered "Describe." at a fixed
                        // 56px that overflowed its bordered box. Lowering
                        // the floor to 36px lets 9vw take over at ~400px
                        // instead, so widths below that scale down too.
                        fontSize: "clamp(36px, 9vw, 132px)",
                        lineHeight: 0.92,
                        letterSpacing: "-0.03em",
                        color: i === 2 ? T.cobalt : T.graphite,
                        fontStyle: i === 2 ? "italic" : "normal",
                        fontWeight: 400,
                      }}
                    >
                      {word}
                    </motion.h1>
                  ))}
                </div>

                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.6,
                    delay: 0.5,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="max-w-xl text-[18px] leading-[1.55]"
                  style={{ color: T.graphite }}
                >
                  Convert rough sketches into production-ready frontends, with
                  live preview and one-click export.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.6,
                    delay: 0.6,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="flex flex-wrap items-center gap-3"
                >
                  <button
                    onClick={() => handleStartNav("/canvas")}
                    className="d5-btn d5-btn-primary"
                  >
                    Open Canvas <span>→</span>
                  </button>
                  <button className="d5-btn">Watch Demo</button>
                </motion.div>

                {/* feature pills — hairline mono badges */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.85 }}
                  className="flex flex-wrap gap-2 pt-4"
                >
                  {["LIVE PREVIEW", "AI RECOGNITION", "ONE-CLICK EXPORT"].map(
                    (label) => (
                      <span
                        key={label}
                        className="d5-mono inline-flex items-center gap-2 border px-3 py-1.5 text-[13px] tracking-[0.18em]"
                        style={{
                          borderColor: T.rule,
                          color: T.graphite,
                          background: T.paper,
                        }}
                      >
                        <Cross size={8} />
                        {label}
                      </span>
                    )
                  )}
                </motion.div>
              </div>
            </div>

            {/* ── RIGHT: Mini-canvas in drafting card ─────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.4,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="relative lg:col-span-5 pointer-events-auto"
            >
              <div
                className="relative d5-reg"
                style={{
                  background: T.paper,
                  border: `1px solid ${T.rule}`,
                }}
              >
                {/* title block */}
                <div
                  className="d5-mono flex items-center justify-between border-b px-4 py-2.5 text-[13px] tracking-[0.16em] uppercase"
                  style={{ borderColor: T.rule, color: T.muted }}
                >
                  <span style={{ color: T.graphite }}>UNTITLED · DRAFT</span>
                  <button
                    onClick={clearCanvas}
                    className="hover:text-[var(--d5-graphite)] transition-colors"
                    style={{ color: T.muted }}
                  >
                    CLEAR ↺
                  </button>
                </div>

                {/* canvas */}
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    className="w-full cursor-crosshair"
                    style={{
                      width: "100%",
                      height: 320,
                      // Pure white, not T.paper: the hero behind this card has
                      // its own 8px/32px graph, and a paper-toned canvas with a
                      // 16px graph visually merges into it. White separates the
                      // drawing well so it reads as "the canvas".
                      background: "#FFFFFF",
                      display: "block",
                    }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={endDrawing}
                    onMouseLeave={endDrawing}
                  />
                  {strokes.length === 0 && (
                    <div
                      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3"
                      style={{ color: T.muted }}
                    >
                      <svg
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={T.cobalt}
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 18 L 7 12 L 12 16 L 17 8 L 20 12" />
                      </svg>
                      <span
                        className="d5-serif"
                        style={{
                          fontSize: 22,
                          lineHeight: 1,
                          color: T.graphite,
                        }}
                      >
                        Draw your UI here ~ No login required
                      </span>

                      <span className="d5-mono text-[13px] tracking-[0.18em] uppercase">
                        Click and drag · any pen · rough is fine
                      </span>
                    </div>
                  )}
                </div>

                {/* continue strip */}
                {strokes.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    className="border-t p-3"
                    style={{ borderColor: T.rule }}
                  >
                    <button
                      onClick={handleContinueDesign}
                      className="d5-btn d5-btn-primary w-full"
                    >
                      Continue in Canvas →
                    </button>
                  </motion.div>
                )}

                {/* mono status strip */}
                <div
                  className="d5-mono flex items-center justify-between border-t px-4 py-2 text-[13px] tracking-[0.14em] uppercase"
                  style={{
                    borderColor: T.rule,
                    background: T.graphite,
                    color: "rgba(242,241,236,0.45)",
                  }}
                >
                  <div className="flex items-center gap-4">
                    <span style={{ color: T.paper }}>~/sketch.canvas</span>
                    <span>480 × 320</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span style={{ color: T.cobalt }}>● PEN</span>
                    <span>{strokes.length} STROKES</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* status bar */}
        <HeroStatusBar strokes={strokes.length} />
      </main>

      {/* ─── 01 — SEE IT IN ACTION (video demo) ───────────────────────────── */}
      <SeeInAction />

      {/* ─── 02 — WHY CODECANVAS (6 feature cards) ────────────────────────── */}
      <WhyCodeCanvas />

      {/* ─── Pricing — disabled, will migrate ──────────────────────────────── */}
      {/* <Pricing /> */}

      {/* ─── 03 — STORIES (inline Drafting-Room Testimonials) ─────────────── */}
      <TestimonialsBlock />

      {/* ─── CTA ───────────────────────────────────────────────────────────── */}
      <CTABlock onStart={() => handleStartNav("/canvas")} />

      {/* ─── COLOPHON / FOOTER (inline Drafting-Room Footer) ──────────────── */}
      <FooterBlock />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS

function TopBar() {
  // Mobile nav (< md): Features/Stories/Canvas/Log in collapse behind a
  // hamburger — the plain `hidden md:flex` nav had no mobile equivalent,
  // so those links were completely unreachable on small screens.
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header
      className="d5-mono sticky top-0 z-50 border-b"
      style={{ background: T.paper, borderColor: T.rule }}
    >
      <div className="flex items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-3">
          <Mark size={22} color={T.graphite} />
          <span
            className="text-[14px] tracking-[0.18em] uppercase"
            style={{ color: T.graphite }}
          >
            CodeCanvas
          </span>
          <span
            className="hidden sm:inline text-[13px] tracking-[0.16em] uppercase"
            style={{ color: T.muted }}
          >
            / DRAFTING ROOM
          </span>
        </Link>
        <nav
          className="hidden items-center gap-6 text-[13px] tracking-[0.16em] uppercase md:flex"
          style={{ color: T.graphite }}
        >
          <Link href="#features">Features</Link>
          <Link href="#stories">Stories</Link>
          <Link href="/canvas">Canvas</Link>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/auth/login"
            className="hidden md:inline-block d5-mono text-[13px] tracking-[0.16em] uppercase px-3 py-2"
            style={{ color: T.muted }}
          >
            Log in
          </Link>
          <Link
            href="/auth/signup"
            className="d5-btn d5-btn-primary"
            style={{ padding: "8px 16px", fontSize: 13, minHeight: 44 }}
          >
            Get Started →
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="md:hidden inline-flex items-center justify-center border"
            style={{
              minWidth: 44,
              minHeight: 44,
              borderColor: T.rule,
              color: T.graphite,
              background: T.paper,
            }}
          >
            {menuOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          className="md:hidden flex flex-col border-t text-[11px] tracking-[0.16em] uppercase"
          style={{ borderColor: T.rule, background: T.paper }}
        >
          {[
            { label: "Features", href: "#features" },
            { label: "Stories", href: "#stories" },
            { label: "Canvas", href: "/canvas" },
            { label: "Log in", href: "/auth/login" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="flex items-center border-b px-6"
              style={{ borderColor: T.rule, color: T.graphite, minHeight: 44 }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

function HeroStatusBar({ strokes }: { strokes: number }) {
  const [time, setTime] = useState("--:--:--");
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const fmt = (n: number) => n.toString().padStart(2, "0");
      setTime(
        `${fmt(d.getHours())}:${fmt(d.getMinutes())}:${fmt(d.getSeconds())}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div
      className="d5-mono relative border-t flex items-center justify-between gap-3 px-4 py-2 text-[13px] tracking-[0.14em] uppercase sm:px-6"
      style={{ borderColor: T.rule, background: T.paper, color: T.muted }}
    >
      {/* 7 badges in one unwrapping flex row overflowed past 320-414px
          viewports (no wrap, no scroll). Only the always-relevant status +
          clock stay visible on phones; the rest reappear at sm/md where
          there's room. */}
      <div className="flex items-center gap-3 sm:gap-5">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-1.5 h-1.5"
            style={{ background: T.cobalt }}
          />
          {strokes > 0 ? "DRAFTING" : "IDLE"}
        </span>
        <span className="hidden sm:inline">ZOOM 100%</span>
        <span className="hidden md:inline">GRID 16PX</span>
        <span className="hidden md:inline">SNAP ON</span>
      </div>
      <div className="flex items-center gap-3 sm:gap-5">
        <span className="hidden md:inline">GEMINI 2.5 · WARM</span>
        <span className="hidden sm:inline">ROBOFLOW v4</span>
        <span style={{ color: T.graphite }}>{time}</span>
      </div>
    </div>
  );
}

function SectionHeader({
  index,
  title,
  caption,
}: {
  index: string;
  title: string;
  caption: string;
}) {
  return (
    <div
      className="flex items-baseline justify-between border-b pb-5 mb-12"
      style={{ borderColor: T.rule }}
    >
      <div className="flex items-baseline gap-6">
        <span
          className="d5-mono text-[13px] tracking-[0.2em]"
          style={{ color: T.cobalt }}
        >
          {index}
        </span>
        <h2
          className="d5-serif"
          style={{
            fontSize: "clamp(36px, 8vw, 56px)",
            lineHeight: 1,
            letterSpacing: "-0.025em",
            fontWeight: 400,
          }}
        >
          {title}
        </h2>
      </div>
      <span
        className="d5-mono text-[13px] tracking-[0.14em] uppercase hidden sm:inline"
        style={{ color: T.muted }}
      >
        {caption}
      </span>
    </div>
  );
}

function SeeInAction() {
  return (
    <section className="border-b" style={{ borderColor: T.rule }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-24">
        <SectionHeader
          index="01"
          title="See it in action"
          caption="Sketch → detect → generate · ≈1.2s"
        />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative d5-reg mx-auto max-w-5xl"
          style={{ border: `1px solid ${T.rule}`, background: T.vellum }}
        >
          {/* title block bar */}
          <div
            className="d5-mono flex items-center justify-between border-b px-4 py-2.5 text-[13px] tracking-[0.16em] uppercase"
            style={{ borderColor: T.rule, color: T.muted, background: T.paper }}
          >
            <span style={{ color: T.graphite }}>demo-video.mp4</span>
            <span className="flex items-center gap-3">
              <span>1920 × 1080</span>
              <Cross size={8} />
              <span style={{ color: T.cobalt }}>● PLAYING</span>
            </span>
          </div>
          {/* video well */}
          <div className="p-3">
            <video
              className="w-full"
              autoPlay
              loop
              muted
              playsInline
              style={{ display: "block" }}
            >
              <source
                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/demo-video.mp4`}
                type="video/mp4"
              />
              Your browser does not support the video tag.
            </video>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function WhyCodeCanvas() {
  const features = [
    {
      title: "Natural sketching",
      desc: "Draw components just like on paper. The model reads your intent.",
    },
    {
      title: "Smart recognition",
      desc: "Detects buttons, inputs, and layouts and converts them to clean code.",
    },
    {
      title: "Live preview",
      desc: "Your design comes to life with real-time code generation.",
    },
    {
      title: "Natural language",
      desc: "Describe interactions and behavior; the logic is generated for you.",
    },
    {
      title: "Export ready",
      desc: "Download code with proper structure and sensible defaults.",
    },
    {
      title: "Style freedom",
      desc: "Choose your framework, styling approach, and coding patterns.",
    },
  ];
  return (
    <section id="features" className="border-b" style={{ borderColor: T.rule }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-24">
        <SectionHeader
          index="02"
          title="Why CodeCanvas"
          caption="Hairline-first. Cobalt as interaction ink."
        />
        <div
          className="grid gap-px sm:grid-cols-2 lg:grid-cols-3"
          style={{ background: T.rule }}
        >
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: 0.5,
                delay: i * 0.05,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="p-8 transition-colors hover:bg-[var(--d5-vellum)]"
              style={{ background: T.paper }}
            >
              <div className="flex items-start justify-between mb-6">
                <span
                  className="d5-mono text-[13px] tracking-[0.2em]"
                  style={{ color: T.cobalt }}
                >
                  0{i + 1}
                </span>
                <Cross size={8} />
              </div>
              <h3
                className="d5-serif mb-3"
                style={{
                  fontSize: 28,
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                  fontWeight: 400,
                }}
              >
                {f.title}
              </h3>
              <p
                className="text-[14px] leading-[1.55]"
                style={{ color: T.muted }}
              >
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsBlock() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(
      () => setI((v) => (v + 1) % TESTIMONIALS.length),
      5000
    );
    return () => clearInterval(t);
  }, [auto]);
  const t = TESTIMONIALS[i];
  return (
    <section id="stories" className="border-b" style={{ borderColor: T.rule }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-24">
        <SectionHeader
          index="03"
          title="Stories from the workshop"
          caption={`${TESTIMONIALS.length} VOICES · DESIGNERS & DEVELOPERS`}
        />

        <div className="grid gap-12 lg:grid-cols-12 items-start">
          {/* big quote */}
          <div className="lg:col-span-9">
            <motion.blockquote
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="d5-serif"
              style={{
                fontSize: "clamp(28px, 4vw, 56px)",
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
                fontWeight: 400,
              }}
            >
              <span style={{ color: T.cobalt }}>“</span>
              {t.quote}
              <span style={{ color: T.cobalt }}>”</span>
            </motion.blockquote>

            <motion.div
              key={`m-${i}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="d5-mono mt-8 flex items-center gap-4 text-[13px] tracking-[0.18em] uppercase"
              style={{ color: T.muted }}
            >
              <span
                className="inline-flex h-9 w-9 items-center justify-center border text-[13px]"
                style={{
                  borderColor: T.rule,
                  color: T.graphite,
                  background: T.paper,
                }}
              >
                {t.avatar}
              </span>
              <span style={{ color: T.graphite }}>{t.name}</span>
              <span>·</span>
              <span>{t.role}</span>
              <span>·</span>
              <span>{t.company}</span>
            </motion.div>
          </div>

          {/* index column */}
          <div className="lg:col-span-3">
            <div
              className="d5-mono text-[13px] tracking-[0.18em] uppercase mb-3"
              style={{ color: T.muted }}
            >
              INDEX
            </div>
            <div className="space-y-2">
              {TESTIMONIALS.map((tx, idx) => (
                <button
                  key={tx.name}
                  onClick={() => {
                    setI(idx);
                    setAuto(false);
                  }}
                  className="d5-mono w-full text-left text-[13px] tracking-[0.14em] uppercase flex items-center justify-between py-1.5 border-b transition-colors"
                  style={{
                    borderColor: idx === i ? T.cobalt : T.tick,
                    color: idx === i ? T.graphite : T.muted,
                  }}
                >
                  <span>
                    {(idx + 1).toString().padStart(2, "0")} ·{" "}
                    {tx.name.split(" ")[0]}
                  </span>
                  <span>{tx.company}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTABlock({ onStart }: { onStart: () => void }) {
  return (
    <section
      className="relative border-b"
      style={{ background: T.graphite, color: T.paper, borderColor: T.rule }}
    >
      {/* fine grid on dark section — paper-colored lines at low opacity
          so it survives laptop displays. The global d5-grid-fine uses tick
          color which is invisible on graphite. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(242,241,236,0.07) 1px, transparent 1px)," +
            "linear-gradient(to bottom, rgba(242,241,236,0.07) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="relative mx-auto max-w-5xl px-6 lg:px-10 py-28 text-center">
        <div
          className="d5-mono inline-flex items-center gap-2 text-[13px] tracking-[0.18em] uppercase border px-3 py-1.5 mb-10"
          style={{
            borderColor: "rgba(242,241,236,0.3)",
            color: T.paper,
            background: T.graphite,
          }}
        >
          <span
            className="inline-block w-1.5 h-1.5"
            style={{ background: T.cobalt }}
          />
          READY WHEN YOU ARE
        </div>
        <h2
          className="d5-serif"
          style={{
            fontSize: "clamp(48px, 7vw, 96px)",
            lineHeight: 0.95,
            letterSpacing: "-0.03em",
            fontWeight: 400,
            color: T.paper,
          }}
        >
          Ready to build <em style={{ color: T.cobalt }}>faster?</em>
        </h2>
        <p
          className="d5-serif mx-auto mt-6 max-w-xl text-[18px]"
          style={{ color: "rgba(242,241,236,0.7)", fontStyle: "italic" }}
        >
          Start sketching your next project today. No credit card required.
        </p>
        <div className="mt-12 flex items-center justify-center gap-3">
          <button onClick={onStart} className="d5-btn d5-btn-on-graphite">
            Get Started Free <span>→</span>
          </button>
          <Link href="#features" className="d5-btn d5-btn-ghost-on-graphite">
            See Features
          </Link>
        </div>
      </div>
    </section>
  );
}

function FooterBlock() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    setSubscribed(true);
    setEmail("");
    setTimeout(() => setSubscribed(false), 3000);
  };
  const year = new Date().getFullYear();
  return (
    <footer style={{ background: T.paper }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-20">
        <div className="grid gap-12 lg:grid-cols-12">
          {/* brand + newsletter */}
          <div className="lg:col-span-4">
            <Link href="/" className="flex items-center gap-3 mb-6">
              <Mark size={28} color={T.graphite} />
              <span
                className="d5-mono text-[14px] tracking-[0.18em] uppercase"
                style={{ color: T.graphite }}
              >
                CodeCanvas
              </span>
            </Link>
            <p
              className="text-[14px] leading-[1.6] mb-8 max-w-sm"
              style={{ color: T.muted }}
            >
              The workshop where rough wireframes become production-ready React.
              Drawn by you, drafted by the room.
            </p>

            <div
              className="d5-mono text-[13px] tracking-[0.18em] uppercase mb-2"
              style={{ color: T.muted }}
            >
              Newsletter
            </div>
            <form onSubmit={handleSubscribe} className="flex items-end gap-2">
              <input
                type="email"
                required
                aria-label="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@studio.com"
                className="d5-input flex-1"
              />
              <button
                type="submit"
                disabled={subscribed}
                aria-label={
                  subscribed ? "Subscribed" : "Subscribe to newsletter"
                }
                className="d5-btn"
                style={{ padding: "8px 14px", fontSize: 13 }}
              >
                {subscribed ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </form>

            <div className="mt-8 flex gap-2">
              {[
                {
                  Icon: Instagram,
                  href: "https://instagram.com/trycodecanvas",
                  label: "Instagram",
                },
                {
                  Icon: Twitter,
                  href: "https://x.com/TryCodeCanvas",
                  label: "X",
                },
                {
                  Icon: Github,
                  href: "https://github.com/trycodecanvas",
                  label: "GitHub",
                },
                {
                  Icon: Mail,
                  href: "mailto:hassaniftikhardev@gmail.com",
                  label: "Email",
                },
              ].map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="d5-social flex h-9 w-9 items-center justify-center border transition-colors"
                  style={{ borderColor: T.rule }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* link columns */}
          <div className="grid grid-cols-2 gap-8 lg:col-span-8">
            {FOOTER_COLS.map((col) => (
              <div key={col.title}>
                <div
                  className="d5-mono text-[13px] tracking-[0.2em] uppercase mb-4 pb-2 border-b"
                  style={{ borderColor: T.rule, color: T.graphite }}
                >
                  {col.title}
                </div>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-[14px] transition-colors hover:text-[var(--d5-cobalt)]"
                        style={{ color: T.muted }}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* copyright row — single line, full width, no colophon */}
        <div
          className="d5-mono mt-16 pt-6 border-t flex flex-col items-start justify-between gap-2 text-[13px] tracking-[0.14em] uppercase sm:flex-row sm:items-center"
          style={{ borderColor: T.rule, color: T.muted }}
        >
          <span style={{ color: T.graphite }}>© {year} CodeCanvas</span>
          <span>All rights reserved · Built for makers</span>
        </div>
      </div>
    </footer>
  );
}
