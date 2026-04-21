import { useState, useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export interface CanvasData {
  lines?: Array<{
    tool?: string;
    points?: number[];
    color?: string;
    width?: number;
    id?: string;
  }>;
  shapes?: Array<{
    id?: string;
    type?: "text" | "rectangle" | "circle" | "image" | "ellipse" | "triangle" | "arrow";
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    radius?: number;
    radiusX?: number;
    radiusY?: number;
    text?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    cornerRadius?: number;
    draggable?: boolean;
    selected?: boolean;
    fontSize?: number;
    fontFamily?: string;
    scaleX?: number;
    scaleY?: number;
    rotation?: number;
  }>;
}

interface Project {
  id: string;
  title: string;
  description?: string;
  canvas_data: CanvasData;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
}

interface UseProjectSaveReturn {
  saveProject: (
    title: string,
    canvasData: CanvasData,
    thumbnail_url?: string
  ) => Promise<string | null>;
  updateProject: (
    projectId: string,
    canvasData: CanvasData,
    thumbnail_url?: string
  ) => Promise<boolean>;
  updateProjectTitle: (projectId: string, title: string) => Promise<boolean>;
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
      title: string,
      canvasData: CanvasData,
      thumbnail_url?: string
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
            title,
            canvas_data: canvasData,
            thumbnail_url,
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
      canvasData: CanvasData,
      thumbnail_url?: string
    ): Promise<boolean> => {
      setIsSaving(true);
      setError(null);

      try {
        const updateData: {
          canvas_data: CanvasData;
          updated_at: string;
          thumbnail_url?: string;
        } = {
          canvas_data: canvasData,
          updated_at: new Date().toISOString(),
        };

        if (thumbnail_url) {
          updateData.thumbnail_url = thumbnail_url;
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

  const updateProjectTitle = useCallback(
    async (projectId: string, title: string): Promise<boolean> => {
      setIsSaving(true);
      setError(null);

      try {
        const { error: updateError } = await supabase
          .from("projects")
          .update({ title, updated_at: new Date().toISOString() })
          .eq("id", projectId);

        if (updateError) throw updateError;

        setLastSaved(new Date());
        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update project title";
        setError(errorMessage);
        console.error("Update project title error:", err);
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
    updateProjectTitle,
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
  canvasData: CanvasData,
  delay: number = 3000
) {
  const { updateProject, isSaving } = useProjectSave();
  const timeoutRef = useRef<NodeJS.Timeout>(undefined);
  const lastSavedDataRef = useRef<string>("");

  useEffect(() => {
    // Don't auto-save temp projects or if no data
    if (!projectId || projectId.startsWith("temp-") || !canvasData) return;

    // Serialize current state
    const currentDataStr = JSON.stringify(canvasData);

    // Skip if data hasn't changed
    if (currentDataStr === lastSavedDataRef.current) return;

    // Skip if canvas is empty
    const hasContent =
      (canvasData.lines && canvasData.lines.length > 0) ||
      (canvasData.shapes && canvasData.shapes.length > 0);
    if (!hasContent) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for auto-save
    timeoutRef.current = setTimeout(async () => {
      const success = await updateProject(projectId, canvasData);
      if (success) {
        lastSavedDataRef.current = currentDataStr;
      }
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [projectId, canvasData, delay, updateProject]);

  return { isSaving };
}
