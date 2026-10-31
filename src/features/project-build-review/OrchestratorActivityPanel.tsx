import { Workflow, X } from 'lucide-react';
import type { ProjectBuildOrchestration } from '@/shared/types';

export function OrchestratorActivityPanel({ workflow, onClose, onViewPlan, onViewTask }: {
  workflow: ProjectBuildOrchestration;
  onClose: () => void;
  onViewPlan: () => void;
  onViewTask: (taskId: string) => void;
}) {
  const currentTask = workflow.tasks.find(task => task.id === workflow.run.currentTaskId);
  const events = workflow.attempts.flatMap(attempt => {
    const task = workflow.tasks.find(item => item.id === attempt.taskId);
    const common = { taskId: attempt.taskId, agentName: attempt.agentName, title: task?.title || 'Assigned task' };
    return [
      ...(attempt.startedAt ? [{ ...common, id: `${attempt.id}-start`, at: attempt.startedAt, label: 'Agent started', detail: task?.assignmentReason }] : []),
      ...(attempt.completedAt ? [{ ...common, id: `${attempt.id}-end`, at: attempt.completedAt, label: attempt.status.replace(/_/g, ' '), detail: attempt.failureReason || attempt.summary }] : []),
    ];
  }).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return <aside className="live-agent-inspector flex max-h-[80dvh] min-h-0 flex-col overflow-hidden rounded-2xl border border-divider bg-surface xl:sticky xl:top-0 xl:max-h-none xl:h-[calc(100dvh-8.5rem)]">
    <div className="flex items-start justify-between gap-3 border-b border-divider p-4">
      <div><div className="flex items-center gap-2 text-xs text-link"><Workflow className="h-4 w-4" />Orchestrator activity</div><div className="mt-2 text-sm font-semibold capitalize text-content">{workflow.run.status.replace(/_/g, ' ')}</div></div>
      <button type="button" onClick={onClose} aria-label="Close orchestrator activity" className="rounded p-1.5 text-content-secondary hover:bg-surface-high focus-visible:ring-2 focus-visible:ring-focus"><X className="h-4 w-4" /></button>
    </div>
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
      <div><p className="text-xs leading-6 text-content-secondary">{workflow.run.goal}</p><p className="mt-2 text-[11px] tabular-nums text-content-muted">{workflow.tasks.filter(task => task.status === 'accepted').length} / {workflow.tasks.length} tasks complete · {new Set(workflow.tasks.map(task => task.ownerAgentId).filter(Boolean)).size} agents</p></div>
      {currentTask && <section className="rounded-lg border border-divider bg-selected p-3"><div className="text-[10px] text-link">Current assignment · {currentTask.ownerName}</div><button type="button" onClick={() => onViewTask(currentTask.id)} className="mt-1 text-left text-xs leading-5 text-content hover:text-content focus-visible:ring-2 focus-visible:ring-focus">{currentTask.title}</button><p className="mt-2 text-[11px] leading-5 text-content-muted">{currentTask.assignmentReason}</p></section>}
      <button type="button" onClick={onViewPlan} className="min-h-9 rounded-lg border border-divider px-3 text-xs text-content hover:bg-surface-high focus-visible:ring-2 focus-visible:ring-focus">Open orchestration plan →</button>
      <section className="space-y-4 border-t border-divider pt-4"><h3 className="text-xs font-medium text-content-secondary">Recorded execution history</h3>
        {events.length ? events.map(event => <div key={event.id} className="border-l border-divider pl-3"><div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-content-muted"><span className="capitalize text-link">{event.label} · {event.agentName}</span><time dateTime={event.at} title={new Date(event.at).toLocaleString()}>{new Date(event.at).toLocaleTimeString()}</time></div><button type="button" onClick={() => onViewTask(event.taskId)} className="mt-1 text-left text-xs leading-5 text-content-secondary hover:text-content focus-visible:ring-2 focus-visible:ring-focus">{event.title}</button>{event.detail && <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-5 text-content-muted">{event.detail}</p>}</div>) : <p className="text-xs leading-5 text-content-muted">Execution history will appear when an assigned agent starts.</p>}
      </section>
    </div>
  </aside>;
}
