import { AlertTriangle, LogIn, PackageX } from 'lucide-react';

import { Agent } from '@/shared/types';

/**
 * Says when an agent cannot answer, and what would fix it.
 *
 * Alpha holds no provider credentials by design: agents run by spawning
 * `claude`, `codex` or `agy`, which authenticate from the machine's own
 * keychain. An agent is therefore only as available as the CLI behind it, and
 * that differs from person to person.
 *
 * Nothing said so. The roster showed five healthy-looking agents regardless, and
 * the first sign of trouble was a failed conversation worded as if the daemon
 * were at fault. Someone who set the machine up knows which CLIs they have;
 * anyone else has to find out one broken chat at a time.
 */

/** True when this agent can actually answer right now. */
export function canAnswer(agent: Pick<Agent, 'readiness'>): boolean {
  const status = agent.readiness?.status;
  // 'unknown' is not a failure — a scan may simply not have run yet, and
  // blocking on it would be worse than letting the turn try.
  return status !== 'signed_out' && status !== 'not_installed';
}

/** Compact marker for a roster row, where there is no space for a sentence. */
export function AgentReadinessDot({ agent }: { agent: Pick<Agent, 'readiness'> }) {
  if (canAnswer(agent)) return null;

  const signedOut = agent.readiness?.status === 'signed_out';

  return (
    <span
      title={agent.readiness?.detail}
      className="flex items-center gap-1 text-[10px] text-amber-300 font-medium whitespace-nowrap"
    >
      {signedOut ? <LogIn size={10} /> : <PackageX size={10} />}
      {signedOut ? 'signed out' : 'not installed'}
    </span>
  );
}

interface NoticeProps {
  agent: Pick<Agent, 'readiness'>;
  /** Takes the user to the Runtimes page, where the CLI can be fixed. */
  onOpenRuntimes?: () => void;
}

/** The full explanation, for the profile and the chat header. */
export function AgentReadinessNotice({ agent, onOpenRuntimes }: NoticeProps) {
  if (canAnswer(agent)) return null;

  const { detail, command } = agent.readiness ?? {};

  return (
    <div className="flex items-start gap-2 text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
      <div className="space-y-1 min-w-0">
        <div>{detail}</div>
        {command && (
          <div className="font-mono text-[10px] text-amber-200/70 break-all">{command}</div>
        )}
        {onOpenRuntimes && (
          <button
            onClick={onOpenRuntimes}
            className="text-[10px] underline underline-offset-2 hover:text-amber-100 transition-colors"
          >
            Open Runtimes
          </button>
        )}
      </div>
    </div>
  );
}
