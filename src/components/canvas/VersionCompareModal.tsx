"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DraftingModal, { ModalButton } from "@/components/canvas/DraftingModal";
import { T_CANVAS } from "@/components/canvas/canvasTokens";
import type { ProjectVersion } from "@/hooks/useVersionHistory";
import {
  buildPreviewDocument,
  detectPreviewLanguage,
  type PreviewLanguage,
} from "@/lib/preview-doc";
import {
  diffLines,
  diffStats,
  collapseUnchanged,
  type DisplayRow,
} from "@/lib/code-diff";

/**
 * Version Diff Viewer (App Uplift feature E).
 *
 * Compares two iterations of a project: side-by-side rendered previews of
 * each version's generated code, plus a line diff. Rollback hands the chosen
 * version back to the canvas page, which restores code (and canvas data when
 * the iteration carries one).
 */

interface VersionCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  versions: ProjectVersion[];
  framework?: "react" | "html" | "vue";
  onRollback: (version: ProjectVersion) => void;
}

type ViewMode = "preview" | "diff";

export default function VersionCompareModal({
  isOpen,
  onClose,
  versions,
  framework,
  onRollback,
}: VersionCompareModalProps) {
  // Versions arrive newest-first from useVersionHistory. Default: compare the
  // previous iteration (A, older, left) against the latest (B, newer, right).
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("preview");

  useEffect(() => {
    if (!isOpen) return;
    setView("preview");
    setBId(versions[0]?.id ?? null);
    setAId(versions[1]?.id ?? versions[0]?.id ?? null);
  }, [isOpen, versions]);

  const versionA = versions.find((v) => v.id === aId) ?? null;
  const versionB = versions.find((v) => v.id === bId) ?? null;

  const codeA = versionA?.generated_code ?? "";
  const codeB = versionB?.generated_code ?? "";

  const rows = useMemo<DisplayRow[]>(() => {
    if (view !== "diff") return [];
    return collapseUnchanged(diffLines(codeA, codeB));
  }, [view, codeA, codeB]);

  const stats = useMemo(
    () => diffStats(diffLines(codeA, codeB)),
    [codeA, codeB]
  );

  if (versions.length === 0) {
    return (
      <DraftingModal
        open={isOpen}
        onClose={onClose}
        slug="VERSIONS · COMPARE"
        title="No versions yet."
        subtitle="Every generation saves an iteration automatically. Generate code first, then come back to compare versions."
        maxWidth={480}
        footer={
          <div className="flex justify-end">
            <ModalButton onClick={onClose}>CLOSE</ModalButton>
          </div>
        }
      >
        <div />
      </DraftingModal>
    );
  }

  return (
    <DraftingModal
      open={isOpen}
      onClose={onClose}
      slug="VERSIONS · COMPARE"
      title="Compare versions."
      subtitle="Pick two iterations to see how the output changed. Rollback restores that version's code to the editor."
      maxWidth={1100}
      footer={
        <div className="flex items-center justify-between">
          <span
            className="text-[13px] tracking-[0.14em] uppercase tabular-nums"
            style={{
              color: T_CANVAS.muted,
              fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
            }}
          >
            +{stats.added} / -{stats.removed} LINES
          </span>
          <ModalButton onClick={onClose}>CLOSE</ModalButton>
        </div>
      }
    >
      {/* CONTROLS ROW */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <VersionSelect
            label="VERSION A (OLDER)"
            versions={versions}
            value={aId}
            onChange={setAId}
          />
          <VersionSelect
            label="VERSION B (NEWER)"
            versions={versions}
            value={bId}
            onChange={setBId}
          />
        </div>

        {/* VIEW toggle */}
        <div
          className="flex items-center"
          style={{ border: `1px solid ${T_CANVAS.rule}` }}
          role="group"
          aria-label="Compare view"
        >
          {(["preview", "diff"] as const).map((mode, i) => {
            const active = view === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                aria-pressed={active}
                className="px-3 py-1.5 text-[13px] tracking-[0.16em] uppercase transition-colors"
                style={{
                  background: active ? T_CANVAS.graphite : T_CANVAS.paper,
                  color: active ? T_CANVAS.paper : T_CANVAS.muted,
                  borderLeft: i > 0 ? `1px solid ${T_CANVAS.rule}` : undefined,
                  fontFamily:
                    "var(--font-jetbrains-mono, ui-monospace, monospace)",
                }}
              >
                {mode === "preview" ? "PREVIEW" : "CODE DIFF"}
              </button>
            );
          })}
        </div>
      </div>

      {view === "preview" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <VersionPane
            heading="A"
            version={versionA}
            framework={framework}
            onRollback={onRollback}
          />
          <VersionPane
            heading="B"
            version={versionB}
            framework={framework}
            onRollback={onRollback}
          />
        </div>
      ) : (
        <DiffView rows={rows} />
      )}
    </DraftingModal>
  );
}

// ─── SUBCOMPONENTS ──────────────────────────────────────────────────────────

function versionLabel(v: ProjectVersion): string {
  const when = new Date(v.created_at).toLocaleString();
  return `v${v.version_number} · ${when}`;
}

