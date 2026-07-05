"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthShell, { T_AUTH } from "@/components/auth/AuthShell";
import {
  AuthError,
  AuthInput,
  AuthSubmitButton,
  AuthSuccess,
} from "@/components/auth/AuthFields";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const isSubmitting = useRef(false);
  const supabase = createClient();

  const validateEmail = useCallback((value: string): string | null => {
    if (!value.trim()) return "Email is required";
    if (!value.includes("@")) return "Email must contain @";
    if (!EMAIL_REGEX.test(value)) return "Please enter a valid email address";
    return null;
  }, []);

  const emailError = useMemo(
    () => validateEmail(email),
    [email, validateEmail]
  );

  const handleEmailChange = useCallback(
    (value: string) => {
      setEmail(value);
      if (error) setError(null);
    },
    [error]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    if (emailError) return;
    if (isSubmitting.current || loading) return;

    isSubmitting.current = true;
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      });

      if (error) {
        // Generic message — don't leak account existence
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

  return (
    <AuthShell
      slug={success ? "ACCESS · RECOVERY · SENT" : "ACCESS · RECOVERY"}
      title={success ? "Check" : "Forgot"}
      italicWord={success ? "your inbox." : "password?"}
      subtitle={
        success
          ? "If an account exists for that email, a reset link is on the way."
          : "Enter your email and we'll send a reset link."
      }
      footerNote={
        <span style={{ letterSpacing: "0.12em" }}>
          REMEMBER IT NOW?{" "}
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
      {success ? (
        <div>
          <AuthSuccess
            title="LINK SENT"
            message={
              <>
                Check your inbox at <strong>{email}</strong>. The reset link
                expires in 1 hour. Didn&apos;t receive it? Check your spam
                folder or wait a minute and{" "}
                <button
                  type="button"
                  className="d5-link"
                  style={{
                    background: "transparent",
                    border: 0,
                    padding: 0,
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setSuccess(false);
                  }}
                >
                  try again
                </button>
                .
              </>
            }
          />
          <Link
            href="/auth/login"
            className="d5-btn d5-btn-primary"
            style={{ textDecoration: "none" }}
          >
            BACK TO LOGIN <span aria-hidden="true">→</span>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <AuthError message={error} />

          <AuthInput
            id="email"
            label="EMAIL"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={handleEmailChange}
            onBlur={() => setEmailTouched(true)}
            placeholder="you@example.com"
            disabled={loading}
            required
            error={emailTouched ? emailError : null}
          />

          <AuthSubmitButton
            label="SEND RESET LINK"
            loadingLabel="SENDING..."
            loading={loading}
            disabled={!!emailError && emailTouched}
          />
        </form>
      )}
    </AuthShell>
  );
}
