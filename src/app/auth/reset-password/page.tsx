"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import AuthLoadingSkeleton from "@/components/auth/AuthLoadingSkeleton";
import ThemeToggle from "@/components/theme/ThemeToggle";

const MIN_PASSWORD_LENGTH = 6;

// Password strength levels
type PasswordStrength = "none" | "weak" | "medium" | "strong";

interface ValidationState {
  password: {
    touched: boolean;
    error: string | null;
  };
  confirmPassword: {
    touched: boolean;
    error: string | null;
  };
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [validation, setValidation] = useState<ValidationState>({
    password: { touched: false, error: null },
    confirmPassword: { touched: false, error: null },
  });
  const isSubmitting = useRef(false);
  const router = useRouter();
  const supabase = createClient();

  // Check for valid session on mount (recovery token)
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setTokenValid(true);
      } else {
        setTokenValid(false);
      }
    };

    // Listen for auth state changes (recovery flow)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setTokenValid(true);
      }
    });

    checkSession();

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  // Password validation function
  const validatePassword = useCallback((value: string): string | null => {
    if (!value) {
      return "Password is required";
    }
    if (value.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    return null;
  }, []);

  // Confirm password validation
  const validateConfirmPassword = useCallback(
    (confirm: string, pass: string): string | null => {
      if (!confirm) {
        return "Please confirm your password";
      }
      if (confirm !== pass) {
        return "Passwords do not match";
      }
      return null;
    },
    []
  );

  // Calculate password strength
  const passwordStrength = useMemo((): PasswordStrength => {
    if (!password) return "none";

    let score = 0;

    // Length checks
    if (password.length >= MIN_PASSWORD_LENGTH) score++;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;

    // Character variety checks
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 2) return "weak";
    if (score <= 4) return "medium";
    return "strong";
  }, [password]);

  // Get strength indicator properties
  const strengthConfig = useMemo(() => {
    switch (passwordStrength) {
      case "weak":
        return { label: "Weak", color: "#EF4444", width: "33%" };
      case "medium":
        return { label: "Medium", color: "#F59E0B", width: "66%" };
      case "strong":
        return { label: "Strong", color: "#22C55E", width: "100%" };
      default:
        return { label: "", color: "transparent", width: "0%" };
    }
  }, [passwordStrength]);

  // Check if form is valid for submission
  const isFormValid = useMemo(() => {
    return (
      !validatePassword(password) &&
      !validateConfirmPassword(confirmPassword, password)
    );
  }, [password, confirmPassword, validatePassword, validateConfirmPassword]);

  // Handle password change with validation
  const handlePasswordChange = useCallback(
    (value: string) => {
      setPassword(value);
      if (error) setError(null);

      if (validation.password.touched) {
        setValidation((prev) => ({
          ...prev,
          password: { ...prev.password, error: validatePassword(value) },
        }));
      }

      // Also update confirm password validation if it's been touched
      if (validation.confirmPassword.touched && confirmPassword) {
        setValidation((prev) => ({
          ...prev,
          confirmPassword: {
            ...prev.confirmPassword,
            error: validateConfirmPassword(confirmPassword, value),
          },
        }));
      }
    },
    [
      error,
      validation.password.touched,
      validation.confirmPassword.touched,
      confirmPassword,
      validatePassword,
      validateConfirmPassword,
    ]
  );

  // Handle password blur
  const handlePasswordBlur = useCallback(() => {
    setValidation((prev) => ({
      ...prev,
      password: { touched: true, error: validatePassword(password) },
    }));
  }, [password, validatePassword]);

  // Handle confirm password change
  const handleConfirmPasswordChange = useCallback(
    (value: string) => {
      setConfirmPassword(value);
      if (error) setError(null);

      if (validation.confirmPassword.touched) {
        setValidation((prev) => ({
          ...prev,
          confirmPassword: {
            ...prev.confirmPassword,
            error: validateConfirmPassword(value, password),
          },
        }));
      }
    },
    [
      error,
      validation.confirmPassword.touched,
      password,
      validateConfirmPassword,
    ]
  );

  // Handle confirm password blur
  const handleConfirmPasswordBlur = useCallback(() => {
    setValidation((prev) => ({
      ...prev,
      confirmPassword: {
        touched: true,
        error: validateConfirmPassword(confirmPassword, password),
      },
    }));
  }, [confirmPassword, password, validateConfirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields before submission
    const passwordError = validatePassword(password);
    const confirmPasswordError = validateConfirmPassword(
      confirmPassword,
      password
    );

    setValidation({
      password: { touched: true, error: passwordError },
      confirmPassword: { touched: true, error: confirmPasswordError },
    });

    // Prevent submission if validation fails
    if (passwordError || confirmPasswordError) return;

    // Prevent duplicate submissions
    if (isSubmitting.current || loading) return;

    isSubmitting.current = true;
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        // Generic error message
        setError(
          "Unable to reset password. Please try again or request a new reset link."
        );
        setLoading(false);
        isSubmitting.current = false;
      } else {
        // Sign out to force re-login with new password
        await supabase.auth.signOut();
        setSuccess(true);
        setLoading(false);
        isSubmitting.current = false;

        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push("/auth/login");
        }, 3000);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
      isSubmitting.current = false;
    }
  };

  // Show loading while checking token
  if (tokenValid === null) {
    return <AuthLoadingSkeleton />;
  }

  // Show error if no valid token
  if (tokenValid === false) {
    return (
      <div className="relative flex min-h-[100svh] overflow-x-hidden overflow-y-auto bg-[var(--cc-bg-canvas)]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-[#FF6B00]/20 to-transparent rounded-full blur-3xl animate-pulse" />
          <div
            className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-[#FF6B00]/10 to-transparent rounded-full blur-3xl animate-pulse"
            style={{ animationDelay: "1s" }}
          />
        </div>

        <div className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:p-12">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 0.9, 0.28, 1] }}
            className="w-full max-w-md"
          >
            <div className="relative">
              <div className="relative rounded-[12px] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] p-6 text-center shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[rgba(239,68,68,0.12)] mb-6">
                  <svg
                    className="w-8 h-8 text-[var(--cc-error)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[var(--cc-text-primary)] mb-2">
                  Invalid or expired link
                </h2>
                <p className="text-[var(--cc-text-secondary)] mb-6">
                  This password reset link is invalid or has expired. Please
                  request a new one.
                </p>
                <Link
                  href="/auth/forgot-password"
                  className="group inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--cc-radius-button)] bg-[var(--cc-accent)] px-4 py-2.5 text-[13px] font-semibold text-white transition-all hover:shadow-[0_0_20px_var(--cc-accent-glow-strong)]"
                >
                  Request new link
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
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[100svh] overflow-x-hidden overflow-y-auto bg-[var(--cc-bg-canvas)]">
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>
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
          <div className="text-center mb-8">
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
                    Password reset successful!
                  </h2>
                  <p className="text-[var(--cc-text-secondary)] mb-6">
                    Your password has been updated. Redirecting you to login...
                  </p>
                  <div className="flex justify-center">
                    <svg
                      className="w-6 h-6 animate-spin text-[var(--cc-accent)]"
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
                  </div>
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
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-[var(--cc-text-primary)] mb-2">
                      Set new password
                    </h2>
                    <p className="text-[var(--cc-text-secondary)]">
                      Create a strong password for your account
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                      <div className="flex items-center gap-3 rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.35)] p-4 text-sm text-[var(--cc-error)] animate-shake">
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

                    {/* New Password Field */}
                    <div className="space-y-2">
                      <label
                        htmlFor="password"
                        className="block text-sm font-medium text-[var(--cc-text-secondary)]"
                      >
                        New password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <svg
                            className={`h-5 w-5 transition-colors ${validation.password.touched && validation.password.error ? "text-[var(--cc-error)]" : "text-[var(--cc-text-muted)]"}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                        </div>
                        <input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          disabled={loading}
                          value={password}
                          onChange={(e) => handlePasswordChange(e.target.value)}
                          onBlur={handlePasswordBlur}
                          className={`block w-full rounded-xl border bg-[var(--cc-bg-canvas)]/50 pl-12 pr-12 py-3.5 text-[var(--cc-text-primary)] placeholder:text-[var(--cc-text-muted)] transition-all focus:outline-none focus:ring-2 focus:bg-[var(--cc-bg-canvas)] disabled:opacity-50 disabled:cursor-not-allowed ${
                            validation.password.touched &&
                            validation.password.error
                              ? "border-[var(--cc-error)] focus:border-[var(--cc-error)] focus:ring-[rgba(239,68,68,0.2)]"
                              : "border-[var(--cc-border-subtle)] focus:border-[var(--cc-accent)] focus:ring-[var(--cc-accent-glow)]"
                          }`}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-[var(--cc-text-muted)] hover:text-[var(--cc-text-secondary)] transition-colors"
                        >
                          {showPassword ? (
                            <svg
                              className="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          )}
                        </button>
                      </div>

                      {/* Password validation message */}
                      {validation.password.touched &&
                        validation.password.error && (
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
                            {validation.password.error}
                          </p>
                        )}

                      {/* Password strength indicator */}
                      {password && !validation.password.error && (
                        <div className="space-y-1.5 mt-2 animate-fade-in">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[var(--cc-text-muted)]">
                              Password strength
                            </span>
                            <span
                              className="text-xs font-medium transition-colors"
                              style={{ color: strengthConfig.color }}
                            >
                              {strengthConfig.label}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-[var(--cc-bg-elevated)] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300 ease-out"
                              style={{
                                width: strengthConfig.width,
                                backgroundColor: strengthConfig.color,
                              }}
                            />
                          </div>
                          <p className="text-xs text-[var(--cc-text-muted)]">
                            Use 8+ characters with uppercase, lowercase, numbers
                            & symbols
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Confirm Password Field */}
                    <div className="space-y-2">
                      <label
                        htmlFor="confirmPassword"
                        className="block text-sm font-medium text-[var(--cc-text-secondary)]"
                      >
                        Confirm password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <svg
                            className={`h-5 w-5 transition-colors ${validation.confirmPassword.touched && validation.confirmPassword.error ? "text-[var(--cc-error)]" : "text-[var(--cc-text-muted)]"}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                            />
                          </svg>
                        </div>
                        <input
                          id="confirmPassword"
                          name="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          autoComplete="new-password"
                          disabled={loading}
                          value={confirmPassword}
                          onChange={(e) =>
                            handleConfirmPasswordChange(e.target.value)
                          }
                          onBlur={handleConfirmPasswordBlur}
                          className={`block w-full rounded-xl border bg-[var(--cc-bg-canvas)]/50 pl-12 pr-12 py-3.5 text-[var(--cc-text-primary)] placeholder:text-[var(--cc-text-muted)] transition-all focus:outline-none focus:ring-2 focus:bg-[var(--cc-bg-canvas)] disabled:opacity-50 disabled:cursor-not-allowed ${
                            validation.confirmPassword.touched &&
                            validation.confirmPassword.error
                              ? "border-[var(--cc-error)] focus:border-[var(--cc-error)] focus:ring-[rgba(239,68,68,0.2)]"
                              : "border-[var(--cc-border-subtle)] focus:border-[var(--cc-accent)] focus:ring-[var(--cc-accent-glow)]"
                          }`}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-[var(--cc-text-muted)] hover:text-[var(--cc-text-secondary)] transition-colors"
                        >
                          {showConfirmPassword ? (
                            <svg
                              className="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          )}
                        </button>
                      </div>

                      {/* Confirm password validation message */}
                      {validation.confirmPassword.touched &&
                        validation.confirmPassword.error && (
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
                            {validation.confirmPassword.error}
                          </p>
                        )}

                      {/* Password match indicator */}
                      {confirmPassword &&
                        !validation.confirmPassword.error &&
                        validation.confirmPassword.touched && (
                          <p className="flex items-center gap-1.5 text-xs text-[var(--cc-success)] mt-1.5 animate-fade-in">
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
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            Passwords match
                          </p>
                        )}
                    </div>

                    <button
                      type="submit"
                      disabled={
                        loading ||
                        (validation.password.touched &&
                          validation.confirmPassword.touched &&
                          !isFormValid)
                      }
                      className="group relative w-full overflow-hidden rounded-[var(--cc-radius-button)] bg-[var(--cc-accent)] px-4 py-2.5 text-[13px] font-semibold text-white transition-all hover:shadow-[0_0_20px_var(--cc-accent-glow-strong)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]"
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
                            Resetting...
                          </>
                        ) : (
                          <>
                            Reset password
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
                          </>
                        )}
                      </span>
                    </button>
                  </form>

                  <p className="mt-8 text-center text-sm text-[var(--cc-text-muted)]">
                    <Link
                      href="/auth/login"
                      className="inline-flex items-center gap-2 font-semibold text-[var(--cc-accent)] hover:text-[#ff8533] transition-colors"
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
