import { useState, useMemo } from 'react';
import { useApp } from '@/app/AppContext';


export function useProjectsViewModel() {
  const { projects, createProject, updateProject, deleteProject, issues, agents } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const enrichedProjects = useMemo(() => {
    return projects.map(proj => {
      const projIssues = issues.filter(i => i.projectId === proj.id);
      const completed = projIssues.filter(i => i.status === 'done').length;
      const total = projIssues.length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      return {
        ...proj,
        totalIssues: total,
        completedIssues: completed,
        progressPercentage: progress
      };
    });
  }, [projects, issues]);

  const filteredProjects = useMemo(() => {
    return enrichedProjects.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [enrichedProjects, searchQuery]);

  const selectedProject = useMemo(() => {
    return enrichedProjects.find(p => p.id === selectedProjectId) || null;
  }, [enrichedProjects, selectedProjectId]);

  return {
    projects: enrichedProjects,
    filteredProjects,
    selectedProject,
    selectedProjectId,
    setSelectedProjectId,
    searchQuery,
    setSearchQuery,
    isCreateModalOpen,
    setIsCreateModalOpen,
    agents,
    createProject,
    updateProject,
    deleteProject
  };
}
