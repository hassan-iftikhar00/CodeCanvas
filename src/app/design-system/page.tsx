import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";

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
// TOKENS - Warm Studio v0.1
// ============================================================
const T = {
  light: {
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
    counterSoft: "#D9E3DC",
    success: "#5C8C73",
    warning: "#C68A3F",
    danger: "#9B3B2E",
    anchor: "#1A1410",
  },
  dark: {
    bg: "#1A1410",
    surface: "#241B14",
    elevated: "#322620",
    ink: "#F1E9D8",
    muted: "#A89888",
    subtle: "#7A6B5A",
    hairline: "#3D2F26",
    accent: "#D67A5A",
    accentHover: "#BD5B3D",
    accentSoft: "#3A241B",
    counter: "#7DB58A",
    counterSoft: "#243029",
    success: "#7DB58A",
    warning: "#E3B57A",
    danger: "#D67566",
    anchor: "#FAF4E4",
  },
};

// ============================================================
// LOGO - Architype Stedelijk style C, recoloured
// ============================================================
function Logo({ size = 48, color }: { size?: number; color: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      style={{ color }}
      fill="currentColor"
      aria-label="CodeCanvas"
    >
      <rect x="55" y="15" width="130" height="46" rx="12" />
      <rect x="15" y="65" width="46" height="74" rx="12" />
      <rect x="55" y="143" width="130" height="46" rx="12" />
    </svg>
  );
}

