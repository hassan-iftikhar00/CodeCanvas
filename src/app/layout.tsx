import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import CommandPalette from "@/components/CommandPalette";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CodeCanvas | Draw. Describe. Ship.",
  description:
    "Convert rough sketches into production-ready frontends | live preview and one-click export.",
  keywords: [
    "code generation",
    "sketch to code",
    "AI design tool",
    "frontend development",
    "UI builder",
  ],
  icons: {
    icon: "/logo-black.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeScript = `(function(){
  try {
    var key = "codecanvas:theme";
    var stored = localStorage.getItem(key);
    var systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = stored === "light" || stored === "dark" ? stored : (systemDark ? "dark" : "light");
    var root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
  } catch (e) {}
})();`;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <ThemeProvider>
          <ToastProvider>
            <ErrorBoundary
              variant="page"
              title="We hit a snag"
              message="The app ran into an issue loading this page."
            >
              {children}
            </ErrorBoundary>
            <ErrorBoundary
              variant="panel"
              title="Command palette unavailable"
              message="This tool failed to load. You can keep working normally."
            >
              <CommandPalette />
            </ErrorBoundary>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
