"use client";

/**
 * /design-preview-v2 — "Drafting Room"
 *
 * A single-file, fully self-contained UI direction showcase.
 * - Strict monochrome base + cobalt (#4A4B8C) as process-blue interaction ink
 * - Hairline grids, registration marks, mono telemetry, editorial serif moments
 * - Zero gradients, zero AI tropes, sharp corners, instrument-grade typography
 *
 * Not a component file. Not wired to global theme. Self-contained on purpose.
 */

import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import { useEffect, useRef, useState } from "react";

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

// ─────────────────────────────────────────────────────────────────────────────
// Token sets — light is the primary, dark is the same brand under different ink

const LIGHT = {
  paper: "#FAFAF7",
  vellum: "#F2F1EC",
  tick: "#989894", // 2.85:1 contrast — robust on uncalibrated external displays
  rule: "#1A1A1C",
  graphite: "#0E0E0F",
  cobalt: "#4A4B8C",
  cobaltInk: "#2D2E5C",
  cobaltWash: "#E8E8F1",
  muted: "#6B6B6E",
};

const DARK = {
  paper: "#0A0A0B",
  vellum: "#131316",
  tick: "#2A2A2D",
  rule: "#F2F1EC",
  graphite: "#F2F1EC",
  cobalt: "#8C8DD4",
  cobaltInk: "#B7B8E5",
  cobaltWash: "#232347",
  muted: "#86868A",
};

type Tokens = typeof LIGHT;

// ─────────────────────────────────────────────────────────────────────────────
// Page

