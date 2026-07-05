import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  const cookieStore = await cookies();

  // Collect cookies synchronously as the SDK emits them via setAll.
  // Previously this used a Promise that only resolved when setAll was called —
  // if the exchange failed (bad code, network error) setAll was never called
  // and Promise.all deadlocked, leaving the browser spinning indefinitely.
  const pendingCookies: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  // @supabase/ssr 0.8.0 does NOT write the session cookie synchronously inside
  // exchangeCodeForSession. It writes it from an async onAuthStateChange handler
  // (fires on SIGNED_IN, awaits applyServerStorage -> our setAll). That handler
  // is queued as a task, so without yielding the event loop here pendingCookies
  // is still empty when we build the redirect below, only the code-verifier goes
  // out, and the next request has no session (proxy bounces back to /auth/login).
  await new Promise((resolve) => setTimeout(resolve, 0));

  const redirectTo = error
    ? `${origin}/auth/login?error=auth_failed`
    : `${origin}${next}`;

  const response = NextResponse.redirect(redirectTo);
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}
