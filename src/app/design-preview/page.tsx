import {
  Instrument_Serif,
  Geist,
  Geist_Mono,
  Fraunces,
  Inter,
  Inter_Tight,
  JetBrains_Mono,
} from "next/font/google";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});
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
const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

// ---------- Shared icon set (inline SVG, no imports) ----------
const IconCursor = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 3l5 16 2.5-6.5L19 10z" />
  </svg>
);
const IconPen = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 21l4-1 11-11-3-3L4 17l-1 4z" />
    <path d="M14 6l3 3" />
  </svg>
);
const IconSquare = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="4" width="16" height="16" rx="1.5" />
  </svg>
);
const IconCircle = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
    <circle cx="12" cy="12" r="8" />
  </svg>
);
const IconText = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 5h14M12 5v14M9 19h6" />
  </svg>
);
const IconEraser = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 17l10-10 4 4-10 10H5z" />
    <path d="M10 20h10" />
  </svg>
);

const toolIcons = [
  { I: IconCursor, label: "Select", key: "V" },
  { I: IconPen, label: "Pen", key: "P" },
  { I: IconSquare, label: "Rect", key: "R" },
  { I: IconCircle, label: "Circle", key: "O" },
  { I: IconText, label: "Text", key: "T" },
  { I: IconEraser, label: "Eraser", key: "E" },
];

// ============================================================
// PAGE
// ============================================================
export default function DesignPreviewPage() {
  return (
    <main
      className={`${instrumentSerif.variable} ${geist.variable} ${geistMono.variable} ${fraunces.variable} ${inter.variable} ${interTight.variable} ${jetbrains.variable} bg-white`}
    >
      <PreviewNav />
      <DirectionOne />
      <DirectionTwo />
      <DirectionThree />
      <DirectionFour />
      <VotingSection />
    </main>
  );
}

