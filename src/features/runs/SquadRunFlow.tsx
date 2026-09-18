import { useCallback, useEffect, useState } from 'react';
import { Check, X, Loader2, Circle, GitBranch, ChevronRight } from 'lucide-react';

import { apiService } from '@/shared/services/apiService';
import { runnerSocket } from '@/shared/services/runnerSocket';
import { useApp } from '@/app/AppContext';
import { PrototypeRun, SquadRun } from '@/shared/types';

/**
 * Who is working, who is finished, and who is waiting.
 *
 * A squad run reached the UI only through its members' stage updates — the
 * five-stage bar would tick over with nothing saying which of four agents it
 * belonged to, or how many were left. The ordering is the whole point of a
 * squad, and it was the one thing not shown.
 *
 * Three levels, because that is what the data is: the squad, its members in
 * execution order, and the five stages inside whichever member is live. Members
 * are a chain rather than a tree — Sequential is the only topology the daemon
 * implements, and the others are disabled in the picker.
 */

/**
 * Keyed by whichever the caller has.
 *
 * The issue panel knows the card; the squad page knows the squad. Both want the
 * same picture, and neither should have to search `squadRuns` to find the id
 * the other one holds.
 */
type Props = { issueId: string; squadId?: never } | { squadId: string; issueId?: never };

type Detail = SquadRun & { runs?: PrototypeRun[] };

/** Where a member sits relative to the one currently running. */
type MemberState = 'done' | 'running' | 'failed' | 'waiting';

/** The squad's own status, said in words rather than in column values. */
const SQUAD_STATUS_LABEL: Record<SquadRun['status'], string> = {
  running: 'running',
  awaiting_approval: 'awaiting approval',
  failed: 'stopped',
  cancelled: 'cancelled'
};

function memberState(run: PrototypeRun | undefined, index: number, current: number): MemberState {
  if (run?.status === 'failed' || run?.status === 'cancelled') return 'failed';
  if (run && ['completed', 'awaiting_approval', 'validating'].includes(run.status)) return 'done';
  // A run the daemon has accepted but not started shares the queued look with
  // members whose turn has not come — because that is what it is.
  if (run?.status === 'queued') return 'waiting';
  if (index === current && run) return 'running';
  return 'waiting';
}

export function SquadRunFlow({ issueId, squadId }: Readonly<Props>) {
  const { squadRuns, squads, agents } = useApp();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  // The newest matching run. An issue can be worked more than once, and a squad
  // has a history — the one worth watching is the last one started.
  const squadRun = [...squadRuns]
    .filter(sr => (issueId ? sr.issueId === issueId : sr.squadId === squadId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  const load = useCallback(async () => {
    if (!squadRun) return;
    try {
      setDetail(await apiService.getSquadRun(squadRun.id));
    } catch {
      // A daemon that cannot answer leaves the last good picture on screen
      // rather than blanking a run that is still going.
    }
  }, [squadRun?.id]);

  useEffect(() => { void load(); }, [load]);

  /**
   * Re-read on anything that could move the chain forward.
   *
   * Refetching rather than patching state from the payload: the detail endpoint
   * already assembles squad, members and stages consistently, and a squad run
   * changes a few times a minute at most. Reconstructing that shape from four
   * event types is how the two drift apart.
   */
  useEffect(() => {
    const events = ['squad_member_started', 'stage_update', 'run_completed', 'run_failed', 'squad_run_completed', 'squad_run_failed'];
    const unsubs = events.map(e => runnerSocket.on(e, () => void load()));
    return () => unsubs.forEach(u => u());
  }, [load]);

  if (!squadRun) return null;

  const squad = squads.find(s => s.id === squadRun.squadId);
  const runs = detail?.runs ?? [];
  const current = detail?.currentMemberIndex ?? squadRun.currentMemberIndex;
  const members = detail?.memberAgentIds ?? squadRun.memberAgentIds;
  const status = detail?.status ?? squadRun.status;

  return (
    <div className="space-y-2 rounded-xl border border-white/5 bg-well p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-white">
            {squad?.name ?? 'Squad run'}
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-gray-500">
            <GitBranch className="w-3 h-3 shrink-0" />
            <span className="truncate">{squadRun.branchName}</span>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] ${
            status === 'failed'
              ? 'bg-rose-500/15 text-rose-300'
              : status === 'running'
                ? 'bg-amber-500/15 text-amber-300'
                : 'bg-emerald-500/15 text-emerald-300'
          }`}
        >
          {status === 'running'
            ? `member ${current + 1} of ${members.length}`
            : SQUAD_STATUS_LABEL[status] ?? status}
        </span>
      </div>

      {/* The chain. One row per member, in execution order. */}
      <div className="space-y-0.5">
        {members.map((agentId, index) => {
          const run = runs.find(r => (r.squadOrder ?? -1) === index);
          const state = memberState(run, index, current);
          const agent = agents.find(a => a.id === agentId);
          const stages = run?.stages ?? [];
          const doneStages = stages.filter(s => s.status === 'success').length;
          const isOpen = expanded === index;

          return (
            <div key={agentId}>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : index)}
                disabled={!stages.length}
                className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-white/[0.03] disabled:cursor-default disabled:hover:bg-transparent"
              >
                {/* State marker, and the line joining this member to the next. */}
                <span className="relative flex w-4 shrink-0 justify-center">
                  {state === 'done' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  {state === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />}
                  {state === 'failed' && <X className="w-3.5 h-3.5 text-rose-400" />}
                  {state === 'waiting' && <Circle className="w-2.5 h-2.5 text-gray-600" />}
                  {index < members.length - 1 && (
                    <span className="absolute top-5 h-3 w-px bg-white/10" />
                  )}
                </span>

                <span
                  className={`flex-1 truncate text-[11px] ${
                    state === 'waiting' ? 'text-gray-500' : 'text-white'
                  }`}
                >
                  {agent?.name ?? agentId}
                  {agent?.role && <span className="text-gray-600"> · {agent.role}</span>}
                </span>

                <span className="shrink-0 font-mono text-[10px] text-gray-500">
                  {state === 'waiting' && 'queued'}
                  {state === 'running' && `${doneStages}/${stages.length} · ${stages[run?.currentStageIndex ?? 0]?.id ?? ''}`}
                  {state === 'done' && `+${run?.insertions ?? 0} −${run?.deletions ?? 0}`}
                  {state === 'failed' && 'stopped'}
                </span>

                {stages.length > 0 && (
                  <ChevronRight
                    className={`w-3 h-3 shrink-0 text-gray-600 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  />
                )}
              </button>

              {/* The five stages, for whichever member you opened. */}
              {isOpen && (
                <div className="ml-6 space-y-0.5 border-l border-white/5 pl-3 pb-1">
                  {stages.map(stage => (
                    <div key={stage.id} className="flex items-center gap-2 text-[10px]">
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          stage.status === 'success'
                            ? 'bg-emerald-400'
                            : stage.status === 'running'
                              ? 'bg-amber-400'
                              : stage.status === 'failed'
                                ? 'bg-rose-400'
                                : stage.status === 'skipped'
                                  ? 'bg-amber-400/60'
                                : 'bg-gray-700'
                        }`}
                      />
                      <span className={stage.status === 'pending' ? 'text-gray-600' : 'text-gray-400'}>
                        {stage.label}{stage.status === 'skipped' ? ' · not verified' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Why a squad stopped early, when it did. A failed member halts the rest. */}
      {detail?.stoppedReason && (
        <p className="border-t border-white/5 pt-2 text-[10px] leading-snug text-rose-200/80">
          {detail.stoppedReason}
        </p>
      )}
    </div>
  );
}
