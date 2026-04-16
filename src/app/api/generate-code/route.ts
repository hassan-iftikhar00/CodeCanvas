import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* ─── OpenRouter (free) – code-refinement via chat ─── */
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Ordered list of free models to try (fallback on rate-limit / error)
const FREE_MODELS = [
  "openai/gpt-oss-120b:free",
  "deepseek/deepseek-r1-0528:free",
  "openai/gpt-oss-20b:free",
];

async function callOpenRouter(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userContent: string
): Promise<Response> {
  return fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      "X-Title": "CodeCanvas",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });
}

async function refineChatWithOpenRouter(
  userMessage: string,
  currentCode: string
): Promise<{ code: string; message: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const systemPrompt = `You are CodeCanvas AI — a code-refinement assistant.
You receive the user's CURRENT CODE and an INSTRUCTION describing what to change.
Return ONLY the complete, updated code — no explanations, no markdown fences, no commentary.
Rules:
• Preserve the overall structure unless the instruction says otherwise.
• Use Tailwind CSS classes for styling changes.
• Keep the code valid HTML / JSX.
• If the instruction is unclear, make a reasonable best-effort change.`;

  const userContent = `CURRENT CODE:\n\`\`\`\n${currentCode}\n\`\`\`\n\nINSTRUCTION: ${userMessage}`;

  let lastError = "";

  for (const model of FREE_MODELS) {
    // Try each model, with one retry on 429
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await callOpenRouter(
          apiKey,
          model,
          systemPrompt,
          userContent
        );

        if (res.ok) {
          const data = await res.json();
          let refined =
            data.choices?.[0]?.message?.content?.trim() ?? currentCode;

          // Strip markdown code fences if model wraps them anyway
          refined = refined
            .replace(/^```[\w]*\n?/, "")
            .replace(/\n?```$/, "")
            .trim();

          const usedModel =
            model.split("/").pop()?.replace(":free", "") ?? model;
          return {
            code: refined,
            message: `Code updated (via ${usedModel}).`,
          };
        }

        const errBody = await res.text();
        lastError = `${model}: ${res.status} ${errBody}`;
        console.warn(
          `OpenRouter [${model}] attempt ${attempt + 1}:`,
          res.status
        );

        // On 429 rate-limit, wait briefly then retry once
        if (res.status === 429 && attempt === 0) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }

        // Any other error (404, 500, etc.) → skip to next model
        break;
      } catch (fetchErr) {
        lastError = `${model}: ${fetchErr}`;
        break;
      }
    }
  }

  // All models exhausted
  throw new Error(`All free models failed. Last: ${lastError}`);
}

