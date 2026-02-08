"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 6;
const MIN_NAME_LENGTH = 2;

// Password strength levels
type PasswordStrengthLevel = "none" | "weak" | "medium" | "strong";

interface PasswordStrength {
  level: PasswordStrengthLevel;
  score: number;
}

interface ValidationState {
  fullName: {
    touched: boolean;
    error: string | null;
  };
  email: {
    touched: boolean;
    error: string | null;
  };
  password: {
    touched: boolean;
    error: string | null;
  };
  confirmPassword: {
    touched: boolean;
    error: string | null;
  };
}

// Email validation regex - standard pattern covering majority of valid email formats
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGitHubLoading, setIsGitHubLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationState, setValidationState] = useState<ValidationState>({
    fullName: { touched: false, error: null },
    email: { touched: false, error: null },
    password: { touched: false, error: null },
    confirmPassword: { touched: false, error: null },
  });
  const isSubmitting = useRef(false);
  const router = useRouter();
  const supabase = createClient();

  // Name validation
  const validateName = useCallback((value: string): string | null => {
    if (!value.trim()) {
      return "Name is required";
    }
    if (value.trim().length < MIN_NAME_LENGTH) {
      return `Name must be at least ${MIN_NAME_LENGTH} characters`;
    }
    if (!/^[a-zA-Z\s'-]+$/.test(value)) {
      return "Name can only contain letters, spaces, hyphens, and apostrophes";
    }
    return null;
  }, []);

  // Email validation
  const validateEmail = useCallback((value: string): string | null => {
    if (!value.trim()) {
      return "Email is required";
    }
    if (!EMAIL_REGEX.test(value)) {
      return "Please enter a valid email address";
    }
    return null;
  }, []);

  // Password validation
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
    (value: string): string | null => {
      if (!value) {
        return "Please confirm your password";
      }
      if (value !== password) {
        return "Passwords do not match";
      }
      return null;
    },
    [password]
  );

  // Calculate password strength
  const passwordStrength = useMemo((): PasswordStrength => {
    if (!password) return { level: "none", score: 0 };

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

    let level: PasswordStrengthLevel;
    if (score <= 2) level = "weak";
    else if (score <= 4) level = "medium";
    else level = "strong";

    return { level, score };
  }, [password]);

  // Get strength indicator properties
  const strengthConfig = useMemo(() => {
    switch (passwordStrength.level) {
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

  // Check if form is valid
  const isFormValid = useMemo(() => {
    return (
      !validateName(fullName) &&
      !validateEmail(email) &&
      !validatePassword(password) &&
      !validateConfirmPassword(confirmPassword)
    );
  }, [
    fullName,
    email,
    password,
    confirmPassword,
    validateName,
    validateEmail,
    validatePassword,
    validateConfirmPassword,
  ]);

  // Handle field changes
  const handleNameChange = useCallback(
    (value: string) => {
      setFullName(value);
      if (error) setError(null);
      if (validationState.fullName.touched) {
        setValidationState((prev) => ({
          ...prev,
          fullName: { ...prev.fullName, error: validateName(value) },
        }));
      }
    },
    [error, validationState.fullName.touched, validateName]
  );

  const handleEmailChange = useCallback(
    (value: string) => {
      setEmail(value);
      if (error) setError(null);
      if (validationState.email.touched) {
        setValidationState((prev) => ({
          ...prev,
          email: { ...prev.email, error: validateEmail(value) },
        }));
      }
    },
    [error, validationState.email.touched, validateEmail]
  );

  const handlePasswordChange = useCallback(
    (value: string) => {
      setPassword(value);
      if (error) setError(null);
      if (validationState.password.touched) {
        setValidationState((prev) => ({
          ...prev,
          password: { ...prev.password, error: validatePassword(value) },
        }));
      }
      // Re-validate confirm password if it's been touched
      if (validationState.confirmPassword.touched && confirmPassword) {
        setValidationState((prev) => ({
          ...prev,
          confirmPassword: {
            ...prev.confirmPassword,
            error: value !== confirmPassword ? "Passwords do not match" : null,
          },
        }));
      }
    },
    [
      error,
      validationState.password.touched,
      validationState.confirmPassword.touched,
      confirmPassword,
      validatePassword,
    ]
  );

  const handleConfirmPasswordChange = useCallback(
    (value: string) => {
      setConfirmPassword(value);
      if (error) setError(null);
      if (validationState.confirmPassword.touched) {
        setValidationState((prev) => ({
          ...prev,
          confirmPassword: {
            ...prev.confirmPassword,
            error: validateConfirmPassword(value),
          },
        }));
      }
    },
    [error, validationState.confirmPassword.touched, validateConfirmPassword]
  );

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const nameError = validateName(fullName);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    const confirmPasswordError = validateConfirmPassword(confirmPassword);

    setValidationState({
      fullName: { touched: true, error: nameError },
      email: { touched: true, error: emailError },
      password: { touched: true, error: passwordError },
      confirmPassword: { touched: true, error: confirmPasswordError },
    });

    // Prevent submission if validation fails
    if (nameError || emailError || passwordError || confirmPasswordError) {
      return;
    }

    // Prevent weak passwords from being submitted
    if (passwordStrength.level === "weak") {
      setError("Please use a stronger password");
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        if (error.message.includes("User already registered")) {
          setError(
            "An account with this email already exists. Please sign in instead."
          );
        } else if (error.message.includes("Password")) {
          setError("Password is too weak. Please use a stronger password.");
        } else if (
          error.message.includes("rate limit") ||
          error.message.includes("Email rate limit exceeded")
        ) {
          setError(
            "Too many signup attempts. Please wait an hour or use a different email address."
          );
        } else {
          setError(error.message);
        }
        setLoading(false);
        isSubmitting.current = false;
      } else {
        // Clear sensitive data
        setPassword("");
        setConfirmPassword("");

        // Show success message
        router.push(
          "/auth/login?message=Check your email to confirm your account"
        );
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
      isSubmitting.current = false;
    }
  };

  const handleGoogleSignup = async () => {
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

  const handleGitHubSignup = async () => {
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

  // Check if any action is in progress
  const isAnyLoading = loading || isGoogleLoading || isGitHubLoading;

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#0A0A0A]">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-br from-[#FF6B00]/20 to-transparent rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-tr from-[#FF6B00]/10 to-transparent rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#FF6B00]/5 rounded-full blur-3xl" />
      </div>

      {/* Left Panel - Signup Form */}
      <div className="flex flex-1 items-center justify-center p-4 sm:p-8 order-2 lg:order-1">
        <div className="w-full max-w-sm animate-slide-in-up">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-2xl font-bold text-white hover:text-[#FF6B00] transition-colors"
            >
              <img src="/logo.png" alt="CodeCanvas Logo" className="w-8 h-8" />
              CodeCanvas
            </Link>
          </div>

          {/* Form Card */}
          <div className="relative">
            {/* Glow effect behind card */}
            <div className="absolute -inset-1 bg-gradient-to-r from-[#FF6B00]/20 via-[#FF6B00]/10 to-[#FF6B00]/20 rounded-3xl blur-xl opacity-50" />

            <div className="relative rounded-xl border border-[#2E2E2E] bg-[#1A1A1A]/80 backdrop-blur-xl p-6 shadow-2xl">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-white mb-1">
                  Create your account
                </h2>
                <p className="text-sm text-[#A0A0A0]">
                  Start building amazing designs today
                </p>
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
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
                    htmlFor="fullName"
                    className="block text-sm font-medium text-[#A0A0A0]"
                  >
                    Full name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg
                        className="h-4 w-4 text-[#666666]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      required
                      disabled={isAnyLoading}
                      value={fullName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className={`block w-full rounded-lg border ${
                        validationState.fullName.touched &&
                        validationState.fullName.error
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                          : "border-[#2E2E2E] focus:border-[#FF6B00] focus:ring-[#FF6B00]/20"
                      } bg-[#0A0A0A]/50 pl-10 pr-3 py-2.5 text-sm text-white placeholder-[#666666] transition-all focus:outline-none focus:ring-2 focus:bg-[#0A0A0A] disabled:opacity-50 disabled:cursor-not-allowed`}
                      placeholder="John Doe"
                    />
                  </div>
                  {validationState.fullName.touched &&
                    validationState.fullName.error && (
                      <div className="flex items-center gap-2 text-sm text-red-400 animate-fade-in">
                        <svg
                          className="w-4 h-4 flex-shrink-0"
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
                        {validationState.fullName.error}
                      </div>
                    )}
                </div>

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
                        className="h-4 w-4 text-[#666666]"
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
                      required
                      disabled={isAnyLoading}
                      value={email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      className={`block w-full rounded-lg border ${
                        validationState.email.touched &&
                        validationState.email.error
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                          : "border-[#2E2E2E] focus:border-[#FF6B00] focus:ring-[#FF6B00]/20"
                      } bg-[#0A0A0A]/50 pl-10 pr-3 py-2.5 text-sm text-white placeholder-[#666666] transition-all focus:outline-none focus:ring-2 focus:bg-[#0A0A0A] disabled:opacity-50 disabled:cursor-not-allowed`}
                      placeholder="you@example.com"
                    />
                  </div>
                  {validationState.email.touched &&
                    validationState.email.error && (
                      <div className="flex items-center gap-2 text-sm text-red-400 animate-fade-in">
                        <svg
                          className="w-4 h-4 flex-shrink-0"
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
                        {validationState.email.error}
                      </div>
                    )}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-[#A0A0A0]"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg
                        className="h-5 w-5 text-[#666666]"
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
                      required
                      disabled={isAnyLoading}
                      value={password}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      className={`block w-full rounded-lg border ${
                        validationState.password.touched &&
                        validationState.password.error
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                          : "border-[#2E2E2E] focus:border-[#FF6B00] focus:ring-[#FF6B00]/20"
                      } bg-[#0A0A0A]/50 pl-10 pr-10 py-2.5 text-sm text-white placeholder-[#666666] transition-all focus:outline-none focus:ring-2 focus:bg-[#0A0A0A] disabled:opacity-50 disabled:cursor-not-allowed`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isAnyLoading}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#666666] hover:text-[#A0A0A0] transition-colors disabled:opacity-50"
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
                  {validationState.password.touched &&
                    validationState.password.error && (
                      <div className="flex items-center gap-2 text-sm text-red-400 animate-fade-in">
                        <svg
                          className="w-4 h-4 flex-shrink-0"
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
                        {validationState.password.error}
                      </div>
                    )}
                  {password && !validationState.password.error && (
                    <div className="space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#666666]">
                          Password strength
                        </span>
                        <span
                          className={`font-medium ${
                            passwordStrength.level === "strong"
                              ? "text-green-400"
                              : passwordStrength.level === "medium"
                                ? "text-orange-400"
                                : "text-red-400"
                          }`}
                        >
                          {passwordStrength.level.charAt(0).toUpperCase() +
                            passwordStrength.level.slice(1)}
                        </span>
                      </div>
                      <div className="h-2 bg-[#2E2E2E] rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            passwordStrength.level === "strong"
                              ? "bg-green-500"
                              : passwordStrength.level === "medium"
                                ? "bg-orange-500"
                                : "bg-red-500"
                          }`}
                          style={{
                            width: `${(passwordStrength.score / 7) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-[#A0A0A0]"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg
                        className="h-5 w-5 text-[#666666]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      disabled={isAnyLoading}
                      value={confirmPassword}
                      onChange={(e) =>
                        handleConfirmPasswordChange(e.target.value)
                      }
                      className={`block w-full rounded-xl border ${
                        validationState.confirmPassword.touched &&
                        validationState.confirmPassword.error
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                          : confirmPassword &&
                              !validationState.confirmPassword.error &&
                              validationState.confirmPassword.touched
                            ? "border-green-500 focus:border-green-500 focus:ring-green-500/20"
                            : "border-[#2E2E2E] focus:border-[#FF6B00] focus:ring-[#FF6B00]/20"
                      } bg-[#0A0A0A]/50 pl-12 pr-12 py-3.5 text-white placeholder-[#666666] transition-all focus:outline-none focus:ring-2 focus:bg-[#0A0A0A] disabled:opacity-50 disabled:cursor-not-allowed`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      disabled={isAnyLoading}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#666666] hover:text-[#A0A0A0] transition-colors disabled:opacity-50"
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
                  {validationState.confirmPassword.touched &&
                    validationState.confirmPassword.error && (
                      <div className="flex items-center gap-2 text-sm text-red-400 animate-fade-in">
                        <svg
                          className="w-4 h-4 flex-shrink-0"
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
                        {validationState.confirmPassword.error}
                      </div>
                    )}
                  {confirmPassword &&
                    !validationState.confirmPassword.error &&
                    validationState.confirmPassword.touched && (
                      <div className="flex items-center gap-2 text-sm text-green-400 animate-fade-in">
                        <svg
                          className="w-4 h-4 flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Passwords match
                      </div>
                    )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="relative w-full overflow-hidden rounded-lg bg-gradient-to-r from-[#FF6B00] to-[#CC5800] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#FF6B00]/25 transition-all hover:shadow-[#FF6B00]/40 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed group"
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
                        Creating account...
                      </>
                    ) : (
                      <>
                        Create account
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
                  onClick={handleGoogleSignup}
                  disabled={isAnyLoading}
                  className="w-full rounded-lg border border-[#2E2E2E] bg-[#0A0A0A]/50 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#2E2E2E] hover:border-[#3E3E3E] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-center gap-3">
                    {isGoogleLoading ? (
                      <>
                        <svg
                          className="h-5 w-5 animate-spin"
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
                        <svg className="h-5 w-5" viewBox="0 0 24 24">
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
                        Continue with Google
                      </>
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleGitHubSignup}
                  disabled={isAnyLoading}
                  className="w-full rounded-lg border border-[#2E2E2E] bg-[#0A0A0A]/50 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#2E2E2E] hover:border-[#3E3E3E] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-center gap-3">
                    {isGitHubLoading ? (
                      <>
                        <svg
                          className="h-5 w-5 animate-spin"
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
                          className="h-5 w-5"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                        Continue with GitHub
                      </>
                    )}
                  </div>
                </button>
              </form>

              <p className="mt-8 text-center text-sm text-[#666666]">
                Already have an account?{" "}
                <Link
                  href="/auth/login"
                  className="font-semibold text-[#FF6B00] hover:text-[#FF8533] transition-colors"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-[#666666]">
            By creating an account, you agree to our{" "}
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

      {/* Right Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative items-center justify-center p-12 bg-gradient-to-bl from-[#0A0A0A] via-[#1A1A1A] to-[#0A0A0A] order-1 lg:order-2">
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
            Join <span className="text-[#FF6B00]">CodeCanvas</span>
          </h1>

          <p className="text-xl text-[#A0A0A0] mb-12 leading-relaxed">
            Join thousands of designers and developers creating amazing UI
          </p>

          {/* Benefits List */}
          <div className="space-y-4 text-left max-w-sm mx-auto">
            {[
              {
                icon: "M5 13l4 4L19 7",
                text: "Sketch and generate code instantly",
              },
              { icon: "M5 13l4 4L19 7", text: "Access to 50+ UI components" },
              { icon: "M5 13l4 4L19 7", text: "Export to React, Vue, or HTML" },
              { icon: "M5 13l4 4L19 7", text: "Collaborate with your team" },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 animate-slide-in-left"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FF6B00]/20 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-[#FF6B00]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={item.icon}
                    />
                  </svg>
                </div>
                <span className="text-[#A0A0A0]">{item.text}</span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="mt-12 flex justify-center gap-8">
            {[
              { value: "10k+", label: "Users" },
              { value: "50k+", label: "Designs" },
              { value: "99%", label: "Uptime" },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl font-bold text-white">
                  {stat.value}
                </div>
                <div className="text-sm text-[#666666]">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
