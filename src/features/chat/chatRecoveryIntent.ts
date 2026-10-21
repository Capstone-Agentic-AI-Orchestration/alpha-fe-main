import type { LiveBuildRecoveryAction } from '@/shared/types';

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
  if (/\b(recheck|reconnect|reconnected|resume|continue from checkpoint)\b/.test(text)) return 'recheck_prerequisite';
  if (isExplicitBuildRetry(text)) return 'repair_and_continue';
  if (/\b(fix|repair|correct)\b.*\b(continue|build|failure|error|test|check|this|it)\b|\bfix and continue\b|\brepair and continue\b/.test(text)) {
    return 'repair_and_continue';
  }
  return undefined;
}