// Fallback code generation when FastAPI is unavailable
function generateCodeFallback(
  canvasData: any,
  framework: string,
  styling: string = "tailwind"
) {
  // Simple element detection based on stroke patterns
  const elements: Array<{ type: string; bounds: any; confidence: number }> = [];

  canvasData.lines?.forEach((line: any) => {
    const points = line.points;
    if (points.length < 4) return;

    const minX = Math.min(...points.filter((_: any, i: number) => i % 2 === 0));
    const maxX = Math.max(...points.filter((_: any, i: number) => i % 2 === 0));
    const minY = Math.min(...points.filter((_: any, i: number) => i % 2 === 1));
    const maxY = Math.max(...points.filter((_: any, i: number) => i % 2 === 1));

    const width = maxX - minX;
    const height = maxY - minY;
    const aspectRatio = width / height;

    let type = "container";
    let confidence = 80;

    if (aspectRatio > 2 && height < 50) {
      type = "input";
      confidence = 85;
    } else if (
      aspectRatio < 2 &&
      aspectRatio > 0.5 &&
      width < 200 &&
      height < 80
    ) {
      type = "button";
      confidence = 90;
    } else if (height < 30 && width > 100) {
      type = "text";
      confidence = 75;
    }

    elements.push({
      type,
      bounds: {
        x: Math.round(minX),
        y: Math.round(minY),
        width: Math.round(width),
        height: Math.round(height),
      },
      confidence,
    });
  });

  // Generate code based on framework
  let code = "";
  if (framework === "react") {
    const imports =
      styling === "tailwind"
        ? `import React from 'react';\n\n`
        : `import React from 'react';\nimport './Component.css';\n\n`;

    code = `${imports}export default function GeneratedComponent() {\n  return (\n    <div className="${styling === "tailwind" ? "min-h-screen bg-gray-50 p-8" : "container"}">\n`;

    elements.forEach((el, i) => {
      switch (el.type) {
        case "button":
          code += `      <button className="${styling === "tailwind" ? "rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 transition-colors" : "btn"}">\n        Button ${i + 1}\n      </button>\n`;
          break;
        case "input":
          code += `      <input\n        type="text"\n        placeholder="Enter text..."\n        className="${styling === "tailwind" ? "rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" : "input"}"\n      />\n`;
          break;
        case "text":
          code += `      <p className="${styling === "tailwind" ? "text-gray-700" : "text"}">Text content</p>\n`;
          break;
        case "container":
          code += `      <div className="${styling === "tailwind" ? "rounded-xl border border-gray-200 bg-white p-6 shadow-sm" : "card"}">\n        {/* Container content */}\n      </div>\n`;
          break;
      }
    });

    code += `    </div>\n  );\n}`;
  } else if (framework === "vue") {
    code = `<template>\n  <div class="${styling === "tailwind" ? "min-h-screen bg-gray-50 p-8" : "container"}">\n`;

    elements.forEach((el, i) => {
      switch (el.type) {
        case "button":
          code += `    <button class="${styling === "tailwind" ? "rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 transition-colors" : "btn"}">Button ${i + 1}</button>\n`;
          break;
        case "input":
          code += `    <input type="text" placeholder="Enter text..." class="${styling === "tailwind" ? "rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none" : "input"}" />\n`;
          break;
        case "text":
          code += `    <p class="${styling === "tailwind" ? "text-gray-700" : "text"}">Text content</p>\n`;
          break;
        case "container":
          code += `    <div class="${styling === "tailwind" ? "rounded-xl border border-gray-200 bg-white p-6 shadow-sm" : "card"}"><!-- Content --></div>\n`;
          break;
      }
    });

    code += `  </div>\n</template>\n\n<script setup>\n// Component logic\n</script>`;
  } else {
    // HTML
    code = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Generated Layout</title>\n`;
    code +=
      styling === "tailwind"
        ? `  <script src="https://cdn.tailwindcss.com"></script>\n`
        : `  <link rel="stylesheet" href="styles.css">\n`;
    code += `</head>\n<body>\n  <div class="${styling === "tailwind" ? "min-h-screen bg-gray-50 p-8" : "container"}">\n`;

    elements.forEach((el, i) => {
      switch (el.type) {
        case "button":
          code += `    <button class="${styling === "tailwind" ? "rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white" : "btn"}">Button ${i + 1}</button>\n`;
          break;
        case "input":
          code += `    <input type="text" placeholder="Enter text..." class="${styling === "tailwind" ? "rounded-lg border border-gray-300 px-4 py-2" : "input"}" />\n`;
          break;
        case "text":
          code += `    <p class="${styling === "tailwind" ? "text-gray-700" : "text"}">Text content</p>\n`;
          break;
        case "container":
          code += `    <div class="${styling === "tailwind" ? "rounded-xl border border-gray-200 bg-white p-6 shadow-sm" : "card"}"><!-- Content --></div>\n`;
          break;
      }
    });

    code += `  </div>\n</body>\n</html>`;
  }

  return { code, detectedElements: elements };
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      canvasData,
      framework = "react",
      styling = "tailwind",
      description,
      projectId,
      mode = "generate",
      messages,
      currentCode,
    } = await request.json();

    if (mode === "generate" && !canvasData) {
      return NextResponse.json(
        { error: "Invalid canvas data" },
        { status: 400 }
      );
    }

    if (mode === "chat" && (!messages || !currentCode)) {
      return NextResponse.json(
        { error: "Missing messages or code context" },
        { status: 400 }
      );
    }

    /* ─── Chat mode → OpenRouter (no FastAPI needed) ─── */
    if (mode === "chat") {
      const lastMessage = messages[messages.length - 1].content;
      try {
        const result = await refineChatWithOpenRouter(lastMessage, currentCode);
        return NextResponse.json({
          code: result.code,
          message: result.message,
          detectedElements: [],
          framework,
          styling,
        });
      } catch (err) {
        console.error("OpenRouter chat error:", err);
        // Fallback: append comment so user isn't stuck
        return NextResponse.json({
          code: currentCode + `\n\n<!-- Refinement: ${lastMessage} -->`,
          message:
            "AI service temporarily unavailable – added your request as a comment.",
          detectedElements: [],
          framework,
          styling,
          usedFallback: true,
        });
      }
    }

    /* ─── Generate mode → FastAPI sketch detection ─── */
    // Try FastAPI backend first
    const fastApiUrl =
      process.env.FASTAPI_URL || "http://localhost:8000/api/predict";

    try {
      const response = await fetch(fastApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          canvasData,
          framework,
          styling,
          description,
          projectId,
          userId: user.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }

      // FastAPI failed, use fallback
      console.warn("FastAPI unavailable, using fallback generation");
    } catch (fetchError) {
      // FastAPI not reachable, use fallback
      console.warn(
        "FastAPI not reachable, using fallback generation:",
        fetchError
      );
    }

    // Fallback logic for sketch → code generation
    let code = "";
    let detectedElements: any[] = [];

    const result = generateCodeFallback(canvasData, framework, styling);
    code = result.code;
    detectedElements = result.detectedElements;

    return NextResponse.json({
      code,
      detectedElements,
      framework,
      styling,
      usedFallback: true,
    });
  } catch (error) {
    console.error("API route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