// ---------- Top sticky nav for the preview page itself ----------
function PreviewNav() {
  const links = [
    { href: "#editorial", label: "01 Editorial" },
    { href: "#jewel", label: "02 Jewel" },
    { href: "#studio", label: "03 Studio" },
    { href: "#precision", label: "04 Precision" },
  ];
  return (
    <nav
      className="sticky top-0 z-50 border-b border-neutral-200 bg-white/90 backdrop-blur"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-10 py-4">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-neutral-900" />
          <span className="text-[13px] font-medium tracking-tight text-neutral-900">
            CodeCanvas - Design Preview
          </span>
          <span className="text-[12px] text-neutral-500">
            4 directions, one decision
          </span>
        </div>
        <ul className="flex items-center gap-1">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="rounded-full px-3 py-1.5 text-[12px] text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

// ---------- Reusable: sticky-note label ----------
function StickyNote({
  num,
  name,
  rotate = "-rotate-3",
  bg = "bg-yellow-200",
  text = "text-neutral-900",
}: {
  num: string;
  name: string;
  rotate?: string;
  bg?: string;
  text?: string;
}) {
  return (
    <div
      className={`absolute right-10 top-10 z-10 ${rotate} ${bg} ${text} shadow-[0_8px_24px_-12px_rgba(0,0,0,0.3)]`}
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <div className="px-5 py-3">
        <div className="text-[10px] uppercase tracking-[0.18em] opacity-70">
          Direction {num}
        </div>
        <div className="text-[15px] font-semibold tracking-tight">{name}</div>
      </div>
    </div>
  );
}

// ---------- Reusable: palette swatch row ----------
function PaletteRow({
  swatches,
  textClass,
  mutedClass,
}: {
  swatches: { name: string; hex: string; note?: string }[];
  textClass: string;
  mutedClass: string;
}) {
  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: `repeat(${swatches.length}, minmax(0, 1fr))`,
      }}
    >
      {swatches.map((s) => (
        <div key={s.hex} className="flex flex-col gap-2">
          <div
            className="h-20 w-full rounded-[2px] border border-black/5"
            style={{ background: s.hex }}
          />
          <div>
            <div className={`text-[11px] font-medium tracking-tight ${textClass}`}>
              {s.name}
            </div>
            <div
              className={`text-[10px] tracking-wide ${mutedClass}`}
              style={{ fontFamily: "var(--font-jetbrains)" }}
            >
              {s.hex.toUpperCase()}
            </div>
            {s.note && (
              <div className={`mt-0.5 text-[10px] ${mutedClass}`}>{s.note}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// DIRECTION 1 - EDITORIAL LIGHT
// ============================================================
function DirectionOne() {
  const palette = [
    { name: "Bone", hex: "#F4F1EA", note: "Background" },
    { name: "Vellum", hex: "#FBF9F4", note: "Surface" },
    { name: "Ink", hex: "#1C1A17", note: "Text" },
    { name: "Ash", hex: "#76706A", note: "Muted" },
    { name: "Rule", hex: "#E5DFD3", note: "Hairline" },
    { name: "Cobalt", hex: "#4A4B8C", note: "Accent" },
    { name: "Critical", hex: "#9B3B2E", note: "Error" },
  ];
  return (
    <section
      id="editorial"
      className="relative min-h-screen w-full"
      style={{
        background: "#F4F1EA",
        fontFamily: "var(--font-inter)",
        color: "#1C1A17",
      }}
    >
      <StickyNote
        num="01"
        name="Editorial Light"
        bg="bg-[#FBF9F4]"
        text="text-[#1C1A17]"
      />
      <div className="mx-auto max-w-[1440px] px-16 py-24">
        {/* Hero */}
        <div className="grid grid-cols-12 gap-8 border-b border-[#E5DFD3] pb-16">
          <div className="col-span-2 pt-3">
            <div
              className="text-[10px] uppercase tracking-[0.22em]"
              style={{ color: "#76706A" }}
            >
              Direction 01
            </div>
            <div
              className="mt-2 text-[12px] tracking-tight"
              style={{ color: "#4A4B8C", fontFamily: "var(--font-jetbrains)" }}
            >
              · quiet / paper / editorial
            </div>
          </div>
          <div className="col-span-10">
            <h1
              className="text-[112px] leading-[0.95] tracking-[-0.025em]"
              style={{ fontFamily: "var(--font-instrument)", color: "#1C1A17" }}
            >
              Draw a sketch.
              <br />
              <em className="italic" style={{ color: "#4A4B8C" }}>
                Read the code.
              </em>
            </h1>
            <p
              className="mt-8 max-w-2xl text-[16px] leading-[1.65]"
              style={{ color: "#76706A" }}
            >
              CodeCanvas is a quiet instrument. A page where wireframes become
              real React, with the calm of a printed magazine and the precision
              of an editor's blue pencil.
            </p>
          </div>
        </div>

        {/* Sample navbar */}
        <div className="mt-16">
          <SectionLabel color="#76706A">Sample navbar</SectionLabel>
          <div className="mt-3 flex items-center justify-between border border-[#E5DFD3] bg-[#FBF9F4] px-6 py-4">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: "#4A4B8C" }} />
              <span
                className="text-[18px] tracking-tight"
                style={{ fontFamily: "var(--font-instrument)" }}
              >
                CodeCanvas
              </span>
            </div>
            <ul className="flex items-center gap-8 text-[13px]" style={{ color: "#1C1A17" }}>
              <li>Canvas</li>
              <li>Projects</li>
              <li>Docs</li>
              <li style={{ color: "#76706A" }}>Changelog</li>
            </ul>
            <div className="flex items-center gap-3">
              <button className="text-[13px]" style={{ color: "#76706A" }}>
                Sign in
              </button>
              <button
                className="border px-4 py-2 text-[13px] transition hover:bg-[#4A4B8C] hover:text-white"
                style={{ borderColor: "#4A4B8C", color: "#4A4B8C" }}
              >
                Start drawing
              </button>
            </div>
          </div>
        </div>

        {/* Palette */}
        <div className="mt-14">
          <SectionLabel color="#76706A">Palette</SectionLabel>
          <div className="mt-3">
            <PaletteRow
              swatches={palette}
              textClass="text-[#1C1A17]"
              mutedClass="text-[#76706A]"
            />
          </div>
        </div>

        {/* Workspace mock - toolbar + canvas + code panel */}
        <div className="mt-14">
          <SectionLabel color="#76706A">Workspace</SectionLabel>
          <div className="mt-3 grid grid-cols-12 gap-6">
            {/* Vertical toolbar */}
            <div className="col-span-1">
              <div className="flex flex-col items-center gap-1 border border-[#E5DFD3] bg-[#FBF9F4] p-2">
                {toolIcons.map((t, i) => (
                  <button
                    key={t.label}
                    className={`group relative h-10 w-10 ${i === 1 ? "bg-[#4A4B8C] text-white" : "text-[#1C1A17] hover:bg-[#F4F1EA]"}`}
                    title={t.label}
                  >
                    <t.I className="mx-auto h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>

            {/* Canvas area */}
            <div className="col-span-7">
              <div
                className="aspect-[16/10] border border-[#E5DFD3] bg-[#FBF9F4]"
                style={{
                  backgroundImage:
                    "radial-gradient(#E5DFD3 1px, transparent 1px)",
                  backgroundSize: "16px 16px",
                }}
              >
                <div className="flex h-full w-full items-center justify-center">
                  <div
                    className="text-[13px]"
                    style={{ color: "#76706A", fontFamily: "var(--font-jetbrains)" }}
                  >
                    canvas - draw to begin
                  </div>
                </div>
              </div>
            </div>

            {/* Project tile */}
            <div className="col-span-4">
              <div className="border border-[#E5DFD3] bg-[#FBF9F4] p-5">
                <div
                  className="text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: "#76706A" }}
                >
                  Project
                </div>
                <div
                  className="mt-2 text-[26px] leading-tight tracking-tight"
                  style={{ fontFamily: "var(--font-instrument)" }}
                >
                  Marketing site,<br />v3
                </div>
                <div
                  className="mt-1 text-[12px]"
                  style={{ color: "#76706A" }}
                >
                  Updated 2 hours ago · 14 iterations
                </div>
                <div
                  className="mt-5 h-32 border border-[#E5DFD3]"
                  style={{
                    backgroundImage:
                      "linear-gradient(180deg, #F4F1EA 0%, #FBF9F4 100%)",
                  }}
                />
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "#4A4B8C" }}>
                    Open ↗
                  </span>
                  <span
                    className="text-[10px] tracking-wide"
                    style={{ color: "#76706A", fontFamily: "var(--font-jetbrains)" }}
                  >
                    react · tailwind
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Code / preview panel */}
          <div className="mt-6 grid grid-cols-2 border border-[#E5DFD3] bg-[#FBF9F4]">
            <div
              className="border-r border-[#E5DFD3] p-6 text-[12px] leading-[1.8]"
              style={{ fontFamily: "var(--font-jetbrains)", color: "#1C1A17" }}
            >
              <div style={{ color: "#76706A" }}>// generated.tsx</div>
              <div>
                <span style={{ color: "#4A4B8C" }}>export default function</span>{" "}
                Hero() &#123;
              </div>
              <div>&nbsp;&nbsp;return (</div>
              <div>
                &nbsp;&nbsp;&nbsp;&nbsp;&lt;<span style={{ color: "#9B3B2E" }}>section</span>{" "}
                className=<span style={{ color: "#4A4B8C" }}>"py-32"</span>&gt;
              </div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;...</div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;&lt;/<span style={{ color: "#9B3B2E" }}>section</span>&gt;</div>
              <div>&nbsp;&nbsp;);</div>
              <div>&#125;</div>
            </div>
            <div className="p-10">
              <div
                className="text-[10px] uppercase tracking-[0.18em]"
                style={{ color: "#76706A" }}
              >
                Live preview
              </div>
              <h3
                className="mt-3 text-[38px] leading-[1.05] tracking-tight"
                style={{ fontFamily: "var(--font-instrument)" }}
              >
                A quieter way<br />to build.
              </h3>
              <p className="mt-3 max-w-sm text-[13px]" style={{ color: "#76706A" }}>
                Hand-drawn becomes hand-crafted.
              </p>
            </div>
          </div>
        </div>

        {/* Buttons + Type */}
        <div className="mt-14 grid grid-cols-12 gap-10">
          <div className="col-span-6">
            <SectionLabel color="#76706A">Buttons</SectionLabel>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                className="px-5 py-2.5 text-[13px] text-white transition hover:opacity-90"
                style={{ background: "#4A4B8C" }}
              >
                Primary
              </button>
              <button
                className="border px-5 py-2.5 text-[13px] transition hover:bg-[#FBF9F4]"
                style={{ borderColor: "#1C1A17", color: "#1C1A17" }}
              >
                Secondary
              </button>
              <button
                className="px-5 py-2.5 text-[13px] transition hover:bg-[#FBF9F4]"
                style={{ color: "#1C1A17" }}
              >
                Ghost
              </button>
              <button
                className="border px-5 py-2.5 text-[13px] transition hover:bg-[#9B3B2E] hover:text-white"
                style={{ borderColor: "#9B3B2E", color: "#9B3B2E" }}
              >
                Delete
              </button>
            </div>
          </div>
          <div className="col-span-6">
            <SectionLabel color="#76706A">Typography</SectionLabel>
            <div className="mt-3 space-y-2">
              <div
                className="text-[44px] leading-tight tracking-tight"
                style={{ fontFamily: "var(--font-instrument)" }}
              >
                A serif with a spine.
              </div>
              <div
                className="text-[22px] tracking-tight"
                style={{ fontFamily: "var(--font-instrument)" }}
              >
                Subheadings carry the weight.
              </div>
              <div className="text-[14px] leading-[1.7]" style={{ color: "#1C1A17" }}>
                Body copy in Inter - neutral, gets out of the way.
              </div>
              <div
                className="text-[11px] uppercase tracking-[0.18em]"
                style={{ color: "#76706A" }}
              >
                Caption - Inter, 11px, +0.18em
              </div>
              <div
                className="text-[12px]"
                style={{ fontFamily: "var(--font-jetbrains)", color: "#4A4B8C" }}
              >
                const code = "JetBrains Mono"
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// DIRECTION 2 - DEEP JEWEL
// ============================================================
function DirectionTwo() {
  const palette = [
    { name: "Obsidian", hex: "#0E1422", note: "Background" },
    { name: "Onyx", hex: "#161E30", note: "Surface" },
    { name: "Lapis", hex: "#1F2A42", note: "Elevated" },
    { name: "Bone Text", hex: "#EFEAE0", note: "Text" },
    { name: "Slate", hex: "#8892AC", note: "Muted" },
    { name: "Gold", hex: "#D4A24C", note: "Primary jewel" },
    { name: "Sapphire", hex: "#6E8BE8", note: "Secondary" },
  ];
  return (
    <section
      id="jewel"
      className="relative min-h-screen w-full"
      style={{
        background:
          "radial-gradient(1200px 600px at 80% -10%, rgba(212,162,76,0.10) 0%, rgba(14,20,34,0) 60%), radial-gradient(900px 500px at 0% 100%, rgba(110,139,232,0.08) 0%, rgba(14,20,34,0) 60%), #0E1422",
        color: "#EFEAE0",
        fontFamily: "var(--font-geist)",
      }}
    >
      <StickyNote
        num="02"
        name="Deep Jewel"
        rotate="rotate-2"
        bg="bg-[#D4A24C]"
        text="text-[#0E1422]"
      />
      <div className="mx-auto max-w-[1440px] px-16 py-24">
        {/* Hero */}
        <div>
          <div
            className="text-[11px] uppercase tracking-[0.24em]"
            style={{ color: "#D4A24C", fontFamily: "var(--font-geist-mono)" }}
          >
            02 / Deep Jewel - premium · midnight · confident
          </div>
          <h1
            className="mt-6 text-[88px] font-medium leading-[1] tracking-[-0.03em]"
            style={{ fontFamily: "var(--font-geist)" }}
          >
            Draw it. Ship it.<br />
            <span style={{ color: "#D4A24C" }}>Make it look paid-for.</span>
          </h1>
          <p
            className="mt-6 max-w-xl text-[15px] leading-[1.6]"
            style={{ color: "#8892AC" }}
          >
            A premium canvas for serious builders. Gold for what matters,
            sapphire for what informs. Nothing else asks for attention.
          </p>
        </div>

        {/* Navbar */}
        <div className="mt-14">
          <SectionLabel color="#8892AC">Sample navbar</SectionLabel>
          <div
            className="mt-3 flex items-center justify-between rounded-2xl border px-6 py-4 backdrop-blur"
            style={{
              borderColor: "rgba(212,162,76,0.18)",
              background: "rgba(31,42,66,0.55)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="h-6 w-6 rounded-md"
                style={{
                  background:
                    "linear-gradient(135deg, #D4A24C 0%, #8E6722 100%)",
                  boxShadow: "0 0 24px rgba(212,162,76,0.45)",
                }}
              />
              <span className="text-[15px] font-medium tracking-tight">
                CodeCanvas
              </span>
              <span
                className="rounded-full border px-2 py-0.5 text-[10px]"
                style={{
                  borderColor: "rgba(110,139,232,0.3)",
                  color: "#6E8BE8",
                  fontFamily: "var(--font-geist-mono)",
                }}
              >
                PRO
              </span>
            </div>
            <ul className="flex items-center gap-7 text-[13px]" style={{ color: "#EFEAE0" }}>
              <li>Canvas</li>
              <li>Library</li>
              <li>Models</li>
              <li style={{ color: "#8892AC" }}>Pricing</li>
            </ul>
            <div className="flex items-center gap-3">
              <button className="text-[13px]" style={{ color: "#8892AC" }}>
                Sign in
              </button>
              <button
                className="rounded-full px-4 py-2 text-[13px] font-medium transition"
                style={{
                  background: "#D4A24C",
                  color: "#0E1422",
                  boxShadow:
                    "0 0 0 1px rgba(255,255,255,0.06) inset, 0 0 20px rgba(212,162,76,0.35)",
                }}
              >
                Open canvas
              </button>
            </div>
          </div>
        </div>

        {/* Palette */}
        <div className="mt-14">
          <SectionLabel color="#8892AC">Palette</SectionLabel>
          <div className="mt-3">
            <PaletteRow
              swatches={palette}
              textClass="text-[#EFEAE0]"
              mutedClass="text-[#8892AC]"
            />
          </div>
        </div>

        {/* Workspace */}
        <div className="mt-14">
          <SectionLabel color="#8892AC">Workspace</SectionLabel>
          <div className="mt-3 grid grid-cols-12 gap-6">
            {/* Toolbar */}
            <div className="col-span-1">
              <div
                className="flex flex-col items-center gap-1 rounded-2xl border p-2 backdrop-blur"
                style={{
                  borderColor: "rgba(255,255,255,0.06)",
                  background: "rgba(31,42,66,0.5)",
                }}
              >
                {toolIcons.map((t, i) => (
                  <button
                    key={t.label}
                    className="relative h-10 w-10 rounded-xl transition"
                    style={
                      i === 1
                        ? {
                            background: "rgba(212,162,76,0.15)",
                            color: "#D4A24C",
                            boxShadow:
                              "0 0 0 1px rgba(212,162,76,0.45) inset, 0 0 16px rgba(212,162,76,0.3)",
                          }
                        : { color: "#8892AC" }
                    }
                    title={t.label}
                  >
                    <t.I className="mx-auto h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>

            {/* Canvas */}
            <div className="col-span-7">
              <div
                className="aspect-[16/10] rounded-2xl border"
                style={{
                  borderColor: "rgba(255,255,255,0.06)",
                  background: "#161E30",
                  backgroundImage:
                    "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
                  backgroundSize: "18px 18px",
                }}
              >
                <div className="flex h-full w-full items-center justify-center">
                  <div
                    className="rounded-full border px-4 py-1.5 text-[12px] backdrop-blur"
                    style={{
                      borderColor: "rgba(212,162,76,0.3)",
                      color: "#D4A24C",
                      background: "rgba(212,162,76,0.06)",
                      fontFamily: "var(--font-geist-mono)",
                    }}
                  >
                    ● detecting · 4 components
                  </div>
                </div>
              </div>
            </div>

            {/* Project tile */}
            <div className="col-span-4">
              <div
                className="rounded-2xl border p-5 backdrop-blur"
                style={{
                  borderColor: "rgba(212,162,76,0.18)",
                  background: "rgba(31,42,66,0.55)",
                  boxShadow:
                    "0 0 0 1px rgba(212,162,76,0.06) inset, 0 24px 60px -30px rgba(0,0,0,0.6)",
                }}
              >
                <div
                  className="text-[10px] uppercase tracking-[0.22em]"
                  style={{ color: "#D4A24C", fontFamily: "var(--font-geist-mono)" }}
                >
                  Project · live
                </div>
                <div className="mt-2 text-[24px] font-medium tracking-[-0.02em]">
                  Pricing page rebuild
                </div>
                <div className="mt-1 text-[12px]" style={{ color: "#8892AC" }}>
                  14 iterations · last edit 4m ago
                </div>
                <div
                  className="mt-5 h-32 rounded-xl border"
                  style={{
                    borderColor: "rgba(255,255,255,0.06)",
                    background:
                      "linear-gradient(135deg, #1F2A42 0%, #161E30 100%)",
                  }}
                />
                <div className="mt-4 flex items-center justify-between text-[11px]">
                  <span style={{ color: "#6E8BE8" }}>Open ↗</span>
                  <span
                    style={{ color: "#8892AC", fontFamily: "var(--font-geist-mono)" }}
                  >
                    react · next
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Code / preview */}
          <div
            className="mt-6 grid grid-cols-2 overflow-hidden rounded-2xl border backdrop-blur"
            style={{
              borderColor: "rgba(255,255,255,0.06)",
              background: "rgba(22,30,48,0.7)",
            }}
          >
            <div
              className="border-r p-6 text-[12px] leading-[1.8]"
              style={{
                borderColor: "rgba(255,255,255,0.06)",
                fontFamily: "var(--font-geist-mono)",
                color: "#EFEAE0",
              }}
            >
              <div style={{ color: "#8892AC" }}>// pricing.tsx</div>
              <div>
                <span style={{ color: "#D4A24C" }}>export default function</span>{" "}
                Pricing() &#123;
              </div>
              <div>&nbsp;&nbsp;return (</div>
              <div>
                &nbsp;&nbsp;&nbsp;&nbsp;&lt;<span style={{ color: "#6E8BE8" }}>section</span>{" "}
                className=<span style={{ color: "#D4A24C" }}>"py-24"</span>&gt;
              </div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;...</div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;&lt;/<span style={{ color: "#6E8BE8" }}>section</span>&gt;</div>
              <div>&nbsp;&nbsp;);</div>
              <div>&#125;</div>
            </div>
            <div className="p-10">
              <div
                className="text-[10px] uppercase tracking-[0.22em]"
                style={{ color: "#D4A24C", fontFamily: "var(--font-geist-mono)" }}
              >
                Live preview
              </div>
              <h3 className="mt-3 text-[36px] font-medium leading-tight tracking-[-0.025em]">
                Pricing that<br />
                respects you.
              </h3>
              <p className="mt-3 text-[13px]" style={{ color: "#8892AC" }}>
                One number. No asterisks. No "contact sales".
              </p>
            </div>
          </div>
        </div>

        {/* Buttons + Type */}
        <div className="mt-14 grid grid-cols-12 gap-10">
          <div className="col-span-6">
            <SectionLabel color="#8892AC">Buttons</SectionLabel>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                className="rounded-full px-5 py-2.5 text-[13px] font-medium transition"
                style={{
                  background: "#D4A24C",
                  color: "#0E1422",
                  boxShadow:
                    "0 0 0 1px rgba(255,255,255,0.08) inset, 0 0 24px rgba(212,162,76,0.35)",
                }}
              >
                Primary
              </button>
              <button
                className="rounded-full border px-5 py-2.5 text-[13px] backdrop-blur transition"
                style={{
                  borderColor: "rgba(110,139,232,0.4)",
                  color: "#6E8BE8",
                  background: "rgba(110,139,232,0.08)",
                }}
              >
                Secondary
              </button>
              <button
                className="rounded-full px-5 py-2.5 text-[13px] transition hover:bg-white/5"
                style={{ color: "#EFEAE0" }}
              >
                Ghost
              </button>
              <button
                className="rounded-full border px-5 py-2.5 text-[13px] transition"
                style={{
                  borderColor: "rgba(220,80,80,0.5)",
                  color: "#E27A7A",
                  background: "rgba(220,80,80,0.06)",
                }}
              >
                Destroy
              </button>
            </div>
          </div>
          <div className="col-span-6">
            <SectionLabel color="#8892AC">Typography</SectionLabel>
            <div className="mt-3 space-y-2">
              <div className="text-[44px] font-medium leading-tight tracking-[-0.03em]">
                Sharp Geist, premium feel.
              </div>
              <div className="text-[22px] font-medium tracking-[-0.02em]">
                Tight tracking does the work.
              </div>
              <div className="text-[14px] leading-[1.7]" style={{ color: "#EFEAE0" }}>
                Body in Geist 400 - calm, modern, opinion-free.
              </div>
              <div
                className="text-[11px] uppercase tracking-[0.22em]"
                style={{ color: "#8892AC", fontFamily: "var(--font-geist-mono)" }}
              >
                Caption - mono, +0.22em
              </div>
              <div
                className="text-[12px]"
                style={{ fontFamily: "var(--font-geist-mono)", color: "#D4A24C" }}
              >
                const code = "Geist Mono"
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// DIRECTION 3 - WARM STUDIO
// ============================================================
function DirectionThree() {
  const palette = [
    { name: "Linen", hex: "#F1E9D8", note: "Background" },
    { name: "Parchment", hex: "#FAF4E4", note: "Surface" },
    { name: "Ink", hex: "#1A1410", note: "Anchor · tool" },
    { name: "Cocoa", hex: "#2A1F18", note: "Text" },
    { name: "Tobacco", hex: "#7A6B5A", note: "Muted" },
    { name: "Terracotta", hex: "#BD5B3D", note: "Primary" },
    { name: "Burnt", hex: "#8E3E25", note: "Pressed" },
    { name: "Moss", hex: "#3F5E4F", note: "Counter" },
  ];
  return (
    <section
      id="studio"
      className="relative min-h-screen w-full"
      style={{
        background: "#F1E9D8",
        color: "#2A1F18",
        fontFamily: "var(--font-inter)",
      }}
    >
      {/* subtle noise overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
      <StickyNote
        num="03"
        name="Warm Studio"
        rotate="-rotate-2"
        bg="bg-[#BD5B3D]"
        text="text-[#FAF4E4]"
      />
      <div className="relative mx-auto max-w-[1440px] px-16 py-24">
        {/* Hero */}
        <div>
          <div
            className="text-[11px] uppercase tracking-[0.2em]"
            style={{ color: "#BD5B3D", fontFamily: "var(--font-fraunces)" }}
          >
            03 - Warm Studio · creative · human · structured
          </div>
          <h1
            className="mt-5 text-[96px] leading-[0.98] tracking-[-0.025em]"
            style={{ fontFamily: "var(--font-fraunces)", fontWeight: 500 }}
          >
            A canvas with<br />
            <span
              className="inline-block rounded-2xl px-5 py-1 italic"
              style={{
                background: "#BD5B3D",
                color: "#FAF4E4",
                fontWeight: 400,
              }}
            >
              warmth
            </span>{" "}
            built in.
          </h1>
          <p
            className="mt-6 max-w-xl text-[15px] leading-[1.65]"
            style={{ color: "#7A6B5A" }}
          >
            CodeCanvas should feel like a creative studio, not a code editor.
            Terracotta where it matters. Moss where it counts.
          </p>
        </div>

        {/* Navbar */}
        <div className="mt-14">
          <SectionLabel color="#7A6B5A">Sample navbar</SectionLabel>
          <div
            className="mt-3 flex items-center justify-between rounded-2xl border px-6 py-4"
            style={{ borderColor: "#E3D9C3", background: "#FAF4E4" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="h-7 w-7 rounded-xl"
                style={{
                  background:
                    "linear-gradient(135deg, #BD5B3D 0%, #8E3E25 100%)",
                }}
              />
              <span
                className="text-[19px] tracking-tight"
                style={{ fontFamily: "var(--font-fraunces)", fontWeight: 600 }}
              >
                CodeCanvas
              </span>
            </div>
            <ul className="flex items-center gap-7 text-[13px]" style={{ color: "#2A1F18" }}>
              <li>Home</li>
              <li>Canvas</li>
              <li>Library</li>
              <li style={{ color: "#7A6B5A" }}>About</li>
            </ul>
            <div className="flex items-center gap-3">
              <button
                className="rounded-xl border px-4 py-2 text-[13px]"
                style={{ borderColor: "#2A1F18", color: "#2A1F18" }}
              >
                Login
              </button>
              <button
                className="rounded-xl px-4 py-2 text-[13px] font-medium transition hover:brightness-95"
                style={{ background: "#BD5B3D", color: "#FAF4E4" }}
              >
                Sign up
              </button>
            </div>
          </div>
        </div>

        {/* Palette */}
        <div className="mt-14">
          <SectionLabel color="#7A6B5A">Palette</SectionLabel>
          <div className="mt-3">
            <PaletteRow
              swatches={palette}
              textClass="text-[#2A1F18]"
              mutedClass="text-[#7A6B5A]"
            />
          </div>
        </div>

        {/* Workspace */}
        <div className="mt-14">
          <SectionLabel color="#7A6B5A">Workspace</SectionLabel>
          <div className="mt-3 grid grid-cols-12 gap-6">
            <div className="col-span-1">
              <div
                className="flex flex-col items-center gap-1.5 rounded-2xl border p-2"
                style={{ borderColor: "#E3D9C3", background: "#FAF4E4" }}
              >
                {toolIcons.map((t, i) => (
                  <button
                    key={t.label}
                    className="h-10 w-10 rounded-xl transition"
                    style={
                      i === 1
                        ? { background: "#BD5B3D", color: "#FAF4E4" }
                        : { color: "#2A1F18" }
                    }
                    title={t.label}
                  >
                    <t.I className="mx-auto h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-7">
              <div
                className="overflow-hidden rounded-2xl border"
                style={{ borderColor: "#E3D9C3" }}
              >
                <div
                  className="aspect-[16/10]"
                  style={{
                    background: "#FAF4E4",
                    backgroundImage:
                      "radial-gradient(#E3D9C3 1.2px, transparent 1.2px)",
                    backgroundSize: "18px 18px",
                  }}
                >
                  <div className="flex h-full w-full items-center justify-center">
                    <div
                      className="rounded-full px-4 py-1.5 text-[12px] font-medium"
                      style={{ background: "#3F5E4F", color: "#FAF4E4" }}
                    >
                      canvas ready · start sketching
                    </div>
                  </div>
                </div>
                {/* Dark ink status bar - mono, file path, dims, active tool */}
                <div
                  className="flex items-center justify-between px-4 py-2 text-[10px]"
                  style={{
                    background: "#1A1410",
                    color: "#E3D9C3",
                    fontFamily: "var(--font-jetbrains)",
                  }}
                >
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          background: "#7DB58A",
                          boxShadow: "0 0 6px rgba(125,181,138,0.7)",
                        }}
                      />
                      ready
                    </span>
                    <span style={{ color: "#E3D9C3" }}>
                      ~/onboarding.canvas
                    </span>
                    <span style={{ color: "#7A6B5A" }}>1920 × 1080</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span style={{ color: "#BD5B3D" }}>● PEN</span>
                    <span style={{ color: "#7A6B5A" }}>2PX</span>
                    <span style={{ color: "#7A6B5A" }}>0 elts</span>
                    <span style={{ color: "#7A6B5A" }}>v2.3.1</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-span-4">
              <div
                className="rounded-2xl border p-5"
                style={{
                  borderColor: "#E3D9C3",
                  background: "#FAF4E4",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ background: "#3F5E4F", color: "#FAF4E4" }}
                    >
                      Active
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ background: "#F1E9D8", color: "#BD5B3D" }}
                    >
                      React
                    </span>
                  </div>
                  <span
                    className="text-[10px]"
                    style={{
                      color: "#7A6B5A",
                      fontFamily: "var(--font-jetbrains)",
                    }}
                  >
                    #4f9a3c
                  </span>
                </div>
                <div
                  className="mt-3 text-[24px] leading-tight tracking-tight"
                  style={{ fontFamily: "var(--font-fraunces)", fontWeight: 600 }}
                >
                  Onboarding flow,<br />v2
                </div>
                <div
                  className="mt-1 text-[12px]"
                  style={{ color: "#7A6B5A" }}
                >
                  Updated this morning
                </div>
                <div
                  className="mt-5 h-32 rounded-xl"
                  style={{
                    background:
                      "linear-gradient(135deg, #F1E9D8 0%, #E3D9C3 100%)",
                  }}
                />
                {/* Mono stats row - tool-feel inside the warm tile */}
                <div
                  className="mt-3 grid grid-cols-3 rounded-xl border text-[10px]"
                  style={{
                    borderColor: "#E3D9C3",
                    color: "#7A6B5A",
                    fontFamily: "var(--font-jetbrains)",
                  }}
                >
                  <div className="px-3 py-2">
                    <div>ITER</div>
                    <div
                      className="text-[15px] tabular-nums"
                      style={{ color: "#2A1F18" }}
                    >
                      07
                    </div>
                  </div>
                  <div
                    className="border-l border-r px-3 py-2"
                    style={{ borderColor: "#E3D9C3" }}
                  >
                    <div>ELTS</div>
                    <div
                      className="text-[15px] tabular-nums"
                      style={{ color: "#2A1F18" }}
                    >
                      14
                    </div>
                  </div>
                  <div className="px-3 py-2">
                    <div>EDIT</div>
                    <div
                      className="text-[15px] tabular-nums"
                      style={{ color: "#2A1F18" }}
                    >
                      4m
                    </div>
                  </div>
                </div>
                <button
                  className="mt-4 w-full rounded-xl py-2 text-[13px] font-medium"
                  style={{ background: "#BD5B3D", color: "#FAF4E4" }}
                >
                  Open project
                </button>
              </div>
            </div>
          </div>

          {/* Code / preview - dark ink anchor on code side, mono everywhere technical */}
          <div
            className="mt-6 overflow-hidden rounded-2xl border"
            style={{ borderColor: "#E3D9C3" }}
          >
            <div className="grid grid-cols-2">
              {/* Code side - Ink (#1A1410) */}
              <div style={{ background: "#1A1410" }}>
                {/* Tab / file header */}
                <div
                  className="flex items-center justify-between border-b px-5 py-2.5 text-[10px]"
                  style={{
                    borderColor: "rgba(227,217,195,0.08)",
                    color: "#7A6B5A",
                    fontFamily: "var(--font-jetbrains)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span style={{ color: "#E3D9C3" }}>
                      ~/src/onboarding.tsx
                    </span>
                    <span>TSX</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span style={{ color: "#7DB58A" }}>● saved</span>
                    <span>UTF-8</span>
                    <span>LF</span>
                  </div>
                </div>
                {/* Code body with line numbers */}
                <div
                  className="px-2 py-5 text-[12px] leading-[1.85]"
                  style={{
                    fontFamily: "var(--font-jetbrains)",
                    color: "#F1E9D8",
                  }}
                >
                  <div className="flex">
                    <span
                      className="w-9 select-none pr-3 text-right"
                      style={{ color: "#5A4A3E" }}
                    >
                      1
                    </span>
                    <span style={{ color: "#7A6B5A" }}>
                      // generated · do not edit
                    </span>
                  </div>
                  <div className="flex">
                    <span
                      className="w-9 select-none pr-3 text-right"
                      style={{ color: "#5A4A3E" }}
                    >
                      2
                    </span>
                    <span>
                      <span style={{ color: "#BD5B3D" }}>
                        export default function
                      </span>{" "}
                      Welcome() &#123;
                    </span>
                  </div>
                  <div className="flex">
                    <span
                      className="w-9 select-none pr-3 text-right"
                      style={{ color: "#5A4A3E" }}
                    >
                      3
                    </span>
                    <span>
                      &nbsp;&nbsp;
                      <span style={{ color: "#BD5B3D" }}>return</span> (
                    </span>
                  </div>
                  <div className="flex">
                    <span
                      className="w-9 select-none pr-3 text-right"
                      style={{ color: "#5A4A3E" }}
                    >
                      4
                    </span>
                    <span>
                      &nbsp;&nbsp;&nbsp;&nbsp;&lt;
                      <span style={{ color: "#3F5E4F" }}>div</span>{" "}
                      className=
                      <span style={{ color: "#E3D9C3" }}>
                        "p-8 rounded-2xl"
                      </span>
                      &gt;
                    </span>
                  </div>
                  <div className="flex">
                    <span
                      className="w-9 select-none pr-3 text-right"
                      style={{ color: "#5A4A3E" }}
                    >
                      5
                    </span>
                    <span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;...</span>
                  </div>
                  <div className="flex">
                    <span
                      className="w-9 select-none pr-3 text-right"
                      style={{ color: "#5A4A3E" }}
                    >
                      6
                    </span>
                    <span>
                      &nbsp;&nbsp;&nbsp;&nbsp;&lt;/
                      <span style={{ color: "#3F5E4F" }}>div</span>&gt;
                    </span>
                  </div>
                  <div className="flex">
                    <span
                      className="w-9 select-none pr-3 text-right"
                      style={{ color: "#5A4A3E" }}
                    >
                      7
                    </span>
                    <span>&nbsp;&nbsp;);</span>
                  </div>
                  <div className="flex">
                    <span
                      className="w-9 select-none pr-3 text-right"
                      style={{ color: "#5A4A3E" }}
                    >
                      8
                    </span>
                    <span>&#125;</span>
                  </div>
                </div>
              </div>
              {/* Preview side - Parchment */}
              <div className="p-10" style={{ background: "#FAF4E4" }}>
                <div
                  className="text-[10px] uppercase tracking-[0.18em]"
                  style={{
                    color: "#7A6B5A",
                    fontFamily: "var(--font-fraunces)",
                  }}
                >
                  Live preview
                </div>
                <h3
                  className="mt-3 text-[36px] leading-[1.05] tracking-tight"
                  style={{ fontFamily: "var(--font-fraunces)", fontWeight: 600 }}
                >
                  Welcome to<br />
                  <em style={{ color: "#BD5B3D" }}>the studio.</em>
                </h3>
                <p className="mt-3 max-w-sm text-[13px]" style={{ color: "#7A6B5A" }}>
                  A first run that actually feels welcoming.
                </p>
              </div>
            </div>
            {/* Bottom command bar - mono keyboard shortcuts + provider status */}
            <div
              className="flex items-center justify-between border-t px-5 py-2 text-[10px]"
              style={{
                borderColor: "#E3D9C3",
                background: "#FAF4E4",
                color: "#7A6B5A",
                fontFamily: "var(--font-jetbrains)",
              }}
            >
              <div className="flex items-center gap-4">
                <span style={{ color: "#2A1F18" }}>react · tailwind</span>
                <span>124 LOC</span>
                <span>3.2 KB</span>
              </div>
              <div className="flex items-center gap-4">
                <span>Ctrl+K commands</span>
                <span>Ctrl+S save</span>
                <span style={{ color: "#3F5E4F" }}>● gemini · 1.2s</span>
              </div>
            </div>
          </div>
        </div>

        {/* Buttons + Type */}
        <div className="mt-14 grid grid-cols-12 gap-10">
          <div className="col-span-6">
            <SectionLabel color="#7A6B5A">Buttons</SectionLabel>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                className="rounded-xl px-5 py-2.5 text-[13px] font-medium transition hover:brightness-95"
                style={{ background: "#BD5B3D", color: "#FAF4E4" }}
              >
                Primary
              </button>
              <button
                className="rounded-xl border-2 px-5 py-2.5 text-[13px] font-medium"
                style={{ borderColor: "#2A1F18", color: "#2A1F18" }}
              >
                Secondary
              </button>
              <button
                className="rounded-xl px-5 py-2.5 text-[13px] font-medium transition hover:bg-[#FAF4E4]"
                style={{ color: "#2A1F18" }}
              >
                Ghost
              </button>
              <button
                className="rounded-xl px-5 py-2.5 text-[13px] font-medium transition hover:brightness-95"
                style={{ background: "#8E3E25", color: "#FAF4E4" }}
              >
                Delete
              </button>
            </div>
          </div>
          <div className="col-span-6">
            <SectionLabel color="#7A6B5A">Typography</SectionLabel>
            <div className="mt-3 space-y-2">
              <div
                className="text-[44px] leading-tight tracking-tight"
                style={{ fontFamily: "var(--font-fraunces)", fontWeight: 600 }}
              >
                Fraunces, with character.
              </div>
              <div
                className="text-[22px] tracking-tight"
                style={{ fontFamily: "var(--font-fraunces)", fontWeight: 500 }}
              >
                <span className="italic">Optical sizes</span> for warmth.
              </div>
              <div className="text-[14px] leading-[1.7]" style={{ color: "#2A1F18" }}>
                Body in Inter - keeps the serif as the personality.
              </div>
              <div
                className="text-[11px] uppercase tracking-[0.2em]"
                style={{ color: "#7A6B5A", fontFamily: "var(--font-fraunces)" }}
              >
                Caption · Fraunces small caps
              </div>
              <div
                className="text-[12px]"
                style={{ fontFamily: "var(--font-jetbrains)", color: "#BD5B3D" }}
              >
                const code = "JetBrains Mono"
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// DIRECTION 4 - MINIMAL PRECISION
// ============================================================
function DirectionFour() {
  const palette = [
    { name: "Stone", hex: "#F5F5F4", note: "Background" },
    { name: "Paper", hex: "#FFFFFF", note: "Surface" },
    { name: "Graphite", hex: "#0A0A0A", note: "Text" },
    { name: "Quiet", hex: "#525252", note: "Secondary" },
    { name: "Whisper", hex: "#A3A3A3", note: "Tertiary" },
    { name: "Rule", hex: "#E5E5E5", note: "Border" },
    { name: "Reactor", hex: "#7DD356", note: "Signal" },
  ];
  return (
    <section
      id="precision"
      className="relative min-h-screen w-full"
      style={{
        background: "#F5F5F4",
        color: "#0A0A0A",
        fontFamily: "var(--font-inter-tight)",
      }}
    >
      <StickyNote
        num="04"
        name="Minimal Precision"
        rotate="rotate-1"
        bg="bg-[#0A0A0A]"
        text="text-[#7DD356]"
      />
      <div className="mx-auto max-w-[1440px] px-16 py-24">
        {/* Hero */}
        <div className="grid grid-cols-12 gap-8 border-b border-[#E5E5E5] pb-12">
          <div className="col-span-3">
            <div
              className="text-[10px] uppercase tracking-[0.2em]"
              style={{ color: "#525252", fontFamily: "var(--font-jetbrains)" }}
            >
              04 / Precision
            </div>
            <div
              className="mt-2 text-[10px] tracking-wide"
              style={{ color: "#A3A3A3", fontFamily: "var(--font-jetbrains)" }}
            >
              surgical · focused · dense
            </div>
            <div
              className="mt-6 inline-flex items-center gap-2 text-[10px]"
              style={{ color: "#525252", fontFamily: "var(--font-jetbrains)" }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#7DD356" }} />
              system · operational
            </div>
          </div>
          <div className="col-span-9">
            <h1
              className="text-[88px] font-semibold leading-[0.95] tracking-[-0.035em]"
              style={{ fontFamily: "var(--font-inter-tight)" }}
            >
              Every pixel earns<br />its place.
            </h1>
            <p className="mt-5 max-w-lg text-[14px] leading-[1.6]" style={{ color: "#525252" }}>
              No decoration. No gradients. Information density as the design
              language. Built for experts who know what they're doing.
            </p>
          </div>
        </div>

        {/* Navbar */}
        <div className="mt-12">
          <SectionLabel color="#525252">Sample navbar</SectionLabel>
          <div className="mt-3 flex items-center justify-between border border-[#E5E5E5] bg-white px-5 py-3">
            <div className="flex items-center gap-4">
              <div className="h-4 w-4 bg-[#0A0A0A]" />
              <span className="text-[13px] font-semibold tracking-tight">codecanvas</span>
              <span
                className="text-[10px]"
                style={{ color: "#A3A3A3", fontFamily: "var(--font-jetbrains)" }}
              >
                v3.4.1
              </span>
            </div>
            <ul
              className="flex items-center gap-6 text-[12px]"
              style={{ fontFamily: "var(--font-inter-tight)" }}
            >
              <li>Canvas</li>
              <li>Projects</li>
              <li>API</li>
              <li style={{ color: "#A3A3A3" }}>Settings</li>
            </ul>
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-1.5 text-[10px]"
                style={{ color: "#525252", fontFamily: "var(--font-jetbrains)" }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#7DD356" }} />
                connected
              </div>
              <button
                className="border border-[#0A0A0A] bg-[#0A0A0A] px-3 py-1.5 text-[12px] font-medium text-white"
              >
                Open
              </button>
            </div>
          </div>
        </div>

        {/* Palette */}
        <div className="mt-12">
          <SectionLabel color="#525252">Palette</SectionLabel>
          <div className="mt-3">
            <PaletteRow
              swatches={palette}
              textClass="text-[#0A0A0A]"
              mutedClass="text-[#525252]"
            />
          </div>
        </div>

        {/* Workspace */}
        <div className="mt-12">
          <SectionLabel color="#525252">Workspace</SectionLabel>
          <div className="mt-3 grid grid-cols-12 gap-4">
            <div className="col-span-1">
              <div className="flex flex-col items-center border border-[#E5E5E5] bg-white">
                {toolIcons.map((t, i) => (
                  <button
                    key={t.label}
                    className={`group relative flex h-10 w-full items-center justify-center border-b border-[#E5E5E5] last:border-b-0 ${
                      i === 1 ? "bg-white text-[#0A0A0A]" : "text-[#525252]"
                    }`}
                    title={t.label}
                  >
                    <t.I className="h-3.5 w-3.5" />
                    {i === 1 && (
                      <span
                        className="absolute left-0 top-0 h-full w-[2px]"
                        style={{ background: "#7DD356" }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-7">
              <div
                className="aspect-[16/10] border border-[#E5E5E5] bg-white"
                style={{
                  backgroundImage:
                    "linear-gradient(#F5F5F4 1px, transparent 1px), linear-gradient(90deg, #F5F5F4 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              >
                <div className="flex h-full w-full items-center justify-center">
                  <div
                    className="flex items-center gap-2 border border-[#E5E5E5] bg-white px-3 py-1.5 text-[11px]"
                    style={{ fontFamily: "var(--font-jetbrains)", color: "#525252" }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#7DD356" }} />
                    ready · 0 elements · 1920×1080
                  </div>
                </div>
              </div>
            </div>
            <div className="col-span-4">
              <div className="border border-[#E5E5E5] bg-white">
                <div className="border-b border-[#E5E5E5] px-4 py-2.5">
                  <div
                    className="text-[10px] uppercase tracking-[0.18em]"
                    style={{ color: "#A3A3A3", fontFamily: "var(--font-jetbrains)" }}
                  >
                    PROJECT · 4f9a3c
                  </div>
                  <div className="mt-1 text-[16px] font-semibold tracking-tight">
                    landing.v3
                  </div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-[#E5E5E5] border-b border-[#E5E5E5]">
                  <div className="px-4 py-2.5">
                    <div className="text-[10px]" style={{ color: "#A3A3A3", fontFamily: "var(--font-jetbrains)" }}>
                      iterations
                    </div>
                    <div className="text-[18px] font-semibold tabular-nums" style={{ fontFamily: "var(--font-jetbrains)" }}>
                      14
                    </div>
                  </div>
                  <div className="px-4 py-2.5">
                    <div className="text-[10px]" style={{ color: "#A3A3A3", fontFamily: "var(--font-jetbrains)" }}>
                      updated
                    </div>
                    <div className="text-[18px] font-semibold tabular-nums" style={{ fontFamily: "var(--font-jetbrains)" }}>
                      4m
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 text-[11px]" style={{ color: "#525252", fontFamily: "var(--font-jetbrains)" }}>
                  <div className="flex items-center justify-between">
                    <span>status</span>
                    <span className="flex items-center gap-1.5" style={{ color: "#0A0A0A" }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#7DD356" }} />
                      synced
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span>framework</span>
                    <span style={{ color: "#0A0A0A" }}>react · tailwind</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Code / preview */}
          <div className="mt-4 grid grid-cols-2 border border-[#E5E5E5] bg-white">
            <div
              className="border-r border-[#E5E5E5] p-5 text-[12px] leading-[1.7]"
              style={{ fontFamily: "var(--font-jetbrains)", color: "#0A0A0A" }}
            >
              <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2 text-[10px]" style={{ color: "#A3A3A3" }}>
                <span>landing.v3.tsx</span>
                <span>·tsx · 124 LOC</span>
              </div>
              <div className="mt-3 space-y-0.5">
                <div><span style={{ color: "#A3A3A3" }}>1</span>&nbsp;&nbsp;<span style={{ color: "#525252" }}>// generated</span></div>
                <div><span style={{ color: "#A3A3A3" }}>2</span>&nbsp;&nbsp;export default function Landing() &#123;</div>
                <div><span style={{ color: "#A3A3A3" }}>3</span>&nbsp;&nbsp;&nbsp;&nbsp;return (</div>
                <div><span style={{ color: "#A3A3A3" }}>4</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;section&gt;</div>
                <div><span style={{ color: "#A3A3A3" }}>5</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;...</div>
                <div><span style={{ color: "#A3A3A3" }}>6</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;/section&gt;</div>
                <div><span style={{ color: "#A3A3A3" }}>7</span>&nbsp;&nbsp;&nbsp;&nbsp;);</div>
                <div><span style={{ color: "#A3A3A3" }}>8</span>&nbsp;&nbsp;&#125;</div>
              </div>
            </div>
            <div className="p-8">
              <div
                className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]"
                style={{ color: "#525252", fontFamily: "var(--font-jetbrains)" }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#7DD356" }} />
                preview · live
              </div>
              <h3 className="mt-3 text-[40px] font-semibold leading-[1] tracking-[-0.035em]">
                Build less.<br />Ship more.
              </h3>
              <p className="mt-3 text-[12px]" style={{ color: "#525252" }}>
                Built with precision. Shipped with confidence.
              </p>
            </div>
          </div>
        </div>

        {/* Buttons + Type */}
        <div className="mt-12 grid grid-cols-12 gap-10">
          <div className="col-span-6">
            <SectionLabel color="#525252">Buttons</SectionLabel>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="bg-[#0A0A0A] px-4 py-2 text-[12px] font-medium text-white">
                Primary
              </button>
              <button className="border border-[#0A0A0A] px-4 py-2 text-[12px] font-medium text-[#0A0A0A]">
                Secondary
              </button>
              <button className="px-4 py-2 text-[12px] font-medium text-[#0A0A0A] hover:bg-white">
                Ghost
              </button>
              <button className="border border-[#0A0A0A] px-4 py-2 text-[12px] font-medium text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white">
                Delete
              </button>
              <button
                className="flex items-center gap-1.5 border border-[#E5E5E5] bg-white px-3 py-2 text-[11px]"
                style={{ color: "#525252", fontFamily: "var(--font-jetbrains)" }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#7DD356" }} />
                live
              </button>
            </div>
          </div>
          <div className="col-span-6">
            <SectionLabel color="#525252">Typography</SectionLabel>
            <div className="mt-3 space-y-2">
              <div className="text-[44px] font-semibold leading-tight tracking-[-0.035em]">
                Inter Tight. Information first.
              </div>
              <div className="text-[22px] font-semibold tracking-[-0.025em]">
                Hierarchy by weight, not color.
              </div>
              <div className="text-[14px] leading-[1.6]">
                Body in Inter - dense, neutral, calibrated.
              </div>
              <div
                className="text-[10px] uppercase tracking-[0.2em]"
                style={{ color: "#525252", fontFamily: "var(--font-jetbrains)" }}
              >
                CAPTION · MONO · +0.20EM
              </div>
              <div
                className="text-[12px]"
                style={{ fontFamily: "var(--font-jetbrains)" }}
              >
                <span style={{ color: "#525252" }}>const</span> code{" "}
                <span style={{ color: "#525252" }}>=</span>{" "}
                <span>"JetBrains Mono"</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- Section label helper ----------
function SectionLabel({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <div
      className="text-[10px] uppercase tracking-[0.22em]"
      style={{ color, fontFamily: "var(--font-jetbrains)" }}
    >
      {children}
    </div>
  );
}

// ============================================================
// VOTING SECTION (blank - placeholder for later)
// ============================================================
function VotingSection() {
  return (
    <section
      className="w-full border-t border-neutral-200 bg-neutral-50"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <div className="mx-auto max-w-[1440px] px-16 py-24">
        <div className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">
          Voting · TBD
        </div>
        <h2 className="mt-3 text-[40px] font-semibold tracking-tight text-neutral-900">
          Which direction wins?
        </h2>
        <p className="mt-3 max-w-xl text-[14px] leading-[1.7] text-neutral-600">
          This section is intentionally blank. We'll wire up votes, comments,
          and the final decision here once everyone has had a look.
        </p>
        <div className="mt-10 grid grid-cols-4 gap-4">
          {[
            { n: "01", name: "Editorial Light" },
            { n: "02", name: "Deep Jewel" },
            { n: "03", name: "Warm Studio" },
            { n: "04", name: "Minimal Precision" },
          ].map((d) => (
            <div
              key={d.n}
              className="rounded-2xl border border-dashed border-neutral-300 p-6"
            >
              <div className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">
                Direction {d.n}
              </div>
              <div className="mt-1 text-[18px] font-semibold tracking-tight text-neutral-900">
                {d.name}
              </div>
              <div className="mt-6 text-[11px] text-neutral-400">
                vote · placeholder
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
