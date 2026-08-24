import { useState, useMemo } from 'react';
import { useApp } from '@/app/AppContext';


export function useAgentsViewModel() {
  const {
    agents,
    createAgent,
    updateAgent,
    deleteAgent,
    duplicateAgent,
    archiveAgent,
    restoreAgent,
    skills,
    runtimes
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'mine' | 'archived'>('all');

  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      const matchesSearch =
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (agent.description && agent.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesRole = roleFilter === 'all' || agent.role === roleFilter;

      if (activeTab === 'archived') return matchesSearch && matchesRole && agent.isArchived;
      if (activeTab === 'mine') return matchesSearch && matchesRole && !agent.isArchived && agent.isMine;
      return matchesSearch && matchesRole && !agent.isArchived;
    });
  }, [agents, searchQuery, roleFilter, activeTab]);

  const selectedAgent = useMemo(() => {
    return agents.find(a => a.id === selectedAgentId) || null;
  }, [agents, selectedAgentId]);

  return {
    agents,
    filteredAgents,
    selectedAgent,
    selectedAgentId,
    setSelectedAgentId,
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    activeTab,
    setActiveTab,
    isCreateModalOpen,
    setIsCreateModalOpen,
    skills,
    runtimes,
    createAgent,
    updateAgent,
    deleteAgent,
    duplicateAgent,
    archiveAgent,
    restoreAgent
  };
}
