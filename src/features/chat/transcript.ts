import type { ProjectBuildOrchestration } from '@/shared/types';
import { stripAnsi } from '@/shared/lib/ansi';

/**
 * How agent work reads in the conversation: short past-tense steps ("Read src/App.tsx",
 * "Ran the test check") grouped by agent, and one "Worked for …" line once it is done.
 * Bookkeeping (status changes, tool results, run summaries) stays in the technical log.
 */

/** The fields a step is read from; build activity and chat-turn activity both have them. */
export interface StepSource {
  id: string;
  kind: string;
  message: string;
  toolName?: string;
  detail?: string;
  paths?: string[];
  createdAt: string;
}

/** A step: what was done, and the file or command it was done to (shown in code type). */
export interface Step {
  id: string;
  verb: string;
  target?: string;
  extra?: string;
}

export interface StepGroup {
  key: string;
  agentName: string;
  steps: Step[];
  /** Steps before the ones shown. */
  earlier: number;
  working: boolean;
}

export interface StepSourceGroup {
  key: string;
  agentName: string;
  working: boolean;
  activity: StepSource[];
}

/** The daemon's chat-turn tool labels (agentCallService), in the past tense. */
const CHAT_TOOL_VERBS: Readonly<Record<string, string>> = {
  'Reading project files': 'Read',
  'Finding project files': 'Looked for files',
  'Searching project files': 'Searched the code',
  'Listing project files': 'Listed files'
};

/** Alpha's project tools (`mcp__alpha-task-files__project_*`), by name. */
const PROJECT_TOOL_VERBS: Readonly<Record<string, string>> = {
  read_file: 'Read',
  list_files: 'Listed files',
  list_repositories: 'Listed the codebases',
  search: 'Searched the code',
  grep: 'Searched the code',
  write_file: 'Edited',
  edit_file: 'Edited',
  replace_in_file: 'Edited'
};

function detailField(detail: string | undefined, field: string): string | undefined {
  if (!detail?.startsWith('{')) return undefined;
  try {
    const value = (JSON.parse(detail) as Record<string, unknown>)[field];
    return typeof value === 'string' ? value : undefined;
  } catch {
    return undefined;
  }
}

/** "Used mcp__server__project_run_check" with `{"script":"test"}` reads "Ran the test check". */
function projectToolStep(id: string, tool: string, detail?: string): Step {
  const name = tool.replace(/^project_/, '');
  if (name === 'run_check') {
    const script = detailField(detail, 'script');
    return { id, verb: script ? `Ran the ${script} check` : 'Ran a check' };
  }
  const verb = PROJECT_TOOL_VERBS[name];
  if (verb) return { id, verb, target: detailField(detail, 'path') };
  return { id, verb: 'Used ' + name.replace(/_/g, ' ') };
}

function pathStep(id: string, verb: string, paths: string[]): Step {
  if (!paths.length) return { id, verb };
  return { id, verb, target: paths[0], extra: paths.length > 1 ? `and ${paths.length - 1} more` : undefined };
}

function toolStep(activity: StepSource): Step {
  const { id, message, detail } = activity;
  const paths = activity.paths ?? [];
  if (message.startsWith('Used mcp__')) return projectToolStep(id, message.slice(message.lastIndexOf('__') + 2), detail);
  const chatVerb = CHAT_TOOL_VERBS[message];
  if (chatVerb) return pathStep(id, chatVerb, paths);
  if (message === 'Command requested') return detail ? { id, verb: 'Ran', target: detail } : { id, verb: 'Ran a command' };
  const command = /^Ran command: (.+)$/s.exec(message);
  if (command) return { id, verb: 'Ran', target: command[1] };
  const read = /^Read (\S+)$/.exec(message);
  if (read) return { id, verb: 'Read', target: read[1] };
  return { id, verb: stripAnsi(message).replace(/ activity$/, '') };
}

/** One step for the transcript, or null for activity that is bookkeeping rather than work. */
export function stepFor(activity: StepSource): Step | null {
  if (activity.kind === 'file_change') return pathStep(activity.id, 'Edited', activity.paths ?? []);
  if (activity.kind === 'steering') return { id: activity.id, verb: 'Took your direction' };
  if (activity.kind === 'tool') return toolStep(activity);
  return null;
}

const sameStep = (a: Step | undefined, b: Step) => Boolean(a) && a!.verb === b.verb && a!.target === b.target && a!.extra === b.extra;

/** Each agent's steps in order, the latest `limit` of them, with a repeat of the same step shown once. */
export function stepGroups(sources: StepSourceGroup[], limit: number): StepGroup[] {
  return sources.flatMap(source => {
    const steps: Step[] = [];
    const ordered = [...source.activity].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const activity of ordered) {
      const step = stepFor(activity);
      if (step && !sameStep(steps.at(-1), step)) steps.push(step);
    }
    if (!steps.length && !source.working) return [];
    const earlier = Math.max(0, steps.length - limit);
    return [{ key: source.key, agentName: source.agentName, steps: steps.slice(earlier), earlier, working: source.working }];
  });
}

const WORKING_BUILD_STATUSES: ReadonlySet<string> = new Set(['planning', 'executing', 'validating', 'cancelling']);

/** A build whose agents are busy: it shows as steps and a status line, with nothing to decide yet. */
export function isWorkingBuildStatus(status: string | undefined): boolean {
  return Boolean(status && WORKING_BUILD_STATUSES.has(status));
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
}

/** When the agents started on the build: its first task attempt, or the run itself while planning. */
export function buildWorkStart(orchestration: ProjectBuildOrchestration): string {
  const started = orchestration.attempts.flatMap(attempt => attempt.startedAt ? [attempt.startedAt] : []).sort();
  return started[0] ?? orchestration.run.createdAt;
}

/** From the first attempt starting to the last one finishing. */
export function attemptsDuration(orchestration: ProjectBuildOrchestration): number {
  const times = orchestration.attempts.flatMap(attempt => [attempt.startedAt, attempt.completedAt])
    .flatMap(value => value ? [Date.parse(value)] : [])
    .filter(Number.isFinite);
  return times.length > 1 ? Math.max(...times) - Math.min(...times) : 0;
}

function checksSummary(orchestration: ProjectBuildOrchestration): string | undefined {
  const validation = orchestration.finalValidation;
  const commands = validation?.repositories?.length
    ? validation.repositories.flatMap(repository => repository.commands)
    : validation?.commands ?? [];
  if (!commands.length) return undefined;
  const failed = commands.filter(command => command.exitCode !== 0 || command.signal !== null).length;
  return failed ? `${failed} of ${commands.length} checks failed` : 'every check passed';
}

const FINISHED_WELL: ReadonlySet<string> = new Set(['completed', 'awaiting_approval', 'publishing']);

/** "Worked for 3m 12s · 3 agents · every check passed", for a build that is no longer working. */
export function buildWorkSummary(orchestration: ProjectBuildOrchestration, durationMs: number): string {
  const agents = new Set(orchestration.attempts.map(attempt => attempt.agentName)).size;
  const agentsText = agents === 1 ? '1 agent' : `${agents} agents`;
  const parts = [
    (FINISHED_WELL.has(orchestration.run.status) ? 'Worked for ' : 'Stopped after ') + formatDuration(durationMs),
    agents ? agentsText : undefined,
    checksSummary(orchestration)
  ];
  return parts.filter(Boolean).join(' · ');
}
