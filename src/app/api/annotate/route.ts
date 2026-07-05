import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Same FastAPI server as generate-code; FASTAPI_ANNOTATE_URL overrides if split.
const FASTAPI_BASE =
  process.env.FASTAPI_URL || "http://localhost:8000/api/predict";
const ANNOTATE_ENDPOINT =
  process.env.FASTAPI_ANNOTATE_URL ||
  FASTAPI_BASE.replace(/\/api\/predict\/?$/, "/api/annotate");

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestBody = await request.json();

    // An annotation refinement is a full Gemini call — same ceiling as
    // generation. Keep ABOVE the backend's GEMINI_TIMEOUT_SECONDS.
    const PROXY_TIMEOUT_MS = Number(
      process.env.FASTAPI_PROXY_TIMEOUT_MS ?? 120_000
    );
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(ANNOTATE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...requestBody,
          userId: user.id,
        }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return NextResponse.json(
          { error: "Annotation refinement timed out." },
          { status: 504 }
        );
      }
      if (fetchError instanceof TypeError) {
        return NextResponse.json(
          { error: "Backend is offline." },
          { status: 503 }
        );
      }
      throw fetchError;
    }
    clearTimeout(timeoutId);

    const responseBody = await readResponseBody(response);

    if (!response.ok) {
      const body = responseBody as
        | { detail?: string; error?: string }
        | string
        | null;
      const errorMessage =
        typeof body === "string"
          ? body
          : body?.detail || body?.error || "Annotation request failed";
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    return NextResponse.json(responseBody ?? {});
  } catch (error) {
    console.error("Annotate proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
