"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthLoadingSkeleton from "@/components/auth/AuthLoadingSkeleton";
import AuthShell, { T_AUTH } from "@/components/auth/AuthShell";
import {
  AuthError,
  AuthPasswordInput,
  AuthSubmitButton,
  AuthSuccess,
  PasswordStrengthMeter,
} from "@/components/auth/AuthFields";

const MIN_PASSWORD_LENGTH = 6;

type PasswordStrengthLevel = "none" | "weak" | "medium" | "strong";

interface ValidationState {
  password: { touched: boolean; error: string | null };
  confirmPassword: { touched: boolean; error: string | null };
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [v, setV] = useState<ValidationState>({
    password: { touched: false, error: null },
    confirmPassword: { touched: false, error: null },
  });
  const isSubmitting = useRef(false);
  const router = useRouter();
  const supabase = createClient();

  // Recovery token validation — preserve original flow exactly.
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setTokenValid(!!session);
    };

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

  const validatePassword = useCallback((value: string): string | null => {
    if (!value) return "Password is required";
    if (value.length < MIN_PASSWORD_LENGTH)
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    return null;
  }, []);

  const validateConfirmPassword = useCallback(
    (confirm: string, pass: string): string | null => {
      if (!confirm) return "Please confirm your password";
      if (confirm !== pass) return "Passwords do not match";
      return null;
    },
    []
  );

  const passwordStrength = useMemo((): {
    level: PasswordStrengthLevel;
    score: number;
  } => {
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
            error: validateConfirmPassword(confirmPassword, value),
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
      validateConfirmPassword,
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
            error: validateConfirmPassword(value, password),
          },
        }));
      }
    },
    [error, v.confirmPassword.touched, password, validateConfirmPassword]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const passwordError = validatePassword(password);
    const confirmPasswordError = validateConfirmPassword(
      confirmPassword,
      password
    );

    setV({
      password: { touched: true, error: passwordError },
      confirmPassword: { touched: true, error: confirmPasswordError },
    });

    if (passwordError || confirmPasswordError) return;
    if (isSubmitting.current || loading) return;

    isSubmitting.current = true;
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setError(
          "Unable to reset password. Please try again or request a new reset link."
        );
        setLoading(false);
        isSubmitting.current = false;
      } else {
        await supabase.auth.signOut();
        setSuccess(true);
        setLoading(false);
        isSubmitting.current = false;
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

  // Loading — token check in flight
  if (tokenValid === null) {
    return <AuthLoadingSkeleton />;
  }

  // Invalid or expired recovery token
  if (tokenValid === false) {
    return (
      <AuthShell
        slug="ACCESS · RECOVERY · INVALID"
        title="Link"
        italicWord="expired."
        subtitle="This password reset link is invalid or has expired."
      >
        <AuthError message="The recovery token is no longer valid. Please request a new reset link." />
        <Link
          href="/auth/forgot-password"
          className="d5-btn d5-btn-primary"
          style={{ textDecoration: "none" }}
        >
          REQUEST NEW LINK <span aria-hidden="true">→</span>
        </Link>
        <p
          className="d5-mono mt-5 text-center text-[10px] tracking-[0.16em] uppercase"
          style={{ color: T_AUTH.muted }}
        >
          OR{" "}
          <Link
            href="/auth/login"
            className="d5-link"
            style={{ color: T_AUTH.cobalt }}
          >
            BACK TO LOGIN
          </Link>
        </p>
      </AuthShell>
    );
  }

  // Success — password updated
  if (success) {
    return (
      <AuthShell
        slug="ACCESS · RECOVERY · COMPLETE"
        title="Password"
        italicWord="updated."
        subtitle="Redirecting you to login in a moment."
      >
        <AuthSuccess
          title="ALL SET"
          message={
            <>
              Your password has been updated. You&apos;ll be redirected to the
              login page in a few seconds, or you can{" "}
              <Link href="/auth/login" className="d5-link">
                go now
              </Link>
              .
            </>
          }
        />
      </AuthShell>
    );
  }

  // Form — set new password
  return (
    <AuthShell
      slug="ACCESS · RECOVERY · NEW PASSWORD"
      title="Set a new"
      italicWord="password."
      subtitle="Pick something you'll remember, but no one else will guess."
      footerNote={
        <span style={{ letterSpacing: "0.12em" }}>
          REMEMBERED IT?{" "}
          <Link
            href="/auth/login"
            className="d5-link"
            style={{ color: T_AUTH.cobalt }}
          >
            BACK TO LOGIN
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <AuthError message={error} />

        <AuthPasswordInput
          id="password"
          label="NEW PASSWORD"
          autoComplete="new-password"
          value={password}
          onChange={handlePasswordChange}
          onBlur={() =>
            setV((prev) => ({
              ...prev,
              password: { touched: true, error: validatePassword(password) },
            }))
          }
          disabled={loading}
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
                error: validateConfirmPassword(confirmPassword, password),
              },
            }))
          }
          disabled={loading}
          required
          error={v.confirmPassword.touched ? v.confirmPassword.error : null}
        />

        <AuthSubmitButton
          label="UPDATE PASSWORD"
          loadingLabel="UPDATING..."
          loading={loading}
          disabled={
            !!(
              v.password.touched &&
              (v.password.error || v.confirmPassword.error)
            )
          }
        />
      </form>
    </AuthShell>
  );
}
