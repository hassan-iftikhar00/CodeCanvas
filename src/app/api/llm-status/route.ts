import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 15;

// Read-only Gemini key-pool status for the model-control panel. Same FastAPI
// server as the generate-code proxy; FASTAPI_LLM_STATUS_URL overrides.
const FASTAPI_BASE =
  process.env.FASTAPI_URL || "http://localhost:8000/api/predict";
const STATUS_ENDPOINT =
  process.env.FASTAPI_LLM_STATUS_URL ||
  FASTAPI_BASE.replace(/\/api\/predict\/?$/, "/api/llm-status");

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    let response: Response;
    try {
      response = await fetch(STATUS_ENDPOINT, {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return NextResponse.json(
          { error: "Status request timed out." },
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

    if (!response.ok) {
      return NextResponse.json(
        { error: "Status request failed" },
        { status: response.status }
      );
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("LLM status proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
