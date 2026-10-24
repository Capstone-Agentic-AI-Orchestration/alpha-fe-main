import { useEffect, useRef, useState } from 'react';
import { TerminalSquare } from 'lucide-react';
import type { LiveBuildRoomActivity, LiveBuildRoomOrchestration } from '@/shared/types';
import { describeAgentActivity, orderedAgentActivity } from './agentActivityPresentation';

export function AgentCommandHistory({ activities, attempts }: {
  activities: LiveBuildRoomActivity[];
  attempts: LiveBuildRoomOrchestration['attempts'];
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
      <div><div className="text-xs font-medium text-slate-200">Commands & actions</div><p className="mt-1 text-[11px] leading-5 text-slate-500">Recorded calls and output, in execution order.</p></div>
      <label className="flex shrink-0 items-center gap-1.5 text-[10px] text-slate-400"><input type="checkbox" checked={follow} onChange={event => setFollow(event.target.checked)} className="accent-violet-400" />Follow</label>
    </div>
    {events.length ? <ol className="space-y-3">{events.map(activity => {
      const { command, exitCode, detail, output } = describeAgentActivity(activity);
      const error = activity.kind === 'error' || (exitCode !== undefined && exitCode !== 0);
      const label = activity.kind === 'tool_result' ? 'Result' : activity.kind === 'file_change' ? 'File change' : error ? 'Error' : 'Tool call';
      return <li key={activity.id} className={`overflow-hidden rounded-lg border ${error ? 'border-rose-300/25 bg-rose-300/[0.035]' : 'border-white/[0.08] bg-[#0b0e16]'}`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/[0.06] px-3 py-2 text-[10px] text-slate-500">
          <TerminalSquare className={`h-3 w-3 ${error ? 'text-rose-300' : 'text-violet-300'}`} /><span className="text-slate-300">{activity.toolName || label}</span><span>{label}</span>
          {activity.isStreaming && <span className="text-violet-200">Streaming</span>}
          {exitCode !== undefined && <span className={error ? 'text-rose-300' : 'text-emerald-300'}>Exit {exitCode}</span>}
          <time dateTime={activity.createdAt} title={new Date(activity.createdAt).toLocaleString()} className="ml-auto tabular-nums">{new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
        </div>
        <div className="space-y-2 p-3">
          {command && <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-violet-100"><span className="select-none text-violet-400">$ </span>{command}</pre>}
          {activity.message && <p className={`whitespace-pre-wrap break-words text-[11px] leading-5 ${error ? 'text-rose-200' : 'text-slate-300'}`}>{activity.message}</p>}
          {output && <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-5 text-slate-300">{output}</pre>}
          {detail && detail !== command && detail !== output && <details open={!output && (activity.isStreaming || error || activity.kind === 'tool_result')}>
            <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-slate-200">{output ? 'Raw event' : activity.kind === 'tool_result' ? 'Recorded output' : 'Recorded details'}</summary>
            <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-5 text-slate-400">{detail}</pre>
          </details>}
          {activity.paths?.map(path => <div key={path} className="break-all font-mono text-[10px] text-emerald-200/75">{path}</div>)}
        </div>
      </li>;
    })}</ol> : <p className="rounded-lg border border-dashed border-white/10 p-4 text-xs leading-5 text-slate-500">No commands or tool results have been recorded for this selection yet.</p>}
    {checks.length > 0 && <section className="space-y-2 border-t border-white/10 pt-4">
      <h3 className="text-xs font-medium text-slate-200">Verification commands</h3>
      {checks.map(check => <div key={check.id} className="rounded-lg border border-white/[0.08] bg-[#0b0e16] p-3">
        <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-slate-300">{check.display || check.script || 'Verification command'}</pre>
        <div className={`mt-2 text-[10px] ${check.exitCode === 0 ? 'text-emerald-300' : check.exitCode === null ? 'text-slate-500' : 'text-rose-300'}`}>{check.exitCode === null ? 'No exit code recorded' : `Exit ${check.exitCode}`}{check.signal ? ` · ${check.signal}` : ''}</div>
      </div>)}
    </section>}
    <div ref={endRef} />
  </div>;
}
