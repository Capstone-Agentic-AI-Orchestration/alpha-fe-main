import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { apiService } from '@/shared/services/apiService';

export interface UsageEntry {
  id: string;
  messageId?: string;
  agentId?: string;
  callId?: string;
  orchestrationRunId?: string;
  provider: string;
  model?: string;
  startedAt: string;
  updatedAt: string;
  endedAt?: string;
  status: 'running' | 'completed' | 'stopped' | 'failed' | 'interrupted';
  usage: { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheCreationTokens?: number; thinkingTokens?: number; totalTokens?: number };
}
export interface ChatUsageSnapshot { available: boolean; reason?: string; entries: UsageEntry[] }

/** Time is the union of execution intervals, so parallel agents never inflate elapsed work. */
export function workDuration(entries: UsageEntry[], now = Date.now()): number {
  const intervals = entries.map(entry => [Date.parse(entry.startedAt), entry.status === 'running' ? now : Date.parse(entry.endedAt ?? entry.updatedAt)])
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end >= start)
    .sort((a, b) => a[0] - b[0]);
  let total = 0, end = 0;
  for (const [start, stop] of intervals) { total += Math.max(0, stop - Math.max(start, end)); end = Math.max(end, stop); }
  return total;
}
export function usageTotal(entries: UsageEntry[]): number | undefined {
  const values = entries.flatMap(entry => entry.usage.totalTokens === undefined ? [] : [entry.usage.totalTokens]);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : undefined;
}
export function useChatUsage(threadId: string | undefined, scope: string, enabled: boolean, expectingWork = false) {
  const key = scope + ':' + (threadId ?? '');
  const [loaded, setLoaded] = useState<{key: string; snapshot: ChatUsageSnapshot} | null>(null);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    if (!threadId || !enabled) return;
    let disposed = false;
    let timer: number | undefined;
    let running = false;
    const refresh = async () => {
      try {
        const snapshot = await apiService.getChatUsage(threadId);
        running = snapshot.entries.some(entry => entry.status === 'running');
        if (!disposed) setLoaded({ key, snapshot });
      } catch {
        // Stale live data must not keep an elapsed timer running after a lost connection.
        if (!disposed) setLoaded({ key, snapshot: { available: false, reason: 'Usage connection unavailable.', entries: [] } });
      }
      if (!disposed) timer = window.setTimeout(refresh, document.hidden ? 10_000 : running || expectingWork ? 1_000 : 5_000);
    };
    void refresh();
    const tick = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => { disposed = true; window.clearTimeout(timer); window.clearInterval(tick); };
  }, [threadId, key, enabled, expectingWork]);
  return { snapshot: loaded?.key === key ? loaded.snapshot : null, now: clock };
}
export function entriesAtMessage(messages: Array<{id: string; senderType: string; orchestrationRunId?: string}>, messageId: string, entries: UsageEntry[]): UsageEntry[] {
  const at = messages.findIndex(message => message.id === messageId);
  if (at < 0 || messages[at].senderType === 'system') return [];
  let user = at;
  while (user >= 0 && messages[user].senderType !== 'user') user--;
  if (user < 0) return [];
  let last = user;
  for (let i = user + 1; i < messages.length && messages[i].senderType !== 'user'; i++) {
    if (messages[i].senderType !== 'system') last = i;
  }
  if (at !== last) return [];
  const request = messages[user].id;
  const builds = new Set(messages.slice(user, last + 1).flatMap(message => message.orchestrationRunId ? [message.orchestrationRunId] : []));
  return entries.filter(entry => entry.messageId === request || Boolean(entry.orchestrationRunId && builds.has(entry.orchestrationRunId)));
}
function duration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
}
function tokens(entries: UsageEntry[]) {
  const total = usageTotal(entries);
  const partial = entries.some(entry => entry.usage.totalTokens === undefined || entry.status === 'interrupted');
  return total === undefined ? 'Tokens not reported' : `${total.toLocaleString()} tokens${partial ? ' · partial' : ''}`;
}

export function WorkUsageRow({ entries, now, names = {} }: { entries: UsageEntry[]; now: number; names?: Record<string, string> }) {
  const [expanded, setExpanded] = useState(false);
  if (!entries.length) return null;
  const running = entries.some(entry => entry.status === 'running');
  const latest = [...entries].sort((a, b) => a.startedAt.localeCompare(b.startedAt)).at(-1)!;
  const label = running ? 'Working for' : latest.status === 'stopped' ? 'Stopped after' : latest.status === 'failed' ? 'Failed after' : latest.status === 'interrupted' ? 'Interrupted after' : 'Worked for';
  return <div className="mt-3 border-b border-divider pb-2 text-[11px] text-content-muted">
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="inline-flex flex-wrap items-center gap-2 py-1 text-left hover:text-content-secondary">
      <span>{label} {duration(workDuration(entries, now))}</span>
      <span>· {tokens(entries)}</span><ChevronRight className={'h-3 w-3 transition-transform ' + (expanded ? 'rotate-90' : '')} />
    </button>
    {expanded && <div className="space-y-2 py-2">
      {entries.map(entry => <div key={entry.id} className="space-y-1">
        <div className="text-content-secondary">{names[entry.agentId ?? ''] ?? (entry.agentId === 'alpha-assistant' ? 'Orchestrator' : 'Agent')} · {entry.model ?? entry.provider} · {entry.status}</div>
        <div>{tokens([entry])} · {duration(workDuration([entry], now))}{entry.usage.totalTokens !== undefined ? ` · Last reported ${new Date(entry.updatedAt).toLocaleTimeString()}` : entry.status === 'running' ? ' · Awaiting provider usage' : ''}</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">{Object.entries(entry.usage).filter(([key]) => key !== 'totalTokens').map(([key, value]) => <span key={key}>{key.replace(/Tokens$/, '').replace(/([A-Z])/g, ' $1').toLowerCase()}: {value?.toLocaleString()}</span>)}</div>
      </div>)}
      <p>Provider-reported usage for this work. Cached input and reasoning may overlap other categories; the total accounts for the runtime’s format. Counts update when the runtime reports them.</p>
    </div>}
  </div>;
}
