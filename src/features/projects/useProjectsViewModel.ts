import { useState, useMemo } from 'react';
import { useApp } from '@/app/AppContext';
import { Project } from '@/shared/types';

/**
 * Derive a free project key from a name.
 *
 * `key` is UNIQUE in the daemon's schema and it prefixes every issue identifier
 * (`<KEY>-101`), so it can never be blank or duplicated. Creation stopped asking
 * for one, which makes collisions easy to hit rather than rare: "Payments API"
 * and "Payment Gateway" both reduce to PAY. Suffix a counter until the key is
 * free instead of letting the INSERT fail.
 *
 * `ignoreId` lets the edit dialog validate a project against its siblings
 * without colliding with the key it already owns.
 */
export function deriveProjectKey(name: string, existing: Project[], ignoreId?: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const base = letters.slice(0, 3) || 'PRJ';
  const taken = new Set(existing.filter(p => p.id !== ignoreId).map(p => p.key));

  if (!taken.has(base)) return base;

  // Two digits keeps the key inside the 5-char field the edit dialog offers.
  for (let n = 2; n < 100; n++) {
    const candidate = `${base}${n}`;
    if (!taken.has(candidate)) return candidate;
  }

  // 99 projects sharing three letters is not a real case, but a caller still
  // needs something unique back rather than a duplicate.
  return `${base}${Date.now().toString().slice(-2)}`;
}

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
