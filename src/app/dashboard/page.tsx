"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ProjectCard from "@/components/dashboard/ProjectCard";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  const fetchProjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name: 'Untitled Project',
          canvas_data: {}
        })
        .select()
        .single();

      if (error) throw error;
      
      router.push(`/canvas?id=${data.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const handleRenameProject = async (id: string, newName: string) => {
    //  Implementation for renaming
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Projects</h1>
            <p className="text-[#A0A0A0] mt-1">Manage your CodeCanvas projects</p>
          </div>
          
          <button
            onClick={handleCreateProject}
            className="flex items-center gap-2 rounded-lg bg-[#FF6B00] px-4 py-2 text-sm font-bold text-white transition-all hover:bg-[#E66000] hover:shadow-[0_0_20px_rgba(255,107,0,0.3)]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </button>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2E2E2E] border-t-[#FF6B00]" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#2E2E2E] bg-[#1A1A1A]/50 py-24 text-center">
            <div className="mb-4 rounded-full bg-[#2E2E2E] p-4">
              <svg className="h-8 w-8 text-[#666666]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white">No projects yet</h3>
            <p className="mt-1 text-[#A0A0A0]">Create your first project to get started</p>
            <button
              onClick={handleCreateProject}
              className="mt-6 rounded-lg border border-[#2E2E2E] bg-[#1A1A1A] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#2E2E2E]"
            >
              Create Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={handleDeleteProject}
                onRename={handleRenameProject}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
