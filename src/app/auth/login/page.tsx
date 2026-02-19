"use client";

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  Suspense,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const REMEMBER_ME_KEY = "codecanvas_remember_me";
const SAVED_EMAIL_KEY = "codecanvas_saved_email";
const MIN_PASSWORD_LENGTH = 6;

// Password strength levels
type PasswordStrength = "none" | "weak" | "medium" | "strong";

interface ValidationState {
  email: {
    touched: boolean;
    error: string | null;
  };
  password: {
    touched: boolean;
    error: string | null;
  };
}

// Email validation regex - checks for @ and valid domain structure
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#0A0A0A]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FF6B00] border-t-transparent" />
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGitHubLoading, setIsGitHubLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationState>({
    email: { touched: false, error: null },
    password: { touched: false, error: null },
  });
  const isSubmitting = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();
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
    return !validateEmail(email) && !validatePassword(password);
  }, [email, password, validateEmail, validatePassword]);

  // Handle email change with validation
  const handleEmailChange = useCallback(
    (value: string) => {
      setEmail(value);
      // Clear server error when user starts typing
      if (error) setError(null);

      // Only show validation errors after field is touched
      if (validation.email.touched) {
        setValidation((prev) => ({
          ...prev,
          email: { ...prev.email, error: validateEmail(value) },
        }));
      }
    },
    [error, validation.email.touched, validateEmail]
  );

  // Handle email blur
  const handleEmailBlur = useCallback(() => {
    setValidation((prev) => ({
      ...prev,
      email: { touched: true, error: validateEmail(email) },
    }));
  }, [email, validateEmail]);

  // Handle password change with validation
  const handlePasswordChange = useCallback(
    (value: string) => {
      setPassword(value);
      // Clear server error when user starts typing
      if (error) setError(null);

      // Only show validation errors after field is touched
      if (validation.password.touched) {
        setValidation((prev) => ({
          ...prev,
          password: { ...prev.password, error: validatePassword(value) },
        }));
      }
    },
    [error, validation.password.touched, validatePassword]
  );

  // Handle password blur
  const handlePasswordBlur = useCallback(() => {
    setValidation((prev) => ({
      ...prev,
      password: { touched: true, error: validatePassword(password) },
    }));
  }, [password, validatePassword]);

  // Load saved preferences on mount
  useEffect(() => {
    const savedRememberMe = localStorage.getItem(REMEMBER_ME_KEY) === "true";
    const savedEmail = localStorage.getItem(SAVED_EMAIL_KEY);

    if (savedRememberMe && savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Check for error in URL params
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "auth_code_exchange_failed") {
      setError("Authentication failed. Please try again.");
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields before submission
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    setValidation({
      email: { touched: true, error: emailError },
      password: { touched: true, error: passwordError },
    });

    // Prevent submission if validation fails
    if (emailError || passwordError) {
      return;
    }

    // Prevent duplicate submissions
    if (isSubmitting.current || loading) {
      return;
    }

    isSubmitting.current = true;
    setLoading(true);
    setError(null);

    try {
      // Save or clear remember me preferences
      if (rememberMe) {
        localStorage.setItem(REMEMBER_ME_KEY, "true");
        localStorage.setItem(SAVED_EMAIL_KEY, email);
      } else {
        localStorage.removeItem(REMEMBER_ME_KEY);
        localStorage.removeItem(SAVED_EMAIL_KEY);
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Email not confirmed")) {
          setError(
            "Please check your email and confirm your account before logging in."
          );
        } else if (error.message.includes("Invalid login credentials")) {
          setError("Invalid email or password. Please check your credentials.");
        } else {
          setError(error.message);
        }
        setLoading(false);
        isSubmitting.current = false;
      } else {
        // Clear password from memory for security
        setPassword("");
        router.push("/canvas");
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
      isSubmitting.current = false;
    }
  };

  const handleGoogleLogin = async () => {
    // Prevent if already loading
    if (isGoogleLoading || loading) {
      return;
    }

    setIsGoogleLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
        setIsGoogleLoading(false);
      }
    } catch (err) {
      setError("Failed to connect to Google. Please try again.");
      setIsGoogleLoading(false);
    }
  };

  const handleGitHubLogin = async () => {
    // Prevent if already loading
    if (isGitHubLoading || loading) {
      return;
    }

    setIsGitHubLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
        setIsGitHubLoading(false);
      }
    } catch (err) {
      setError("Failed to connect to GitHub. Please try again.");
      setIsGitHubLoading(false);
    }
  };

  // Check if any login action is in progress
  const isAnyLoading = loading || isGoogleLoading || isGitHubLoading;

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#0A0A0A]">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-[#FF6B00]/20 to-transparent rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-[#FF6B00]/10 to-transparent rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#FF6B00]/5 rounded-full blur-3xl" />
      </div>

      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative items-center justify-center p-12 bg-gradient-to-br from-[#0A0A0A] via-[#1A1A1A] to-[#0A0A0A]">
        <div className="relative z-10 max-w-lg text-center">
          {/* Logo Icon */}
          <div className="mb-8 inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#FF6B00] to-[#CC5800] shadow-[0_0_60px_rgba(255,107,0,0.4)]">
            <svg
              className="w-10 h-10 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.39m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.764m3.42 3.42a6.776 6.776 0 00-3.42-3.42"
              />
            </svg>
          </div>

          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
            Code<span className="text-[#FF6B00]">Canvas</span>
          </h1>

          <p className="text-xl text-[#A0A0A0] mb-12 leading-relaxed">
            Transform your sketches into production-ready code with the power of
            AI
          </p>

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-3">
            {[
              "AI-Powered",
              "Real-time Preview",
              "Export to Code",
              "Components Library",
            ].map((feature, i) => (
              <span
                key={feature}
                className="px-4 py-2 rounded-full text-sm font-medium bg-[#1A1A1A] border border-[#2E2E2E] text-[#A0A0A0] animate-fade-in"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {feature}
              </span>
            ))}
          </div>

          {/* Canvas Preview Mockup */}
          <div className="mt-12 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent z-10" />
            <div className="rounded-xl border border-[#2E2E2E] bg-[#1A1A1A] p-4 shadow-2xl">
              <div className="flex gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                <div className="w-3 h-3 rounded-full bg-[#28C840]" />
              </div>
              <div className="h-32 rounded-lg bg-[#0A0A0A] border border-[#2E2E2E] flex items-center justify-center">
                <div className="flex gap-4">
                  <div className="w-16 h-16 rounded-lg border-2 border-dashed border-[#FF6B00]/50 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-[#FF6B00]/50"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div className="w-24 h-16 rounded-lg border-2 border-[#FF6B00] bg-[#FF6B00]/10" />
                  <div className="w-12 h-12 rounded-full border-2 border-[#FF6B00]/30" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex flex-1 items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-sm animate-slide-in-up">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xl sm:text-2xl font-bold text-white hover:text-[#FF6B00] transition-colors"
            >
              <img
                src="/logo.png"
                alt="CodeCanvas Logo"
                className="w-7 h-7 sm:w-8 sm:h-8"
              />
              CodeCanvas
            </Link>
          </div>

          {/* Form Card */}
          <div className="relative">
            {/* Glow effect behind card */}
            <div className="absolute -inset-1 bg-gradient-to-r from-[#FF6B00]/20 via-[#FF6B00]/10 to-[#FF6B00]/20 rounded-3xl blur-xl opacity-50" />

            <div className="relative rounded-xl border border-[#2E2E2E] bg-[#1A1A1A]/80 backdrop-blur-xl p-5 sm:p-6 shadow-2xl">
              <div className="text-center mb-5 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-1">
                  Welcome back
                </h2>
                <p className="text-xs sm:text-sm text-[#A0A0A0]">
                  Sign in to continue to your canvas
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-400 animate-shake">
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
                    className="block text-sm font-medium text-[#A0A0A0]"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg
                        className={`h-4 w-4 transition-colors ${validation.email.touched && validation.email.error ? "text-red-400" : "text-[#666666]"}`}
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
                      disabled={isAnyLoading}
                      value={email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      onBlur={handleEmailBlur}
                      className={`block w-full rounded-lg border bg-[#0A0A0A]/50 pl-10 pr-3 py-2.5 text-sm text-white placeholder-[#666666] transition-all focus:outline-none focus:ring-2 focus:bg-[#0A0A0A] disabled:opacity-50 disabled:cursor-not-allowed ${
                        validation.email.touched && validation.email.error
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                          : "border-[#2E2E2E] focus:border-[#FF6B00] focus:ring-[#FF6B00]/20"
                      }`}
                      placeholder="you@example.com"
                    />
                  </div>
                  {/* Email validation message */}
                  {validation.email.touched && validation.email.error && (
                    <p className="flex items-center gap-1.5 text-xs text-red-400 mt-1.5 animate-fade-in">
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
                      {validation.email.error}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-[#A0A0A0]"
                    >
                      Password
                    </label>
                    <Link
                      href="/auth/forgot-password"
                      className="text-sm font-medium text-[#FF6B00] hover:text-[#FF8533] transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg
                        className={`h-4 w-4 transition-colors ${validation.password.touched && validation.password.error ? "text-red-400" : "text-[#666666]"}`}
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
                      autoComplete="current-password"
                      disabled={isAnyLoading}
                      value={password}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      onBlur={handlePasswordBlur}
                      className={`block w-full rounded-lg border bg-[#0A0A0A]/50 pl-10 pr-10 py-2.5 text-sm text-white placeholder-[#666666] transition-all focus:outline-none focus:ring-2 focus:bg-[#0A0A0A] disabled:opacity-50 disabled:cursor-not-allowed ${
                        validation.password.touched && validation.password.error
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                          : "border-[#2E2E2E] focus:border-[#FF6B00] focus:ring-[#FF6B00]/20"
                      }`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#666666] hover:text-[#A0A0A0] transition-colors"
                    >
                      {showPassword ? (
                        <svg
                          className="h-4 w-4"
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
                  {validation.password.touched && validation.password.error && (
                    <p className="flex items-center gap-1.5 text-xs text-red-400 mt-1.5 animate-fade-in">
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
                        <span className="text-xs text-[#666666]">
                          Password strength
                        </span>
                        <span
                          className="text-xs font-medium transition-colors"
                          style={{ color: strengthConfig.color }}
                        >
                          {strengthConfig.label}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-[#2E2E2E] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300 ease-out"
                          style={{
                            width: strengthConfig.width,
                            backgroundColor: strengthConfig.color,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center">
                  <label className="flex items-center cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        disabled={isAnyLoading}
                        className="sr-only peer"
                      />
                      <div className="w-5 h-5 rounded border-2 border-[#2E2E2E] bg-[#0A0A0A]/50 transition-all peer-checked:bg-[#FF6B00] peer-checked:border-[#FF6B00] peer-disabled:opacity-50 peer-disabled:cursor-not-allowed group-hover:border-[#3E3E3E] peer-checked:group-hover:border-[#FF8533]">
                        <svg
                          className="w-full h-full text-white opacity-0 peer-checked:opacity-100 transition-opacity p-0.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                      <svg
                        className={`absolute top-0.5 left-0.5 w-4 h-4 text-white transition-opacity ${rememberMe ? "opacity-100" : "opacity-0"}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <span className="ml-3 text-sm text-[#A0A0A0] group-hover:text-white transition-colors">
                      Remember me
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={
                    isAnyLoading ||
                    (!isFormValid &&
                      (validation.email.touched || validation.password.touched))
                  }
                  className={`relative w-full overflow-hidden rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all group ${
                    isFormValid
                      ? "bg-gradient-to-r from-[#FF6B00] to-[#CC5800] shadow-[#FF6B00]/25 hover:shadow-[#FF6B00]/40 hover:shadow-xl"
                      : "bg-gradient-to-r from-[#FF6B00]/70 to-[#CC5800]/70 shadow-[#FF6B00]/15"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <svg
                          className="w-4 h-4 animate-spin"
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
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign in
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

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#2E2E2E]" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-[#1A1A1A] px-4 text-[#666666]">
                      or continue with
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isAnyLoading}
                  className="w-full rounded-lg border border-[#2E2E2E] bg-[#0A0A0A]/50 px-4 py-2.5 text-xs sm:text-sm font-medium text-white transition-all hover:bg-[#2E2E2E] hover:border-[#3E3E3E] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-center gap-2 sm:gap-3">
                    {isGoogleLoading ? (
                      <>
                        <svg
                          className="h-4 w-4 animate-spin"
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
                        Redirecting...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        <span className="hidden xs:inline">Continue with </span>
                        Google
                      </>
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleGitHubLogin}
                  disabled={isAnyLoading}
                  className="w-full rounded-lg border border-[#2E2E2E] bg-[#0A0A0A]/50 px-4 py-2.5 text-xs sm:text-sm font-medium text-white transition-all hover:bg-[#2E2E2E] hover:border-[#3E3E3E] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-center gap-2 sm:gap-3">
                    {isGitHubLoading ? (
                      <>
                        <svg
                          className="h-4 w-4 animate-spin"
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
                        Redirecting...
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                        <span className="hidden xs:inline">Continue with </span>
                        GitHub
                      </>
                    )}
                  </div>
                </button>
              </form>

              <p className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-[#666666]">
                Don't have an account?{" "}
                <Link
                  href="/auth/signup"
                  className="font-semibold text-[#FF6B00] hover:text-[#FF8533] transition-colors"
                >
                  Create one free
                </Link>
              </p>
            </div>
          </div>

          {/* Footer */}
          <p className="mt-6 sm:mt-8 text-center text-xs text-[#666666]">
            By signing in, you agree to our{" "}
            <Link
              href="#"
              className="text-[#A0A0A0] hover:text-white transition-colors"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="#"
              className="text-[#A0A0A0] hover:text-white transition-colors"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
