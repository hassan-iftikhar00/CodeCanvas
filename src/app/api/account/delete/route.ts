import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const STORAGE_BUCKETS = ["avatars", "sketch-exports", "project-assets"] as const;

export async function POST() {
  // Step 1: Verify the requesting user's session server-side.
  // Never accept a user_id from the client body - always derive from the JWT.
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;
  const admin = createAdminClient();

  // Step 2: Delete all storage objects owned by this user.
  // Storage objects are NOT covered by DB cascade - they must be removed manually.
  // Failures are logged but non-fatal: a storage leak is less dangerous than
  // blocking account deletion because of an empty or inaccessible bucket.
  for (const bucket of STORAGE_BUCKETS) {
    try {
      const { data: files, error: listError } = await admin.storage
        .from(bucket)
        .list(userId);

      if (listError) {
        console.error(
          `[delete-account] Could not list ${bucket}/${userId}:`,
          listError.message
        );
        continue;
      }

      if (!files || files.length === 0) continue;

      const paths = files.map((f) => `${userId}/${f.name}`);
      const { error: removeError } = await admin.storage
        .from(bucket)
        .remove(paths);

      if (removeError) {
        console.error(
          `[delete-account] Failed to remove files from ${bucket}:`,
          removeError.message
        );
      }
    } catch (err) {
      console.error(
        `[delete-account] Unexpected error cleaning storage bucket ${bucket}:`,
        err
      );
    }
  }

  // Step 3: Delete the auth.users record via the admin API.
  // This triggers the DB cascade:
  //   auth.users → profiles → projects → iterations → canvas_snapshots
  // All of this is a single atomic DB transaction handled by Postgres.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

  if (deleteError) {
    console.error(
      "[delete-account] auth.admin.deleteUser failed:",
      deleteError.message
    );
    return NextResponse.json(
      {
        error:
          "Failed to delete account. Please try again or contact support.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
