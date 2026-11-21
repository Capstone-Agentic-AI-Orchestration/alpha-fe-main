import type { LiveBuildRecoveryAction, LiveBuildRecoveryProjection, LiveBuildRecoveryState } from '@/shared/types';

import { resolveRecoveryAction } from './chatRecoveryIntent';

/**
 * What pressing send does right now. Nothing the person types is dropped or refused here:
 * - `steer`: a live turn takes the message as a direction at its next safe point;
 * - `queue`: a reply with no live turn to steer (a /build turn, say) is still running, so the
 *   message waits and is sent as soon as that reply ends;
 * - `send`: it goes to the chat, where the Orchestrator answers it.
 */
export function composerSendMode(state: { isAgentTyping: boolean; activeTurnMessageId?: string }): 'steer' | 'queue' | 'send' {
  if (state.activeTurnMessageId) return 'steer';
  return state.isAgentTyping ? 'queue' : 'send';
}

/** A message waiting for the running reply in its conversation to end. */
export interface QueuedChatMessage {
  threadId: string;
  text: string;
  files: File[];
  skillIds: string[];
}

/** Add to the message already waiting in the conversation, if any, so a second send is not lost either. */
export function queueChatMessage(current: QueuedChatMessage | undefined, next: QueuedChatMessage): QueuedChatMessage {
  if (!current || current.threadId !== next.threadId) return { ...next, files: [...next.files], skillIds: [...next.skillIds] };
  return {
    threadId: current.threadId,
    text: [current.text, next.text].filter(Boolean).join('\n\n'),
    files: [...current.files, ...next.files],
    skillIds: [...new Set([...current.skillIds, ...next.skillIds])]
  };
}

/** The message box's send button: when it can be pressed and what it says it will do. */
export function composerSubmitState(state: { hasText: boolean; hasFiles: boolean; steering: boolean; forcedBuild: boolean; busy: boolean; queues: boolean }): { disabled: boolean; label: string; title?: string } {
  // Files alone are not a direction, and a /build needs words; everything else can be sent.
  const empty = !state.hasText && (!state.hasFiles || state.steering || state.forcedBuild);
  if (state.steering) return { disabled: empty || state.busy, label: 'Queue direction for current agent', title: 'Queue this direction for the current response.' };
  if (state.queues) return { disabled: empty || state.busy, label: 'Send when this reply finishes', title: 'Alpha sends this as soon as the current reply ends.' };
  return { disabled: empty || state.busy, label: state.forcedBuild ? 'Start Orchestrator build' : 'Send message' };
}

export type RecoverySelection =
  | { kind: 'act'; runId: string; state: LiveBuildRecoveryState; recovery: LiveBuildRecoveryProjection; action: LiveBuildRecoveryAction }
  /** Not taken here: the message goes to the chat. `reason` says why, for a button that asked for it. */
  | { kind: 'chat'; reason?: string };

/**
 * Which build's recovery a message acts on, and with which action. Anything that cannot be
 * taken safely here returns `chat`, so the message reaches the Orchestrator instead of being
 * refused by the message box.
 */
export function selectRecovery(input: {
  runIds: string[];
  states: Array<{ runId: string; state?: LiveBuildRecoveryState }>;
  requestedAction: LiveBuildRecoveryAction;
  explicitBuildRetry: boolean;
  /** A message that only might be a recovery answer: with no exact match it simply goes to the chat. */
  optional: boolean;
}): RecoverySelection {
  const { runIds, states, requestedAction } = input;
  if (!runIds.length) return { kind: 'chat', reason: 'This conversation has no build to continue.' };
  const activeStates = states.filter(item => item.state?.recovery);
  if (activeStates.length > 1) return { kind: 'chat', reason: 'More than one build is waiting for a decision. Use the recovery controls under the build you mean.' };
  const selected = activeStates[0] ?? (runIds.length === 1 ? states.find(item => item.state?.history.length) : undefined);
  if (!selected?.state) return { kind: 'chat', reason: noBuildSelectedReason(states, input.explicitBuildRetry && runIds.length > 1) };
  const recovery = selected.state.recovery ?? (requestedAction === 'explain_failure' || requestedAction === 'review_saved_changes'
    ? selected.state.history[0]
    : undefined);
  if (!recovery) return { kind: 'chat', reason: input.optional ? undefined : 'This build has no saved recovery waiting for an action.' };
  const action = resolveRecoveryAction(requestedAction, recovery);
  if (!recovery.availableActions.includes(action)) return { kind: 'chat', reason: input.optional ? undefined : unavailableReason(recovery, action) };
  return { kind: 'act', runId: selected.runId, state: selected.state, recovery, action };
}

/** Why no build's recovery was chosen: its details did not load, or a retry could mean more than one build. */
function noBuildSelectedReason(states: Array<{ state?: LiveBuildRecoveryState }>, ambiguousRetry: boolean): string | undefined {
  if (states.some(item => !item.state)) return 'The build’s recovery details could not be loaded. Refresh the Build review tab.';
  return ambiguousRetry ? 'This conversation has more than one saved build. Open the one you want to retry.' : undefined;
}

/** Why the build cannot take this action now, in the server's words when it gave any. */
function unavailableReason(recovery: LiveBuildRecoveryProjection, action: LiveBuildRecoveryAction): string {
  return recovery.actionReasons[action]
    ?? recovery.actionReasons.provide_guidance
    ?? Object.values(recovery.actionReasons).find(value => typeof value === 'string' && value.trim())
    ?? 'This build has no eligible retry in its current state. Review the recovery panel for the saved failure and next available action.';
}
