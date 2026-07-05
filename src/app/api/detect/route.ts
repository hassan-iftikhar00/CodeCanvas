import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Detection-only proxy for the HITL review step. Same FastAPI server as the
// generate-code proxy; FASTAPI_DETECT_URL overrides if the backend splits.
const FASTAPI_BASE =
  process.env.FASTAPI_URL || "http://localhost:8000/api/predict";
const DETECT_ENDPOINT =
  process.env.FASTAPI_DETECT_URL ||
  FASTAPI_BASE.replace(/\/api\/predict\/?$/, "/api/detect");

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

    // Detection alone stays under the backend's 60s Roboflow ceiling; 75s
    // gives the proxy headroom above it.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 75_000);

    let response: Response;
    try {
      response = await fetch(DETECT_ENDPOINT, {
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
          { error: "Detection timed out." },
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
          : body?.detail || body?.error || "Detection request failed";
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    return NextResponse.json(responseBody ?? {});
  } catch (error) {
    console.error("Detect proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
