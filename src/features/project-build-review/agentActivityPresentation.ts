import type { ProjectBuildActivity, ProjectBuildAgentCard } from '@/shared/types';

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export function describeAgentActivity(activity: ProjectBuildActivity) {
  let payload: Record<string, unknown> | undefined;
  try { payload = record(JSON.parse(activity.detail ?? '')); } catch { /* Plain text is also a supported event format. */ }
  let input = record(payload?.input) ?? record(payload?.arguments) ?? record(payload?.args);
  if (!input && typeof payload?.input === 'string') {
    try { input = record(JSON.parse(payload.input)); } catch { /* Keep the original detail below. */ }
  }
  const commandValue = payload?.command ?? payload?.cmd ?? input?.command ?? input?.cmd;
  const shell = /^(bash|shell|terminal|exec_command|run_command|command|powershell)(\b|_)/i.test(activity.toolName ?? '');
  const command = typeof commandValue === 'string' ? commandValue
    : activity.kind === 'tool' && shell && !payload ? activity.detail : undefined;
  const exitValue = payload?.exitCode ?? payload?.exit_code;
  const exitCode = typeof exitValue === 'number' ? exitValue : undefined;
  const streams = [payload?.stdout, payload?.stderr].filter((value): value is string => typeof value === 'string' && value.length > 0);
  const output = typeof payload?.output === 'string' ? payload.output : streams.length ? streams.join('\n') : activity.kind === 'tool_result' && !payload ? activity.detail : undefined;
  return { command, exitCode, detail: activity.detail, output };
}

export function orderedAgentActivity(activities: ProjectBuildActivity[]): ProjectBuildActivity[] {
  return [...activities].sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0) || a.sequence - b.sequence || a.id.localeCompare(b.id));
}

export function latestAgentAction(card: ProjectBuildAgentCard): { text: string; command: boolean } {
  const activity = orderedAgentActivity(card.activity).at(-1);
  if (!activity) return { text: card.currentStage || 'Awaiting activity', command: false };
  const { command } = describeAgentActivity(activity);
  return { text: command ? `$ ${command}` : activity.message || activity.toolName || 'Activity recorded', command: Boolean(command) };
}
