import { useEffect, useRef, useState } from 'react';
import { TerminalSquare } from 'lucide-react';
import type { ProjectBuildActivity, ProjectBuildOrchestration } from '@/shared/types';
import { describeAgentActivity, orderedAgentActivity } from './agentActivityPresentation';

export function AgentCommandHistory({ activities, attempts }: {
  activities: ProjectBuildActivity[];
  attempts: ProjectBuildOrchestration['attempts'];
}) {
  const [follow, setFollow] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const events = orderedAgentActivity(activities).filter(activity => ['tool', 'tool_result', 'file_change', 'error'].includes(activity.kind) || activity.toolName);
  const last = events.at(-1);
  useEffect(() => {
    if (!follow) return;
    // Scroll only the inspector, keeping the selected tree node in view.
    const panel = endRef.current?.closest('[role="tabpanel"]');
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [follow, events.length, last?.detail, last?.message]);
  const checks = attempts.flatMap(attempt => [
    ...(attempt.verification?.preparation ? [{ ...attempt.verification.preparation, script: 'Preparation' }] : []),
    ...(attempt.verification?.commands ?? []),
  ].map((command, index) => ({ ...command, id: `${attempt.id}-${index}`, taskId: attempt.taskId })));

  return <div className="space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div><div className="text-xs font-medium text-content">Commands & actions</div><p className="mt-1 text-[11px] leading-5 text-content-muted">Recorded calls and output, in execution order.</p></div>
      <label className="flex shrink-0 items-center gap-1.5 text-[10px] text-content-secondary"><input type="checkbox" checked={follow} onChange={event => setFollow(event.target.checked)} className="accent-violet-400" />Follow</label>
    </div>
    {events.length ? <ol className="space-y-3">{events.map(activity => {
      const { command, exitCode, detail, output } = describeAgentActivity(activity);
      const error = activity.kind === 'error' || (exitCode !== undefined && exitCode !== 0);
      const label = activity.kind === 'tool_result' ? 'Result' : activity.kind === 'file_change' ? 'File change' : error ? 'Error' : 'Tool call';
      return <li key={activity.id} className={`overflow-hidden rounded-lg border ${error ? 'border-status-danger-border bg-status-danger-subtle' : 'border-divider bg-code'}`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-divider px-3 py-2 text-[10px] text-content-muted">
          <TerminalSquare className={`h-3 w-3 ${error ? 'text-status-danger' : 'text-link'}`} /><span className="text-content-secondary">{activity.toolName || label}</span><span>{label}</span>
          {activity.isStreaming && <span className="text-link">Streaming</span>}
          {exitCode !== undefined && <span className={error ? 'text-status-danger' : 'text-status-success'}>Exit {exitCode}</span>}
          <time dateTime={activity.createdAt} title={new Date(activity.createdAt).toLocaleString()} className="ml-auto tabular-nums">{new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
        </div>
        <div className="space-y-2 p-3">
          {command && <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-link"><span className="select-none text-link">$ </span>{command}</pre>}
          {activity.message && <p className={`whitespace-pre-wrap break-words text-[11px] leading-5 ${error ? 'text-status-danger' : 'text-content-secondary'}`}>{activity.message}</p>}
          {output && <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-5 text-content-secondary">{output}</pre>}
          {detail && detail !== command && detail !== output && <details open={!output && (activity.isStreaming || error || activity.kind === 'tool_result')}>
            <summary className="cursor-pointer text-[10px] text-content-muted hover:text-content">{output ? 'Raw event' : activity.kind === 'tool_result' ? 'Recorded output' : 'Recorded details'}</summary>
            <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-5 text-content-secondary">{detail}</pre>
          </details>}
          {activity.paths?.map(path => <div key={path} className="break-all font-mono text-[10px] text-status-success">{path}</div>)}
        </div>
      </li>;
    })}</ol> : <p className="rounded-lg border border-dashed border-divider p-4 text-xs leading-5 text-content-muted">No commands or tool results have been recorded for this selection yet.</p>}
    {checks.length > 0 && <section className="space-y-2 border-t border-divider pt-4">
      <h3 className="text-xs font-medium text-content">Verification commands</h3>
      {checks.map(check => <div key={check.id} className="rounded-lg border border-divider bg-code p-3">
        <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-content-secondary">{check.display || check.script || 'Verification command'}</pre>
        <div className={`mt-2 text-[10px] ${check.exitCode === 0 ? 'text-status-success' : check.exitCode === null ? 'text-content-muted' : 'text-status-danger'}`}>{check.exitCode === null ? 'No exit code recorded' : `Exit ${check.exitCode}`}{check.signal ? ` · ${check.signal}` : ''}</div>
      </div>)}
    </section>}
    <div ref={endRef} />
  </div>;
}
