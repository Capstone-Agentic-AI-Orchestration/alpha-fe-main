import type { LiveBuildRecoveryAction, LiveBuildRecoveryProjection } from '@/shared/types';

export function isExplicitBuildRetry(message: string): boolean {
  const text = message.trim().toLowerCase();
  const retryPattern = /\b(rerun|re-run|retry|run(?:\s+it)?\s+again|try again|restart)\b.*\b(build|run|task|agent|it)\b|\b(build|run|task)\b.*\b(again|rerun|re-run|retry)\b/;
  const retryVerb = '(?:rerun|re-run|retry|run(?:\\s+it)?\\s+again|try again|restart)';
  const negated = new RegExp(`\\b(?:don't|do not|never|not|can't|cannot|shouldn't|should not|wouldn't|would not)\\s+${retryVerb}\\b`).test(text)
    || /\b(?:can't|cannot|shouldn't|should not|wouldn't|would not)\s+(?:i|we)\s+(?:rerun|re-run|retry|run again|restart)\b/.test(text)
    || /\b(?:don't|do not)\s+want\b.{0,24}\b(?:rerun|re-run|retry|run again|restart)\b/.test(text)
    || /\bwithout\s+(?:rerunning|retrying|restarting)\b/.test(text);
  return retryPattern.test(text) && !negated;
}

export function inferRecoveryAction(message: string): LiveBuildRecoveryAction | undefined {
  const text = message.trim().toLowerCase();
  if (/\bwhy\b.*\b(can't|cannot|won't|isn't|not allowed)\b.*\b(rerun|re-run|retry|run again|restart)\b/.test(text)) return 'explain_failure';
  if (/\b(explain|why did|what caused|what is the reason)\b/.test(text)) return 'explain_failure';
  if (/\b(review|show|open)\b.*\b(saved changes|patch|diff)\b/.test(text)) return 'review_saved_changes';
  if (/\b(keep|leave)\b.*\b(paused|stopped)\b|\bdon't resume\b/.test(text)) return 'keep_paused';
  if (/\b(cancel|stop)\b.*\b(build|run)\b/.test(text)) return 'cancel_build';
  if (/\b(retry|correct|fix)\b.*\b(report|response|format|field)\b/.test(text)) return 'retry_report_format';
  if (isExplicitBuildRetry(text)) return 'repair_and_continue';
  if (/\b(fix|repair|correct)\b.*\b(continue|build|failure|error|test|check|this|it)\b|\bfix and continue\b|\brepair and continue\b/.test(text)) {
    return 'repair_and_continue';
  }
  if (/\b(recheck|reconnect|reconnected|resume)\b|\bcontinue\b.{0,48}\bcheckpoint\b/.test(text)) return 'recheck_prerequisite';
  return undefined;
}

export function resolveRecoveryAction(
  requestedAction: LiveBuildRecoveryAction,
  recovery: Pick<LiveBuildRecoveryProjection, 'category' | 'availableActions'>
): LiveBuildRecoveryAction {
  let action = requestedAction;
  if (action === 'repair_and_continue') {
    if (recovery.category === 'report') action = 'retry_report_format';
    else if (['provider', 'configuration', 'review_input', 'final_validation', 'budget'].includes(recovery.category)) {
      action = 'recheck_prerequisite';
    } else if (['workspace', 'alpha'].includes(recovery.category)) {
      action = recovery.availableActions.includes('resume_checkpoint') ? 'resume_checkpoint'
        : recovery.availableActions.includes('recheck_prerequisite') ? 'recheck_prerequisite' : action;
    }
  } else if (action === 'recheck_prerequisite') {
    if (recovery.category === 'project_code') action = 'repair_and_continue';
    else if (recovery.category === 'report') action = 'retry_report_format';
    else if (['workspace', 'alpha'].includes(recovery.category)) {
      action = recovery.availableActions.includes('resume_checkpoint') ? 'resume_checkpoint'
        : recovery.availableActions.includes('recheck_prerequisite') ? 'recheck_prerequisite' : action;
    }
  }

  if (action === 'repair_and_continue' && !recovery.availableActions.includes(action) &&
      recovery.availableActions.includes('provide_guidance')) {
    return 'provide_guidance';
  }
  if (action === 'recheck_prerequisite' && !recovery.availableActions.includes(action) &&
      recovery.availableActions.includes('resume_checkpoint')) {
    return 'resume_checkpoint';
  }
  // Any retry the build cannot take as-is goes as direction when direction is what it waits for.
  if (['repair_and_continue', 'recheck_prerequisite', 'resume_checkpoint'].includes(action) &&
      !recovery.availableActions.includes(action) && recovery.availableActions.includes('provide_guidance')) {
    return 'provide_guidance';
  }
  return action;
}

const CONTINUE_PHRASE = /\b(continue|carry on|keep going|go ahead|proceed|resume|move forward|pick (?:it|this|that) (?:back )?up|start (?:the )?(?:planned work|plan|build|work)|run the plan|let'?s go|do it)\b/;
const QUESTION_START = /^(?:what|why|how|when|where|who|which|is|are|was|were|does|did|will|would|should|shall|do you|do we)\b/;
const NEGATED = /\b(?:don't|dont|do not|never|not|no need to|stop|wait|hold off|hold on|before you)\b.{0,24}\b(?:continue|carry on|keep going|go ahead|proceed|resume|start)\b/;
const CHAT_CONTINUATION = /\bcontinue\s+(?:to\s+(?!work\b|build\b)\w+|explaining|your|the (?:explanation|answer|story|list|summary))\b/;

/**
 * A short instruction to carry an open build forward: "continue", "continue with
 * the plan", "can you continue", "go ahead", "keep going", "fix and continue".
 * Questions about continuing, negations and requests to continue an answer are
 * not, so asking "should we continue?" never starts work.
 */
/**
 * A short request to try the stopped work again: "retry", "can you retry", "try again",
 * "run it again". Only meaningful while a build is waiting on the person; longer messages
 * and negations go to Alpha as ordinary chat.
 */
export function isRetryRequest(message: string): boolean {
  const text = message.trim().toLowerCase().replace(/[.!?]+$/, '');
  if (!text || text.length > 60) return false;
  return /^(?:(?:can|could|would|will) you\s+|please\s+|ok(?:ay)?,?\s+|let'?s\s+)?(?:retry|try (?:it |that )?again|re-?run(?: it| that)?|run (?:it|that) again|do (?:it|that) again|redo(?: it| that)?)(?:\s+(?:please|now|the (?:task|build)))?$/.test(text);
}

/**
 * A message that answers a build waiting for direction: an instruction, not a question,
 * an @mention or a slash command. "Tell the Orchestrator what to do" asks for exactly this
 * in the message box, so it must reach the build rather than Alpha's chat.
 */
export function isBuildDirection(message: string): boolean {
  const text = message.trim();
  if (text.length < 8 || text.length > 4_000 || /^[@/]/.test(text)) return false;
  if (/\?\s*$/.test(text) || QUESTION_START.test(text.toLowerCase())) return false;
  return true;
}

export function isContinueRequest(message: string): boolean {
  const text = message.trim().toLowerCase().replace(/[.!]+$/, '');
  if (!text || text.length > 120) return false;
  if (text.endsWith('?') && !/^(?:can|could|would) you\b/.test(text)) return false;
  if (QUESTION_START.test(text)) return false;
  if (NEGATED.test(text) || CHAT_CONTINUATION.test(text)) return false;
  return CONTINUE_PHRASE.test(text);
}