function VersionSelect({
  label,
  versions,
  value,
  onChange,
}: {
  label: string;
  versions: ProjectVersion[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span
        className="text-[13px] tracking-[0.18em] uppercase"
        style={{
          color: T_CANVAS.muted,
          fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
        }}
      >
        {label}
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 min-w-[220px] px-2 text-[13px] outline-none"
        style={{
          background: T_CANVAS.paper,
          border: `1px solid ${T_CANVAS.rule}`,
          color: T_CANVAS.graphite,
          fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
        }}
      >
        {versions.map((v) => (
          <option key={v.id} value={v.id}>
            {versionLabel(v)}
            {v.generated_code ? "" : " (no code)"}
          </option>
        ))}
      </select>
    </label>
  );
}

function VersionPane({
  heading,
  version,
  framework,
  onRollback,
}: {
  heading: string;
  version: ProjectVersion | null;
  framework?: "react" | "html" | "vue";
  onRollback: (version: ProjectVersion) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const code = version?.generated_code ?? "";

  useEffect(() => {
    if (!iframeRef.current || !code) return;
    const doc =
      iframeRef.current.contentDocument ||
      iframeRef.current.contentWindow?.document;
    if (!doc) return;
    const language: PreviewLanguage = framework ?? detectPreviewLanguage(code);
    doc.open();
    doc.write(buildPreviewDocument(code, language, window.location.origin));
    doc.close();
  }, [code, framework]);

  return (
    <div
      className="flex flex-col"
      style={{ border: `1px solid ${T_CANVAS.rule}` }}
    >
      <div
        className="flex items-center justify-between border-b px-3 py-1.5"
        style={{ borderColor: T_CANVAS.rule, background: T_CANVAS.vellum }}
      >
        <span
          className="truncate text-[13px] tracking-[0.14em] uppercase"
          style={{
            color: T_CANVAS.graphite,
            fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
          }}
        >
          {heading} · {version ? versionLabel(version) : "NONE"}
        </span>
        {version && code ? (
          <button
            type="button"
            onClick={() => onRollback(version)}
            className="ml-2 shrink-0 px-2 py-0.5 text-[12px] tracking-[0.16em] uppercase transition-opacity hover:opacity-85"
            style={{
              background: T_CANVAS.cobalt,
              color: T_CANVAS.paper,
              fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
            }}
          >
            ROLLBACK
          </button>
        ) : null}
      </div>
      {code ? (
        <iframe
          ref={iframeRef}
          title={`Version ${heading} preview`}
          sandbox="allow-scripts allow-same-origin"
          className="h-[340px] w-full border-0 bg-white"
        />
      ) : (
        <div
          className="flex h-[340px] items-center justify-center px-4 text-center text-[13px]"
          style={{ color: T_CANVAS.muted, background: T_CANVAS.paper }}
        >
          This iteration has no generated code (canvas checkpoint only).
        </div>
      )}
    </div>
  );
}

function DiffView({ rows }: { rows: DisplayRow[] }) {
  const rowColors: Record<
    string,
    { bg: string; fg: string; sign: string; edge?: string }
  > = {
    add: { bg: "#C4E4C6", fg: "#0F4A1E", sign: "+", edge: "#2E7D32" },
    del: { bg: "#F3C2BC", fg: "#6E1509", sign: "-", edge: "#C0392B" },
    same: { bg: "transparent", fg: T_CANVAS.graphite, sign: " " },
  };

  if (rows.length === 0) {
    return (
      <div
        className="px-4 py-8 text-center text-[13px]"
        style={{ color: T_CANVAS.muted }}
      >
        No differences. The two versions have identical code.
      </div>
    );
  }

  return (
    <div
      className="max-h-[420px] overflow-auto text-[13px] leading-[1.6]"
      style={{
        border: `1px solid ${T_CANVAS.rule}`,
        background: T_CANVAS.paper,
        fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
      }}
    >
      {rows.map((row, i) => {
        if (row.collapsed) {
          return (
            <div
              key={i}
              className="px-3 py-1 text-center text-[13px] tracking-[0.14em] uppercase"
              style={{
                color: T_CANVAS.muted,
                background: T_CANVAS.vellum,
                borderTop: `1px dashed ${T_CANVAS.rule}`,
                borderBottom: `1px dashed ${T_CANVAS.rule}`,
              }}
            >
              {row.text}
            </div>
          );
        }
        const c = rowColors[row.type];
        return (
          <div
            key={i}
            className="flex whitespace-pre"
            style={{
              background: c.bg,
              color: c.fg,
              borderLeft: c.edge
                ? `3px solid ${c.edge}`
                : "3px solid transparent",
              fontWeight: c.edge ? 500 : undefined,
            }}
          >
            <span
              className="w-10 shrink-0 select-none pr-1 text-right tabular-nums"
              style={{ color: T_CANVAS.muted, opacity: 0.7 }}
            >
              {row.oldLine ?? ""}
            </span>
            <span
              className="w-10 shrink-0 select-none pr-2 text-right tabular-nums"
              style={{ color: T_CANVAS.muted, opacity: 0.7 }}
            >
              {row.newLine ?? ""}
            </span>
            <span className="w-4 shrink-0 select-none">{c.sign}</span>
            <span className="pr-3">{row.text}</span>
          </div>
        );
      })}
    </div>
  );
}
