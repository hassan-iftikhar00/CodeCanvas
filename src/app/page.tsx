"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import Pricing from "@/components/Pricing";
import Testimonials from "@/components/Testimonials";
import Footer from "@/components/Footer";

const GridScan = dynamic(() => import("@/components/GridScan"), {
  ssr: false,
});

export default function Home() {
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<{ x: number; y: number }[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<
    { x: number; y: number }[]
  >([]);
  const [buttonClicked, setButtonClicked] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const supabase = createClient();

  // Don't auto-redirect - let users see the landing page
  // They can click "Open Canvas" or login to access the app

  const handleContinueDesign = () => {
    // Save the strokes to localStorage
    localStorage.setItem("miniCanvasDesign", JSON.stringify(strokes));
    // Redirect to canvas page
    router.push("/canvas?fromMini=true");
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentStroke([{ x, y }]);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentStroke((prev) => [...prev, { x, y }]);
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

    // Set canvas internal resolution to match display size * pixel ratio for crisp rendering
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    // Scale context to match pixel ratio
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Draw grid with crisp lines
    ctx.strokeStyle = "rgba(17, 18, 23, 0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i < rect.width; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, rect.height);
      ctx.stroke();
    }
    for (let i = 0; i < rect.height; i += 20) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(rect.width, i);
      ctx.stroke();
    }

    // Draw all strokes with anti-aliasing
    ctx.strokeStyle = "#111217";
    ctx.lineWidth = 2.5;
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
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Navigation Header */}
      <nav className="relative z-20 border-b border-[#2E2E2E]">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="CodeCanvas Logo"
                className="h-8 w-8 sm:h-10 sm:w-10"
              />
              <span className="text-lg font-bold text-white sm:text-xl">
                CodeCanvas
              </span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link
                href="/auth/login"
                className="rounded-lg px-3 py-2 text-xs font-medium text-[#A0A0A0] transition-colors hover:text-white sm:px-4 sm:text-sm"
              >
                Log in
              </Link>
              <Link
                href="/canvas"
                className="rounded-lg bg-[#FF6B00] px-3 py-2 text-xs font-bold text-white transition-all hover:bg-[#E66000] hover:shadow-[0_0_20px_rgba(255,107,0,0.3)] sm:px-4 sm:text-sm"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative overflow-hidden">
        {/* Grid Scan Background - Subtle Energy Pulse */}
        <div className="absolute inset-0 z-0 pointer-events-auto">
          <GridScan
            sensitivity={0.55}
            lineThickness={1.0}
            linesColor="#2E2E2E"
            gridScale={0.15}
            scanColor="#FFFFFF"
            scanOpacity={0.08}
            enablePost
            bloomIntensity={0.4}
            chromaticAberration={0.0001}
            noiseIntensity={0.001}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24 pointer-events-none">
          <div className="grid gap-8 sm:gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            {/* Left: Hero Copy */}
            <div className="space-y-6 sm:space-y-8 pointer-events-auto">
              <div className="inline-flex items-center rounded-full bg-[#2E2E2E] px-4 py-1.5 text-sm font-medium text-[#A0A0A0]">
                ✨ Sketch-to-code in seconds
              </div>

              <div className="space-y-0">
                <h1
                  className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl animate-slide-in-up"
                  style={{ animationDelay: "0.1s" }}
                >
                  Draw.
                </h1>
                <h1
                  className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl animate-slide-in-up"
                  style={{ animationDelay: "0.2s" }}
                >
                  Describe.
                </h1>
                <h1
                  className="text-4xl font-bold tracking-tight text-[#FF6B00] sm:text-5xl md:text-6xl lg:text-7xl animate-slide-in-up animate-glow-pulse"
                  style={{ animationDelay: "0.3s" }}
                >
                  Ship.
                </h1>
              </div>

              <p
                className="text-base leading-relaxed text-[#A0A0A0] max-w-lg sm:text-lg md:text-xl animate-fade-in"
                style={{
                  animationDelay: "0.5s",
                  opacity: 0,
                  animationFillMode: "forwards",
                }}
              >
                Convert rough sketches into production-ready frontends - live
                preview and one-click export.
              </p>

              <div
                className="flex flex-col gap-3 sm:flex-row sm:gap-4 animate-slide-in-up"
                style={{
                  animationDelay: "0.6s",
                  opacity: 0,
                  animationFillMode: "forwards",
                }}
              >
                <Link
                  href="/canvas"
                  className="btn-base ripple group inline-flex items-center justify-center rounded-xl glass-orange px-6 py-3 text-sm font-semibold text-white glow-orange-hover focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:ring-offset-2 focus:ring-offset-[#0A0A0A] sm:px-8 sm:py-4 sm:text-base"
                >
                  Open Canvas
                  <svg
                    className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1 sm:h-5 sm:w-5"
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

                <button className="btn-base glass-light inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all duration-[var(--duration-base)] hover:glass focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:ring-offset-2 focus:ring-offset-[#0A0A0A] sm:px-8 sm:py-4 sm:text-base">
                  Watch Demo
                </button>
              </div>

              {/* Feature Pills */}
              <div className="flex flex-wrap gap-3 pt-4">
                <div className="flex items-center gap-2 rounded-lg bg-[#1A1A1A] border border-[#2E2E2E] px-4 py-2 text-sm font-medium text-[#A0A0A0]">
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
                  Live Preview
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-[#1A1A1A] border border-[#2E2E2E] px-4 py-2 text-sm font-medium text-[#A0A0A0]">
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
                  AI-Powered Recognition
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-[#1A1A1A] border border-[#2E2E2E] px-4 py-2 text-sm font-medium text-[#A0A0A0]">
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
                  One-Click Export
                </div>
              </div>
            </div>

            {/* Right: Interactive Mini Canvas */}
            <div className="relative pointer-events-auto">
              <div className="relative rounded-2xl bg-[#1A1A1A] border border-[#2E2E2E] p-6 shadow-panel transition-all duration-300 hover:shadow-lg">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">
                    Try it now | Draw a button
                  </h3>
                  <button
                    onClick={clearCanvas}
                    className="rounded-lg bg-[#2E2E2E] px-3 py-1.5 text-xs font-medium text-[#A0A0A0] transition-colors hover:bg-white hover:text-[#0A0A0A]"
                  >
                    Clear
                  </button>
                </div>

                <canvas
                  ref={canvasRef}
                  className="w-full cursor-crosshair rounded-lg border-2 border-[#2E2E2E] bg-white paper-texture"
                  style={{ width: "100%", height: "300px" }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={endDrawing}
                  onMouseLeave={endDrawing}
                />

                {strokes.length > 0 && (
                  <div className="mt-4 rounded-lg border-2 border-dashed border-[#2E2E2E] bg-[#1A1A1A] p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#A0A0A0]">
                      Live Preview
                    </p>
                    <button
                      onClick={handleContinueDesign}
                      className="w-full rounded-lg bg-[#FF6B00]/20 border border-[#FF6B00]/50 backdrop-blur-md px-6 py-3 font-semibold text-white shadow-md transition-all hover:bg-[#FF6B00]/30 hover:border-[#FF6B00] hover:scale-105 hover:shadow-[0_0_20px_rgba(255,107,0,0.4)]"
                    >
                      Continue in Canvas →
                    </button>
                  </div>
                )}
              </div>

              {/* Decorative Element */}
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-[#FF6B00]/10 blur-3xl" />
              <div className="absolute -bottom-4 -left-4 h-32 w-32 rounded-full bg-white/5 blur-3xl" />
            </div>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="border-t border-[#2E2E2E] bg-[#0A0A0A] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          {/* Video Demo Section */}
          <div className="mb-24">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                See It In Action
              </h2>
              <p className="mt-4 text-lg text-[#A0A0A0]">
                Watch how CodeCanvas transforms sketches into production-ready
                code
              </p>
            </div>

            <div className="relative mx-auto max-w-5xl">
              <div className="relative rounded-2xl border border-[#2E2E2E] bg-[#1A1A1A] p-4 shadow-2xl ">
                <video
                  className="w-full rounded-lg"
                  autoPlay
                  loop
                  muted
                  playsInline
                >
                  <source
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/demo-video2.mp4`}
                    type="video/mp4"
                  />
                  Your browser does not support the video tag.
                </video>
              </div>

              {/* Decorative blur effects */}
              <div className="absolute -left-10 top-1/2 h-40 w-40 rounded-full bg-[#FF6B00]/20 blur-3xl" />
              <div className="absolute -right-10 top-1/4 h-40 w-40 rounded-full bg-white/5 blur-3xl" />
            </div>
          </div>

          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Why CodeCanvas?
            </h2>
            <p className="mt-4 text-lg text-[#A0A0A0]">
              Fast, intuitive, and built for makers
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "✏️",
                title: "Natural Sketching",
                description:
                  "Draw components just like on paper - our AI understands your intent.",
              },
              {
                icon: "🤖",
                title: "Smart Recognition",
                description:
                  "Advanced ML detects buttons, inputs, layouts and converts them to clean code.",
              },
              {
                icon: "⚡",
                title: "Live Preview",
                description:
                  "See your design come to life instantly with real-time code generation.",
              },
              {
                icon: "💬",
                title: "Natural Language",
                description:
                  "Describe interactions and behavior - we'll generate the logic.",
              },
              {
                icon: "📦",
                title: "Export Ready",
                description:
                  "Download production-ready code with proper structure and best practices.",
              },
              {
                icon: "🎨",
                title: "Style Freedom",
                description:
                  "Choose your framework, styling approach, and coding patterns.",
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="group rounded-xl border border-[#2E2E2E] bg-[#1A1A1A] p-6 transition-all duration-300 hover:border-white/20 hover:shadow-md"
              >
                <div className="mb-3 text-4xl">{feature.icon}</div>
                <h3 className="mb-2 text-lg font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-[#A0A0A0]">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <Pricing />

      {/* Testimonials Section */}
      <Testimonials />

      {/* CTA Section */}
      <section className="relative bg-[#1A1A1A] border-t border-[#2E2E2E] py-16 sm:py-24 overflow-hidden">
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center lg:px-8">
          <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Ready to build faster?
          </h2>
          <p className="mt-6 text-lg leading-8 text-[#A0A0A0]">
            Start sketching your next project today. No credit card required.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/canvas"
              className="inline-flex items-center justify-center rounded-xl bg-[#FF6B00]/20 border border-[#FF6B00]/50 backdrop-blur-md px-8 py-4 text-base font-semibold text-white transition-all duration-[var(--duration-base)] hover:bg-[#FF6B00]/30 hover:border-[#FF6B00] hover:scale-105 hover:shadow-[0_0_30px_rgba(255,107,0,0.4)] focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:ring-offset-2 focus:ring-offset-[#1A1A1A]"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