function Wordmark({ color, size = 32 }: { color: string; size?: number }) {
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
// SHARED HELPERS
// ============================================================
function SectionShell({
  num,
  name,
  desc,
  id,
  children,
}: {
  num: string;
  name: string;
  desc: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="border-t"
      style={{ borderColor: T.light.hairline }}
    >
      <div className="mx-auto max-w-[1440px] px-16 py-20">
        <div className="grid grid-cols-12 gap-8 pb-10">
          <div className="col-span-3">
            <div
              className="text-[13px] uppercase tracking-[0.22em]"
              style={{
                color: T.light.muted,
                fontFamily: "var(--font-jetbrains)",
              }}
            >
              {num} / {name}
            </div>
          </div>
          <div className="col-span-9">
            <h2
              className="text-[44px] leading-[1] tracking-tight"
              style={{
                fontFamily: "var(--font-fraunces)",
                fontWeight: 600,
                color: T.light.ink,
              }}
            >
              {name}
            </h2>
            <p
              className="mt-3 max-w-2xl text-[14px] leading-[1.65]"
              style={{ color: T.light.muted }}
            >
              {desc}
            </p>
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}

function Label({
  children,
  mode = "light",
}: {
  children: React.ReactNode;
  mode?: "light" | "dark";
}) {
  return (
    <div
      className="text-[13px] uppercase tracking-[0.22em]"
      style={{
        color: T[mode].muted,
        fontFamily: "var(--font-jetbrains)",
      }}
    >
      {children}
    </div>
  );
}

function ModePanel({
  mode,
  children,
  className = "",
}: {
  mode: "light" | "dark";
  children: React.ReactNode;
  className?: string;
}) {
  const t = T[mode];
  return (
    <div
      className={`rounded-2xl border p-6 ${className}`}
      style={{ background: t.bg, borderColor: t.hairline }}
    >
      <div className="mb-4 flex items-center justify-between">
        <Label mode={mode}>{mode}</Label>
        <span
          className="text-[13px]"
          style={{
            color: t.muted,
            fontFamily: "var(--font-jetbrains)",
          }}
        >
          {mode === "light"
            ? "@media (prefers: light)"
            : "@media (prefers: dark)"}
        </span>
      </div>
      {children}
    </div>
  );
}

// ============================================================
// MOTION CSS - single source of truth
// ============================================================
const motionCSS = `
@keyframes ds-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes ds-spin { to { transform: rotate(360deg); } }
@keyframes ds-pulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.4); }
}
@keyframes ds-draw {
  from { stroke-dashoffset: 240; }
  to { stroke-dashoffset: 0; }
}
@keyframes ds-ink-spread {
  0% { transform: scale(0); opacity: 0; }
  60% { opacity: 0.18; }
  100% { transform: scale(1); opacity: 0; }
}
@keyframes ds-code-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes ds-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
@keyframes ds-progress {
  0% { width: 0%; }
  100% { width: 100%; }
}
@keyframes ds-spring-in {
  0% { transform: scale(0.85); opacity: 0; }
  60% { transform: scale(1.04); opacity: 1; }
  100% { transform: scale(1); }
}
.ds-shimmer {
  background: linear-gradient(90deg, transparent 0%, rgba(189,91,61,0.22) 50%, transparent 100%);
  background-size: 200% 100%;
  animation: ds-shimmer 1.6s ease-in-out infinite;
}
.ds-spin { animation: ds-spin 0.9s linear infinite; }
.ds-pulse { animation: ds-pulse 2s ease-in-out infinite; }
.ds-draw {
  stroke-dasharray: 240;
  animation: ds-draw 1.8s cubic-bezier(0.65, 0, 0.35, 1) infinite alternate;
}
.ds-float { animation: ds-float 3.4s ease-in-out infinite; }
.ds-progress {
  animation: ds-progress 1.8s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}
.ds-spring { animation: ds-spring-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.ds-code-rain > * {
  opacity: 0;
  animation: ds-code-in 0.4s cubic-bezier(0.16,1,0.3,1) forwards;
}
.ds-code-rain > *:nth-child(1) { animation-delay: 0.05s; }
.ds-code-rain > *:nth-child(2) { animation-delay: 0.12s; }
.ds-code-rain > *:nth-child(3) { animation-delay: 0.19s; }
.ds-code-rain > *:nth-child(4) { animation-delay: 0.26s; }
.ds-code-rain > *:nth-child(5) { animation-delay: 0.33s; }
.ds-code-rain > *:nth-child(6) { animation-delay: 0.40s; }
.ds-btn { transition: transform 200ms cubic-bezier(0.16,1,0.3,1), background-color 200ms ease-out, box-shadow 200ms ease-out; }
.ds-btn:active { transform: scale(0.97); }
.ds-ink-spread::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(circle at center, rgba(189,91,61,0.4) 0%, transparent 70%);
  animation: ds-ink-spread 2.4s ease-out infinite;
  pointer-events: none;
}
`;

// ============================================================
// PAGE
// ============================================================
export default function DesignSystemPage() {
  return (
    <main
      className={`${fraunces.variable} ${inter.variable} ${jetbrains.variable}`}
      style={{
        background: T.light.bg,
        color: T.light.ink,
        fontFamily: "var(--font-inter)",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: motionCSS }} />
      <DSNav />
      <Hero />
      <BrandSection />
      <TokensSection />
      <TypographySection />
      <RadiusSection />
      <ButtonsSection />
      <FormsSection />
      <SurfacesSection />
      <FeedbackSection />
      <StatesSection />
      <MotionSection />
      <IconsSection />
      <DSFooter />
    </main>
  );
}

// ---------- Sticky nav ----------
function DSNav() {
  const items = [
    ["#brand", "Brand"],
    ["#tokens", "Tokens"],
    ["#type", "Type"],
    ["#radius", "Radius"],
    ["#buttons", "Buttons"],
    ["#forms", "Forms"],
    ["#surfaces", "Surfaces"],
    ["#feedback", "Feedback"],
    ["#states", "States"],
    ["#motion", "Motion"],
    ["#icons", "Icons"],
  ];
  return (
    <nav
      className="sticky top-0 z-50 border-b backdrop-blur"
      style={{
        borderColor: T.light.hairline,
        background: "rgba(241,233,216,0.85)",
      }}
    >
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-10 py-3">
        <div className="flex items-center gap-3">
          <Logo size={22} color={T.light.accent} />
          <Wordmark color={T.light.ink} size={16} />
          <span
            className="ml-3 rounded-full border px-2 py-0.5 text-[13px]"
            style={{
              borderColor: T.light.hairline,
              color: T.light.muted,
              fontFamily: "var(--font-jetbrains)",
            }}
          >
            design-system v0.1
          </span>
        </div>
        <ul className="flex items-center gap-1">
          {items.map(([href, label]) => (
            <li key={href}>
              <a
                href={href}
                className="rounded-full px-3 py-1.5 text-[13px] transition"
                style={{ color: T.light.muted }}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

// ---------- Hero ----------
function Hero() {
  return (
    <header className="mx-auto max-w-[1440px] px-16 py-24">
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-3">
          <Label>00 / Foundation</Label>
          <div
            className="mt-2 text-[13px]"
            style={{
              color: T.light.muted,
              fontFamily: "var(--font-jetbrains)",
            }}
          >
            warm studio · v0.1
          </div>
          <div
            className="mt-6 inline-flex items-center gap-2 text-[13px]"
            style={{
              color: T.light.counter,
              fontFamily: "var(--font-jetbrains)",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: T.light.counter }}
            />
            living document
          </div>
        </div>
        <div className="col-span-9">
          <h1
            className="text-[88px] leading-[0.98] tracking-[-0.025em]"
            style={{
              fontFamily: "var(--font-fraunces)",
              fontWeight: 500,
              color: T.light.ink,
            }}
          >
            The system,
            <br />
            <em style={{ color: T.light.accent }}>not the screenshot.</em>
          </h1>
          <p
            className="mt-6 max-w-xl text-[15px] leading-[1.65]"
            style={{ color: T.light.muted }}
          >
            Every primitive needed to build CodeCanvas in Warm Studio. Light and
            dark, every component state, the motion language, the brand mark.
            Implementation reference.
          </p>
        </div>
      </div>
    </header>
  );
}

// ============================================================
// 01 - BRAND
// ============================================================
function BrandSection() {
  return (
    <SectionShell
      num="01"
      name="Brand"
      id="brand"
      desc="The C-mark is kept. The orange is swapped to Terracotta. A serif wordmark gives the geometric mark contrast - the same trick Pentagram uses for tech brands that want to feel made, not generated."
    >
      <div className="grid grid-cols-12 gap-6">
        {/* Mark on light */}
        <div
          className="col-span-4 rounded-2xl border p-8"
          style={{
            background: T.light.surface,
            borderColor: T.light.hairline,
          }}
        >
          <Label>Mark · on linen</Label>
          <div className="mt-6 flex items-center justify-center">
            <Logo size={120} color={T.light.accent} />
          </div>
          <div
            className="mt-6 flex items-center justify-between text-[13px]"
            style={{
              color: T.light.muted,
              fontFamily: "var(--font-jetbrains)",
            }}
          >
            <span>terracotta · #BD5B3D</span>
            <span>was: #FF6B00</span>
          </div>
        </div>
        {/* Mark on dark */}
        <div
          className="col-span-4 rounded-2xl border p-8"
          style={{
            background: T.dark.bg,
            borderColor: T.dark.hairline,
          }}
        >
          <Label mode="dark">Mark · on ink</Label>
          <div className="mt-6 flex items-center justify-center">
            <Logo size={120} color={T.dark.accent} />
          </div>
          <div
            className="mt-6 flex items-center justify-between text-[13px]"
            style={{
              color: T.dark.muted,
              fontFamily: "var(--font-jetbrains)",
            }}
          >
            <span>terracotta-light · #D67A5A</span>
            <span>brighter for dark</span>
          </div>
        </div>
        {/* Monochrome */}
        <div
          className="col-span-4 rounded-2xl border p-8"
          style={{
            background: T.light.elevated,
            borderColor: T.light.hairline,
          }}
        >
          <Label>Mark · monochrome</Label>
          <div className="mt-6 flex items-center justify-center gap-6">
            <Logo size={56} color={T.light.ink} />
            <Logo size={32} color={T.light.ink} />
            <Logo size={18} color={T.light.ink} />
          </div>
          <div
            className="mt-6 text-[13px]"
            style={{
              color: T.light.muted,
              fontFamily: "var(--font-jetbrains)",
            }}
          >
            cocoa · for favicon, print, single-colour print
          </div>
        </div>
      </div>

      {/* Wordmark variations */}
      <div className="mt-6 grid grid-cols-12 gap-6">
        <div
          className="col-span-6 rounded-2xl border p-8"
          style={{
            background: T.light.surface,
            borderColor: T.light.hairline,
          }}
        >
          <Label>Wordmark · lockup</Label>
          <div className="mt-6 flex items-center gap-4">
            <Logo size={48} color={T.light.accent} />
            <Wordmark color={T.light.ink} size={36} />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Logo size={28} color={T.light.accent} />
            <Wordmark color={T.light.ink} size={20} />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Logo size={18} color={T.light.accent} />
            <Wordmark color={T.light.ink} size={13} />
          </div>
        </div>
        <div
          className="col-span-6 rounded-2xl border p-8"
          style={{
            background: T.dark.bg,
            borderColor: T.dark.hairline,
          }}
        >
          <Label mode="dark">Wordmark · with tagline</Label>
          <div className="mt-6 flex items-center gap-4">
            <Logo size={48} color={T.dark.accent} />
            <div>
              <Wordmark color={T.dark.ink} size={32} />
              <div
                className="mt-1 text-[13px] uppercase tracking-[0.24em]"
                style={{
                  color: T.dark.muted,
                  fontFamily: "var(--font-jetbrains)",
                }}
              >
                sketch · to · code
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

// ============================================================
// 02 - TOKENS
// ============================================================
function TokensSection() {
  const semantic = [
    { name: "Background", light: "bg", dark: "bg" },
    { name: "Surface", light: "surface", dark: "surface" },
    { name: "Elevated", light: "elevated", dark: "elevated" },
    { name: "Text", light: "ink", dark: "ink" },
    { name: "Muted", light: "muted", dark: "muted" },
    { name: "Subtle", light: "subtle", dark: "subtle" },
    { name: "Hairline", light: "hairline", dark: "hairline" },
    { name: "Accent", light: "accent", dark: "accent" },
    { name: "Accent hover", light: "accentHover", dark: "accentHover" },
    { name: "Counter", light: "counter", dark: "counter" },
    { name: "Success", light: "success", dark: "success" },
    { name: "Warning", light: "warning", dark: "warning" },
    { name: "Danger", light: "danger", dark: "danger" },
  ] as const;

  return (
    <SectionShell
      num="02"
      name="Color tokens"
      id="tokens"
      desc="Two modes, one set of semantic names. Every component reads from these tokens - never from raw hex codes - so dark mode is one variable swap, not a rewrite."
    >
      <div
        className="overflow-hidden rounded-2xl border"
        style={{ borderColor: T.light.hairline }}
      >
        {/* Header row */}
        <div
          className="grid grid-cols-12 border-b text-[13px] uppercase tracking-[0.22em]"
          style={{
            borderColor: T.light.hairline,
            background: T.light.surface,
            color: T.light.muted,
            fontFamily: "var(--font-jetbrains)",
          }}
        >
          <div className="col-span-3 px-5 py-3">Semantic</div>
          <div
            className="col-span-1 border-l px-5 py-3"
            style={{ borderColor: T.light.hairline }}
          >
            Token
          </div>
          <div
            className="col-span-4 border-l px-5 py-3"
            style={{ borderColor: T.light.hairline }}
          >
            Light
          </div>
          <div
            className="col-span-4 border-l px-5 py-3"
            style={{
              borderColor: T.light.hairline,
              background: T.dark.bg,
              color: T.dark.muted,
            }}
          >
            Dark
          </div>
        </div>
        {semantic.map((row) => (
          <div
            key={row.name}
            className="grid grid-cols-12 border-b text-[13px]"
            style={{ borderColor: T.light.hairline }}
          >
            <div
              className="col-span-3 px-5 py-3"
              style={{ color: T.light.ink, background: T.light.elevated }}
            >
              {row.name}
            </div>
            <div
              className="col-span-1 border-l px-5 py-3"
              style={{
                borderColor: T.light.hairline,
                color: T.light.muted,
                fontFamily: "var(--font-jetbrains)",
                background: T.light.elevated,
              }}
            >
              {row.light}
            </div>
            <div
              className="col-span-4 flex items-center gap-3 border-l px-5 py-3"
              style={{ borderColor: T.light.hairline }}
            >
              <span
                className="h-5 w-5 rounded border"
                style={{
                  background: T.light[row.light],
                  borderColor: "rgba(0,0,0,0.06)",
                }}
              />
              <span
                className="text-[13px]"
                style={{
                  fontFamily: "var(--font-jetbrains)",
                  color: T.light.ink,
                }}
              >
                {T.light[row.light]}
              </span>
            </div>
            <div
              className="col-span-4 flex items-center gap-3 border-l px-5 py-3"
              style={{
                borderColor: T.light.hairline,
                background: T.dark.bg,
              }}
            >
              <span
                className="h-5 w-5 rounded border"
                style={{
                  background: T.dark[row.dark],
                  borderColor: "rgba(255,255,255,0.06)",
                }}
              />
              <span
                className="text-[13px]"
                style={{
                  fontFamily: "var(--font-jetbrains)",
                  color: T.dark.ink,
                }}
              >
                {T.dark[row.dark]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

// ============================================================
// 03 - TYPOGRAPHY
// ============================================================
function TypographySection() {
  const scale: [string, string, string, string][] = [
    ["display", "72px", "Build less. Ship more.", "fraunces 500 / -0.025em"],
    ["h1", "44px", "A canvas with warmth built in.", "fraunces 600 / -0.02em"],
    ["h2", "30px", "Section heading", "fraunces 600 / -0.015em"],
    ["h3", "22px", "Subheading", "fraunces 500"],
    [
      "body-lg",
      "16px",
      "Body large - generous reading copy.",
      "inter 400 / 1.65",
    ],
    ["body", "14px", "Body - default UI text.", "inter 400 / 1.6"],
    ["body-sm", "13px", "Body small - secondary copy.", "inter 400 / 1.55"],
    ["caption", "11px", "CAPTION · UPPERCASE · +0.20em", "fraunces 500 / smcp"],
    ["mono-sm", "11px", "~/path/to/file.tsx", "jetbrains 400 / 1.5"],
  ];
  return (
    <SectionShell
      num="03"
      name="Type scale"
      id="type"
      desc="Fraunces carries the personality. Inter does the work. JetBrains Mono signals 'tool'. Three families, total. No more."
    >
      <div
        className="overflow-hidden rounded-2xl border"
        style={{ borderColor: T.light.hairline, background: T.light.surface }}
      >
        {scale.map(([name, size, sample, spec]) => {
          const isFraunces = spec.startsWith("fraunces");
          const isMono = spec.startsWith("jetbrains");
          const family = isFraunces
            ? "var(--font-fraunces)"
            : isMono
              ? "var(--font-jetbrains)"
              : "var(--font-inter)";
          const weight = spec.includes("600")
            ? 600
            : spec.includes("500")
              ? 500
              : 400;
          const tracking = spec.includes("-0.025em")
            ? "-0.025em"
            : spec.includes("-0.02em")
              ? "-0.02em"
              : spec.includes("-0.015em")
                ? "-0.015em"
                : name === "caption"
                  ? "0.2em"
                  : "0";
          const transform = name === "caption" ? "uppercase" : "none";
          return (
            <div
              key={name}
              className="grid grid-cols-12 items-baseline gap-6 border-b px-6 py-5"
              style={{ borderColor: T.light.hairline }}
            >
              <div className="col-span-2">
                <div
                  className="text-[13px] uppercase tracking-[0.18em]"
                  style={{
                    color: T.light.muted,
                    fontFamily: "var(--font-jetbrains)",
                  }}
                >
                  {name}
                </div>
                <div
                  className="mt-1 text-[13px]"
                  style={{
                    color: T.light.subtle,
                    fontFamily: "var(--font-jetbrains)",
                  }}
                >
                  {size}
                </div>
              </div>
              <div className="col-span-7">
                <div
                  style={{
                    fontFamily: family,
                    fontWeight: weight,
                    fontSize: size,
                    letterSpacing: tracking,
                    textTransform:
                      transform as React.CSSProperties["textTransform"],
                    color: T.light.ink,
                    lineHeight: 1.1,
                  }}
                >
                  {sample}
                </div>
              </div>
              <div
                className="col-span-3 text-[13px]"
                style={{
                  color: T.light.muted,
                  fontFamily: "var(--font-jetbrains)",
                }}
              >
                {spec}
              </div>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

// ============================================================
// 04 - RADIUS
// ============================================================
function RadiusSection() {
  const radii = [
    { name: "sm", value: "6px", use: "input · small chip" },
    { name: "md", value: "10px", use: "default" },
    { name: "lg", value: "14px", use: "buttons · cards small" },
    { name: "xl", value: "18px", use: "panels · code editor" },
    { name: "2xl", value: "22px", use: "hero · workspace shells" },
    { name: "full", value: "9999px", use: "status pills · dots" },
  ];
  return (
    <SectionShell
      num="04"
      name="Radius scale"
      id="radius"
      desc="Roundness stays - but it's tuned by component, not uniform. Buttons hit medium-large. Workspace shells go big. Status pills go full. The mix of radii reads as designed, not lazy."
    >
      <div className="grid grid-cols-6 gap-4">
        {radii.map((r) => (
          <div
            key={r.name}
            className="border p-5"
            style={{
              borderColor: T.light.hairline,
              background: T.light.surface,
              borderRadius: r.value === "9999px" ? "22px" : r.value,
            }}
          >
            <div
              className="mx-auto h-16 w-16"
              style={{
                background: T.light.accent,
                borderRadius: r.value,
              }}
            />
            <div
              className="mt-4 text-[13px] font-medium"
              style={{ color: T.light.ink }}
            >
              {r.name}
            </div>
            <div
              className="text-[13px]"
              style={{
                color: T.light.muted,
                fontFamily: "var(--font-jetbrains)",
              }}
            >
              {r.value}
            </div>
            <div className="mt-1 text-[13px]" style={{ color: T.light.subtle }}>
              {r.use}
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

// ============================================================
// 05 - BUTTONS (all states, both modes)
// ============================================================
function ButtonStateRow({ mode }: { mode: "light" | "dark" }) {
  const t = T[mode];
  return (
    <div className="grid grid-cols-6 gap-3">
      {/* Primary */}
      <BtnDemo label="Primary" mode={mode}>
        <button
          className="ds-btn rounded-xl px-4 py-2 text-[13px] font-medium"
          style={{
            background: t.accent,
            color: mode === "light" ? "#FAF4E4" : "#1A1410",
          }}
        >
          Run detection
        </button>
        <button
          className="ds-btn rounded-xl px-4 py-2 text-[13px] font-medium"
          style={{
            background: t.accentHover,
            color: mode === "light" ? "#FAF4E4" : "#1A1410",
          }}
        >
          Hover
        </button>
        <button
          className="ds-btn rounded-xl px-4 py-2 text-[13px] font-medium"
          style={{
            background: t.accent,
            color: mode === "light" ? "#FAF4E4" : "#1A1410",
            boxShadow: `0 0 0 3px ${t.accentSoft}`,
          }}
        >
          Focus
        </button>
        <button
          disabled
          className="rounded-xl px-4 py-2 text-[13px] font-medium"
          style={{
            background: t.hairline,
            color: t.subtle,
            cursor: "not-allowed",
          }}
        >
          Disabled
        </button>
        <button
          className="ds-btn flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium"
          style={{
            background: t.accent,
            color: mode === "light" ? "#FAF4E4" : "#1A1410",
          }}
        >
          <Spinner color={mode === "light" ? "#FAF4E4" : "#1A1410"} size={12} />
          Loading
        </button>
      </BtnDemo>

      {/* Secondary */}
      <BtnDemo label="Secondary" mode={mode}>
        <button
          className="ds-btn rounded-xl border-2 px-4 py-[6px] text-[13px] font-medium"
          style={{ borderColor: t.ink, color: t.ink }}
        >
          Save
        </button>
        <button
          className="ds-btn rounded-xl border-2 px-4 py-[6px] text-[13px] font-medium"
          style={{ borderColor: t.ink, background: t.surface, color: t.ink }}
        >
          Hover
        </button>
        <button
          className="ds-btn rounded-xl border-2 px-4 py-[6px] text-[13px] font-medium"
          style={{
            borderColor: t.ink,
            color: t.ink,
            boxShadow: `0 0 0 3px ${t.accentSoft}`,
          }}
        >
          Focus
        </button>
        <button
          disabled
          className="rounded-xl border-2 px-4 py-[6px] text-[13px] font-medium"
          style={{
            borderColor: t.hairline,
            color: t.subtle,
            cursor: "not-allowed",
          }}
        >
          Disabled
        </button>
        <span className="text-[13px]" style={{ color: t.muted }}>
          -
        </span>
      </BtnDemo>

      {/* Ghost */}
      <BtnDemo label="Ghost" mode={mode}>
        <button
          className="ds-btn rounded-xl px-4 py-2 text-[13px] font-medium"
          style={{ color: t.ink }}
        >
          Cancel
        </button>
        <button
          className="ds-btn rounded-xl px-4 py-2 text-[13px] font-medium"
          style={{ background: t.surface, color: t.ink }}
        >
          Hover
        </button>
        <button
          className="ds-btn rounded-xl px-4 py-2 text-[13px] font-medium"
          style={{
            color: t.ink,
            boxShadow: `0 0 0 3px ${t.accentSoft}`,
          }}
        >
          Focus
        </button>
        <button
          disabled
          className="rounded-xl px-4 py-2 text-[13px] font-medium"
          style={{ color: t.subtle, cursor: "not-allowed" }}
        >
          Disabled
        </button>
        <span className="text-[13px]" style={{ color: t.muted }}>
          -
        </span>
      </BtnDemo>

      {/* Danger */}
      <BtnDemo label="Danger" mode={mode}>
        <button
          className="ds-btn rounded-xl px-4 py-2 text-[13px] font-medium"
          style={{
            background: t.danger,
            color: mode === "light" ? "#FAF4E4" : "#1A1410",
          }}
        >
          Delete
        </button>
        <button
          className="ds-btn rounded-xl px-4 py-2 text-[13px] font-medium"
          style={{
            background: "#7E2E22",
            color: "#FAF4E4",
          }}
        >
          Hover
        </button>
        <button
          className="ds-btn rounded-xl px-4 py-2 text-[13px] font-medium"
          style={{
            background: t.danger,
            color: mode === "light" ? "#FAF4E4" : "#1A1410",
            boxShadow: `0 0 0 3px rgba(155,59,46,0.25)`,
          }}
        >
          Focus
        </button>
        <button
          disabled
          className="rounded-xl px-4 py-2 text-[13px] font-medium"
          style={{
            background: t.hairline,
            color: t.subtle,
            cursor: "not-allowed",
          }}
        >
          Disabled
        </button>
        <span className="text-[13px]" style={{ color: t.muted }}>
          -
        </span>
      </BtnDemo>

      {/* Icon */}
      <BtnDemo label="Icon" mode={mode}>
        <button
          className="ds-btn flex h-9 w-9 items-center justify-center rounded-xl"
          style={{
            background: t.surface,
            color: t.ink,
            border: `1px solid ${t.hairline}`,
          }}
          aria-label="play"
        >
          <PlayIcon />
        </button>
        <button
          className="ds-btn flex h-9 w-9 items-center justify-center rounded-xl"
          style={{
            background: t.accent,
            color: mode === "light" ? "#FAF4E4" : "#1A1410",
          }}
        >
          <PlayIcon />
        </button>
        <button
          className="ds-btn flex h-9 w-9 items-center justify-center rounded-xl"
          style={{
            background: t.surface,
            color: t.ink,
            border: `1px solid ${t.hairline}`,
            boxShadow: `0 0 0 3px ${t.accentSoft}`,
          }}
        >
          <PlayIcon />
        </button>
        <button
          disabled
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{
            background: t.surface,
            color: t.subtle,
            border: `1px solid ${t.hairline}`,
            cursor: "not-allowed",
          }}
        >
          <PlayIcon />
        </button>
        <span className="text-[13px]" style={{ color: t.muted }}>
          -
        </span>
      </BtnDemo>

      {/* CTA with icon */}
      <BtnDemo label="With icon" mode={mode}>
        <button
          className="ds-btn flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium"
          style={{
            background: t.accent,
            color: mode === "light" ? "#FAF4E4" : "#1A1410",
          }}
        >
          <ArrowIcon /> Generate
        </button>
        <button
          className="ds-btn flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium"
          style={{
            background: t.surface,
            color: t.ink,
            border: `1px solid ${t.hairline}`,
          }}
        >
          <DownloadIcon /> Export
        </button>
        <span className="text-[13px]" style={{ color: t.muted }}>
          -
        </span>
        <span className="text-[13px]" style={{ color: t.muted }}>
          -
        </span>
        <span className="text-[13px]" style={{ color: t.muted }}>
          -
        </span>
      </BtnDemo>
    </div>
  );
}

function BtnDemo({
  label,
  mode,
  children,
}: {
  label: string;
  mode: "light" | "dark";
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div
        className="text-[13px] uppercase tracking-[0.18em]"
        style={{
          color: T[mode].muted,
          fontFamily: "var(--font-jetbrains)",
        }}
      >
        {label}
      </div>
      <div className="flex flex-col items-start gap-2">{children}</div>
    </div>
  );
}

function ButtonsSection() {
  return (
    <SectionShell
      num="05"
      name="Buttons"
      id="buttons"
      desc="Five variants. Every state explicit. Default, hover, focus (visible 3px terracotta-soft ring), disabled, loading. Pressed scales to 0.97 - defined globally on .ds-btn."
    >
      <div className="space-y-6">
        <ModePanel mode="light">
          <ButtonStateRow mode="light" />
        </ModePanel>
        <ModePanel mode="dark">
          <ButtonStateRow mode="dark" />
        </ModePanel>
      </div>
    </SectionShell>
  );
}

// ---------- Small icons ----------
function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12M6 11l6 6 6-6M5 21h14" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function Spinner({
  color = "currentColor",
  size = 14,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      className="ds-spin"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke={color}
        strokeOpacity="0.2"
        strokeWidth="2.5"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ============================================================
// 06 - FORMS
// ============================================================
function FormsSection() {
  return (
    <SectionShell
      num="06"
      name="Forms"
      id="forms"
      desc="Inputs use rounded-md (10px) - slightly less playful than buttons, more focused on legibility. Focus ring is the same 3px terracotta-soft as buttons. Error state replaces hairline with danger and shows a single-line message below."
    >
      <div className="grid grid-cols-2 gap-6">
        <ModePanel mode="light">
          <FormPrimitives mode="light" />
        </ModePanel>
        <ModePanel mode="dark">
          <FormPrimitives mode="dark" />
        </ModePanel>
      </div>
    </SectionShell>
  );
}

function FormPrimitives({ mode }: { mode: "light" | "dark" }) {
  const t = T[mode];
  const baseInput: React.CSSProperties = {
    background: t.surface,
    border: `1px solid ${t.hairline}`,
    color: t.ink,
    borderRadius: 10,
  };
  return (
    <div className="space-y-5">
      {/* Text inputs */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label mode={mode}>Default</Label>
          <input
            placeholder="project name"
            className="mt-2 w-full px-3.5 py-2 text-[13px] outline-none"
            style={baseInput}
          />
        </div>
        <div>
          <Label mode={mode}>Focused</Label>
          <input
            defaultValue="landing-v3"
            readOnly
            className="mt-2 w-full px-3.5 py-2 text-[13px] outline-none"
            style={{
              ...baseInput,
              borderColor: t.accent,
              boxShadow: `0 0 0 3px ${t.accentSoft}`,
            }}
          />
        </div>
        <div>
          <Label mode={mode}>Error</Label>
          <input
            defaultValue="landing v3!"
            readOnly
            className="mt-2 w-full px-3.5 py-2 text-[13px] outline-none"
            style={{ ...baseInput, borderColor: t.danger }}
          />
          <div className="mt-1.5 text-[13px]" style={{ color: t.danger }}>
            Project names cannot contain spaces or symbols.
          </div>
        </div>
        <div>
          <Label mode={mode}>Disabled</Label>
          <input
            defaultValue="archived-project"
            disabled
            className="mt-2 w-full px-3.5 py-2 text-[13px] outline-none"
            style={{
              ...baseInput,
              color: t.subtle,
              cursor: "not-allowed",
              background: mode === "light" ? "#EFE7D5" : "#1F1812",
            }}
          />
        </div>
      </div>

      {/* Search + Select */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label mode={mode}>Search</Label>
          <div
            className="mt-2 flex items-center gap-2 px-3 py-2"
            style={baseInput}
          >
            <span style={{ color: t.muted }}>
              <SearchIcon />
            </span>
            <input
              placeholder="Search projects, components, files…"
              className="w-full bg-transparent text-[13px] outline-none"
              style={{ color: t.ink }}
            />
            <span
              className="rounded border px-1.5 py-0.5 text-[13px]"
              style={{
                borderColor: t.hairline,
                color: t.muted,
                fontFamily: "var(--font-jetbrains)",
              }}
            >
              Ctrl+K
            </span>
          </div>
        </div>
        <div>
          <Label mode={mode}>Select</Label>
          <div
            className="mt-2 flex items-center justify-between px-3.5 py-2 text-[13px]"
            style={baseInput}
          >
            <span style={{ color: t.ink }}>React + Tailwind</span>
            <span style={{ color: t.muted }}>
              <ChevronIcon />
            </span>
          </div>
        </div>
      </div>

      {/* Textarea */}
      <div>
        <Label mode={mode}>Textarea</Label>
        <textarea
          rows={3}
          defaultValue="Make the hero darker. Add a subtle gold underline to the CTA on hover. Keep everything else."
          readOnly
          className="mt-2 w-full px-3.5 py-2.5 text-[13px] outline-none"
          style={baseInput}
        />
      </div>

      {/* Checkbox · Radio · Switch */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label mode={mode}>Checkbox</Label>
          <div className="mt-3 space-y-2.5">
            {[
              ["Auto-save iterations", true],
              ["Show grid", true],
              ["Snap to grid", false],
            ].map(([label, checked]) => (
              <label
                key={String(label)}
                className="flex items-center gap-2.5 text-[13px]"
                style={{ color: t.ink }}
              >
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-[5px]"
                  style={{
                    background: checked ? t.accent : "transparent",
                    border: `1.5px solid ${checked ? t.accent : t.hairline}`,
                    color: mode === "light" ? "#FAF4E4" : "#1A1410",
                  }}
                >
                  {checked ? <CheckIcon /> : null}
                </span>
                {label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <Label mode={mode}>Radio</Label>
          <div className="mt-3 space-y-2.5">
            {[
              ["React + Tailwind", true],
              ["HTML + CSS", false],
              ["Vue + Tailwind", false],
            ].map(([label, checked]) => (
              <label
                key={String(label)}
                className="flex items-center gap-2.5 text-[13px]"
                style={{ color: t.ink }}
              >
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-full"
                  style={{
                    border: `1.5px solid ${checked ? t.accent : t.hairline}`,
                  }}
                >
                  {checked ? (
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: t.accent }}
                    />
                  ) : null}
                </span>
                {label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <Label mode={mode}>Switch</Label>
          <div className="mt-3 space-y-3">
            {[
              ["Dark mode", true],
              ["Live preview", true],
              ["Analytics", false],
            ].map(([label, checked]) => (
              <div
                key={String(label)}
                className="flex items-center justify-between text-[13px]"
                style={{ color: t.ink }}
              >
                <span>{label}</span>
                <span
                  className="flex h-5 w-9 items-center rounded-full p-0.5"
                  style={{
                    background: checked ? t.accent : t.hairline,
                  }}
                >
                  <span
                    className="h-4 w-4 rounded-full"
                    style={{
                      background: mode === "light" ? "#FAF4E4" : "#1A1410",
                      transform: checked ? "translateX(16px)" : "translateX(0)",
                      transition: "transform 200ms cubic-bezier(0.16,1,0.3,1)",
                    }}
                  />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 07 - SURFACES (modal, dropdown, tooltip)
// ============================================================
function SurfacesSection() {
  return (
    <SectionShell
      num="07"
      name="Surfaces"
      id="surfaces"
      desc="Modals get a soft ink scrim (not opaque black). Dropdowns inherit surface tokens. Tooltips are ink-on-linen - the only place ink touches the foreground without being a container."
    >
      <div className="grid grid-cols-12 gap-6">
        {/* Modal */}
        <div
          className="col-span-7 overflow-hidden rounded-2xl border"
          style={{
            borderColor: T.light.hairline,
            background:
              "radial-gradient(circle at 30% 20%, rgba(26,20,16,0.18) 0%, rgba(26,20,16,0.08) 60%), #F1E9D8",
            minHeight: 360,
          }}
        >
          <div className="flex h-full items-center justify-center p-10">
            <div
              className="w-full max-w-md rounded-2xl border p-6"
              style={{
                background: T.light.surface,
                borderColor: T.light.hairline,
                boxShadow: "0 30px 80px -30px rgba(26,20,16,0.35)",
              }}
            >
              <div className="flex items-center justify-between">
                <Label>Modal</Label>
                <button
                  className="flex h-7 w-7 items-center justify-center rounded-md"
                  style={{ color: T.light.muted }}
                  aria-label="close"
                >
                  <CloseIcon />
                </button>
              </div>
              <h3
                className="mt-3 text-[22px] tracking-tight"
                style={{
                  fontFamily: "var(--font-fraunces)",
                  fontWeight: 600,
                  color: T.light.ink,
                }}
              >
                Delete this project?
              </h3>
              <p
                className="mt-2 text-[13px] leading-[1.6]"
                style={{ color: T.light.muted }}
              >
                <span style={{ color: T.light.ink, fontWeight: 500 }}>
                  Onboarding flow, v2
                </span>{" "}
                and its 14 iterations will be removed. This cannot be undone.
              </p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  className="ds-btn rounded-xl px-4 py-2 text-[13px] font-medium"
                  style={{ color: T.light.ink }}
                >
                  Cancel
                </button>
                <button
                  className="ds-btn rounded-xl px-4 py-2 text-[13px] font-medium"
                  style={{
                    background: T.light.danger,
                    color: T.light.surface,
                  }}
                >
                  Delete project
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Dropdown + Tooltip */}
        <div className="col-span-5 space-y-6">
          {/* Dropdown */}
          <div
            className="rounded-2xl border p-5"
            style={{
              background: T.light.surface,
              borderColor: T.light.hairline,
            }}
          >
            <Label>Dropdown menu</Label>
            <div className="mt-4 flex items-start gap-4">
              <button
                className="flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px]"
                style={{
                  background: T.light.elevated,
                  borderColor: T.light.hairline,
                  color: T.light.ink,
                }}
              >
                Project ▾
              </button>
              <div
                className="min-w-[200px] rounded-xl border py-1.5"
                style={{
                  background: T.light.elevated,
                  borderColor: T.light.hairline,
                  boxShadow: "0 18px 48px -24px rgba(26,20,16,0.3)",
                }}
              >
                {[
                  ["Open in canvas", "⏎"],
                  ["Duplicate", "Ctrl+D"],
                  ["Rename", "Ctrl+R"],
                  ["Export ZIP", "Ctrl+E"],
                ].map(([label, key]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between px-3 py-1.5 text-[13px]"
                    style={{ color: T.light.ink }}
                  >
                    <span>{label}</span>
                    <span
                      className="text-[13px]"
                      style={{
                        color: T.light.muted,
                        fontFamily: "var(--font-jetbrains)",
                      }}
                    >
                      {key}
                    </span>
                  </div>
                ))}
                <div
                  className="my-1 border-t"
                  style={{ borderColor: T.light.hairline }}
                />
                <div
                  className="flex items-center justify-between px-3 py-1.5 text-[13px]"
                  style={{ color: T.light.danger }}
                >
                  <span>Delete</span>
                  <span
                    className="text-[13px]"
                    style={{ fontFamily: "var(--font-jetbrains)" }}
                  >
                    ⌫
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tooltip */}
          <div
            className="rounded-2xl border p-5"
            style={{
              background: T.light.surface,
              borderColor: T.light.hairline,
            }}
          >
            <Label>Tooltip</Label>
            <div className="mt-6 flex items-center justify-center gap-4">
              <div className="relative">
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-xl border"
                  style={{
                    background: T.light.elevated,
                    borderColor: T.light.hairline,
                    color: T.light.ink,
                  }}
                >
                  <PlayIcon />
                </button>
                <div
                  className="absolute left-1/2 top-[-44px] -translate-x-1/2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px]"
                  style={{
                    background: T.light.anchor,
                    color: T.light.surface,
                    fontFamily: "var(--font-inter)",
                  }}
                >
                  Run detection
                  <span
                    className="ml-2 rounded px-1 py-0.5 text-[12px]"
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      fontFamily: "var(--font-jetbrains)",
                    }}
                  >
                    R
                  </span>
                  <span
                    className="absolute bottom-[-4px] left-1/2 h-2 w-2 -translate-x-1/2 rotate-45"
                    style={{ background: T.light.anchor }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

// ============================================================
// 08 - FEEDBACK (toast, skeleton, spinner, progress)
// ============================================================
function FeedbackSection() {
  const toasts = [
    {
      name: "Success",
      bg: T.light.counterSoft,
      border: T.light.counter,
      text: T.light.counter,
      icon: <CheckIcon />,
      title: "Code generated",
      body: "184 lines · React + Tailwind · 1.2s",
    },
    {
      name: "Info",
      bg: "#E8E1D0",
      border: T.light.muted,
      text: T.light.ink,
      icon: <PlayIcon />,
      title: "Detection running",
      body: "Roboflow · 4 components found",
    },
    {
      name: "Warning",
      bg: "#F5E3C8",
      border: T.light.warning,
      text: "#7A4E10",
      icon: <PlayIcon />,
      title: "Card confidence low",
      body: "Re-draw or refine with chat",
    },
    {
      name: "Danger",
      bg: "#F4D8D2",
      border: T.light.danger,
      text: T.light.danger,
      icon: <CloseIcon />,
      title: "Generation failed",
      body: "Gemini timeout · retrying in 4s",
    },
  ];

  return (
    <SectionShell
      num="08"
      name="Feedback"
      id="feedback"
      desc="Toasts use tinted versions of the semantic colors - never the saturated form. Skeletons shimmer with a terracotta wash, not grey. Progress bars use the accent. Always."
    >
      {/* Toasts */}
      <div className="grid grid-cols-4 gap-4">
        {toasts.map((t) => (
          <div
            key={t.name}
            className="rounded-2xl border-l-4 border-y border-r p-4"
            style={{
              background: t.bg,
              borderLeftColor: t.border,
              borderTopColor: T.light.hairline,
              borderBottomColor: T.light.hairline,
              borderRightColor: T.light.hairline,
            }}
          >
            <div className="flex items-start gap-3">
              <span style={{ color: t.text }} className="mt-0.5">
                {t.icon}
              </span>
              <div className="flex-1">
                <div
                  className="text-[13px] font-medium"
                  style={{ color: T.light.ink }}
                >
                  {t.title}
                </div>
                <div
                  className="mt-0.5 text-[13px]"
                  style={{ color: T.light.muted }}
                >
                  {t.body}
                </div>
              </div>
              <button style={{ color: T.light.muted }}>
                <CloseIcon />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Skeleton + Spinner + Progress */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        {/* Skeleton */}
        <div
          className="rounded-2xl border p-5"
          style={{
            background: T.light.surface,
            borderColor: T.light.hairline,
          }}
        >
          <Label>Skeleton</Label>
          <div className="mt-4 space-y-2">
            <div
              className="ds-shimmer h-5 w-3/4 rounded-md"
              style={{ background: T.light.hairline }}
            />
            <div
              className="ds-shimmer h-3 w-full rounded-md"
              style={{ background: T.light.hairline }}
            />
            <div
              className="ds-shimmer h-3 w-5/6 rounded-md"
              style={{ background: T.light.hairline }}
            />
            <div
              className="ds-shimmer mt-3 h-24 w-full rounded-xl"
              style={{ background: T.light.hairline }}
            />
          </div>
        </div>
        {/* Spinner */}
        <div
          className="flex flex-col items-center justify-center rounded-2xl border p-5"
          style={{
            background: T.light.surface,
            borderColor: T.light.hairline,
          }}
        >
          <Label>Spinner</Label>
          <div className="my-6 flex items-center gap-5">
            <Spinner color={T.light.accent} size={16} />
            <Spinner color={T.light.accent} size={24} />
            <Spinner color={T.light.accent} size={36} />
          </div>
          <div
            className="text-[13px]"
            style={{
              color: T.light.muted,
              fontFamily: "var(--font-jetbrains)",
            }}
          >
            generating… 1.2s elapsed
          </div>
        </div>
        {/* Progress */}
        <div
          className="rounded-2xl border p-5"
          style={{
            background: T.light.surface,
            borderColor: T.light.hairline,
          }}
        >
          <Label>Progress</Label>
          <div className="mt-4">
            <div className="flex items-center justify-between text-[13px]">
              <span style={{ color: T.light.ink }}>Detecting components</span>
              <span
                style={{
                  color: T.light.muted,
                  fontFamily: "var(--font-jetbrains)",
                }}
              >
                3 / 4
              </span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full"
              style={{ background: T.light.hairline }}
            >
              <div
                className="ds-progress h-full rounded-full"
                style={{ background: T.light.accent }}
              />
            </div>
          </div>
          <div className="mt-5">
            <div className="flex items-center justify-between text-[13px]">
              <span style={{ color: T.light.ink }}>Gemini generation</span>
              <span
                style={{
                  color: T.light.muted,
                  fontFamily: "var(--font-jetbrains)",
                }}
              >
                streaming
              </span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full"
              style={{ background: T.light.hairline }}
            >
              <div
                className="ds-shimmer h-full rounded-full"
                style={{ background: T.light.accent }}
              />
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

// ============================================================
// 09 - STATES (empty, error)
// ============================================================
function StatesSection() {
  return (
    <SectionShell
      num="09"
      name="States"
      id="states"
      desc="Empty isn't blank - it's invitational. Error isn't apologetic - it's actionable. Both use illustration sparingly: a single SVG mark, not a stock illustration."
    >
      <div className="grid grid-cols-2 gap-6">
        {/* Empty */}
        <div
          className="rounded-2xl border p-10 text-center"
          style={{
            background: T.light.surface,
            borderColor: T.light.hairline,
          }}
        >
          <div className="ds-float inline-block">
            <Logo size={56} color={T.light.accent} />
          </div>
          <h3
            className="mt-6 text-[24px] tracking-tight"
            style={{
              fontFamily: "var(--font-fraunces)",
              fontWeight: 600,
              color: T.light.ink,
            }}
          >
            No projects yet
          </h3>
          <p
            className="mx-auto mt-2 max-w-sm text-[13px]"
            style={{ color: T.light.muted }}
          >
            Start with a sketch. Even a rectangle is enough.
          </p>
          <button
            className="ds-btn mt-5 rounded-xl px-4 py-2 text-[13px] font-medium"
            style={{ background: T.light.accent, color: T.light.surface }}
          >
            New canvas
          </button>
        </div>
        {/* Error */}
        <div
          className="rounded-2xl border p-10 text-center"
          style={{
            background: T.light.surface,
            borderColor: T.light.hairline,
          }}
        >
          <div
            className="inline-flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: T.light.accentSoft, color: T.light.danger }}
          >
            <CloseIcon />
          </div>
          <h3
            className="mt-6 text-[24px] tracking-tight"
            style={{
              fontFamily: "var(--font-fraunces)",
              fontWeight: 600,
              color: T.light.ink,
            }}
          >
            Detection failed
          </h3>
          <p
            className="mx-auto mt-2 max-w-sm text-[13px]"
            style={{ color: T.light.muted }}
          >
            Roboflow returned 0 predictions. Your sketch might be on a
            transparent background - composite to white and try again.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              className="ds-btn rounded-xl border-2 px-4 py-[6px] text-[13px] font-medium"
              style={{ borderColor: T.light.ink, color: T.light.ink }}
            >
              Try again
            </button>
            <button
              className="ds-btn rounded-xl px-4 py-2 text-[13px] font-medium"
              style={{ color: T.light.muted }}
            >
              Read docs
            </button>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

// ============================================================
// 10 - MOTION
// ============================================================
function MotionSection() {
  const timings = [
    { name: "instant", ms: "100ms", use: "button press · toggle" },
    { name: "fast", ms: "200ms", use: "most interactions" },
    { name: "base", ms: "320ms", use: "panel · drawer · tooltip" },
    { name: "slow", ms: "500ms", use: "page · route change" },
    { name: "hero", ms: "800ms", use: "signature moments" },
  ];
  const easings = [
    {
      name: "out",
      curve: "cubic-bezier(0.16, 1, 0.3, 1)",
      use: "most things - settles softly",
    },
    {
      name: "soft",
      curve: "cubic-bezier(0.4, 0, 0.2, 1)",
      use: "neutral · material default",
    },
    {
      name: "spring",
      curve: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      use: "tool select · checkbox · toast",
    },
    {
      name: "ink",
      curve: "cubic-bezier(0.65, 0, 0.35, 1)",
      use: "headlines · hero · magazine feel",
    },
  ];
  return (
    <SectionShell
      num="10"
      name="Motion language"
      id="motion"
      desc="Five timings, four easings, six signature motions. Every animation in CodeCanvas reads from this list - never improvised. The point of a motion language is that the brand feels coherent in motion the way it feels coherent in colour."
    >
      {/* Timing + easing tokens */}
      <div className="grid grid-cols-2 gap-6">
        <div
          className="rounded-2xl border p-6"
          style={{
            background: T.light.surface,
            borderColor: T.light.hairline,
          }}
        >
          <Label>Duration tokens</Label>
          <div className="mt-4 space-y-3">
            {timings.map((t) => (
              <div key={t.name} className="flex items-center gap-4 text-[13px]">
                <div
                  className="w-16 text-[13px]"
                  style={{
                    color: T.light.ink,
                    fontFamily: "var(--font-jetbrains)",
                  }}
                >
                  t-{t.name}
                </div>
                <div
                  className="w-16 text-[13px]"
                  style={{
                    color: T.light.accent,
                    fontFamily: "var(--font-jetbrains)",
                  }}
                >
                  {t.ms}
                </div>
                <div style={{ color: T.light.muted }}>{t.use}</div>
              </div>
            ))}
          </div>
        </div>
        <div
          className="rounded-2xl border p-6"
          style={{
            background: T.light.surface,
            borderColor: T.light.hairline,
          }}
        >
          <Label>Easing tokens</Label>
          <div className="mt-4 space-y-3">
            {easings.map((e) => (
              <div key={e.name} className="text-[13px]">
                <div className="flex items-center gap-3">
                  <span
                    style={{
                      color: T.light.ink,
                      fontFamily: "var(--font-jetbrains)",
                      width: 56,
                    }}
                  >
                    e-{e.name}
                  </span>
                  <span
                    className="text-[13px]"
                    style={{
                      color: T.light.accent,
                      fontFamily: "var(--font-jetbrains)",
                    }}
                  >
                    {e.curve}
                  </span>
                </div>
                <div
                  className="ml-[56px] mt-0.5"
                  style={{ color: T.light.muted }}
                >
                  {e.use}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live motion demos */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        {/* Shimmer / skeleton */}
        <MotionTile
          title="Shimmer"
          caption="terracotta wash · 1.6s · loop"
          spec="loading content"
        >
          <div className="space-y-2">
            <div
              className="ds-shimmer h-4 w-2/3 rounded-md"
              style={{ background: T.light.hairline }}
            />
            <div
              className="ds-shimmer h-4 w-full rounded-md"
              style={{ background: T.light.hairline }}
            />
            <div
              className="ds-shimmer h-4 w-3/4 rounded-md"
              style={{ background: T.light.hairline }}
            />
          </div>
        </MotionTile>
        {/* Pulse */}
        <MotionTile
          title="Pulse"
          caption="t-base · e-out · loop"
          spec="live · status indicator"
        >
          <div className="flex items-center justify-center gap-2 py-4">
            <span className="relative flex h-3 w-3">
              <span
                className="ds-pulse absolute inset-0 rounded-full"
                style={{ background: T.light.counter }}
              />
              <span
                className="relative h-3 w-3 rounded-full"
                style={{ background: T.light.counter }}
              />
            </span>
            <span
              className="text-[13px]"
              style={{
                color: T.light.muted,
                fontFamily: "var(--font-jetbrains)",
              }}
            >
              ● live
            </span>
          </div>
        </MotionTile>
        {/* Spinner */}
        <MotionTile
          title="Spin"
          caption="900ms · linear · loop"
          spec="ai · generation · saving"
        >
          <div className="flex items-center justify-center py-4">
            <Spinner color={T.light.accent} size={32} />
          </div>
        </MotionTile>
        {/* Stroke draw */}
        <MotionTile
          title="Stroke draw"
          caption="t-hero · e-ink · alt"
          spec="hero icons · sketch-on reveal"
        >
          <div className="flex items-center justify-center py-2">
            <svg
              viewBox="0 0 60 60"
              width="60"
              height="60"
              fill="none"
              stroke={T.light.accent}
              strokeWidth="3"
              strokeLinecap="round"
            >
              <path className="ds-draw" d="M10 30 Q 30 5, 50 30 T 10 30" />
            </svg>
          </div>
        </MotionTile>
        {/* Code rain */}
        <MotionTile
          title="Code-in"
          caption="staggered · 70ms · e-out"
          spec="generation reveal"
        >
          <div
            className="ds-code-rain space-y-0.5 text-[13px]"
            style={{
              fontFamily: "var(--font-jetbrains)",
              color: T.light.ink,
            }}
          >
            <div>
              <span style={{ color: T.light.muted }}>1</span>{" "}
              <span style={{ color: T.light.accent }}>export</span> default …
            </div>
            <div>
              <span style={{ color: T.light.muted }}>2</span> &nbsp; return (
            </div>
            <div>
              <span style={{ color: T.light.muted }}>3</span> &nbsp;&nbsp; &lt;
              <span style={{ color: T.light.counter }}>div</span>&gt;
            </div>
            <div>
              <span style={{ color: T.light.muted }}>4</span> &nbsp;&nbsp;&nbsp;
              …
            </div>
            <div>
              <span style={{ color: T.light.muted }}>5</span> &nbsp;&nbsp; &lt;/
              <span style={{ color: T.light.counter }}>div</span>&gt;
            </div>
            <div>
              <span style={{ color: T.light.muted }}>6</span> &nbsp;);
            </div>
          </div>
        </MotionTile>
        {/* Float */}
        <MotionTile
          title="Float"
          caption="3.4s · e-soft · loop"
          spec="empty-state mark · gentle breath"
        >
          <div className="flex items-center justify-center py-2">
            <span className="ds-float inline-block">
              <Logo size={56} color={T.light.accent} />
            </span>
          </div>
        </MotionTile>
      </div>

      {/* Signature moment description */}
      <div
        className="mt-6 rounded-2xl border p-8"
        style={{
          background: T.light.anchor,
          borderColor: T.light.anchor,
          color: T.light.surface,
        }}
      >
        <Label mode="dark">Signature moment · the magic</Label>
        <div className="mt-4 grid grid-cols-12 gap-8">
          <div className="col-span-7">
            <h3
              className="text-[32px] leading-tight tracking-tight"
              style={{
                fontFamily: "var(--font-fraunces)",
                fontWeight: 500,
              }}
            >
              Sketch → code,
              <br />
              <em style={{ color: T.dark.accent }}>the transition</em>
            </h3>
            <p
              className="mt-4 max-w-md text-[13px] leading-[1.7]"
              style={{ color: T.dark.muted }}
            >
              When detection completes, the canvas shrinks 1.4 → 1.0 scale,
              translates to a thumbnail in the top-left (t-slow · e-ink). The
              code panel rises from the bottom (t-slow · e-out · 80ms delay).
              Each detected element gets a terracotta bounding ring that pulses
              once (t-base · e-spring) before settling. The whole choreography
              is 1.2 seconds - long enough to feel like a moment, short enough
              to not annoy.
            </p>
          </div>
          <div className="col-span-5">
            <div
              className="rounded-xl border p-4"
              style={{
                background: T.dark.surface,
                borderColor: T.dark.hairline,
              }}
            >
              <div
                className="text-[13px] uppercase tracking-[0.2em]"
                style={{
                  color: T.dark.muted,
                  fontFamily: "var(--font-jetbrains)",
                }}
              >
                Choreography
              </div>
              <ol
                className="mt-3 space-y-1.5 text-[13px]"
                style={{
                  color: T.dark.ink,
                  fontFamily: "var(--font-jetbrains)",
                }}
              >
                <li>0ms · detection complete</li>
                <li>0ms · canvas scale 1 → 0.3 · translate</li>
                <li>80ms · code panel rise · opacity 0 → 1</li>
                <li>120ms · bounding rings stagger in</li>
                <li>320ms · ring pulse (once)</li>
                <li>500ms · code-rain begins</li>
                <li>1200ms · done · idle</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

function MotionTile({
  title,
  caption,
  spec,
  children,
}: {
  title: string;
  caption: string;
  spec: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        background: T.light.surface,
        borderColor: T.light.hairline,
      }}
    >
      <div className="flex items-baseline justify-between">
        <div className="text-[13px] font-medium" style={{ color: T.light.ink }}>
          {title}
        </div>
        <div
          className="text-[13px]"
          style={{
            color: T.light.muted,
            fontFamily: "var(--font-jetbrains)",
          }}
        >
          {caption}
        </div>
      </div>
      <div className="my-4 min-h-[80px]">{children}</div>
      <div className="text-[13px]" style={{ color: T.light.subtle }}>
        {spec}
      </div>
    </div>
  );
}

// ============================================================
// 11 - ICONS
// ============================================================
function IconsSection() {
  return (
    <SectionShell
      num="11"
      name="Iconography"
      id="icons"
      desc="lucide-react at 1.6px stroke, 16/20/24px sizes. Sharp enough to feel precise, thin enough to sit beside Fraunces without competing. Custom icons (canvas tools) match this exact stroke weight - no exceptions."
    >
      <div
        className="rounded-2xl border p-6"
        style={{
          background: T.light.surface,
          borderColor: T.light.hairline,
        }}
      >
        <div className="grid grid-cols-8 gap-4">
          {[
            "play",
            "arrow",
            "download",
            "check",
            "close",
            "search",
            "chevron",
            "spinner",
          ].map((name) => (
            <div
              key={name}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border p-4"
              style={{
                background: T.light.elevated,
                borderColor: T.light.hairline,
              }}
            >
              <span style={{ color: T.light.ink }}>
                {name === "play" && <PlayIcon />}
                {name === "arrow" && <ArrowIcon />}
                {name === "download" && <DownloadIcon />}
                {name === "check" && <CheckIcon />}
                {name === "close" && <CloseIcon />}
                {name === "search" && <SearchIcon />}
                {name === "chevron" && <ChevronIcon />}
                {name === "spinner" && (
                  <Spinner color={T.light.ink} size={14} />
                )}
              </span>
              <span
                className="text-[13px]"
                style={{
                  color: T.light.muted,
                  fontFamily: "var(--font-jetbrains)",
                }}
              >
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

// ============================================================
// FOOTER
// ============================================================
function DSFooter() {
  return (
    <footer
      className="border-t"
      style={{
        borderColor: T.light.hairline,
        background: T.light.anchor,
        color: T.light.surface,
      }}
    >
      <div className="mx-auto max-w-[1440px] px-16 py-14">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-5">
            <div className="flex items-center gap-3">
              <Logo size={36} color={T.dark.accent} />
              <Wordmark color={T.dark.ink} size={24} />
            </div>
            <p
              className="mt-4 max-w-sm text-[13px]"
              style={{ color: T.dark.muted }}
            >
              Warm Studio v0.1 - the system that powers CodeCanvas. Implement
              once. Re-skin never.
            </p>
          </div>
          <div className="col-span-7 grid grid-cols-3 gap-6">
            <div>
              <Label mode="dark">Next steps</Label>
              <ul
                className="mt-3 space-y-1.5 text-[13px]"
                style={{ color: T.dark.ink }}
              >
                <li>1 · Landing page pilot</li>
                <li>2 · Canvas workspace</li>
                <li>3 · Dashboard</li>
                <li>4 · Auth pages</li>
                <li>5 · Profile + settings</li>
              </ul>
            </div>
            <div>
              <Label mode="dark">Files affected</Label>
              <ul
                className="mt-3 space-y-1.5 text-[13px]"
                style={{
                  color: T.dark.muted,
                  fontFamily: "var(--font-jetbrains)",
                }}
              >
                <li>~/app/page.tsx</li>
                <li>~/components/Navbar.tsx</li>
                <li>~/components/canvas/*</li>
                <li>~/app/dashboard/*</li>
                <li>~/app/auth/*</li>
              </ul>
            </div>
            <div>
              <Label mode="dark">Owner</Label>
              <div className="mt-3 text-[13px]" style={{ color: T.dark.ink }}>
                Maarij · Frontend
              </div>
              <div className="mt-1 text-[13px]" style={{ color: T.dark.muted }}>
                Per CLAUDE_CONTEXT roles
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
