import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/canvas";

  if (!code) {
    console.error("❌ Missing authorization code");
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  const cookieStore = await cookies();

  // Wait for setAll to be called with a Promise
  let resolveSetAll: (cookies: any[]) => void;
  const setAllPromise = new Promise<any[]>((resolve) => {
    resolveSetAll = resolve;
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          console.log("🔥 setAll called with", cookiesToSet.length, "cookies");
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
          // Resolve the promise with the cookies
          resolveSetAll!(cookiesToSet);
        },
      },
    }
  );

  // Start the session exchange
  console.log("🔍 Exchanging code for session...");
  const exchangePromise = supabase.auth.exchangeCodeForSession(code);

  // Wait for BOTH the exchange AND setAll to complete
  const [{ error }, responseCookies] = await Promise.all([
    exchangePromise,
    setAllPromise,
  ]);

  if (error) {
    console.error("❌ Exchange failed:", error.message);
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  console.log("✅ Session created, cookies captured:", responseCookies.length);

  // Now create the redirect with the captured cookies
  const redirectUrl = `${origin}${next}`;
  const response = NextResponse.redirect(redirectUrl);

  // Apply all cookies to the redirect response
  responseCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  console.log("✅ Cookies applied to redirect response");
  return response;
}
