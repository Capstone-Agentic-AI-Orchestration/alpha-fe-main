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

  if (!data && !error) return <div role="status" className="flex items-center gap-2 text-gray-500"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Loading build history…</div>;

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
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-rose-300/20 bg-rose-400/[0.06] px-3 py-2 text-rose-100"><span>{error}</span><button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 text-[11px] font-medium hover:text-white"><RefreshCw className="h-3 w-3" />Retry</button></div>}

    {card && <section aria-label="Build scorecard">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Build scorecard</h3>
        <span className="text-[10px] text-gray-500">{card.lastWorkedAt ? 'Last build task ' + new Date(card.lastWorkedAt).toLocaleString() : 'No build tasks yet'}</span>
      </div>
      {card.tasks === 0 ? <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-gray-500">This agent has not worked on a build task yet. Its scorecard fills in as the Orchestrator assigns it work.</p>
        : <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{tiles.map(tile => <div key={tile.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5" title={tile.hint}>
          <div className="text-base font-semibold text-white">{tile.value}</div>
          <div className="mt-0.5 text-[10px] leading-4 text-gray-500">{tile.label}</div>
        </div>)}</div>}
    </section>}

    {data && <section aria-label="Suggested lessons">
      <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-400"><Lightbulb className="h-3.5 w-3.5 text-amber-300" />Suggested lessons</h3>
      <p className="mb-2 text-[10px] leading-4 text-gray-500">Drafted from why Alpha rejected this agent's work and what reviewers found. Accepting one adds it to the agent's instructions for every future run.</p>
      {data.lessons.length === 0 ? <p className="text-gray-500">No suggestions right now.</p>
        : <ul className="space-y-2">{data.lessons.map(lesson => <li key={lesson.id} className="flex items-start gap-3 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="leading-5 text-gray-200">{lesson.text}</p>
            <p className="mt-0.5 text-[10px] text-gray-500">{lesson.occurrences === 1 ? 'Seen once' : 'Seen ' + lesson.occurrences + ' times'} · last {new Date(lesson.lastSeenAt).toLocaleDateString()}</p>
          </div>
          {canManage && <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" disabled={Boolean(busy)} onClick={() => void decide(lesson.id, 'accept')} className="inline-flex items-center gap-1 rounded-md bg-emerald-300/90 px-2.5 py-1 text-[11px] font-semibold text-[#10201b] hover:bg-emerald-200 disabled:opacity-50">{busy === lesson.id ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}Accept</button>
            <button type="button" disabled={Boolean(busy)} onClick={() => void decide(lesson.id, 'dismiss')} aria-label={'Dismiss: ' + lesson.text} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-gray-300 hover:bg-white/[0.06] disabled:opacity-50"><X className="h-3 w-3" />Dismiss</button>
          </div>}
        </li>)}</ul>}
    </section>}

    {data && data.accepted.length > 0 && <section aria-label="Saved lessons">
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-400"><BookOpenCheck className="h-3.5 w-3.5 text-emerald-300" />Saved lessons ({data.accepted.length} of 20)</h3>
      <ul className="list-disc space-y-1 pl-5 text-gray-300">{data.accepted.map(text => <li key={text}>{text}</li>)}</ul>
      <p className="mt-2 text-[10px] text-gray-500">Saved in this agent's learnings file under "Lessons from builds". Edit or remove them there.</p>
    </section>}
  </div>;
}

