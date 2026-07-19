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
import AuthLoadingSkeleton from "@/components/auth/AuthLoadingSkeleton";
import AuthShell, { T_AUTH } from "@/components/auth/AuthShell";
import {
  AuthError,
  AuthInput,
  AuthPasswordInput,
  AuthSubmitButton,
  AuthDivider,
  AuthCheckbox,
  OAuthButton,
} from "@/components/auth/AuthFields";

const REMEMBER_ME_KEY = "codecanvas_remember_me";
const SAVED_EMAIL_KEY = "codecanvas_saved_email";
const MIN_PASSWORD_LENGTH = 6;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface ValidationState {
  email: { touched: boolean; error: string | null };
  password: { touched: boolean; error: string | null };
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthLoadingSkeleton />}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  const validateEmail = useCallback((value: string): string | null => {
    if (!value.trim()) return "Email is required";
    if (!value.includes("@")) return "Email must contain @";
    if (!EMAIL_REGEX.test(value)) return "Please enter a valid email address";
    return null;
  }, []);

  const validatePassword = useCallback((value: string): string | null => {
    if (!value) return "Password is required";
    if (value.length < MIN_PASSWORD_LENGTH)
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    return null;
  }, []);

  const isFormValid = useMemo(
    () => !validateEmail(email) && !validatePassword(password),
    [email, password, validateEmail, validatePassword]
  );

  const handleEmailChange = useCallback(
    (value: string) => {
      setEmail(value);
      if (error) setError(null);
      if (validation.email.touched) {
        setValidation((prev) => ({
          ...prev,
          email: { ...prev.email, error: validateEmail(value) },
        }));
      }
    },
    [error, validation.email.touched, validateEmail]
  );

  const handleEmailBlur = useCallback(() => {
    setValidation((prev) => ({
      ...prev,
      email: { touched: true, error: validateEmail(email) },
    }));
  }, [email, validateEmail]);

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
    },
    [error, validation.password.touched, validatePassword]
  );

  const handlePasswordBlur = useCallback(() => {
    setValidation((prev) => ({
      ...prev,
      password: { touched: true, error: validatePassword(password) },
    }));
  }, [password, validatePassword]);

  // Restore saved email if remember-me was on
  useEffect(() => {
    const savedRememberMe = localStorage.getItem(REMEMBER_ME_KEY) === "true";
    const savedEmail = localStorage.getItem(SAVED_EMAIL_KEY);
    if (savedRememberMe && savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Pick up error redirect params from supabase callback
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (
      errorParam === "auth_code_exchange_failed" ||
      errorParam === "auth_failed"
    ) {
      setError("Authentication failed. Please try again.");
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    setValidation({
      email: { touched: true, error: emailError },
      password: { touched: true, error: passwordError },
    });

    if (emailError || passwordError) return;
    if (isSubmitting.current || loading) return;

    isSubmitting.current = true;
    setLoading(true);
    setError(null);

    try {
      if (rememberMe) {
        localStorage.setItem(REMEMBER_ME_KEY, "true");
        localStorage.setItem(SAVED_EMAIL_KEY, email);
      } else {
        localStorage.removeItem(REMEMBER_ME_KEY);
        localStorage.removeItem(SAVED_EMAIL_KEY);
      }

      const { error } = await supabase.auth.signInWithPassword({
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
        setPassword("");
        const redirectParam = searchParams.get("redirectTo");
        const target =
          redirectParam && redirectParam.startsWith("/")
            ? redirectParam
            : "/dashboard";
        router.push(target);
        router.refresh();
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
      const redirectParam = searchParams.get("redirectTo");
      const callbackUrl =
        redirectParam && redirectParam.startsWith("/")
          ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectParam)}`
          : `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: callbackUrl },
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

  return (
    <AuthShell
      slug="ACCESS · LOGIN"
      title="Welcome"
      italicWord="back."
      subtitle="Sign in to continue to your canvas."
      footerNote={
        <span style={{ letterSpacing: "0.12em" }}>
          NEW HERE?{" "}
          <Link
            href="/auth/signup"
            className="d5-link"
            style={{ color: T_AUTH.cobalt }}
          >
            CREATE AN ACCOUNT
          </Link>
        </span>
      }
    >
      <form onSubmit={handleLogin} noValidate>
        <AuthError message={error} />

        <AuthInput
          id="email"
          label="EMAIL"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={handleEmailChange}
          onBlur={handleEmailBlur}
          placeholder="you@example.com"
          disabled={isAnyLoading}
          required
          error={validation.email.touched ? validation.email.error : null}
        />

        <AuthPasswordInput
          id="password"
          label="PASSWORD"
          autoComplete="current-password"
          value={password}
          onChange={handlePasswordChange}
          onBlur={handlePasswordBlur}
          disabled={isAnyLoading}
          required
          error={validation.password.touched ? validation.password.error : null}
          rightSlot={
            <Link
              href="/auth/forgot-password"
              className="d5-mono d5-link text-[13px] tracking-[0.16em] uppercase"
            >
              FORGOT?
            </Link>
          }
        />

        <div className="mb-6 flex items-center justify-between">
          <AuthCheckbox
            id="remember"
            label="Remember me"
            checked={rememberMe}
            onChange={setRememberMe}
            disabled={isAnyLoading}
          />
        </div>

        <AuthSubmitButton
          label="SIGN IN"
          loadingLabel="SIGNING IN..."
          loading={loading}
          disabled={
            !isFormValid &&
            (validation.email.touched || validation.password.touched)
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
          className="d5-sans mt-6 text-center text-[13px] leading-[1.5]"
          style={{ color: T_AUTH.muted }}
        >
          By signing in, you agree to our{" "}
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
