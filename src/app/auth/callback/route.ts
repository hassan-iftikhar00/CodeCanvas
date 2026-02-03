import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/canvas";

  console.log("🔵 Callback - Received code:", code ? "YES" : "NO");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      console.log("✅ Callback - Session created for:", data.user?.email);
      console.log("🍪 Callback - Session expires:", data.session?.expires_at);

      // Check if this is a password recovery flow
      // The 'next' param will be /auth/reset-password for recovery
      if (next === "/auth/reset-password") {
        console.log("🔑 Callback - Password recovery flow detected");
        return NextResponse.redirect(`${origin}/auth/reset-password`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    } else {
      console.error(
        "❌ Callback - Exchange failed:",
        error?.message || "No session returned"
      );
    }
  }

  // If we reach here, something failed
  return NextResponse.redirect(
    `${origin}/auth/login?error=auth_code_exchange_failed`
  );
}
