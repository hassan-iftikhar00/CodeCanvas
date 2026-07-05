"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DraftingModal, {
  ModalButton,
  ModalSection,
} from "@/components/canvas/DraftingModal";
import { T_CANVAS } from "@/components/canvas/canvasTokens";

/**
 * Share dialog: flips the project's is_public flag and hands out the public
 * viewer URL (/p/[id]). The viewer renders the last SAVED generated_code, so
 * the dialog reminds the user to save before sharing fresh output.
 */

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
}

export default function ShareDialog({
  isOpen,
  onClose,
  projectId,
}: ShareDialogProps) {
  const [isPublic, setIsPublic] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareUrl =
    typeof window !== "undefined" && projectId
      ? `${window.location.origin}/p/${projectId}`
      : "";

  useEffect(() => {
    if (!isOpen || !projectId) return;
    let cancelled = false;
    setError(null);
    setCopied(false);
    const supabase = createClient();
    supabase
      .from("projects")
      .select("is_public")
      .eq("id", projectId)
      .single()
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError || !data) {
          setError("Could not load the sharing state for this project.");
          setIsPublic(null);
          return;
        }
        setIsPublic(Boolean(data.is_public));
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, projectId]);

  const toggleSharing = async () => {
    if (!projectId || isPublic === null || busy) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const next = !isPublic;
    // .select() after the update matters: a Supabase update that RLS filters
    // down to zero rows reports NO error. Reading the row back proves the
    // flag actually flipped.
    const { data, error: updateError } = await supabase
      .from("projects")
      .update({ is_public: next })
      .eq("id", projectId)
      .select("is_public")
      .maybeSingle();
    if (updateError || !data || Boolean(data.is_public) !== next) {
      console.warn("[share] sharing toggle failed:", updateError, data);
      setError("Could not update sharing. Try again.");
    } else {
      setIsPublic(next);
    }
    setBusy(false);
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Select the link text and copy it manually.");
    }
  };

  return (
    <DraftingModal
      open={isOpen}
      onClose={onClose}
      slug="SHARE · PUBLIC LINK"
      title="Share a live preview."
      subtitle="Anyone with the link sees a read-only render of this project's last saved code. Turn sharing off any time."
      maxWidth={520}
      footer={
        <div className="flex items-center justify-end">
          <ModalButton onClick={onClose}>DONE</ModalButton>
        </div>
      }
    >
      {!projectId ? (
        <p
          className="text-[12px] leading-relaxed"
          style={{ color: T_CANVAS.muted }}
        >
          Save the project first. Sharing needs a saved project to point the
          link at.
        </p>
      ) : (
        <>
          <ModalSection label="STATUS">
            <div
              className="flex items-center justify-between px-3 py-2.5"
              style={{
                background: T_CANVAS.vellum,
                border: `1px solid ${T_CANVAS.rule}`,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-1.5 w-1.5"
                  style={{
                    background:
                      isPublic === true ? T_CANVAS.success : T_CANVAS.muted,
                  }}
                />
                <span
                  className="text-[11px] tracking-[0.14em] uppercase"
                  style={{
                    color: T_CANVAS.graphite,
                    fontFamily:
                      "var(--font-jetbrains-mono, ui-monospace, monospace)",
                  }}
                >
                  {isPublic === null
                    ? "LOADING"
                    : isPublic
                      ? "SHARING ON"
                      : "SHARING OFF"}
                </span>
              </div>
              <ModalButton
                variant={isPublic ? "danger" : "primary"}
                onClick={toggleSharing}
                disabled={busy || isPublic === null}
              >
                {isPublic ? "STOP SHARING" : "START SHARING"}
              </ModalButton>
            </div>
          </ModalSection>

          {isPublic ? (
            <ModalSection label="PUBLIC LINK">
              <div
                className="flex items-stretch"
                style={{ border: `1px solid ${T_CANVAS.rule}` }}
              >
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Public share link"
                  className="min-w-0 flex-1 px-3 py-2 text-[11px] outline-none"
                  style={{
                    background: T_CANVAS.paper,
                    color: T_CANVAS.graphite,
                    fontFamily:
                      "var(--font-jetbrains-mono, ui-monospace, monospace)",
                  }}
                />
                <button
                  type="button"
                  onClick={copyLink}
                  className="px-3 text-[10px] tracking-[0.16em] uppercase transition-opacity hover:opacity-85"
                  style={{
                    background: T_CANVAS.graphite,
                    color: T_CANVAS.paper,
                    borderLeft: `1px solid ${T_CANVAS.rule}`,
                    fontFamily:
                      "var(--font-jetbrains-mono, ui-monospace, monospace)",
                  }}
                >
                  {copied ? "COPIED" : "COPY"}
                </button>
              </div>
              <p
                className="mt-2 text-[11px] leading-relaxed"
                style={{ color: T_CANVAS.muted }}
              >
                The preview shows the last saved code. Save (Ctrl+S) after
                generating to publish the newest version.
              </p>
            </ModalSection>
          ) : null}

          {error ? (
            <p className="text-[11px]" style={{ color: T_CANVAS.error }}>
              {error}
            </p>
          ) : null}
        </>
      )}
    </DraftingModal>
  );
}
