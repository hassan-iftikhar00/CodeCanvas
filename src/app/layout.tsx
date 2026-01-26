import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
