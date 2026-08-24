import { useState, useMemo } from 'react';
import { useApp } from '@/app/AppContext';


export function useIssuesViewModel() {
  const {
    issues,
    projects,
    agents,
    prototypeRuns,
    updateIssueStatus,
    updateIssue,
    deleteIssue,
    runAgentOnIssue,
    createIssue
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      const matchesSearch =
        issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.identifier.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (issue.description && issue.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || issue.status === statusFilter;
      const matchesProject = projectFilter === 'all' || issue.projectId === projectFilter;

      return matchesSearch && matchesStatus && matchesProject;
    });
  }, [issues, searchQuery, statusFilter, projectFilter]);

  const selectedIssue = useMemo(() => {
    return issues.find(i => i.id === selectedIssueId) || null;
  }, [issues, selectedIssueId]);

  const activeRun = useMemo(() => {
    if (!selectedIssue) return null;
    return prototypeRuns.find(r => r.issueId === selectedIssue.id) || null;
  }, [prototypeRuns, selectedIssue]);

  const handleLaunchAgent = (issueId: string, agentId?: string) => {
    runAgentOnIssue(issueId, agentId);
  };

  return {
    issues,
    filteredIssues,
    selectedIssue,
    selectedIssueId,
    setSelectedIssueId,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    projectFilter,
    setProjectFilter,
    isCreateModalOpen,
    setIsCreateModalOpen,
    projects,
    agents,
    activeRun,
    handleLaunchAgent,
    updateIssueStatus,
    updateIssue,
    deleteIssue,
    createIssue
  };
}
