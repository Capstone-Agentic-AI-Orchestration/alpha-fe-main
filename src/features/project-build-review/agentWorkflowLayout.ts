import type { ProjectBuildAgentCard, ProjectBuildOrchestration } from '@/shared/types';

type Task = ProjectBuildOrchestration['tasks'][number];
export interface WorkflowTaskLeaf {
  id: string;
  title: string;
  status: string;
  card: ProjectBuildAgentCard;
  task?: Task;
  x: number;
  y: number;
}

/** Ownership defines the tree. Execution status and dependency changes never rank its nodes. */
export function layoutAgentHierarchy(cards: ProjectBuildAgentCard[], tasks: Task[], expandedAgents: ReadonlySet<string>, viewportWidth: number) {
  const ownerOrder = new Map<string, number>();
  tasks.forEach(task => {
    if (task.ownerAgentId && !ownerOrder.has(task.ownerAgentId)) ownerOrder.set(task.ownerAgentId, ownerOrder.size);
  });
  const ordered = [...cards].sort((a, b) =>
    (ownerOrder.get(a.agentId) ?? Number.MAX_SAFE_INTEGER) - (ownerOrder.get(b.agentId) ?? Number.MAX_SAFE_INTEGER)
    || a.agentId.localeCompare(b.agentId) || a.executionId.localeCompare(b.executionId));
  const groups = ordered.map(card => {
    const assigned = tasks.filter(task => task.ownerAgentId === card.agentId);
    const leaves = assigned.length ? assigned.map(task => ({ id: task.id, title: task.title, status: task.status, task }))
      : card.currentTask ? [{ id: `assignment:${card.executionId}`, title: card.currentTask, status: card.status, task: undefined }] : [];
    const expanded = expandedAgents.has(card.agentId);
    return { card, assigned, leaves, expanded, width: expanded ? Math.max(224, Math.min(3, leaves.length) * 158 + 24) : 224 };
  });
  const contentWidth = groups.reduce((sum, group) => sum + group.width, 0) + 80;
  const width = Math.max(760, viewportWidth, contentWidth);
  let cursor = (width - contentWidth) / 2 + 40;
  const taskLeaves: WorkflowTaskLeaf[] = [];
  const positionedCards = groups.map(group => {
    const x = cursor + group.width / 2;
    cursor += group.width;
    if (group.expanded) group.leaves.forEach((leaf, i) => {
      const row = Math.floor(i / 3);
      const count = Math.min(3, group.leaves.length - row * 3);
      taskLeaves.push({ ...leaf, card: group.card, x: x + (i % 3 - (count - 1) / 2) * 158, y: 565 + row * 170 });
    });
    return { ...group, x, y: 380 };
  });
  return { width, height: Math.max(490, ...taskLeaves.map(leaf => leaf.y + 110)), positionedCards, taskLeaves };
}
