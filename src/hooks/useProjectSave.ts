import { useState, useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface Project {
  id: string;
  name: string;
  description?: string;
  canvas_data: any;
  thumbnail?: string;
  created_at: string;
  updated_at: string;
}

interface UseProjectSaveReturn {
  saveProject: (
    name: string,
    canvasData: any,
    thumbnail?: string
  ) => Promise<string | null>;
  updateProject: (
    projectId: string,
    canvasData: any,
    thumbnail?: string
  ) => Promise<boolean>;
  updateProjectName: (projectId: string, name: string) => Promise<boolean>;
  loadProject: (projectId: string) => Promise<Project | null>;
  deleteProject: (projectId: string) => Promise<boolean>;
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
}

export function useProjectSave(): UseProjectSaveReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const saveProject = useCallback(
    async (
      name: string,
      canvasData: any,
      thumbnail?: string
    ): Promise<string | null> => {
      setIsSaving(true);
      setError(null);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error("User not authenticated");
        }

        const { data, error: saveError } = await supabase
          .from("projects")
          .insert({
            user_id: user.id,
            name,
            canvas_data: canvasData,
            thumbnail,
          })
          .select()
          .single();

        if (saveError) throw saveError;

        setLastSaved(new Date());
        return data.id;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to save project";
        setError(errorMessage);
        console.error("Save project error:", err);
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [supabase]
  );

  const updateProject = useCallback(
    async (
      projectId: string,
      canvasData: any,
      thumbnail?: string
    ): Promise<boolean> => {
      setIsSaving(true);
      setError(null);

      try {
        const updateData: any = {
          canvas_data: canvasData,
          updated_at: new Date().toISOString(),
        };

        if (thumbnail) {
          updateData.thumbnail = thumbnail;
        }

        const { error: updateError } = await supabase
          .from("projects")
          .update(updateData)
          .eq("id", projectId);

        if (updateError) throw updateError;

        setLastSaved(new Date());
        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update project";
        setError(errorMessage);
        console.error("Update project error:", err);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [supabase]
  );

  const loadProject = useCallback(
    async (projectId: string): Promise<Project | null> => {
      try {
        const { data, error: loadError } = await supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .single();

        if (loadError) throw loadError;

        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load project";
        setError(errorMessage);
        console.error("Load project error:", err);
        return null;
      }
    },
    [supabase]
  );

  const deleteProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      try {
        const { error: deleteError } = await supabase
          .from("projects")
          .delete()
          .eq("id", projectId);

        if (deleteError) throw deleteError;

        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to delete project";
        setError(errorMessage);
        console.error("Delete project error:", err);
        return false;
      }
    },
    [supabase]
  );

  const updateProjectName = useCallback(
    async (projectId: string, name: string): Promise<boolean> => {
      setIsSaving(true);
      setError(null);

      try {
        const { error: updateError } = await supabase
          .from("projects")
          .update({ name, updated_at: new Date().toISOString() })
          .eq("id", projectId);

        if (updateError) throw updateError;

        setLastSaved(new Date());
        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update project name";
        setError(errorMessage);
        console.error("Update project name error:", err);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [supabase]
  );

  return {
    saveProject,
    updateProject,
    updateProjectName,
    loadProject,
    deleteProject,
    isSaving,
    lastSaved,
    error,
  };
}

// Auto-save hook with debouncing
export function useAutoSave(
  projectId: string | null,
  canvasData: any,
  delay: number = 1000
) {
  const { updateProject, isSaving } = useProjectSave();
  const timeoutRef = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => {
    if (!projectId || !canvasData) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for auto-save
    timeoutRef.current = setTimeout(() => {
      updateProject(projectId, canvasData);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [projectId, canvasData, delay, updateProject]);

  return { isSaving };
}
