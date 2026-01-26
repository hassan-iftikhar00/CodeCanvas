import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // CRITICAL: Set cookies on BOTH request AND response
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not run code between createServerClient and getClaims()
  // getClaims() validates the JWT signature against the project's public keys
  const { data } = await supabase.auth.getClaims();

  const user = data?.user ?? null;

  console.log("🔐 Proxy - Path:", request.nextUrl.pathname);
  console.log("👤 Proxy - User:", user ? user.email : "Not authenticated");
  console.log(
    "🍪 Proxy - Cookies:",
    request.cookies
      .getAll()
      .map((c) => c.name)
      .join(", ")
  );

  // AUTH PROTECTION LOGIC
  const isAuthPage = request.nextUrl.pathname.startsWith("/auth");
  const isCanvasPage = request.nextUrl.pathname.startsWith("/canvas");

  if (!user && isCanvasPage) {
    console.log("❌ Proxy - No user, redirecting to login");
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  if (user && isAuthPage) {
    console.log("✅ Proxy - User authenticated, redirecting to canvas");
    return NextResponse.redirect(new URL("/canvas", request.url));
  }

  return supabaseResponse;
}
