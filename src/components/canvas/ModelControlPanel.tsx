"use client";

import { useCallback, useEffect, useState } from "react";
import DraftingModal, { ModalOption, ModalSection } from "./DraftingModal";
import { T_CANVAS } from "./canvasTokens";

/**
 * Hidden model-control panel (Ctrl+Shift+G). Exhibition-day tool: watch the
 * Gemini key pool and force a model tier without touching the backend.
 *
 * Modes map to the backend's forceModel field:
 *   AUTO  - full ladder (best model first, fallback on quota)
 *   BEST  - strongest model only; fails rather than silently degrading
 *   SAVER - forces the mid-tier model to preserve the best model's daily quota
 *
 * SAVER forces gemini-3-flash-preview (not 2.5-flash) because the key health
 * check showed 2.5-flash is no longer served to most newer free projects.
 */

export type ModelMode = "auto" | "best" | "saver";

export const MODEL_MODE_FORCE: Record<ModelMode, string | undefined> = {
  auto: undefined,
  best: "gemini-3.5-flash",
  saver: "gemini-3-flash-preview",
};

export const MODEL_MODE_STORAGE_KEY = "codecanvas:model-mode";
export const AUTO_REPAIR_STORAGE_KEY = "codecanvas:auto-repair";

interface ModelStatusEntry {
  cooldown_remaining_s: number;
  success_count_today: number;
}

interface KeyStatus {
  slot: number;
  env: string;
  last_success_ts: number | null;
  models: Record<string, ModelStatusEntry>;
}

interface PoolStatus {
  ladder: string[];
  keys: KeyStatus[];
}

interface ModelControlPanelProps {
  open: boolean;
  onClose: () => void;
  mode: ModelMode;
  onModeChange: (mode: ModelMode) => void;
  autoRepairEnabled: boolean;
  onAutoRepairChange: (enabled: boolean) => void;
}

const MONO = "var(--font-jetbrains-mono, ui-monospace, monospace)";

/** Short display name: gemini-3.5-flash -> 3.5-FLASH */
function shortModel(model: string): string {
  return model
    .replace(/^gemini-/, "")
    .replace(/-preview$/, "-PV")
    .toUpperCase();
}

function chipState(entry: ModelStatusEntry): {
  label: string;
  color: string;
} {
  const cd = entry.cooldown_remaining_s;
  if (cd <= 0) return { label: "OK", color: T_CANVAS.success };
  // Anything cooling for over an hour is a per-day quota hit.
  if (cd > 3600) return { label: "SPENT", color: T_CANVAS.error };
  return { label: `${cd}S`, color: T_CANVAS.warning };
}

