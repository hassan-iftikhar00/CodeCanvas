import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request,
          });
          cookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log("🔐 Proxy - Path:", request.nextUrl.pathname);
  console.log("👤 Proxy - User:", user ? user.email : "Not authenticated");
  console.log(
    "🍪 Proxy - Cookies:",
    request.cookies
      .getAll()
      .map((c) => c.name)
      .join(", ")
  );

  const pathname = request.nextUrl.pathname;

  const isAuthPage =
    pathname.startsWith("/auth") && !pathname.startsWith("/auth/callback");
  const isProtected =
    pathname.startsWith("/canvas") || pathname.startsWith("/dashboard");

  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/canvas", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - .well-known (chrome/google internal requests)
     */
    "/((?!_next/static|_next/image|favicon.ico|.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
