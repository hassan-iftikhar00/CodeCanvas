"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import AuthLoadingSkeleton from "@/components/auth/AuthLoadingSkeleton";
import ThemeToggle from "@/components/theme/ThemeToggle";

// Email validation regex - checks for @ and valid domain structure
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const isSubmitting = useRef(false);
  const supabase = createClient();

  // Email validation function
  const validateEmail = useCallback((value: string): string | null => {
    if (!value.trim()) {
      return "Email is required";
    }
    if (!value.includes("@")) {
      return "Email must contain @";
    }
    if (!EMAIL_REGEX.test(value)) {
      return "Please enter a valid email address";
    }
    return null;
  }, []);

  const emailError = useMemo(
    () => validateEmail(email),
    [email, validateEmail]
  );

  // Check if form is valid for submission
  const isFormValid = useMemo(() => !emailError, [emailError]);

  // Handle email change with validation
  const handleEmailChange = useCallback(
    (value: string) => {
      setEmail(value);
      if (error) setError(null);
    },
    [error]
  );

  // Handle email blur
  const handleEmailBlur = useCallback(() => {
    setEmailTouched(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark field as touched and validate
    setEmailTouched(true);
    if (emailError) return;

    // Prevent duplicate submissions
    if (isSubmitting.current || loading) return;

    isSubmitting.current = true;
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      });

      if (error) {
        // Generic error message - don't expose if email exists or not
        setError("Unable to process your request. Please try again later.");
        setLoading(false);
        isSubmitting.current = false;
      } else {
        setSuccess(true);
        setLoading(false);
        isSubmitting.current = false;
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
      isSubmitting.current = false;
    }
  };

  if (loading && !success) {
    return <AuthLoadingSkeleton />;
  }

  return (
    <div className="relative flex min-h-[100svh] overflow-x-hidden overflow-y-auto bg-[var(--cc-bg-canvas)]">
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>
      {/* Subtle ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-[var(--cc-accent-glow)] blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-[var(--cc-accent-glow)] blur-[100px]" />
      </div>

      {/* Centered Form */}
      <div className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:p-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 0.9, 0.28, 1] }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <div className="mb-7 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[18px] font-semibold tracking-tight text-[var(--cc-text-primary)] transition-colors hover:text-[var(--cc-accent)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="h-7 w-7" />
              CodeCanvas
            </Link>
          </div>

          {/* Form Card */}
          <div className="relative">
            <div className="relative rounded-[12px] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] p-6 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]">
              {success ? (
                // Success State
                <div className="text-center animate-fade-in">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[rgba(34,197,94,0.12)] mb-6">
                    <svg
                      className="w-8 h-8 text-[var(--cc-success)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-[var(--cc-text-primary)] mb-2">
                    Check your email
                  </h2>
                  <p className="text-[var(--cc-text-secondary)] mb-6">
                    If an account exists with that email, we&apos;ve sent you a
                    link to reset your password.
                  </p>
                  <p className="text-sm text-[var(--cc-text-muted)] mb-6">
                    Didn&apos;t receive the email? Check your spam folder or try
                    again.
                  </p>
                  <Link
                    href="/auth/login"
                    className="group inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--cc-radius-button)] bg-[var(--cc-accent)] px-4 py-2.5 text-[13px] font-semibold text-white transition-all hover:shadow-[0_0_20px_var(--cc-accent-glow-strong)]"
                  >
                    Back to login
                    <svg
                      className="w-5 h-5 transition-transform group-hover:translate-x-1"
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
                </div>
              ) : (
                // Form State
                <>
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--cc-accent-glow)] mb-4">
                      <svg
                        className="w-8 h-8 text-[var(--cc-accent)]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                        />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-[var(--cc-text-primary)] mb-2">
                      Forgot password?
                    </h2>
                    <p className="text-[var(--cc-text-secondary)]">
                      No worries, we&apos;ll send you reset instructions.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                      <div className="flex items-center gap-2.5 rounded-[var(--cc-radius-card)] border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] px-3.5 py-2.5 text-[13px] text-[var(--cc-error)] animate-shake">
                        <svg
                          className="w-5 h-5 flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {error}
                      </div>
                    )}

                    <div className="space-y-2">
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-[var(--cc-text-secondary)]"
                      >
                        Email address
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <svg
                            className={`h-4 w-4 transition-colors ${emailTouched && emailError ? "text-[var(--cc-error)]" : "text-[var(--cc-text-muted)]"}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                            />
                          </svg>
                        </div>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          disabled={loading}
                          value={email}
                          onChange={(e) => handleEmailChange(e.target.value)}
                          onBlur={handleEmailBlur}
                          className={`block w-full rounded-[var(--cc-radius-button)] border bg-[var(--cc-bg-canvas)] pl-9 pr-3 py-2.5 text-[13px] text-[var(--cc-text-primary)] placeholder:text-[var(--cc-text-muted)] transition-all focus:outline-none focus:ring-3 disabled:opacity-50 disabled:cursor-not-allowed ${
                            emailTouched && emailError
                              ? "border-[var(--cc-error)] focus:border-[var(--cc-error)] focus:ring-[rgba(239,68,68,0.2)]"
                              : "border-[var(--cc-border-subtle)] focus:border-[var(--cc-accent)] focus:ring-[var(--cc-accent-glow)]"
                          }`}
                          placeholder="you@example.com"
                        />
                      </div>
                      {/* Email validation message */}
                      {emailTouched && emailError && (
                        <p className="flex items-center gap-1.5 text-xs text-[var(--cc-error)] mt-1.5 animate-fade-in">
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          {emailError}
                        </p>
                      )}
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      type="submit"
                      disabled={loading || (emailTouched && !isFormValid)}
                      className="group relative w-full overflow-hidden rounded-[var(--cc-radius-button)] bg-[var(--cc-accent)] px-4 py-2.5 text-[13px] font-semibold text-white transition-all hover:shadow-[0_0_20px_var(--cc-accent-glow-strong)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--cc-bg-canvas)]"
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {loading ? (
                          <>
                            <svg
                              className="w-5 h-5 animate-spin"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            Sending...
                          </>
                        ) : (
                          <>
                            Reset password
                            <svg
                              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M13 7l5 5m0 0l-5 5m5-5H6"
                              />
                            </svg>
                          </>
                        )}
                      </span>
                    </motion.button>
                  </form>

                  <p className="mt-8 text-center text-sm text-[var(--cc-text-muted)]">
                    <Link
                      href="/auth/login"
                      className="inline-flex items-center gap-2 font-semibold text-[var(--cc-accent)] hover:text-[var(--cc-accent)] transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 19l-7-7m0 0l7-7m-7 7h18"
                        />
                      </svg>
                      Back to login
                    </Link>
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-[var(--cc-text-muted)]">
            Need help?{" "}
            <Link
              href="#"
              className="text-[var(--cc-text-secondary)] hover:text-[var(--cc-text-primary)] transition-colors"
            >
              Contact support
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
