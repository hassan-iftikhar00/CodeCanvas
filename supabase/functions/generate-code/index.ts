import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!openaiKey || !supabaseUrl || !supabaseKey) {
      throw new Error("Missing environment variables");
    }

    const { canvasData, framework, description, projectId } = await req.json();

    // Verify authentication
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prepare prompt for AI
    const systemPrompt = `You are an expert UI code generator for ${framework}. Convert canvas sketch data into clean, production-ready code. The canvas data contains strokes and elements drawn by the user. Generate semantic HTML with proper styling using Tailwind CSS classes. Make the code responsive and accessible.`;

    const userPrompt = `Generate ${framework} component code based on this sketch:

Canvas Data: ${JSON.stringify(canvasData)}
User Description: ${description || "No description provided"}

Requirements:
- Use Tailwind CSS for styling
- Make it responsive
- Add proper accessibility attributes
- Use semantic HTML
- Return ONLY the code, no explanations`;

    // Call OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "OpenAI API error");
    }

    const { choices } = await response.json();
    const generatedCode = choices[0].message.content;

    // Save iteration to database
    const { error: iterationError } = await supabase.from("iterations").insert({
      project_id: projectId,
      canvas_data: canvasData,
      generated_code: generatedCode,
      prompt_used: description,
    });

    if (iterationError) {
      console.error("Error saving iteration:", iterationError);
    }

    // Update project with latest code
    const { error: projectError } = await supabase
      .from("projects")
      .update({
        generated_code: generatedCode,
        canvas_data: canvasData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .eq("user_id", user.id);

    if (projectError) {
      console.error("Error updating project:", projectError);
    }

    return new Response(
      JSON.stringify({
        code: generatedCode,
        success: true,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-code function:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
