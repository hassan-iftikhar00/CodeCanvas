"use client";

/**
 * Public read-only preview of a shared project (Share Link feature).
 *
 * No auth required: the page calls /api/shared/[id], a server route that
 * reads the row with the service-role client and enforces is_public
 * explicitly. The first version queried Supabase from the browser with the
 * anon key and depended on the "Public projects are viewable by everyone"
 * RLS policy existing on the live database — when it didn't, every shared
 * link rendered "not available" with no trace. Private and missing ids both
 * come back 404, so the screen does not leak which ids exist.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { buildPreviewDocument, detectPreviewLanguage } from "@/lib/preview-doc";
import { T_CANVAS, CanvasMark } from "@/components/canvas/canvasTokens";

interface SharedProject {
  title: string;
  generated_code: string | null;
  updated_at: string;
}

type LoadState = "loading" | "ready" | "unavailable" | "empty";

export default function PublicPreviewPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id;
  const [state, setState] = useState<LoadState>("loading");
  const [project, setProject] = useState<SharedProject | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    fetch(`/api/shared/${projectId}`)
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          console.warn(
            "[share] shared project lookup returned",
            response.status
          );
          setState("unavailable");
          return;
        }
        const data = (await response.json()) as SharedProject;
        if (cancelled) return;
        if (!data.generated_code) {
          setProject(data);
          setState("empty");
          return;
        }
        setProject(data);
        setState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("[share] failed to load shared project:", err);
        setState("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (state !== "ready" || !project?.generated_code || !iframeRef.current)
      return;
    const iframe = iframeRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    const language = detectPreviewLanguage(project.generated_code);

    doc.open();
    doc.write(
      buildPreviewDocument(
        project.generated_code,
        language,
        window.location.origin
      )
    );
    doc.close();
  }, [state, project]);

  return (
    <div
      className="flex h-dvh flex-col"
      style={{
        background: T_CANVAS.paper,
        fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
      }}
    >
      {/* HEADER — minimal drafting strip */}
      <header
        className="flex h-11 shrink-0 items-center justify-between border-b px-4"
        style={{ borderColor: T_CANVAS.rule, background: T_CANVAS.vellum }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <CanvasMark size={18} color={T_CANVAS.graphite} />
          <span
            className="min-w-0 truncate text-[13px] tracking-[0.14em] uppercase"
            style={{ color: T_CANVAS.graphite }}
          >
            {state === "ready" ? project?.title : "Shared preview"}
          </span>
          <span
            className="hidden text-[13px] tracking-[0.16em] uppercase sm:inline"
            style={{ color: T_CANVAS.muted }}
          >
            · READ ONLY
          </span>
        </div>
        <Link
          href="/"
          className="flex h-7 items-center px-2.5 text-[13px] tracking-[0.16em] uppercase transition-opacity hover:opacity-85"
          style={{
            background: T_CANVAS.graphite,
            color: T_CANVAS.paper,
          }}
        >
          MADE WITH CODECANVAS
        </Link>
      </header>

      {/* BODY */}
      <div className="relative flex-1">
        {state === "loading" && (
          <CenterNotice
            title="Loading preview"
            body="Fetching the shared project."
          />
        )}
        {state === "unavailable" && (
          <CenterNotice
            title="This preview is not available."
            body="The link may be wrong, or the owner stopped sharing this project."
          />
        )}
        {state === "empty" && (
          <CenterNotice
            title="Nothing published yet."
            body="This project is shared, but no generated code has been saved. Ask the owner to generate and save, then reload this page."
          />
        )}
        {state === "ready" && (
          <iframe
            ref={iframeRef}
            title="Shared project preview"
            sandbox="allow-scripts allow-same-origin allow-forms"
            className="h-full w-full border-0 bg-white"
          />
        )}
      </div>
    </div>
  );
}

function CenterNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <div
          className="text-[22px] leading-snug"
          style={{
            color: T_CANVAS.graphite,
            fontFamily:
              "var(--font-instrument-serif, ui-serif, Georgia, serif)",
          }}
        >
          {title}
        </div>
        <p
          className="mt-2 text-[13px] leading-relaxed"
          style={{
            color: T_CANVAS.muted,
            fontFamily:
              "var(--font-inter, ui-sans-serif, system-ui, sans-serif)",
          }}
        >
          {body}
        </p>
      </div>
    </div>
  );
}
