import type { LiveBuildRoomAgentCard, LiveBuildRoomSnapshot } from '@/shared/types';
import { orderedAgentActivity } from './agentActivityPresentation';

/** Never show a different assignment's commands when an unstarted task is selected. */
export function agentActivityScope(snapshot: LiveBuildRoomSnapshot, card: LiveBuildRoomAgentCard, taskId?: string | null, executionOnly = false) {
  const workflow = snapshot.orchestration;
  const selectedTask = workflow?.tasks.find(task => task.id === taskId && task.ownerAgentId === card.agentId);
  const attempts = workflow?.attempts.filter(attempt =>
    (attempt.agentId ? attempt.agentId === card.agentId : workflow.tasks.some(task => task.id === attempt.taskId && task.ownerAgentId === card.agentId))
    && (!selectedTask || attempt.taskId === selectedTask.id)
    && (!executionOnly || attempt.prototypeRunId === card.runId)) ?? [];
  const runIds = new Set(attempts.map(attempt => attempt.prototypeRunId).filter(Boolean));
  const relatedCards = workflow && !executionOnly
    ? snapshot.agentCards.filter(item => item.agentId === card.agentId && (item.runId ? runIds.has(item.runId) : Boolean(item.orchestrationTaskId && workflow.tasks.some(task => task.id === item.orchestrationTaskId) && (!selectedTask || item.orchestrationTaskId === selectedTask.id))))
    : [card];
  const activityById = new Map(relatedCards.flatMap(item => item.activity.map(activity => {
    const id = `${item.executionId}:${activity.id}`;
    return [id, { ...activity, id }] as const;
  })));
  const activityCard = {
    ...card,
    currentTask: selectedTask?.title || card.currentTask,
    activity: orderedAgentActivity([...activityById.values()]),
    filePaths: [...new Set([...relatedCards.flatMap(item => item.filePaths ?? []), ...attempts.flatMap(attempt => attempt.changedPaths)])],
  };
  const outputCard = [...relatedCards].sort((a, b) => (Date.parse(b.updatedAt ?? '') || 0) - (Date.parse(a.updatedAt ?? '') || 0))[0];
  return { selectedTask, attempts, relatedCards, activityCard, outputCard };
}