export default function ModelControlPanel({
  open,
  onClose,
  mode,
  onModeChange,
  autoRepairEnabled,
  onAutoRepairChange,
}: ModelControlPanelProps) {
  const [status, setStatus] = useState<PoolStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/llm-status", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Status request failed (${res.status})`);
      }
      setStatus(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void fetchStatus();
  }, [open, fetchStatus]);

  return (
    <DraftingModal
      open={open}
      onClose={onClose}
      slug="PANEL · MODEL CONTROL"
      title="Model control"
      subtitle="Pick which Gemini tier answers generations. Key counts are tracked since the backend started; Google does not expose remaining quota."
      maxWidth={720}
    >
      <ModalSection label="Mode">
        <div className="grid grid-cols-3 gap-2">
          <ModalOption
            active={mode === "auto"}
            onClick={() => onModeChange("auto")}
            label="Auto"
            hint="Full ladder. Best model first, falls back on quota."
          />
          <ModalOption
            active={mode === "best"}
            onClick={() => onModeChange("best")}
            label="Best"
            hint="3.5 Flash only. Fails instead of degrading. For judges."
          />
          <ModalOption
            active={mode === "saver"}
            onClick={() => onModeChange("saver")}
            label="Saver"
            hint="3 Flash preview only. Preserves 3.5 quota for later."
          />
        </div>
      </ModalSection>

      <ModalSection label="Auto repair">
        <button
          type="button"
          onClick={() => onAutoRepairChange(!autoRepairEnabled)}
          aria-pressed={autoRepairEnabled}
          className="flex w-full items-center justify-between px-3 py-2.5 transition-colors"
          style={{
            background: autoRepairEnabled
              ? T_CANVAS.cobaltWash
              : T_CANVAS.paper,
            border: `1px solid ${autoRepairEnabled ? T_CANVAS.cobalt : T_CANVAS.rule}`,
          }}
        >
          <span
            className="text-[11px] tracking-[0.14em] uppercase"
            style={{
              color: autoRepairEnabled ? T_CANVAS.cobaltInk : T_CANVAS.graphite,
              fontFamily: MONO,
            }}
          >
            {autoRepairEnabled ? "Repair on" : "Repair off"}
          </span>
          <span className="text-[11px]" style={{ color: T_CANVAS.muted }}>
            {autoRepairEnabled
              ? "Low fidelity triggers one extra Gemini call."
              : "Skips the extra Gemini call. Saves quota during demos."}
          </span>
        </button>
      </ModalSection>

      <ModalSection label="Key pool">
        {error && (
          <div
            className="mb-2 px-3 py-2 text-[12px]"
            style={{
              color: T_CANVAS.error,
              border: `1px solid ${T_CANVAS.rule}`,
              background: T_CANVAS.paper,
            }}
          >
            {error}
          </div>
        )}
        {status && (
          <div
            className="overflow-x-auto"
            style={{ border: `1px solid ${T_CANVAS.rule}` }}
          >
            <table className="w-full" style={{ fontFamily: MONO }}>
              <thead>
                <tr
                  className="text-[9px] tracking-[0.14em] uppercase"
                  style={{
                    color: T_CANVAS.muted,
                    background: T_CANVAS.vellum,
                  }}
                >
                  <th className="px-3 py-2 text-left font-normal">Key</th>
                  {status.ladder.map((m) => (
                    <th key={m} className="px-3 py-2 text-left font-normal">
                      {shortModel(m)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {status.keys.map((k) => (
                  <tr
                    key={k.slot}
                    className="text-[11px]"
                    style={{ borderTop: `1px solid ${T_CANVAS.rule}` }}
                  >
                    <td
                      className="px-3 py-1.5"
                      style={{ color: T_CANVAS.graphite }}
                    >
                      {k.slot}
                    </td>
                    {status.ladder.map((m) => {
                      const entry = k.models[m];
                      if (!entry) {
                        return (
                          <td
                            key={m}
                            className="px-3 py-1.5"
                            style={{ color: T_CANVAS.muted }}
                          >
                            -
                          </td>
                        );
                      }
                      const chip = chipState(entry);
                      return (
                        <td key={m} className="px-3 py-1.5">
                          <span style={{ color: chip.color }}>
                            {chip.label}
                          </span>
                          {entry.success_count_today > 0 && (
                            <span
                              className="ml-1.5"
                              style={{ color: T_CANVAS.muted }}
                            >
                              x{entry.success_count_today}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span
            className="text-[10px]"
            style={{ color: T_CANVAS.muted, fontFamily: MONO }}
          >
            OK = serving · NNs = cooling · SPENT = daily quota hit · xN = wins
            today
          </span>
          <button
            type="button"
            onClick={() => void fetchStatus()}
            disabled={loading}
            className="px-3 py-1.5 text-[10px] tracking-[0.16em] uppercase transition-colors disabled:opacity-50"
            style={{
              background: T_CANVAS.paper,
              border: `1px solid ${T_CANVAS.rule}`,
              color: T_CANVAS.graphite,
              fontFamily: MONO,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = T_CANVAS.graphite;
              e.currentTarget.style.color = T_CANVAS.paper;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = T_CANVAS.paper;
              e.currentTarget.style.color = T_CANVAS.graphite;
            }}
          >
            {loading ? "Loading" : "Refresh"}
          </button>
        </div>
      </ModalSection>
    </DraftingModal>
  );
}
