import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/app/AppContext';
import { apiService, normalizeGitHubRepo } from '@/shared/services/apiService';

export interface LiveWorkflowRun {
  databaseId: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'cancelled' | 'timed_out' | 'action_required';
  headBranch: string;
  headSha: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export function useDeploymentsViewModel() {
  const { deployments, agents, issues, projects, showToast } = useApp();
  const [liveRuns, setLiveRuns] = useState<LiveWorkflowRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [failedLogs, setFailedLogs] = useState<string | null>(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isSelfHealing, setIsSelfHealing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const project = projects.find(candidate => (candidate.resources || []).some(resource =>
    (resource.type === 'local_path' || resource.type === 'local_dir' || resource.type === 'github_repo') &&
    Boolean(resource.localPath || resource.pathOrUrl)
  )) || projects[0];
  const localResource = project?.resources?.find(resource =>
    (resource.type === 'local_path' || resource.type === 'local_dir') &&
    Boolean(resource.localPath || resource.pathOrUrl)
  );
  const githubResource = project?.resources?.find(resource =>
    resource.type === 'github_repo' && Boolean(resource.pathOrUrl)
  );
  const workspace = localResource?.localPath ||
    normalizeGitHubRepo(githubResource?.pathOrUrl) ||
    localResource?.pathOrUrl;

  const loadGitHubRuns = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const runs = await apiService.getGitHubRuns(workspace);
      if (runs && Array.isArray(runs)) {
        setLiveRuns(runs);
      }
    } catch (err) {
      console.warn('Failed to fetch GitHub runs:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [workspace]);

  useEffect(() => {
    loadGitHubRuns();
    const interval = setInterval(loadGitHubRuns, 15000);
    return () => clearInterval(interval);
  }, [loadGitHubRuns]);

  const handleInspectFailedLogs = async (runId: number) => {
    setSelectedRunId(runId);
    setIsLoadingLogs(true);
    try {
      const data = await apiService.getGitHubRunLogs(runId, workspace);
      setFailedLogs(data.logs || 'No logs available for this workflow run.');
    } catch (err: any) {
      setFailedLogs(err.message || 'Failed to fetch workflow logs.');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const triggerSelfHealing = async (runId: number) => {
    setIsSelfHealing(true);
    try {
      const devopsAgent =
        agents.find(a => a.role.toLowerCase().includes('devops') || a.role.toLowerCase().includes('qa')) ||
        agents[0];
      const targetIssue = issues[0];

      const plan = [
        `Inspect failed GitHub Actions run #${runId}`,
        'Extract error stack trace and offending file',
        'Apply fix patch to resolve CI failure',
        'Push commit to trigger green rebuild'
      ];

      if (targetIssue && devopsAgent) {
        await apiService.startRun({
          issueId: targetIssue.id,
          agentId: devopsAgent.id,
          plan,
          scenario: 'success'
        });
        showToast('Self-healing dispatched', `Agent ${devopsAgent.name} is triaging workflow #${runId}.`, 'success');
      } else {
        showToast('Self-healing started', `Analyzing workflow #${runId} and applying fix.`, 'info');
      }
    } catch (err: any) {
      showToast('Self-healing failed', err.message || 'Could not start triage run.', 'error');
    } finally {
      setIsSelfHealing(false);
      setSelectedRunId(null);
    }
  };

  return {
    deployments,
    liveRuns,
    selectedRunId,
    failedLogs,
    isLoadingLogs,
    isSelfHealing,
    isRefreshing,
    loadGitHubRuns,
    handleInspectFailedLogs,
    triggerSelfHealing,
    closeLogViewer: () => {
      setSelectedRunId(null);
      setFailedLogs(null);
    }
  };
}
