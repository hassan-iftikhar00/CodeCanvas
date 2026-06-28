"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthLoadingSkeleton from "@/components/auth/AuthLoadingSkeleton";
import AuthShell, { T_AUTH } from "@/components/auth/AuthShell";
import {
  AuthError,
  AuthInput,
  AuthPasswordInput,
  AuthSubmitButton,
  AuthDivider,
  OAuthButton,
  PasswordStrengthMeter,
} from "@/components/auth/AuthFields";

const MIN_PASSWORD_LENGTH = 6;
const MIN_NAME_LENGTH = 2;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

type PasswordStrengthLevel = "none" | "weak" | "medium" | "strong";

interface ValidationState {
  fullName: { touched: boolean; error: string | null };
  email: { touched: boolean; error: string | null };
  password: { touched: boolean; error: string | null };
  confirmPassword: { touched: boolean; error: string | null };
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGitHubLoading, setIsGitHubLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState<ValidationState>({
    fullName: { touched: false, error: null },
    email: { touched: false, error: null },
    password: { touched: false, error: null },
    confirmPassword: { touched: false, error: null },
  });
  const isSubmitting = useRef(false);
  const router = useRouter();
  const supabase = createClient();

  const validateName = useCallback((value: string): string | null => {
    if (!value.trim()) return "Name is required";
    if (value.trim().length < MIN_NAME_LENGTH)
      return `Name must be at least ${MIN_NAME_LENGTH} characters`;
    if (!/^[a-zA-Z\s'-]+$/.test(value))
      return "Name can only contain letters, spaces, hyphens, and apostrophes";
    return null;
  }, []);

  const validateEmail = useCallback((value: string): string | null => {
    if (!value.trim()) return "Email is required";
    if (!EMAIL_REGEX.test(value)) return "Please enter a valid email address";
    return null;
  }, []);

  const validatePassword = useCallback((value: string): string | null => {
    if (!value) return "Password is required";
    if (value.length < MIN_PASSWORD_LENGTH)
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    return null;
  }, []);

  const validateConfirmPassword = useCallback(
    (value: string): string | null => {
      if (!value) return "Please confirm your password";
      if (value !== password) return "Passwords do not match";
      return null;
    },
    [password]
  );

  const passwordStrength = useMemo((): { level: PasswordStrengthLevel; score: number } => {
    if (!password) return { level: "none", score: 0 };
    let score = 0;
    if (password.length >= MIN_PASSWORD_LENGTH) score++;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
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

  const isFormValid = useMemo(
    () =>
      !validateName(fullName) &&
      !validateEmail(email) &&
      !validatePassword(password) &&
      !validateConfirmPassword(confirmPassword),
    [
      fullName,
      email,
      password,
      confirmPassword,
      validateName,
      validateEmail,
      validatePassword,
      validateConfirmPassword,
    ]
  );

  const handleNameChange = useCallback(
    (value: string) => {
      setFullName(value);
      if (error) setError(null);
      if (v.fullName.touched) {
        setV((prev) => ({
          ...prev,
          fullName: { ...prev.fullName, error: validateName(value) },
        }));
      }
    },
    [error, v.fullName.touched, validateName]
  );

  const handleEmailChange = useCallback(
    (value: string) => {
      setEmail(value);
      if (error) setError(null);
      if (v.email.touched) {
        setV((prev) => ({
          ...prev,
          email: { ...prev.email, error: validateEmail(value) },
        }));
      }
    },
    [error, v.email.touched, validateEmail]
  );

  const handlePasswordChange = useCallback(
    (value: string) => {
      setPassword(value);
      if (error) setError(null);
      if (v.password.touched) {
        setV((prev) => ({
          ...prev,
          password: { ...prev.password, error: validatePassword(value) },
        }));
      }
      if (v.confirmPassword.touched && confirmPassword) {
        setV((prev) => ({
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
      v.password.touched,
      v.confirmPassword.touched,
      confirmPassword,
      validatePassword,
    ]
  );

  const handleConfirmPasswordChange = useCallback(
    (value: string) => {
      setConfirmPassword(value);
      if (error) setError(null);
      if (v.confirmPassword.touched) {
        setV((prev) => ({
          ...prev,
          confirmPassword: {
            ...prev.confirmPassword,
            error: validateConfirmPassword(value),
          },
        }));
      }
    },
    [error, v.confirmPassword.touched, validateConfirmPassword]
  );

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameError = validateName(fullName);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    const confirmPasswordError = validateConfirmPassword(confirmPassword);

    setV({
      fullName: { touched: true, error: nameError },
      email: { touched: true, error: emailError },
      password: { touched: true, error: passwordError },
      confirmPassword: { touched: true, error: confirmPasswordError },
    });

    if (nameError || emailError || passwordError || confirmPasswordError) return;
    if (passwordStrength.level === "weak") {
      setError("Please use a stronger password");
      return;
    }
    if (isSubmitting.current || loading) return;

    isSubmitting.current = true;
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim() },
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
        setPassword("");
        setConfirmPassword("");
        router.push(
          "/auth/login?message=Check your email to confirm your account"
        );
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
      isSubmitting.current = false;
    }
  };

  const handleOAuth = async (
    provider: "google" | "github",
    setProviderLoading: (b: boolean) => void
  ) => {
    if (loading || isGoogleLoading || isGitHubLoading) return;
    setProviderLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setError(error.message);
        setProviderLoading(false);
      }
    } catch {
      setError(
        `Failed to connect to ${provider === "google" ? "Google" : "GitHub"}. Please try again.`
      );
      setProviderLoading(false);
    }
  };

  const isAnyLoading = loading || isGoogleLoading || isGitHubLoading;

  if (isAnyLoading && !error && !isGoogleLoading && !isGitHubLoading) {
    return <AuthLoadingSkeleton />;
  }

  return (
    <AuthShell
      slug="ACCESS · SIGN UP"
      title="Start"
      italicWord="drafting."
      subtitle="Create your account in under a minute."
      footerNote={
        <span style={{ letterSpacing: "0.12em" }}>
          ALREADY HAVE AN ACCOUNT?{" "}
          <Link
            href="/auth/login"
            className="d5-link"
            style={{ color: T_AUTH.cobalt }}
          >
            SIGN IN
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSignup} noValidate>
        <AuthError message={error} />

        <AuthInput
          id="fullName"
          label="FULL NAME"
          autoComplete="name"
          value={fullName}
          onChange={handleNameChange}
          onBlur={() =>
            setV((prev) => ({
              ...prev,
              fullName: { touched: true, error: validateName(fullName) },
            }))
          }
          placeholder="Ada Lovelace"
          disabled={isAnyLoading}
          required
          error={v.fullName.touched ? v.fullName.error : null}
        />

        <AuthInput
          id="email"
          label="EMAIL"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={handleEmailChange}
          onBlur={() =>
            setV((prev) => ({
              ...prev,
              email: { touched: true, error: validateEmail(email) },
            }))
          }
          placeholder="you@example.com"
          disabled={isAnyLoading}
          required
          error={v.email.touched ? v.email.error : null}
        />

        <AuthPasswordInput
          id="password"
          label="PASSWORD"
          autoComplete="new-password"
          value={password}
          onChange={handlePasswordChange}
          onBlur={() =>
            setV((prev) => ({
              ...prev,
              password: { touched: true, error: validatePassword(password) },
            }))
          }
          disabled={isAnyLoading}
          required
          error={v.password.touched ? v.password.error : null}
        />

        {password && !v.password.error && (
          <PasswordStrengthMeter
            score={passwordStrength.score}
            level={passwordStrength.level}
          />
        )}

        <AuthPasswordInput
          id="confirmPassword"
          label="CONFIRM PASSWORD"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={handleConfirmPasswordChange}
          onBlur={() =>
            setV((prev) => ({
              ...prev,
              confirmPassword: {
                touched: true,
                error: validateConfirmPassword(confirmPassword),
              },
            }))
          }
          disabled={isAnyLoading}
          required
          error={v.confirmPassword.touched ? v.confirmPassword.error : null}
        />

        <AuthSubmitButton
          label="CREATE ACCOUNT"
          loadingLabel="CREATING..."
          loading={loading}
          disabled={
            !isFormValid &&
            (v.fullName.touched ||
              v.email.touched ||
              v.password.touched ||
              v.confirmPassword.touched)
          }
        />

        <AuthDivider />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <OAuthButton
            provider="google"
            label="GOOGLE"
            loading={isGoogleLoading}
            disabled={isAnyLoading}
            onClick={() => handleOAuth("google", setIsGoogleLoading)}
          />
          <OAuthButton
            provider="github"
            label="GITHUB"
            loading={isGitHubLoading}
            disabled={isAnyLoading}
            onClick={() => handleOAuth("github", setIsGitHubLoading)}
          />
        </div>

        <p
          className="d5-sans mt-6 text-center text-[11px] leading-[1.5]"
          style={{ color: T_AUTH.muted }}
        >
          By creating an account, you agree to our{" "}
          <Link href="#" className="d5-link">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="#" className="d5-link">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </AuthShell>
  );
}
