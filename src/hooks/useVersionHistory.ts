import { useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export interface ProjectVersion {
  id: string;
  project_id: string;
  version_number: number;
  canvas_data: any;
  generated_code?: string;
  prompt_used?: string | null;
  created_at: string;
  description?: string;
}

function getSupabaseErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const maybeMessage = (err as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
      return maybeMessage;
    }

    const maybeDetails = (err as { details?: unknown }).details;
    if (typeof maybeDetails === "string" && maybeDetails.trim().length > 0) {
      return maybeDetails;
    }
  }
  return fallback;
}

interface UseVersionHistoryReturn {
  versions: ProjectVersion[];
  loading: boolean;
  error: string | null;
  fetchVersions: (projectId: string) => Promise<void>;
  createVersion: (
    projectId: string,
    canvasData: any,
    description?: string
  ) => Promise<boolean>;
  restoreVersion: (versionId: string) => Promise<ProjectVersion | null>;
  deleteVersion: (versionId: string) => Promise<boolean>;
  compareVersions: (
    v1Id: string,
    v2Id: string
  ) => Promise<{ v1: any; v2: any } | null>;
}

export function useVersionHistory(): UseVersionHistoryReturn {
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  // NOTE: DB schema was unified to the canonical form where version history lives
  // in `iterations` (see supabase migrations). Legacy code referenced
  // `project_versions`, which may no longer exist.
  const versionsTable = "iterations";

  const fetchVersions = useCallback(
    async (projectId: string) => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from(versionsTable)
          .select("*")
          .eq("project_id", projectId)
          .order("version_number", { ascending: false });

        if (fetchError) throw fetchError;

        const mapped = (data || []).map((row: any) => ({
          ...row,
          description: row?.prompt_used ?? row?.description,
        }));
        setVersions(mapped);
      } catch (err) {
        const errorMessage = getSupabaseErrorMessage(
          err,
          "Failed to fetch versions"
        );
        setError(errorMessage);
        console.error("Fetch versions error:", errorMessage, err);
      } finally {
        setLoading(false);
      }
    },
    [supabase, versionsTable]
  );

  const createVersion = useCallback(
    async (
      projectId: string,
      canvasData: any,
      description?: string
    ): Promise<boolean> => {
      setError(null);

      try {
        const { error: createError } = await supabase
          .from(versionsTable)
          .insert({
            project_id: projectId,
            canvas_data: canvasData,
            // Canonical schema requires this; checkpoints don't generate code yet.
            generated_code: "",
            // Store checkpoint label in prompt_used; UI reads it as description.
            prompt_used: description,
          });

        if (createError) throw createError;

        // Refresh versions list
        await fetchVersions(projectId);

        return true;
      } catch (err) {
        const errorMessage = getSupabaseErrorMessage(
          err,
          "Failed to create version"
        );
        setError(errorMessage);
        console.error("Create version error:", errorMessage, err);
        return false;
      }
    },
    [supabase, fetchVersions, versionsTable]
  );

  const restoreVersion = useCallback(
    async (versionId: string): Promise<ProjectVersion | null> => {
      setError(null);

      try {
        const { data, error: restoreError } = await supabase
          .from(versionsTable)
          .select("*")
          .eq("id", versionId)
          .single();

        if (restoreError) throw restoreError;

        // Return the whole row: callers restore the code AND the canvas
        // snapshot (returning only canvas_data made toolbox restore silently
        // skip the code).
        return data as ProjectVersion;
      } catch (err) {
        const errorMessage = getSupabaseErrorMessage(
          err,
          "Failed to restore version"
        );
        setError(errorMessage);
        console.error("Restore version error:", errorMessage, err);
        return null;
      }
    },
    [supabase, versionsTable]
  );

  const deleteVersion = useCallback(
    async (versionId: string): Promise<boolean> => {
      setError(null);

      try {
        const { error: deleteError } = await supabase
          .from(versionsTable)
          .delete()
          .eq("id", versionId);

        if (deleteError) throw deleteError;

        // Refresh versions list
        setVersions((prev) => prev.filter((v) => v.id !== versionId));

        return true;
      } catch (err) {
        const errorMessage = getSupabaseErrorMessage(
          err,
          "Failed to delete version"
        );
        setError(errorMessage);
        console.error("Delete version error:", errorMessage, err);
        return false;
      }
    },
    [supabase, versionsTable]
  );

  const compareVersions = useCallback(
    async (
      v1Id: string,
      v2Id: string
    ): Promise<{ v1: any; v2: any } | null> => {
      setError(null);

      try {
        const [{ data: v1 }, { data: v2 }] = await Promise.all([
          supabase.from(versionsTable).select("*").eq("id", v1Id).single(),
          supabase.from(versionsTable).select("*").eq("id", v2Id).single(),
        ]);

        if (!v1 || !v2) throw new Error("Version not found");

        return {
          v1: v1.canvas_data,
          v2: v2.canvas_data,
        };
      } catch (err) {
        const errorMessage = getSupabaseErrorMessage(
          err,
          "Failed to compare versions"
        );
        setError(errorMessage);
        console.error("Compare versions error:", errorMessage, err);
        return null;
      }
    },
    [supabase, versionsTable]
  );

  return {
    versions,
    loading,
    error,
    fetchVersions,
    createVersion,
    restoreVersion,
    deleteVersion,
    compareVersions,
  };
}
