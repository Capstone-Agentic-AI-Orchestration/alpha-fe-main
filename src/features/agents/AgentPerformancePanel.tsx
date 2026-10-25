import { useCallback, useEffect, useState } from 'react';
import { BookOpenCheck, Check, LoaderCircle, Lightbulb, RefreshCw, X } from 'lucide-react';

import { apiService } from '@/shared/services/apiService';
import type { AgentPerformance } from '@/shared/types';

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) + '%' : '—');

/**
 * How an agent has done in builds, and what it could learn from them.
 *
 * Lessons are drafted from Alpha's own rejection reasons and independent
 * review findings. Nothing reaches the agent until someone accepts it; an
 * accepted lesson is added to the agent's learnings file and so to its
 * instructions on every run.
 */
export function AgentPerformancePanel({ agentId, canManage }: { agentId: string; canManage: boolean }) {
  const [data, setData] = useState<AgentPerformance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await apiService.getAgentPerformance(agentId));
    } catch (caught: any) {
      setError(caught?.message ?? 'The agent\'s build history could not be loaded.');
    }
  }, [agentId]);

  useEffect(() => { setData(null); void load(); }, [load]);

  const decide = async (lessonId: string, action: 'accept' | 'dismiss') => {
    setBusy(lessonId);
    setError(null);
    try {
      await apiService.decideAgentLesson(agentId, lessonId, action);
      await load();
    } catch (caught: any) {
      setError(caught?.message ?? 'The lesson could not be saved.');
    } finally {
      setBusy(null);
    }
  };

  if (!data && !error) return <div role="status" className="flex items-center gap-2 text-content-muted"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Loading build history…</div>;

  const card = data?.scorecard;
  const accepted = card ? card.acceptedFirstTry + card.acceptedAfterRetry : 0;
  const tiles = card ? [
    { label: 'Build tasks', value: String(card.tasks) },
    { label: 'Accepted first try', value: percent(card.acceptedFirstTry, card.tasks), hint: card.acceptedFirstTry + ' of ' + card.tasks },
    { label: 'Accepted after retries', value: String(card.acceptedAfterRetry) },
    { label: 'Not accepted yet', value: String(Math.max(0, card.tasks - accepted)) },
    { label: 'Report format rejections', value: String(card.reportFormatRejections) },
    { label: 'Scope rejections', value: String(card.scopeRejections) },
    { label: 'Failed checks', value: String(card.checkFailures) },
    { label: 'Blocking review findings', value: String(card.reviewFindings) }
  ] : [];

  return <div className="space-y-5">
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-status-danger-border bg-status-danger-subtle px-3 py-2 text-status-danger"><span>{error}</span><button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 text-[11px] font-medium hover:text-content"><RefreshCw className="h-3 w-3" />Retry</button></div>}

    {card && <section aria-label="Build scorecard">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-content-secondary">Build scorecard</h3>
        <span className="text-[10px] text-content-muted">{card.lastWorkedAt ? 'Last build task ' + new Date(card.lastWorkedAt).toLocaleString() : 'No build tasks yet'}</span>
      </div>
      {card.tasks === 0 ? <p className="rounded-lg border border-divider bg-surface-raised px-3 py-3 text-content-muted">This agent has not worked on a build task yet. Its scorecard fills in as the Orchestrator assigns it work.</p>
        : <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{tiles.map(tile => <div key={tile.label} className="rounded-lg border border-divider bg-surface-raised px-3 py-2.5" title={tile.hint}>
          <div className="text-base font-semibold text-content">{tile.value}</div>
          <div className="mt-0.5 text-[10px] leading-4 text-content-muted">{tile.label}</div>
        </div>)}</div>}
    </section>}

    {data && <section aria-label="Suggested lessons">
      <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-content-secondary"><Lightbulb className="h-3.5 w-3.5 text-status-warning" />Suggested lessons</h3>
      <p className="mb-2 text-[10px] leading-4 text-content-muted">Drafted from why Alpha rejected this agent's work and what reviewers found. Accepting one adds it to the agent's instructions for every future run.</p>
      {data.lessons.length === 0 ? <p className="text-content-muted">No suggestions right now.</p>
        : <ul className="space-y-2">{data.lessons.map(lesson => <li key={lesson.id} className="flex items-start gap-3 rounded-lg border border-divider bg-surface-raised px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="leading-5 text-content">{lesson.text}</p>
            <p className="mt-0.5 text-[10px] text-content-muted">{lesson.occurrences === 1 ? 'Seen once' : 'Seen ' + lesson.occurrences + ' times'} · last {new Date(lesson.lastSeenAt).toLocaleDateString()}</p>
          </div>
          {canManage && <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" disabled={Boolean(busy)} onClick={() => void decide(lesson.id, 'accept')} className="inline-flex items-center gap-1 rounded-md bg-status-success-subtle px-2.5 py-1 text-[11px] font-semibold text-status-success hover:bg-status-success-subtle disabled:opacity-50">{busy === lesson.id ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}Accept</button>
            <button type="button" disabled={Boolean(busy)} onClick={() => void decide(lesson.id, 'dismiss')} aria-label={'Dismiss: ' + lesson.text} className="inline-flex items-center gap-1 rounded-md border border-divider px-2 py-1 text-[11px] text-content-secondary hover:bg-surface-high disabled:opacity-50"><X className="h-3 w-3" />Dismiss</button>
          </div>}
        </li>)}</ul>}
    </section>}

    {data && data.accepted.length > 0 && <section aria-label="Saved lessons">
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-content-secondary"><BookOpenCheck className="h-3.5 w-3.5 text-status-success" />Saved lessons ({data.accepted.length} of 20)</h3>
      <ul className="list-disc space-y-1 pl-5 text-content-secondary">{data.accepted.map(text => <li key={text}>{text}</li>)}</ul>
      <p className="mt-2 text-[10px] text-content-muted">Saved in this agent's learnings file under "Lessons from builds". Edit or remove them there.</p>
    </section>}
  </div>;
}

