import { Workflow, X } from 'lucide-react';
import type { LiveBuildRoomOrchestration } from '@/shared/types';

export function OrchestratorActivityPanel({ workflow, onClose, onViewPlan, onViewTask }: {
  workflow: LiveBuildRoomOrchestration;
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
  return <aside className="live-agent-inspector flex max-h-[80dvh] min-h-0 flex-col overflow-hidden rounded-2xl border border-violet-300/20 bg-[#10131e] xl:sticky xl:top-0 xl:max-h-none xl:h-[calc(100dvh-8.5rem)]">
    <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] p-4">
      <div><div className="flex items-center gap-2 text-xs text-violet-200"><Workflow className="h-4 w-4" />Orchestrator activity</div><div className="mt-2 text-sm font-semibold capitalize text-white">{workflow.run.status.replace(/_/g, ' ')}</div></div>
      <button type="button" onClick={onClose} aria-label="Close orchestrator activity" className="rounded p-1.5 text-slate-400 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-violet-200"><X className="h-4 w-4" /></button>
    </div>
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
      <div><p className="text-xs leading-6 text-slate-300">{workflow.run.goal}</p><p className="mt-2 text-[11px] tabular-nums text-slate-500">{workflow.tasks.filter(task => task.status === 'accepted').length} / {workflow.tasks.length} tasks complete · {new Set(workflow.tasks.map(task => task.ownerAgentId).filter(Boolean)).size} agents</p></div>
      {currentTask && <section className="rounded-lg border border-violet-300/20 bg-violet-300/5 p-3"><div className="text-[10px] text-violet-200">Current assignment · {currentTask.ownerName}</div><button type="button" onClick={() => onViewTask(currentTask.id)} className="mt-1 text-left text-xs leading-5 text-slate-200 hover:text-white focus-visible:ring-2 focus-visible:ring-violet-200">{currentTask.title}</button><p className="mt-2 text-[11px] leading-5 text-slate-500">{currentTask.assignmentReason}</p></section>}
      <button type="button" onClick={onViewPlan} className="min-h-9 rounded-lg border border-white/10 px-3 text-xs text-slate-200 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-violet-200">Open orchestration plan →</button>
      <section className="space-y-4 border-t border-white/[0.08] pt-4"><h3 className="text-xs font-medium text-slate-300">Recorded execution history</h3>
        {events.length ? events.map(event => <div key={event.id} className="border-l border-violet-300/25 pl-3"><div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-500"><span className="capitalize text-violet-200">{event.label} · {event.agentName}</span><time dateTime={event.at} title={new Date(event.at).toLocaleString()}>{new Date(event.at).toLocaleTimeString()}</time></div><button type="button" onClick={() => onViewTask(event.taskId)} className="mt-1 text-left text-xs leading-5 text-slate-300 hover:text-white focus-visible:ring-2 focus-visible:ring-violet-200">{event.title}</button>{event.detail && <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-500">{event.detail}</p>}</div>) : <p className="text-xs leading-5 text-slate-500">Execution history will appear when an assigned agent starts.</p>}
      </section>
    </div>
  </aside>;
}
