import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const FASTAPI_URL = process.env.FASTAPI_URL;

if (!FASTAPI_URL && process.env.NODE_ENV !== "production") {
  console.warn(
    "[CodeCanvas] FASTAPI_URL is not set - falling back to http://localhost:8000/api/predict. " +
      "Set FASTAPI_URL in .env.local to suppress this warning."
  );
}

const FASTAPI_ENDPOINT = FASTAPI_URL || "http://localhost:8000/api/predict";

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

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

    if (!FASTAPI_URL && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        {
          error:
            "Backend not configured: FASTAPI_URL environment variable is not set.",
        },
        { status: 503 }
      );
    }

    const requestBody = await request.json();

    // Outermost ceiling for the whole detect + generate call. Must stay ABOVE the
    // backend's GEMINI_TIMEOUT_SECONDS (default 110s) so the backend returns its
    // own clean error/result before this aborts. Override via FASTAPI_PROXY_TIMEOUT_MS.
    const PROXY_TIMEOUT_MS = Number(
      process.env.FASTAPI_PROXY_TIMEOUT_MS ?? 120_000
    );
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(FASTAPI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
          {
            error:
              "Detection timed out - the AI took too long. Please try again.",
          },
          { status: 504 }
        );
      }
      if (fetchError instanceof TypeError) {
        return NextResponse.json(
          { error: "Backend is offline. Please start the FastAPI server." },
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
          : body?.detail || body?.error || "FastAPI request failed";

      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    const data =
      responseBody && typeof responseBody === "object"
        ? (responseBody as {
            detectedElements?: unknown;
            elements?: unknown;
            [key: string]: unknown;
          })
        : {};

    return NextResponse.json({
      ...data,
      detectedElements: data.detectedElements ?? data.elements ?? [],
    });
  } catch (error) {
    console.error("FastAPI proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
