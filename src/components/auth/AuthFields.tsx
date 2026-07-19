"use client";

import { ReactNode, useState } from "react";
import { T_AUTH } from "./AuthShell";

// ─── ERROR PANE ─────────────────────────────────────────────────────────────

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      className="d5-mono d5-shake mb-5 flex items-start gap-3 border px-3 py-2.5 text-[13px] tracking-[0.04em] leading-[1.5]"
      style={{
        borderColor: T_AUTH.error,
        background: `${T_AUTH.error}0F`,
        color: T_AUTH.error,
      }}
      role="alert"
    >
      <span
        className="d5-mono mt-[1px] inline-block flex-shrink-0 text-[13px] font-bold"
        aria-hidden="true"
      >
        [!]
      </span>
      <span style={{ textTransform: "none", letterSpacing: 0 }}>{message}</span>
    </div>
  );
}

// ─── INPUT ──────────────────────────────────────────────────────────────────

interface AuthInputProps {
  id: string;
  label: string;
  type?: "text" | "email";
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "email";
  disabled?: boolean;
  required?: boolean;
  error?: string | null;
  rightSlot?: ReactNode;
}

export function AuthInput({
  id,
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  placeholder,
  autoComplete,
  inputMode,
  disabled,
  required,
  error,
  rightSlot,
}: AuthInputProps) {
  return (
    <div className="mb-5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="d5-input-label">
          {label}
        </label>
        {rightSlot}
      </div>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        disabled={disabled}
        required={required}
        className={`d5-input ${error ? "is-error" : ""}`}
      />
      {error && (
        <p
          className="d5-mono mt-2 text-[13px] tracking-[0.06em]"
          style={{ color: T_AUTH.error, textTransform: "none" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

// ─── PASSWORD INPUT ─────────────────────────────────────────────────────────

interface AuthPasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string | null;
  rightSlot?: ReactNode;
}

export function AuthPasswordInput({
  id,
  label,
  value,
  onChange,
  onBlur,
  placeholder = "********",
  autoComplete = "current-password",
  disabled,
  required,
  error,
  rightSlot,
}: AuthPasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="mb-5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="d5-input-label">
          {label}
        </label>
        {rightSlot}
      </div>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          required={required}
          className={`d5-input ${error ? "is-error" : ""}`}
          style={{ paddingRight: 56 }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          className="d5-mono absolute right-0 bottom-[10px] text-[13px] tracking-[0.16em] uppercase"
          style={{
            color: T_AUTH.muted,
            background: "transparent",
            border: 0,
            cursor: "pointer",
            padding: "4px 0 4px 8px",
          }}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "HIDE" : "SHOW"}
        </button>
      </div>
      {error && (
        <p
          className="d5-mono mt-2 text-[13px] tracking-[0.06em]"
          style={{ color: T_AUTH.error, textTransform: "none" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

// ─── OAUTH BUTTON ───────────────────────────────────────────────────────────

interface OAuthButtonProps {
  provider: "google" | "github";
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function OAuthButton({
  provider,
  label,
  loading,
  disabled,
  onClick,
}: OAuthButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="d5-btn"
    >
      {loading ? (
        <Spinner />
      ) : (
        <>
          {provider === "google" ? <GoogleIcon /> : <GithubIcon />}
          <span>{loading ? "REDIRECTING" : label}</span>
        </>
      )}
    </button>
  );
}

// ─── SUBMIT BUTTON ──────────────────────────────────────────────────────────

interface AuthSubmitButtonProps {
  loading: boolean;
  loadingLabel: string;
  label: string;
  disabled?: boolean;
}

export function AuthSubmitButton({
  loading,
  loadingLabel,
  label,
  disabled,
}: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className="d5-btn d5-btn-primary"
    >
      {loading ? (
        <>
          <Spinner />
          {loadingLabel}
        </>
      ) : (
        <>
          {label} <span aria-hidden="true">→</span>
        </>
      )}
    </button>
  );
}

// ─── DIVIDER ────────────────────────────────────────────────────────────────

export function AuthDivider({
  label = "OR CONTINUE WITH",
}: {
  label?: string;
}) {
  return (
    <div className="my-6 flex items-center gap-3">
      <div
        className="h-px flex-1"
        style={{ background: T_AUTH.rule, opacity: 0.4 }}
      />
      <span
        className="d5-mono text-[13px] tracking-[0.18em] uppercase"
        style={{ color: T_AUTH.muted }}
      >
        {label}
      </span>
      <div
        className="h-px flex-1"
        style={{ background: T_AUTH.rule, opacity: 0.4 }}
      />
    </div>
  );
}

// ─── CHECKBOX ───────────────────────────────────────────────────────────────

interface AuthCheckboxProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function AuthCheckbox({
  id,
  label,
  checked,
  onChange,
  disabled,
}: AuthCheckboxProps) {
  return (
    <label
      htmlFor={id}
      className="d5-sans inline-flex cursor-pointer items-center gap-2.5 text-[13px]"
      style={{ color: T_AUTH.graphite }}
    >
      <span className="relative inline-flex h-4 w-4 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="peer sr-only"
        />
        <span
          className="block h-4 w-4 border"
          style={{
            borderColor: T_AUTH.rule,
            background: checked ? T_AUTH.cobalt : T_AUTH.paper,
            transition: "background 120ms ease, border-color 120ms ease",
          }}
        />
        {checked && (
          <svg
            className="absolute"
            width="10"
            height="10"
            viewBox="0 0 10 10"
            style={{ color: T_AUTH.paper, pointerEvents: "none" }}
          >
            <path
              d="M2 5.5 L4.5 8 L8.5 2.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span>{label}</span>
    </label>
  );
}

// ─── PASSWORD STRENGTH METER ────────────────────────────────────────────────

export function PasswordStrengthMeter({
  score,
  level,
}: {
  score: number;
  level: "none" | "weak" | "medium" | "strong";
}) {
  if (level === "none") return null;
  const pct = Math.min(100, (score / 7) * 100);
  const config = {
    weak: { label: "WEAK", color: T_AUTH.error },
    medium: { label: "MEDIUM", color: T_AUTH.cobalt },
    strong: { label: "STRONG", color: T_AUTH.success },
  }[level];
  return (
    <div className="mb-5 -mt-3">
      <div className="d5-mono mb-1.5 flex items-center justify-between text-[13px] tracking-[0.16em] uppercase">
        <span style={{ color: T_AUTH.muted }}>PASSWORD STRENGTH</span>
        <span style={{ color: config.color }}>{config.label}</span>
      </div>
      <div className="h-[3px] w-full" style={{ background: T_AUTH.vellum }}>
        <div
          className="h-full transition-all duration-200"
          style={{ width: `${pct}%`, background: config.color }}
        />
      </div>
    </div>
  );
}

// ─── SUCCESS PANE ───────────────────────────────────────────────────────────

export function AuthSuccess({
  title,
  message,
}: {
  title: string;
  message: ReactNode;
}) {
  return (
    <div
      className="d5-mono mb-5 border px-4 py-3 text-[13px] leading-[1.55]"
      style={{
        borderColor: T_AUTH.success,
        background: `${T_AUTH.success}0D`,
        color: T_AUTH.graphite,
        letterSpacing: 0,
        textTransform: "none",
      }}
      role="status"
    >
      <div
        className="mb-1.5 text-[13px] tracking-[0.18em] uppercase"
        style={{ color: T_AUTH.success }}
      >
        [OK] {title}
      </div>
      <div className="d5-sans" style={{ color: T_AUTH.graphite }}>
        {message}
      </div>
    </div>
  );
}

// ─── ICONS (inline, small) ──────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: "spin 0.9s linear infinite" }}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 1-9 9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
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
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.565 21.796 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
