import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ProjectVersion {
  id: string;
  project_id: string;
  version_number: number;
  canvas_data: any;
  created_at: string;
  description?: string;
}

interface UseVersionHistoryReturn {
  versions: ProjectVersion[];
  loading: boolean;
  error: string | null;
  fetchVersions: (projectId: string) => Promise<void>;
  createVersion: (projectId: string, canvasData: any, description?: string) => Promise<boolean>;
  restoreVersion: (versionId: string) => Promise<any | null>;
  deleteVersion: (versionId: string) => Promise<boolean>;
  compareVersions: (v1Id: string, v2Id: string) => Promise<{ v1: any; v2: any } | null>;
}

export function useVersionHistory(): UseVersionHistoryReturn {
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchVersions = useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('project_versions')
        .select('*')
        .eq('project_id', projectId)
        .order('version_number', { ascending: false });

      if (fetchError) throw fetchError;

      setVersions(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch versions';
      setError(errorMessage);
      console.error('Fetch versions error:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const createVersion = useCallback(async (
    projectId: string,
    canvasData: any,
    description?: string
  ): Promise<boolean> => {
    setError(null);

    try {
      // Get next version number
      const { data: latestVersion } = await supabase
        .from('project_versions')
        .select('version_number')
        .eq('project_id', projectId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      const nextVersionNumber = latestVersion ? latestVersion.version_number + 1 : 1;

      const { error: createError } = await supabase
        .from('project_versions')
        .insert({
          project_id: projectId,
          version_number: nextVersionNumber,
          canvas_data: canvasData,
          description,
        });

      if (createError) throw createError;

      // Refresh versions list
      await fetchVersions(projectId);

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create version';
      setError(errorMessage);
      console.error('Create version error:', err);
      return false;
    }
  }, [supabase, fetchVersions]);

  const restoreVersion = useCallback(async (versionId: string): Promise<any | null> => {
    setError(null);

    try {
      const { data, error: restoreError } = await supabase
        .from('project_versions')
        .select('*')
        .eq('id', versionId)
        .single();

      if (restoreError) throw restoreError;

      return data.canvas_data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to restore version';
      setError(errorMessage);
      console.error('Restore version error:', err);
      return null;
    }
  }, [supabase]);

  const deleteVersion = useCallback(async (versionId: string): Promise<boolean> => {
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('project_versions')
        .delete()
        .eq('id', versionId);

      if (deleteError) throw deleteError;

      // Refresh versions list
      setVersions((prev) => prev.filter((v) => v.id !== versionId));

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete version';
      setError(errorMessage);
      console.error('Delete version error:', err);
      return false;
    }
  }, [supabase]);

  const compareVersions = useCallback(async (
    v1Id: string,
    v2Id: string
  ): Promise<{ v1: any; v2: any } | null> => {
    setError(null);

    try {
      const [{ data: v1 }, { data: v2 }] = await Promise.all([
        supabase.from('project_versions').select('*').eq('id', v1Id).single(),
        supabase.from('project_versions').select('*').eq('id', v2Id).single(),
      ]);

      if (!v1 || !v2) throw new Error('Version not found');

      return {
        v1: v1.canvas_data,
        v2: v2.canvas_data,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to compare versions';
      setError(errorMessage);
      console.error('Compare versions error:', err);
      return null;
    }
  }, [supabase]);

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
