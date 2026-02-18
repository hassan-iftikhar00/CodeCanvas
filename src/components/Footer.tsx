"use client";

import Link from "next/link";
import { useState } from "react";
import { Github, Twitter, Linkedin, Mail, Send } from "lucide-react";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement newsletter subscription
    setSubscribed(true);
    setEmail("");
    setTimeout(() => setSubscribed(false), 3000);
  };

  return (
    <footer className="relative border-t border-[#2E2E2E] bg-[#0A0A0A]">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Brand & Newsletter */}
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2 mb-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-sm sm:text-base font-bold text-white transition-colors hover:text-[#FF6B00]"
              >
                <img
                  src="/logo.png"
                  alt="CodeCanvas Logo"
                  className="w-6 h-6 sm:w-7 sm:h-7"
                />
                <span>CodeCanvas</span>
              </Link>
            </div>
            <p className="mb-6 text-sm leading-relaxed text-[#A0A0A0]">
              Transform sketches into production-ready code. Design faster, ship
              smarter with AI-powered development.
            </p>

            {/* Newsletter */}
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-semibold text-white">
                Stay Updated
              </h3>
              <form onSubmit={handleSubscribe} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="flex-1 rounded-lg border border-[#2E2E2E] bg-[#1A1A1A] px-4 py-2 text-sm text-white placeholder:text-[#666666] focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                />
                <button
                  type="submit"
                  disabled={subscribed}
                  className="flex items-center justify-center rounded-lg bg-[#FF6B00] px-4 py-2 text-white transition-all hover:bg-[#E66200] disabled:bg-[#4A4A4A] disabled:text-[#A0A0A0]"
                >
                  {subscribed ? (
                    <span className="text-sm">✓</span>
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </form>
            </div>

            {/* Social Links */}
            <div className="flex gap-3">
              {[
                {
                  icon: Github,
                  href: "https://github.com",
                  label: "GitHub",
                },
                {
                  icon: Twitter,
                  href: "https://twitter.com",
                  label: "Twitter",
                },
                {
                  icon: Linkedin,
                  href: "https://linkedin.com",
                  label: "LinkedIn",
                },
                {
                  icon: Mail,
                  href: "mailto:hello@codecanvas.dev",
                  label: "Email",
                },
              ].map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#2E2E2E] bg-[#1A1A1A] text-[#A0A0A0] transition-all hover:border-[#FF6B00]/50 hover:bg-[#FF6B00]/10 hover:text-[#FF6B00]"
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Navigation Links */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8 lg:gap-4">
            {/* Product */}
            <div>
              <h3 className="mb-4 text-sm font-semibold text-white">Product</h3>
              <ul className="space-y-3">
                {[
                  { label: "Features", href: "/#features" },
                  { label: "Pricing", href: "/#pricing" },
                  { label: "Demo", href: "/demo" },
                  { label: "Integrations", href: "/integrations" },
                  { label: "Roadmap", href: "/roadmap" },
                ].map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-[#A0A0A0] transition-colors hover:text-[#FF6B00]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="mb-4 text-sm font-semibold text-white">Company</h3>
              <ul className="space-y-3">
                {[
                  { label: "About", href: "/about" },
                  { label: "Blog", href: "/blog" },
                  { label: "Careers", href: "/careers" },
                  { label: "Contact", href: "/contact" },
                  { label: "Brand", href: "/brand" },
                ].map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-[#A0A0A0] transition-colors hover:text-[#FF6B00]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="mb-4 text-sm font-semibold text-white">
                Resources
              </h3>
              <ul className="space-y-3">
                {[
                  { label: "Documentation", href: "/docs" },
                  { label: "API Reference", href: "/api" },
                  { label: "Tutorials", href: "/tutorials" },
                  { label: "Community", href: "/community" },
                  { label: "Support", href: "/support" },
                ].map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-[#A0A0A0] transition-colors hover:text-[#FF6B00]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="mb-4 text-sm font-semibold text-white">Legal</h3>
              <ul className="space-y-3">
                {[
                  { label: "Privacy", href: "/privacy" },
                  { label: "Terms", href: "/terms" },
                  { label: "Security", href: "/security" },
                  { label: "Cookies", href: "/cookies" },
                  { label: "License", href: "/license" },
                ].map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-[#A0A0A0] transition-colors hover:text-[#FF6B00]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 border-t border-[#2E2E2E] pt-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-[#666666]">
              © {new Date().getFullYear()} CodeCanvas. All rights reserved.
            </p>
            <div className="flex items-center gap-2 text-sm text-[#666666]">
              <span>Built with</span>
              <span className="text-[#FF6B00]">❤️</span>
              <span>for developers</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
