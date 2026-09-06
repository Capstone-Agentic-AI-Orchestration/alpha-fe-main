import { useCallback, useEffect, useState } from 'react';
import { ArrowUpFromLine, GitPullRequest, GitMerge, ShieldAlert, Bot, Cpu, User } from 'lucide-react';

import { apiService } from '@/shared/services/apiService';
import { runnerSocket } from '@/shared/services/runnerSocket';
import { useApp } from '@/app/AppContext';
import { RemoteAction } from '@/shared/types';

/**
 * What this run did to the remote, and who did it.
 *
 * Agents reach GitHub two ways — the MCP tools, and raw git through Bash, which
 * a run permits — and Alpha's own pipeline pushes on their behalf at the review
 * stage. None of it was visible: a push showed up only in the CLI's scrollback,
 * and Alpha's own appeared as a stage log line the next stage overwrote.
 *
 * Failures and refusals are shown, not filtered. An agent that tried to push to
 * a protected branch is precisely what someone reviewing the run needs to see,
 * and a list that only showed successes would imply nothing else was attempted.
 */

interface Props {
  runId: string;
}

const ICONS: Record<string, typeof ArrowUpFromLine> = {
  push: ArrowUpFromLine,
  open_pull_request: GitPullRequest,
  merge_pull_request: GitMerge
};

/** Column values are not sentences. */
const LABELS: Record<string, string> = {
  push: 'pushed',
  open_pull_request: 'opened a pull request',
  merge_pull_request: 'merged'
};

const ACTOR_ICONS = { agent: Bot, alpha: Cpu, user: User } as const;

export function RemoteActivity({ runId }: Readonly<Props>) {
  const { agents } = useApp();
  const [actions, setActions] = useState<RemoteAction[]>([]);

  const load = useCallback(async () => {
    try {
      setActions(await apiService.getRemoteActions(runId));
    } catch {
      // Leave the last good list rather than blanking a history that exists.
    }
  }, [runId]);

  useEffect(() => { void load(); }, [load]);

  /**
   * Re-read when the run moves.
   *
   * There is no event for "an agent pushed" — the MCP server writes straight to
   * the database from its own process and has no channel back here. Stage
   * transitions are the closest signal, and they bracket every mutation the
   * pipeline makes.
   */
  useEffect(() => {
    const unsubs = ['stage_update', 'run_completed', 'run_failed'].map(e =>
      runnerSocket.on(e, () => void load())
    );
    return () => unsubs.forEach(u => u());
  }, [load]);

  if (!actions.length) return null;

  return (
    <div className="space-y-2 rounded-xl border border-white/5 bg-[#0A0B0E] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-gray-400">Remote activity</span>
        <span className="font-mono text-[10px] text-gray-500">{actions.length}</span>
      </div>

      <div className="space-y-1">
        {actions.map(a => {
          const Icon = ICONS[a.action] ?? ArrowUpFromLine;
          const ActorIcon = ACTOR_ICONS[a.actor] ?? Bot;
          const who =
            a.actor === 'user'
              ? 'You'
              : a.actor === 'alpha'
                ? 'Alpha'
                : agents.find(ag => ag.id === a.agentId)?.name ?? 'An agent';

          return (
            <div key={a.id} className="flex items-start gap-2">
              <span
                className={`mt-0.5 shrink-0 ${a.succeeded ? 'text-gray-500' : 'text-rose-400'}`}
                title={a.succeeded ? a.action : `${a.action} failed`}
              >
                {a.succeeded ? <Icon className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
              </span>

              <div className="min-w-0 flex-1 leading-snug">
                <div className="flex items-center gap-1 text-[11px]">
                  <ActorIcon className="w-2.5 h-2.5 shrink-0 text-gray-600" />
                  <span className={a.succeeded ? 'text-gray-300' : 'text-rose-200'}>
                    {who} {a.succeeded ? LABELS[a.action] ?? a.action : `could not ${LABELS[a.action] ?? a.action}`}
                  </span>
                </div>

                {a.target && (
                  <div className="truncate font-mono text-[10px] text-gray-500">
                    {/* A pull request URL is worth following; a branch name is not a link. */}
                    {a.target.startsWith('http') ? (
                      <a
                        href={a.target}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-brand-400 hover:underline"
                      >
                        {a.target}
                      </a>
                    ) : (
                      a.target
                    )}
                  </div>
                )}

                {a.detail && (
                  <div className={`text-[10px] ${a.succeeded ? 'text-gray-600' : 'text-rose-300/70'}`}>
                    {a.detail}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
