import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Public read endpoint for the Share Link feature (/p/[id]).
 *
 * Uses the service-role client and enforces is_public EXPLICITLY instead of
 * leaning on the anon-key RLS policy. The RLS route proved fragile in the
 * wild (a missing policy or column on a live database makes every shared
 * link read as "not available" with no server-side trace). This route also
 * logs the real failure to the server terminal, so a broken link is
 * diagnosable.
 *
 * Only three harmless columns ever leave this endpoint; private projects and
 * unknown ids both return 404 so the response does not leak which ids exist.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (err) {
    console.error("[shared] admin client unavailable:", err);
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("projects")
    .select("title, generated_code, updated_at, is_public")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[shared] failed to load project", id, "-", error.message);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!data || !data.is_public) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    title: data.title,
    generated_code: data.generated_code,
    updated_at: data.updated_at,
  });
}