export default function DesignPreviewV2() {
  return (
    <div className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <style jsx global>{`
        :root {
          --d5-paper: ${LIGHT.paper};
          --d5-vellum: ${LIGHT.vellum};
          --d5-tick: ${LIGHT.tick};
          --d5-rule: ${LIGHT.rule};
          --d5-graphite: ${LIGHT.graphite};
          --d5-cobalt: ${LIGHT.cobalt};
          --d5-cobalt-ink: ${LIGHT.cobaltInk};
          --d5-cobalt-wash: ${LIGHT.cobaltWash};
          --d5-muted: ${LIGHT.muted};
        }
        .d5-root {
          background: var(--d5-paper);
          color: var(--d5-graphite);
          font-family: var(--d5-sans), ui-sans-serif, system-ui, sans-serif;
          font-feature-settings: "ss01", "cv11";
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
        /* italic right side bearing eats trailing space — give every em explicit gap.
           Trailing-em case (e.g. ".become *code.*") gets an extra 0.18em at line end —
           invisible because it's at the end of line/block. */
        .d5-serif em {
          margin-right: 0.22em;
        }
        /* graph grid — coarse line 1.5px so sub-pixel rendering doesn't kill it
           on uncalibrated external monitors. Fine 1px stays subtle. */
        .d5-grid {
          background-image:
            linear-gradient(to right, var(--d5-tick) 1.5px, transparent 1.5px),
            linear-gradient(to bottom, var(--d5-tick) 1.5px, transparent 1.5px);
          background-size: 32px 32px;
        }
        .d5-grid-fine {
          background-image:
            linear-gradient(to right, var(--d5-tick) 1px, transparent 1px),
            linear-gradient(to bottom, var(--d5-tick) 1px, transparent 1px);
          background-size: 8px 8px;
          opacity: 0.4;
        }
        /* draftsman dashed rules */
        .d5-rule-h {
          background-image: linear-gradient(
            to right,
            var(--d5-rule) 0 4px,
            transparent 4px 10px
          );
          background-size: 10px 1px;
          background-repeat: repeat-x;
        }
        /* hairline */
        .d5-hair {
          border-color: var(--d5-rule);
        }
        /* corner registration marks */
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
        /* mono micro-label */
        .d5-tag {
          font-family: var(--d5-mono), ui-monospace, monospace;
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--d5-muted);
        }
        /* draftsman input */
        .d5-input {
          background: transparent;
          border: 0;
          border-bottom: 1px solid var(--d5-rule);
          padding: 6px 0;
          font-family: var(--d5-sans);
          color: var(--d5-graphite);
          outline: none;
          width: 100%;
          font-size: 14px;
        }
        .d5-input:focus {
          border-bottom-color: var(--d5-cobalt);
        }
        /* draftsman button */
        .d5-btn {
          font-family: var(--d5-mono);
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          padding: 10px 18px;
          border: 1px solid var(--d5-rule);
          background: transparent;
          color: var(--d5-graphite);
          transition:
            background 120ms cubic-bezier(0.2, 0.7, 0.1, 1),
            color 120ms cubic-bezier(0.2, 0.7, 0.1, 1),
            border-color 120ms cubic-bezier(0.2, 0.7, 0.1, 1);
          cursor: pointer;
          position: relative;
        }
        .d5-btn:hover {
          background: var(--d5-graphite);
          color: var(--d5-paper);
        }
        .d5-btn:active {
          background: var(--d5-cobalt-ink);
          color: var(--d5-paper);
          border-color: var(--d5-cobalt-ink);
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
        .d5-btn-ghost {
          border-color: transparent;
        }
        .d5-btn-ghost:hover {
          background: var(--d5-vellum);
          color: var(--d5-graphite);
          border-color: var(--d5-vellum);
        }
        /* selection */
        .d5-root *::selection {
          background: var(--d5-cobalt-wash);
          color: var(--d5-cobalt-ink);
        }
        /* keyframes */
        @keyframes d5-draw {
          to {
            stroke-dashoffset: 0;
          }
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
        @keyframes d5-compass-spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes d5-num-roll {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(-90%);
          }
        }
        @keyframes d5-marquee {
          to {
            transform: translateX(-50%);
          }
        }
      `}</style>

      <main className="d5-root min-h-screen">
        <TopBar />
        <Hero />
        <Section index="01" title="Palette" caption="Two inks. One process.">
          <PaletteBlock />
        </Section>
        <Section
          index="02"
          title="Typography"
          caption="Editorial · Sans · Mono. Nothing else."
        >
          <TypographyBlock />
        </Section>
        <Section
          index="03"
          title="Workspace"
          caption="Sketch panel + code well. Telemetry in mono, content in plate."
        >
          <WorkspaceBlock />
        </Section>
        <Section
          index="04"
          title="Components"
          caption="Hairline-first. Cobalt as interaction ink."
        >
          <ComponentsBlock />
        </Section>
        <Section
          index="05"
          title="Motion"
          caption="Mechanical, not bouncy. 120–400ms."
        >
          <MotionBlock />
        </Section>
        <Section
          index="06"
          title="Dark Mode"
          caption="Same brand, ink inverted. No second palette."
        >
          <DarkModeBlock />
        </Section>
        <Colophon />
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top Bar — title block at the top of every drafting sheet

function TopBar() {
  return (
    <header
      className="d5-mono sticky top-0 z-50 flex items-center justify-between border-b px-6 py-3"
      style={{ background: "var(--d5-paper)", borderColor: "var(--d5-rule)" }}
    >
      <div className="flex items-center gap-3">
        <Mark size={20} color="var(--d5-graphite)" />
        <span className="text-[13px] tracking-[0.18em] uppercase">
          CodeCanvas
        </span>
        <span className="text-[10px]" style={{ color: "var(--d5-muted)" }}>
          / DRAFTING ROOM v0.1
        </span>
      </div>
      <nav className="flex items-center gap-6 text-[11px] tracking-[0.16em] uppercase">
        <a href="#palette">Palette</a>
        <a href="#typography">Type</a>
        <a href="#workspace">Workspace</a>
        <a href="#components">Components</a>
        <a href="#motion">Motion</a>
      </nav>
      <div
        className="flex items-center gap-2 text-[10px]"
        style={{ color: "var(--d5-muted)" }}
      >
        <Cross size={8} />
        <span>SHEET 01 / 09</span>
        <span>·</span>
        <span>REV 2026-06-11</span>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO

function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [coord, setCoord] = useState({ x: 0, y: 0, active: false });

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${x}px, ${y}px)`;
      }
      setCoord({ x: Math.round(x), y: Math.round(y), active: true });
    };
    const onLeave = () => setCoord((c) => ({ ...c, active: false }));
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative overflow-hidden border-b"
      style={{ borderColor: "var(--d5-rule)", cursor: "none" }}
    >
      {/* fine graph grid */}
      <div className="absolute inset-0 d5-grid-fine pointer-events-none" />
      {/* coarse 32px grid */}
      <div className="absolute inset-0 d5-grid opacity-60 pointer-events-none" />
      {/* horizontal margin rules — silent, no labels (labels collided with slug + status bar) */}
      <div
        className="absolute left-0 right-0 d5-rule-h h-px pointer-events-none"
        style={{ top: 56, opacity: 0.35 }}
      />
      <div
        className="absolute left-0 right-0 d5-rule-h h-px pointer-events-none"
        style={{ bottom: 56, opacity: 0.35 }}
      />

      <div className="relative px-10 pt-20 pb-28 max-w-[1400px] mx-auto">
        {/* slug + counter row */}
        <div
          className="d5-mono flex items-center justify-between mb-12 text-[10px] tracking-[0.16em] uppercase"
          style={{ color: "var(--d5-muted)" }}
        >
          <span>FIG. 01 / DRAFT — TOOL VIEW</span>
          <span className="flex items-center gap-2">
            <Cross size={8} />
            x: {coord.active
              ? coord.x.toString().padStart(4, "0")
              : "—— "} y:{" "}
            {coord.active ? coord.y.toString().padStart(4, "0") : "—— "}
          </span>
        </div>

        {/* MASSIVE EDITORIAL HEADLINE */}
        <h1
          className="d5-serif"
          style={{
            fontSize: "clamp(72px, 11vw, 188px)",
            lineHeight: 0.9,
            letterSpacing: "-0.03em",
            color: "var(--d5-graphite)",
            fontWeight: 400,
          }}
        >
          <span className="block">Sketches</span>
          <span className="block" style={{ marginLeft: "0.4em" }}>
            become{" "}
            <em
              style={{
                color: "var(--d5-cobalt)",
                fontStyle: "italic",
              }}
            >
              code.
            </em>
          </span>
        </h1>

        {/* mono sub-line + cta */}
        <div className="mt-16 flex items-end justify-between gap-12 flex-wrap">
          <div className="max-w-xl">
            <p
              className="text-[18px] leading-[1.5]"
              style={{ color: "var(--d5-graphite)" }}
            >
              CodeCanvas is the workshop where rough wireframes are turned into
              production-ready React. Drawn by you, drafted by the room.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <button className="d5-btn d5-btn-primary">
                Open the canvas →
              </button>
              <button className="d5-btn">Watch demo</button>
            </div>
          </div>

          {/* spec block — looks like a drafting title block */}
          <SpecBlock />
        </div>
      </div>

      {/* status bar — telemetry style */}
      <StatusBar />

      {/* cobalt scan tick that traverses the hero */}
      <div className="absolute left-0 bottom-0 w-full h-px pointer-events-none overflow-hidden">
        <div
          className="absolute h-px"
          style={{
            width: "120px",
            background: "var(--d5-cobalt)",
            boxShadow: "0 0 0 0 transparent",
            animation: "d5-tick-sweep 8s linear infinite",
          }}
        />
      </div>

      {/* registration crosshair cursor */}
      <div
        ref={cursorRef}
        className="pointer-events-none absolute top-0 left-0"
        style={{
          width: 0,
          height: 0,
          mixBlendMode: "difference",
          opacity: coord.active ? 1 : 0,
          transition: "opacity 120ms linear",
        }}
      >
        <Crosshair />
      </div>
    </section>
  );
}

function SpecBlock() {
  const rows: [string, string][] = [
    ["FORMAT", "WEB / 1440×900"],
    ["MEDIUM", "REACT 19 · TAILWIND 4"],
    ["INK", "GRAPHITE #0E0E0F"],
    ["MARK", "COBALT #4A4B8C"],
    ["SCALE", "1 : 1"],
    ["REV", "2026-06-11"],
  ];
  return (
    <div
      className="relative d5-reg"
      style={{
        background: "var(--d5-paper)",
        border: "1px solid var(--d5-rule)",
        padding: "20px 24px",
        minWidth: 320,
      }}
    >
      <div
        className="d5-mono text-[10px] tracking-[0.18em] uppercase mb-3 pb-2 border-b"
        style={{
          borderColor: "var(--d5-rule)",
          color: "var(--d5-graphite)",
        }}
      >
        SHEET INFO
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 d5-mono text-[11px]">
        {rows.map(([k, v]) => (
          <div
            key={k}
            className="flex items-center justify-between gap-3 col-span-2"
          >
            <span style={{ color: "var(--d5-muted)" }}>{k}</span>
            <span style={{ color: "var(--d5-graphite)" }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBar() {
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
      className="d5-mono relative border-t flex items-center justify-between px-6 py-2 text-[10px] tracking-[0.14em] uppercase"
      style={{
        borderColor: "var(--d5-rule)",
        background: "var(--d5-paper)",
        color: "var(--d5-muted)",
      }}
    >
      <div className="flex items-center gap-6">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-1.5 h-1.5"
            style={{ background: "var(--d5-cobalt)" }}
          />
          IDLE
        </span>
        <span>ZOOM 100%</span>
        <span>GRID 32px</span>
        <span>SNAP ON</span>
      </div>
      <div className="flex items-center gap-6">
        <span>GEMINI 2.5 · WARM</span>
        <span>ROBOFLOW v2</span>
        <span>{time}</span>
      </div>
    </div>
  );
}

function Crosshair() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      style={{
        transform: "translate(-50%, -50%)",
        color: "var(--d5-cobalt)",
      }}
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
  );
}

function Cross({ size = 8 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8">
      <line x1="0" y1="4" x2="8" y2="4" stroke="currentColor" />
      <line x1="4" y1="0" x2="4" y2="8" stroke="currentColor" />
    </svg>
  );
}

function Mark({
  size = 28,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) {
  // The CodeCanvas 'C' — three rounded slabs, but with sharper feel for drafting
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} fill={color}>
      <rect x="48" y="12" width="140" height="40" rx="4" />
      <rect x="12" y="56" width="40" height="88" rx="4" />
      <rect x="48" y="148" width="140" height="40" rx="4" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic Section wrapper

function Section({
  index,
  title,
  caption,
  children,
}: {
  index: string;
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={title.toLowerCase().replace(/\s/g, "-")}
      className="relative border-b"
      style={{ borderColor: "var(--d5-rule)", scrollMarginTop: 56 }}
    >
      <div className="max-w-[1400px] mx-auto px-10 py-24">
        <div className="flex items-baseline justify-between border-b pb-5 mb-12 d5-hair">
          <div className="flex items-baseline gap-6">
            <span
              className="d5-mono text-[12px] tracking-[0.2em]"
              style={{ color: "var(--d5-cobalt)" }}
            >
              {index}
            </span>
            <h2
              className="d5-serif"
              style={{
                fontSize: 56,
                lineHeight: 1,
                letterSpacing: "-0.025em",
                fontWeight: 400,
              }}
            >
              {title}
            </h2>
          </div>
          <span
            className="d5-mono text-[11px] tracking-[0.14em] uppercase"
            style={{ color: "var(--d5-muted)" }}
          >
            {caption}
          </span>
        </div>
        {children}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 01 — PALETTE

function PaletteBlock() {
  const swatches: Array<{
    name: string;
    hex: string;
    role: string;
    fg?: string;
  }> = [
    { name: "Paper", hex: LIGHT.paper, role: "Primary surface" },
    { name: "Vellum", hex: LIGHT.vellum, role: "Secondary surface" },
    { name: "Tick", hex: LIGHT.tick, role: "Graph + dividers" },
    { name: "Rule", hex: LIGHT.rule, role: "Hairlines", fg: LIGHT.paper },
    {
      name: "Graphite",
      hex: LIGHT.graphite,
      role: "Type + ink",
      fg: LIGHT.paper,
    },
    {
      name: "Cobalt",
      hex: LIGHT.cobalt,
      role: "Interaction · Mark",
      fg: LIGHT.paper,
    },
    {
      name: "Cobalt Ink",
      hex: LIGHT.cobaltInk,
      role: "Pressed · active",
      fg: LIGHT.paper,
    },
    { name: "Cobalt Wash", hex: LIGHT.cobaltWash, role: "Selection bg" },
  ];

  return (
    <div
      className="grid grid-cols-4 gap-px"
      style={{ background: "var(--d5-rule)" }}
    >
      {swatches.map((s) => (
        <div
          key={s.name}
          className="relative aspect-square p-5 flex flex-col justify-between"
          style={{ background: s.hex, color: s.fg ?? LIGHT.graphite }}
        >
          <div className="flex items-start justify-between">
            <span className="d5-mono text-[10px] tracking-[0.16em] uppercase opacity-60">
              {s.role}
            </span>
            <Cross size={8} />
          </div>
          <div>
            <div
              className="d5-serif"
              style={{ fontSize: 36, lineHeight: 1, letterSpacing: "-0.02em" }}
            >
              {s.name}
            </div>
            <div className="d5-mono text-[11px] mt-1 tracking-[0.12em]">
              {s.hex.toUpperCase()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 02 — TYPOGRAPHY

function TypographyBlock() {
  return (
    <div className="grid grid-cols-12 gap-x-8 gap-y-12">
      {/* Display serif */}
      <div className="col-span-12 grid grid-cols-12 gap-x-8 items-end border-b d5-hair pb-10">
        <div
          className="col-span-2 d5-mono text-[10px] tracking-[0.16em] uppercase"
          style={{ color: "var(--d5-muted)" }}
        >
          DISPLAY / SERIF
          <div className="mt-1" style={{ color: "var(--d5-graphite)" }}>
            INSTRUMENT SERIF · 400
          </div>
          <div className="mt-1">96 / 120 / 188</div>
        </div>
        <div
          className="col-span-10 d5-serif"
          style={{ fontSize: 120, lineHeight: 1, letterSpacing: "-0.03em" }}
        >
          Drawn by you, <em style={{ color: "var(--d5-cobalt)" }}>drafted</em>{" "}
          by the room.
        </div>
      </div>

      {/* Sans body */}
      <div className="col-span-12 grid grid-cols-12 gap-x-8 items-start border-b d5-hair pb-10">
        <div
          className="col-span-2 d5-mono text-[10px] tracking-[0.16em] uppercase"
          style={{ color: "var(--d5-muted)" }}
        >
          BODY / SANS
          <div className="mt-1" style={{ color: "var(--d5-graphite)" }}>
            INTER · 400 / 500 / 600
          </div>
          <div className="mt-1">14 / 16 / 18</div>
        </div>
        <div className="col-span-10 space-y-3 max-w-3xl">
          <p style={{ fontSize: 18, lineHeight: 1.55 }}>
            CodeCanvas is the workshop where rough wireframes are turned into
            production-ready React. Drawn by you, drafted by the room. Every
            stroke gets a coordinate, every coordinate gets a component.
          </p>
          <p
            style={{ fontSize: 16, lineHeight: 1.6, color: "var(--d5-muted)" }}
          >
            Body copy is set in Inter at 16/24 by default, 14/20 for dense
            telemetry rows, 18/28 for hero descriptions. Weight discipline: 400
            for prose, 500 for UI labels, 600 only for headings and buttons.
          </p>
        </div>
      </div>

      {/* Mono technical */}
      <div className="col-span-12 grid grid-cols-12 gap-x-8 items-start">
        <div
          className="col-span-2 d5-mono text-[10px] tracking-[0.16em] uppercase"
          style={{ color: "var(--d5-muted)" }}
        >
          TECHNICAL / MONO
          <div className="mt-1" style={{ color: "var(--d5-graphite)" }}>
            JETBRAINS MONO · 400 / 500
          </div>
          <div className="mt-1">10 / 11 / 13</div>
        </div>
        <div className="col-span-10 d5-mono space-y-2.5 max-w-3xl">
          <div className="text-[13px]" style={{ color: "var(--d5-graphite)" }}>
            const sketch = await canvas.export({"{"} format: "png", scale: 2{" "}
            {"}"});
          </div>
          <div
            className="text-[11px] tracking-[0.12em] uppercase"
            style={{ color: "var(--d5-graphite)" }}
          >
            ROBOFLOW DETECTION · CONFIDENCE 0.93 · CARD ×6 · SECTION ×2
          </div>
          <div
            className="text-[10px] tracking-[0.16em] uppercase"
            style={{ color: "var(--d5-muted)" }}
          >
            STATUS · SHEET 01 / 09 · REV 2026-06-11 · GEMINI 2.5
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 03 — WORKSPACE (product surface, not a how-it-works diagram)

function WorkspaceBlock() {
  return (
    <div
      className="relative d5-reg"
      style={{
        border: "1px solid var(--d5-rule)",
        background: "var(--d5-vellum)",
      }}
    >
      {/* title block bar */}
      <div
        className="d5-mono flex items-center justify-between px-4 py-2 border-b text-[10px] tracking-[0.16em] uppercase"
        style={{
          borderColor: "var(--d5-rule)",
          color: "var(--d5-muted)",
          background: "var(--d5-paper)",
        }}
      >
        <div className="flex items-center gap-4">
          <span style={{ color: "var(--d5-graphite)" }}>UNTITLED PROJECT</span>
          <span>· ITER 12</span>
          <span>· EDITED 2 MIN AGO</span>
        </div>
        <div className="flex items-center gap-3">
          <span>1440 × 900</span>
          <Cross size={8} />
          <span style={{ color: "var(--d5-cobalt)" }}>● SAVED</span>
        </div>
      </div>

      {/* two-panel workspace */}
      <div
        className="grid grid-cols-2 d5-hair"
        style={{ borderColor: "var(--d5-rule)" }}
      >
        {/* left — canvas / sketch */}
        <div
          className="relative border-r p-8"
          style={{
            borderColor: "var(--d5-rule)",
            background: "var(--d5-paper)",
            minHeight: 520,
          }}
        >
          <div className="d5-grid-fine absolute inset-0 opacity-50 pointer-events-none" />
          <div className="d5-grid absolute inset-0 opacity-50 pointer-events-none" />

          {/* labelled bounding boxes — pure wireframe study */}
          <SketchStudy />

          {/* bottom-left mono label */}
          <div
            className="absolute bottom-3 left-4 d5-mono text-[9px] tracking-[0.18em] uppercase"
            style={{ color: "var(--d5-muted)" }}
          >
            CANVAS / 6 ELEMENTS / SNAP ON
          </div>
          <div
            className="absolute bottom-3 right-4 d5-mono text-[9px] tracking-[0.18em] uppercase"
            style={{ color: "var(--d5-muted)" }}
          >
            ZOOM 100%
          </div>
        </div>

        {/* right — code well */}
        <div
          className="relative p-6"
          style={{ background: "var(--d5-graphite)", minHeight: 520 }}
        >
          <CodeWell />
        </div>
      </div>

      {/* bottom command rail */}
      <div
        className="d5-mono flex items-center justify-between px-4 py-2 border-t text-[10px] tracking-[0.14em] uppercase"
        style={{
          borderColor: "var(--d5-rule)",
          background: "var(--d5-paper)",
          color: "var(--d5-muted)",
        }}
      >
        <div className="flex items-center gap-5">
          <span>
            <kbd className="d5-kbd">⌘ K</kbd> commands
          </span>
          <span>
            <kbd className="d5-kbd">⌘ S</kbd> save
          </span>
          <span>
            <kbd className="d5-kbd">⌘ ↵</kbd> generate
          </span>
        </div>
        <div className="flex items-center gap-5">
          <span style={{ color: "var(--d5-graphite)" }}>GEMINI 2.5 · 1.2s</span>
          <span
            className="inline-block w-1.5 h-1.5"
            style={{ background: "var(--d5-cobalt)" }}
          />
        </div>
      </div>

      <style jsx>{`
        .d5-kbd {
          font-family: var(--d5-mono);
          padding: 1px 5px;
          border: 1px solid var(--d5-rule);
          margin-right: 4px;
          color: var(--d5-graphite);
          background: var(--d5-paper);
        }
      `}</style>
    </div>
  );
}

function SketchStudy() {
  /**
   * Bounding boxes representing detected UI components.
   * Precise (not hand-drawn) — the system has measured your sketch.
   * Dimensions only shown on variable widths (engineering drawing convention).
   */
  return (
    <div className="relative w-full h-full" style={{ minHeight: 420 }}>
      <svg
        viewBox="0 0 600 420"
        className="absolute inset-0 w-full h-full"
        style={{ color: "var(--d5-graphite)" }}
      >
        <Box x={30} y={30} w={540} h={42} label="NAVBAR" />
        <Box x={30} y={100} w={240} h={120} label="CARD" showDim />
        <Box x={290} y={100} w={280} h={120} label="CARD" showDim />
        <Box x={30} y={250} w={540} h={100} label="SECTION" />
        <Box x={30} y={368} w={540} h={28} label="FOOTER" />
      </svg>
    </div>
  );
}

function Box({
  x,
  y,
  w,
  h,
  label,
  showDim = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  showDim?: boolean;
}) {
  return (
    <g>
      {/* precise rectangle — system rendering of detected element */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        shapeRendering="crispEdges"
      />
      {/* corner registration ticks in cobalt (top-left + bottom-right) */}
      <g
        stroke="var(--d5-cobalt)"
        strokeWidth="1"
        fill="none"
        shapeRendering="crispEdges"
      >
        <path
          d={`M ${x - 5} ${y} L ${x + 5} ${y} M ${x} ${y - 5} L ${x} ${y + 5}`}
        />
        <path
          d={`M ${x + w - 5} ${y + h} L ${x + w + 5} ${y + h} M ${x + w} ${y + h - 5} L ${x + w} ${y + h + 5}`}
        />
      </g>
      <text
        x={x + 8}
        y={y + 14}
        fill="var(--d5-muted)"
        fontFamily="var(--d5-mono)"
        fontSize="9"
        letterSpacing="0.16em"
      >
        {label}
      </text>
      {/* width dim — only on variable elements */}
      {showDim && (
        <text
          x={x + w / 2}
          y={y + h + 14}
          textAnchor="middle"
          fill="var(--d5-cobalt)"
          fontFamily="var(--d5-mono)"
          fontSize="8"
          letterSpacing="0.12em"
        >
          {w}px
        </text>
      )}
    </g>
  );
}

function CodeWell() {
  const lines = [
    {
      n: 1,
      t: (
        <>
          <Tk c="m">import</Tk> <Tk>React</Tk> <Tk c="m">from</Tk>{" "}
          <Tk c="s">"react"</Tk>;
        </>
      ),
    },
    { n: 2, t: <></> },
    {
      n: 3,
      t: (
        <>
          <Tk c="m">export default function</Tk> <Tk c="f">Page</Tk>() {"{"}
        </>
      ),
    },
    {
      n: 4,
      t: (
        <>
          <Tk c="m"> return</Tk> (
        </>
      ),
    },
    {
      n: 5,
      t: (
        <>
          {" "}
          {"<"}
          <Tk c="t">main</Tk> <Tk c="a">className</Tk>={'"'}
          <Tk c="s">min-h-screen</Tk>
          {'"'}
          {">"}
        </>
      ),
    },
    {
      n: 6,
      t: (
        <>
          {" "}
          {"<"}
          <Tk c="t">nav</Tk> <Tk c="a">className</Tk>={'"'}
          <Tk c="s">flex items-center</Tk>
          {'"'}
          {">"}
        </>
      ),
    },
    {
      n: 7,
      t: (
        <>
          {" "}
          {"<"}
          <Tk c="t">a</Tk> <Tk c="a">href</Tk>={'"'}
          <Tk c="s">/</Tk>
          {'"'}
          {">"}
          <Tk>Home</Tk>
          {"</"}
          <Tk c="t">a</Tk>
          {">"}
        </>
      ),
    },
    {
      n: 8,
      t: (
        <>
          {" "}
          {"</"}
          <Tk c="t">nav</Tk>
          {">"}
        </>
      ),
    },
    {
      n: 9,
      t: (
        <>
          {" "}
          {"<"}
          <Tk c="t">section</Tk> <Tk c="a">className</Tk>={'"'}
          <Tk c="s">grid grid-cols-2</Tk>
          {'"'}
          {">"}
        </>
      ),
    },
    {
      n: 10,
      t: (
        <>
          {" "}
          {"<"}
          <Tk c="t">article</Tk>
          {">"}
          <Tk>Card</Tk>
          {"</"}
          <Tk c="t">article</Tk>
          {">"}
        </>
      ),
    },
    {
      n: 11,
      t: (
        <>
          {" "}
          {"</"}
          <Tk c="t">section</Tk>
          {">"}
        </>
      ),
    },
    {
      n: 12,
      t: (
        <>
          {" "}
          {"</"}
          <Tk c="t">main</Tk>
          {">"}
        </>
      ),
    },
    { n: 13, t: <> );</> },
    { n: 14, t: <>{"}"}</> },
  ];
  return (
    <div className="relative h-full">
      {/* tab bar */}
      <div
        className="d5-mono flex items-center gap-1 text-[10px] tracking-[0.14em] uppercase mb-3"
        style={{ color: "rgba(242,241,236,0.55)" }}
      >
        <span
          className="px-3 py-1.5 border"
          style={{
            borderColor: "rgba(242,241,236,0.18)",
            color: "var(--d5-paper)",
            background: "rgba(242,241,236,0.05)",
          }}
        >
          page.tsx
        </span>
        <span className="px-3 py-1.5">layout.tsx</span>
        <span className="px-3 py-1.5">styles.css</span>
        <span className="ml-auto" style={{ color: "var(--d5-cobalt)" }}>
          ● UNSAVED
        </span>
      </div>

      {/* code body */}
      <pre
        className="d5-mono text-[12px] leading-[1.7] overflow-hidden"
        style={{ color: "rgba(242,241,236,0.85)" }}
      >
        {lines.map((l) => (
          <div key={l.n} className="flex">
            <span
              className="select-none pr-4 text-right inline-block"
              style={{ color: "rgba(242,241,236,0.25)", width: 28 }}
            >
              {l.n}
            </span>
            <span>{l.t}</span>
          </div>
        ))}
      </pre>

      {/* bottom status */}
      <div
        className="d5-mono absolute bottom-0 left-0 right-0 flex items-center justify-between text-[9px] tracking-[0.16em] uppercase pt-2 border-t"
        style={{
          color: "rgba(242,241,236,0.45)",
          borderColor: "rgba(242,241,236,0.12)",
        }}
      >
        <span>TS · REACT 19</span>
        <span>LN 14 · COL 1</span>
        <span style={{ color: "var(--d5-cobalt)" }}>GENERATED · 1.2s</span>
      </div>
    </div>
  );
}

function Tk({
  children,
  c = "d",
}: {
  children: React.ReactNode;
  c?: "d" | "m" | "s" | "t" | "a" | "f";
}) {
  // Token color in code well — monochrome with cobalt as the single accent
  const color: Record<string, string> = {
    d: "rgba(242,241,236,0.85)",
    m: "rgba(242,241,236,0.55)", // keywords/imports — muted
    s: "var(--d5-cobalt)", // strings — the ONE accent
    t: "rgba(242,241,236,0.95)", // tag names — brightest
    a: "rgba(242,241,236,0.55)", // attributes — muted
    f: "rgba(242,241,236,0.95)", // function names
  };
  return <span style={{ color: color[c] }}>{children}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 04 — COMPONENTS

function ComponentsBlock() {
  return (
    <div className="grid grid-cols-12 gap-8">
      {/* Buttons */}
      <PanelCard title="BUTTONS" span={6}>
        <div className="flex flex-wrap items-center gap-3">
          <button className="d5-btn d5-btn-primary">Open canvas</button>
          <button className="d5-btn">Secondary</button>
          <button className="d5-btn d5-btn-ghost">Ghost</button>
          <button
            className="d5-btn"
            disabled
            style={{ opacity: 0.4, cursor: "not-allowed" }}
          >
            Disabled
          </button>
        </div>
        <RuleSep />
        <div className="d5-tag mb-2">STATES (hover individually)</div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="d5-btn d5-btn-primary">Primary</button>
          <button
            className="d5-btn"
            style={{
              background: "var(--d5-graphite)",
              color: "var(--d5-paper)",
            }}
          >
            Hover
          </button>
          <button
            className="d5-btn"
            style={{
              background: "var(--d5-cobalt-ink)",
              color: "var(--d5-paper)",
              borderColor: "var(--d5-cobalt-ink)",
            }}
          >
            Pressed
          </button>
        </div>
      </PanelCard>

      {/* Inputs */}
      <PanelCard title="INPUTS / FIELDS" span={6}>
        <div className="space-y-5">
          <Field label="PROJECT NAME" placeholder="untitled-project" />
          <Field label="EMAIL" placeholder="you@studio.com" />
          <Field label="API KEY" placeholder="sk-•••" focused />
        </div>
      </PanelCard>

      {/* Cards */}
      <PanelCard title="PROJECT CARD" span={4}>
        <ProjectCard />
      </PanelCard>

      {/* Toast */}
      <PanelCard title="TOAST · NOTIFICATION" span={4}>
        <Toast type="success" />
        <div className="h-3" />
        <Toast type="error" />
      </PanelCard>

      {/* Dropdown */}
      <PanelCard title="DROPDOWN" span={4}>
        <DropdownMock />
      </PanelCard>

      {/* Tabs */}
      <PanelCard title="TABS" span={6}>
        <Tabs />
      </PanelCard>

      {/* Badge / Pill */}
      <PanelCard title="BADGES" span={6}>
        <div className="flex flex-wrap gap-2">
          <Badge>DRAFT</Badge>
          <Badge accent>READY</Badge>
          <Badge>EXPORTED</Badge>
          <Badge muted>ARCHIVED</Badge>
        </div>
        <RuleSep />
        <div className="d5-tag mb-2">NUMERIC / TABULAR</div>
        <div
          className="flex gap-6 d5-mono text-[24px]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          <span>012</span>
          <span>247</span>
          <span style={{ color: "var(--d5-cobalt)" }}>1,840</span>
        </div>
      </PanelCard>
    </div>
  );
}

function PanelCard({
  title,
  span = 6,
  children,
}: {
  title: string;
  span?: 4 | 6 | 8 | 12;
  children: React.ReactNode;
}) {
  const colMap = {
    4: "col-span-4",
    6: "col-span-6",
    8: "col-span-8",
    12: "col-span-12",
  } as const;
  return (
    <div
      className={`relative d5-reg p-6 ${colMap[span]}`}
      style={{
        border: "1px solid var(--d5-rule)",
        background: "var(--d5-paper)",
      }}
    >
      <div
        className="d5-mono text-[10px] tracking-[0.18em] uppercase mb-5 pb-2 border-b d5-hair"
        style={{ color: "var(--d5-graphite)" }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function RuleSep() {
  return <div className="my-5 d5-rule-h h-px" style={{ opacity: 0.5 }} />;
}

function Field({
  label,
  placeholder,
  focused = false,
}: {
  label: string;
  placeholder: string;
  focused?: boolean;
}) {
  return (
    <div>
      <div
        className="d5-mono text-[10px] tracking-[0.18em] uppercase mb-1"
        style={{ color: "var(--d5-muted)" }}
      >
        {label}
      </div>
      <input
        className="d5-input"
        placeholder={placeholder}
        style={focused ? { borderBottomColor: "var(--d5-cobalt)" } : undefined}
        defaultValue={focused ? "sk-zX72••••" : ""}
      />
      {focused && (
        <div
          className="d5-mono text-[10px] tracking-[0.12em] uppercase mt-1.5"
          style={{ color: "var(--d5-cobalt)" }}
        >
          ✓ KEY VERIFIED
        </div>
      )}
    </div>
  );
}

function ProjectCard() {
  return (
    <div
      className="relative d5-reg p-5"
      style={{
        border: "1px solid var(--d5-rule)",
        background: "var(--d5-vellum)",
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <span
          className="d5-mono text-[10px] tracking-[0.18em] uppercase"
          style={{ color: "var(--d5-cobalt)" }}
        >
          P-0247
        </span>
        <span
          className="d5-mono text-[10px]"
          style={{ color: "var(--d5-muted)" }}
        >
          ITER 12
        </span>
      </div>
      <div
        className="d5-serif"
        style={{ fontSize: 28, lineHeight: 1, letterSpacing: "-0.02em" }}
      >
        Pricing page
      </div>
      <div
        className="d5-mono text-[10px] tracking-[0.14em] uppercase mt-2"
        style={{ color: "var(--d5-muted)" }}
      >
        EDITED 2 MIN AGO · 6 ELEMENTS
      </div>
      <div
        className="mt-5 pt-3 border-t d5-hair flex items-center justify-between d5-mono text-[10px] tracking-[0.14em] uppercase"
        style={{ color: "var(--d5-muted)" }}
      >
        <span>EXPORT</span>
        <span>OPEN →</span>
      </div>
    </div>
  );
}

function Toast({ type }: { type: "success" | "error" }) {
  const isOk = type === "success";
  return (
    <div
      className="relative flex items-center gap-3 px-4 py-3"
      style={{
        background: isOk ? "var(--d5-graphite)" : "var(--d5-paper)",
        color: isOk ? "var(--d5-paper)" : "var(--d5-graphite)",
        border: `1px solid ${isOk ? "var(--d5-graphite)" : "var(--d5-rule)"}`,
      }}
    >
      <span
        className="d5-mono text-[10px] tracking-[0.18em] uppercase"
        style={{ color: isOk ? "var(--d5-cobalt)" : "var(--d5-cobalt)" }}
      >
        {isOk ? "✓ SAVED" : "✕ ERROR"}
      </span>
      <span className="text-[13px]">
        {isOk ? "Project committed." : "Couldn't reach Roboflow."}
      </span>
      <span className="d5-mono ml-auto text-[10px] tracking-[0.14em] uppercase opacity-60">
        {isOk ? "0.4s ago" : "RETRY"}
      </span>
    </div>
  );
}

function DropdownMock() {
  const items = ["Open in editor", "Duplicate", "Export ZIP", "Delete"];
  return (
    <div
      className="d5-reg relative inline-block min-w-[220px]"
      style={{
        border: "1px solid var(--d5-rule)",
        background: "var(--d5-paper)",
      }}
    >
      <div
        className="d5-mono text-[10px] tracking-[0.16em] uppercase px-3 py-2 border-b d5-hair"
        style={{ color: "var(--d5-muted)" }}
      >
        ACTIONS
      </div>
      {items.map((it, i) => (
        <div
          key={it}
          className="px-3 py-2 flex items-center justify-between text-[13px] cursor-pointer"
          style={{
            background: i === 0 ? "var(--d5-cobalt-wash)" : "transparent",
            color: i === 0 ? "var(--d5-cobalt-ink)" : "var(--d5-graphite)",
          }}
        >
          <span>{it}</span>
          <span
            className="d5-mono text-[10px] tracking-[0.12em]"
            style={{ color: "var(--d5-muted)" }}
          >
            ⌘{i + 1}
          </span>
        </div>
      ))}
    </div>
  );
}

function Tabs() {
  const tabs = ["Code", "Preview", "Iterations", "Export"];
  return (
    <div>
      <div className="flex items-end gap-6 border-b d5-hair">
        {tabs.map((t, i) => (
          <div
            key={t}
            className="d5-mono text-[11px] tracking-[0.18em] uppercase pb-2 relative"
            style={{
              color: i === 1 ? "var(--d5-graphite)" : "var(--d5-muted)",
            }}
          >
            {t}
            {i === 1 && (
              <div
                className="absolute -bottom-px left-0 right-0 h-px"
                style={{ background: "var(--d5-cobalt)" }}
              />
            )}
          </div>
        ))}
      </div>
      <div
        className="mt-5 d5-mono text-[12px]"
        style={{ color: "var(--d5-muted)" }}
      >
        Preview is selected. The cobalt tick anchors the active tab.
      </div>
    </div>
  );
}

function Badge({
  children,
  accent,
  muted,
}: {
  children: React.ReactNode;
  accent?: boolean;
  muted?: boolean;
}) {
  const style: React.CSSProperties = accent
    ? {
        background: "var(--d5-cobalt)",
        color: "var(--d5-paper)",
        borderColor: "var(--d5-cobalt)",
      }
    : muted
      ? { color: "var(--d5-muted)", borderColor: "var(--d5-tick)" }
      : {};
  return (
    <span
      className="d5-mono text-[10px] tracking-[0.2em] uppercase px-2 py-1 inline-flex items-center"
      style={{ border: "1px solid var(--d5-rule)", ...style }}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 05 — MOTION

function MotionBlock() {
  return (
    <div className="grid grid-cols-12 gap-8">
      <MotionDemo title="STROKE DRAW · 400ms · CURVE (0.2,0.7,0.1,1)" span={6}>
        <DrawDemo />
      </MotionDemo>
      <MotionDemo title="TYPE SWAP · 200ms · CROSSFADE" span={6}>
        <TypeSwapDemo />
      </MotionDemo>
      <MotionDemo title="DRAFTING COMPASS · LOADER" span={4}>
        <CompassLoader />
      </MotionDemo>
      <MotionDemo title="TABULAR NUMERAL ROLL" span={4}>
        <NumeralRoll />
      </MotionDemo>
      <MotionDemo title="REGISTRATION TICK · 8s LINEAR" span={4}>
        <TickSweepDemo />
      </MotionDemo>
    </div>
  );
}

function MotionDemo({
  title,
  span,
  children,
}: {
  title: string;
  span: 4 | 6 | 12;
  children: React.ReactNode;
}) {
  const colMap = {
    4: "col-span-4",
    6: "col-span-6",
    12: "col-span-12",
  } as const;
  return (
    <div
      className={`relative d5-reg p-6 ${colMap[span]}`}
      style={{
        border: "1px solid var(--d5-rule)",
        background: "var(--d5-paper)",
      }}
    >
      <div
        className="d5-mono text-[10px] tracking-[0.16em] uppercase mb-4 pb-2 border-b d5-hair"
        style={{ color: "var(--d5-graphite)" }}
      >
        {title}
      </div>
      <div className="flex items-center justify-center min-h-[160px]">
        {children}
      </div>
    </div>
  );
}

function DrawDemo() {
  const [k, setK] = useState(0);
  return (
    <div className="flex flex-col items-center gap-4">
      <svg width="220" height="80" viewBox="0 0 220 80" key={k}>
        <path
          d="M 4 40 L 60 40 L 70 20 L 100 60 L 130 20 L 160 60 L 170 40 L 216 40"
          fill="none"
          stroke="var(--d5-graphite)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="600"
          strokeDashoffset="600"
          style={{
            animation: "d5-draw 1.6s cubic-bezier(0.2,0.7,0.1,1) forwards",
          }}
        />
      </svg>
      <button
        className="d5-btn d5-btn-ghost"
        onClick={() => setK((v) => v + 1)}
      >
        Replay
      </button>
    </div>
  );
}

function TypeSwapDemo() {
  const words = ["Sketches", "Wireframes", "Napkins", "Doodles"];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % words.length), 1600);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      className="d5-serif text-center"
      style={{ fontSize: 48, lineHeight: 1, letterSpacing: "-0.02em" }}
    >
      <span
        key={i}
        style={{
          display: "inline-block",
          animation: "d5-fade-in 200ms linear",
        }}
      >
        {words[i]}
      </span>
      <span style={{ color: "var(--d5-cobalt)" }}> → code.</span>
      <style jsx>{`
        @keyframes d5-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

function CompassLoader() {
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="56" height="56" viewBox="0 0 56 56">
        <g
          style={{
            transformOrigin: "28px 28px",
            animation: "d5-compass-spin 1.6s linear infinite",
          }}
        >
          <circle
            cx="28"
            cy="28"
            r="22"
            fill="none"
            stroke="var(--d5-tick)"
            strokeWidth="1"
          />
          <path
            d="M 28 6 A 22 22 0 0 1 49.5 30"
            fill="none"
            stroke="var(--d5-cobalt)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="28" cy="28" r="2" fill="var(--d5-graphite)" />
        </g>
      </svg>
      <div
        className="d5-mono text-[9px] tracking-[0.2em] uppercase"
        style={{ color: "var(--d5-muted)" }}
      >
        DRAFTING…
      </div>
    </div>
  );
}

function NumeralRoll() {
  const [n, setN] = useState(247);
  useEffect(() => {
    const t = setInterval(() => setN((v) => v + 1), 1100);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="d5-mono"
        style={{
          fontSize: 56,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.02em",
        }}
      >
        {n.toLocaleString()}
      </div>
      <div
        className="d5-mono text-[9px] tracking-[0.2em] uppercase"
        style={{ color: "var(--d5-muted)" }}
      >
        COMPONENTS RENDERED
      </div>
    </div>
  );
}

function TickSweepDemo() {
  return (
    <div className="w-full flex flex-col gap-3">
      <div className="relative h-px" style={{ background: "var(--d5-tick)" }}>
        <div
          className="absolute top-0 h-px"
          style={{
            width: 60,
            background: "var(--d5-cobalt)",
            animation: "d5-tick-sweep 4s linear infinite",
          }}
        />
      </div>
      <div className="relative h-px" style={{ background: "var(--d5-tick)" }}>
        <div
          className="absolute top-0 h-px"
          style={{
            width: 60,
            background: "var(--d5-cobalt)",
            animation: "d5-tick-sweep 6s linear infinite",
            animationDelay: "0.8s",
          }}
        />
      </div>
      <div className="relative h-px" style={{ background: "var(--d5-tick)" }}>
        <div
          className="absolute top-0 h-px"
          style={{
            width: 60,
            background: "var(--d5-cobalt)",
            animation: "d5-tick-sweep 5s linear infinite",
            animationDelay: "0.4s",
          }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 06 — DARK MODE

function DarkModeBlock() {
  return (
    <div
      className="grid grid-cols-2 gap-px"
      style={{ background: "var(--d5-rule)" }}
    >
      <ThemePreview tokens={LIGHT} label="LIGHT — DAY DRAFT" />
      <ThemePreview tokens={DARK} label="DARK — NIGHT DRAFT" />
    </div>
  );
}

function ThemePreview({ tokens, label }: { tokens: Tokens; label: string }) {
  const css: React.CSSProperties = {
    background: tokens.paper,
    color: tokens.graphite,
    padding: 32,
    minHeight: 460,
  } as React.CSSProperties;
  return (
    <div style={css} className="relative">
      <div
        className="d5-mono text-[10px] tracking-[0.2em] uppercase pb-2 border-b mb-6 flex items-center justify-between"
        style={{ borderColor: tokens.rule, color: tokens.muted }}
      >
        <span>{label}</span>
        <Cross size={8} />
      </div>

      <div
        className="d5-serif"
        style={{
          fontSize: 64,
          lineHeight: 0.95,
          letterSpacing: "-0.03em",
          color: tokens.graphite,
        }}
      >
        Sketches{" "}
        <em style={{ color: tokens.cobalt, fontStyle: "italic" }}>become</em>{" "}
        code.
      </div>

      <div className="mt-8 flex items-center gap-3">
        <button
          className="d5-mono"
          style={{
            background: tokens.cobalt,
            color: tokens.paper,
            border: `1px solid ${tokens.cobalt}`,
            padding: "10px 18px",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Open canvas →
        </button>
        <button
          className="d5-mono"
          style={{
            background: "transparent",
            color: tokens.graphite,
            border: `1px solid ${tokens.rule}`,
            padding: "10px 18px",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Watch demo
        </button>
      </div>

      <div
        className="mt-8 p-4"
        style={{
          background: tokens.vellum,
          border: `1px solid ${tokens.rule}`,
        }}
      >
        <div
          className="d5-mono text-[10px] tracking-[0.18em] uppercase pb-2 mb-3 border-b"
          style={{ borderColor: tokens.rule, color: tokens.muted }}
        >
          P-0247 · PRICING PAGE
        </div>
        <div
          className="d5-mono text-[10px] tracking-[0.14em] uppercase"
          style={{ color: tokens.muted }}
        >
          EDITED 2 MIN AGO · 6 ELEMENTS
        </div>
      </div>

      <div
        className="d5-mono text-[10px] tracking-[0.14em] uppercase mt-8 flex items-center gap-5"
        style={{ color: tokens.muted }}
      >
        <span style={{ color: tokens.cobalt }}>● SAVED</span>
        <span>GEMINI 2.5 · 1.2s</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COLOPHON

function Colophon() {
  return (
    <footer
      className="px-10 py-16 max-w-[1400px] mx-auto d5-mono text-[11px] tracking-[0.14em] uppercase"
      style={{ color: "var(--d5-muted)" }}
    >
      <div className="border-t d5-hair pt-6 grid grid-cols-3 gap-8">
        <div>
          <div style={{ color: "var(--d5-graphite)" }}>COLOPHON</div>
          <div className="mt-2">
            Set in Instrument Serif, Inter, JetBrains Mono. Drawn on a 32px
            grid.
          </div>
        </div>
        <div>
          <div style={{ color: "var(--d5-graphite)" }}>INK</div>
          <div className="mt-2">
            Graphite #0E0E0F · Cobalt #4A4B8C · Paper #FAFAF7
          </div>
        </div>
        <div>
          <div style={{ color: "var(--d5-graphite)" }}>SHEET</div>
          <div className="mt-2">v0.1 · 2026-06-11 · CODECANVAS</div>
        </div>
      </div>
    </footer>
  );
}
