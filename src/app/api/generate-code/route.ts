import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const FASTAPI_DEFAULT_URL = "http://localhost:8000/api/predict";

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

    const requestBody = await request.json();
    const fastApiUrl = process.env.FASTAPI_URL || FASTAPI_DEFAULT_URL;

    const response = await fetch(fastApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...requestBody,
        userId: user.id,
      }),
    });

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
