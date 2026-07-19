"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { DRAFTING_TOKENS as T } from "@/lib/drafting-room/tokens";

type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
  durationMs: number;
}

interface ToastOptions {
  title?: string;
  durationMs?: number;
}

interface ToastApi {
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION_MS = 4000;
const ERROR_DURATION_MS = 6000;

const VARIANT_META: Record<
  ToastVariant,
  {
    accent: string;
    slug: string;
    live: "polite" | "assertive";
    role: "status" | "alert";
  }
> = {
  success: {
    accent: T.success,
    slug: "SUCCESS",
    live: "polite",
    role: "status",
  },
  error: {
    accent: T.error,
    slug: "ERROR",
    live: "assertive",
    role: "alert",
  },
  warning: {
    accent: T.warning,
    slug: "WARNING",
    live: "polite",
    role: "status",
  },
  info: {
    accent: T.cobalt,
    slug: "INFO",
    live: "polite",
    role: "status",
  },
};

const MONO = "var(--font-jetbrains-mono, ui-monospace, monospace)";
const SANS = "var(--font-inter, ui-sans-serif, system-ui, sans-serif)";

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string, options?: ToastOptions) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const durationMs =
        options?.durationMs ??
        (variant === "error" ? ERROR_DURATION_MS : DEFAULT_DURATION_MS);
      setToasts((prev) => [
        ...prev,
        { id, title: options?.title, message, variant, durationMs },
      ]);
      const timer = setTimeout(() => dismiss(id), durationMs);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss]
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer) => clearTimeout(timer));
      map.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, options) => push("success", message, options),
      error: (message, options) => push("error", message, options),
      warning: (message, options) => push("warning", message, options),
      info: (message, options) => push("info", message, options),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[80] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-full sm:max-w-sm"
      aria-label="Notifications"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastCard
            key={toast.id}
            toast={toast}
            onDismiss={() => onDismiss(toast.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const meta = VARIANT_META[toast.variant];

  return (
    <motion.div
      role={meta.role}
      aria-live={meta.live}
      aria-atomic="true"
      layout
      initial={{ opacity: 0, x: 24, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{
        opacity: 0,
        x: 24,
        scale: 0.98,
        transition: { duration: 0.16 },
      }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="pointer-events-auto flex"
      style={{
        background: T.paper,
        border: `1px solid ${T.rule}`,
        boxShadow:
          "0 10px 28px -10px rgba(14,14,15,0.22), 0 2px 6px -2px rgba(14,14,15,0.10)",
      }}
    >
      {/* Variant accent rail — quick scan ID */}
      <span
        aria-hidden="true"
        className="w-[3px] flex-none"
        style={{ background: meta.accent }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mono slug bar — accent dot + variant + dismiss */}
        <div
          className="flex items-center justify-between gap-2 border-b px-3 py-1.5 text-[13px] tracking-[0.16em] uppercase"
          style={{
            borderColor: T.rule,
            background: T.vellum,
            color: T.muted,
            fontFamily: MONO,
          }}
        >
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5"
              style={{ background: meta.accent }}
            />
            <span style={{ color: meta.accent }}>{meta.slug}</span>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notification"
            className="relative flex h-5 w-5 items-center justify-center transition-colors before:absolute before:-inset-3 before:content-['']"
            style={{ color: T.muted }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = T.graphite;
              e.currentTarget.style.background = T.paper;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = T.muted;
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3 w-3"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Title + message body */}
        <div className="px-3 py-2.5">
          {toast.title ? (
            <p
              className="text-[13px] font-medium leading-snug"
              style={{ color: T.graphite, fontFamily: SANS }}
            >
              {toast.title}
            </p>
          ) : null}
          <p
            className="text-[13px] leading-[1.5] break-words"
            style={{
              color: toast.title ? T.muted : T.graphite,
              fontFamily: SANS,
              marginTop: toast.title ? 4 : 0,
            }}
          >
            {toast.message}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}
