import { useMemo } from 'react';
import { useApp } from '@/app/AppContext';


export function useAgentRunViewModel(runId?: string) {
  const { prototypeRuns, cancelPrototypeRun, retryPrototypeRun, agents, issues } = useApp();

  const currentRun = useMemo(() => {
    if (!runId) return prototypeRuns[0] || null;
    return prototypeRuns.find(r => r.id === runId) || null;
  }, [prototypeRuns, runId]);

  const assignedAgent = useMemo(() => {
    if (!currentRun) return null;
    return agents.find(a => a.id === currentRun.agentId) || null;
  }, [agents, currentRun]);

  const targetIssue = useMemo(() => {
    if (!currentRun) return null;
    return issues.find(i => i.id === currentRun.issueId) || null;
  }, [issues, currentRun]);

  const stages = useMemo(() => {
    return currentRun?.stages || [];
  }, [currentRun]);

  const currentStage = useMemo(() => {
    if (!currentRun) return null;
    return currentRun.stages[currentRun.currentStageIndex] || null;
  }, [currentRun]);

  const progressPercentage = useMemo(() => {
    if (!currentRun) return 0;
    const completedCount = currentRun.stages.filter(s => s.status === 'success').length;
    return Math.round((completedCount / currentRun.stages.length) * 100);
  }, [currentRun]);

  return {
    currentRun,
    assignedAgent,
    targetIssue,
    stages,
    currentStage,
    progressPercentage,
    handleCancel: () => currentRun && cancelPrototypeRun(currentRun.id),
    handleRetry: () => currentRun && retryPrototypeRun(currentRun.id)
  };
}
