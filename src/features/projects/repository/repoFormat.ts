import { parseApiError } from '@/shared/services/apiService';
import { PIPELINE_BRANCHES, RepoBranch, RepoRun, RepoTreeEntry } from '@/shared/types';

/**
 * The sentence to show for a failed repository call.
 *
 * A 401 means GitHub no longer accepts the stored sign-in. The fix is always
 * the same, so say what it is instead of echoing GitHub's wording.
 */
export function describeRepoError(err: unknown): string {
  const { status, message } = parseApiError(err);
  if (status === 401) return 'Sign in to GitHub again from Settings.';
  return message;
}

export function relativeTime(timestamp: string | undefined | null): string {
  if (!timestamp) return '';
  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) return '';
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(time).toLocaleDateString();
}

export interface BranchGroups {
  pipeline: RepoBranch[];
  agent: RepoBranch[];
  other: RepoBranch[];
}

/** Pipeline branches in promotion order, then agent branches, then the rest — each alphabetical. */
export function groupBranches(branches: RepoBranch[]): BranchGroups {
  const byName = (a: RepoBranch, b: RepoBranch) => a.name.localeCompare(b.name);
  const pipelineOrder = (name: string) => PIPELINE_BRANCHES.indexOf(name as (typeof PIPELINE_BRANCHES)[number]);
  const isPipeline = (b: RepoBranch) => b.pipeline || pipelineOrder(b.name) >= 0;
  const isAgent = (b: RepoBranch) => !isPipeline(b) && (b.agent || b.name.startsWith('agent/'));

  return {
    pipeline: branches
      .filter(isPipeline)
      .sort((a, b) => {
        const ai = pipelineOrder(a.name);
        const bi = pipelineOrder(b.name);
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || byName(a, b);
      }),
    agent: branches.filter(isAgent).sort(byName),
    other: branches.filter(b => !isPipeline(b) && !isAgent(b)).sort(byName)
  };
}

/** dev when there is one, otherwise the first branch in display order. */
export function defaultBranch(branches: RepoBranch[]): string | null {
  if (branches.some(b => b.name === 'dev')) return 'dev';
  const groups = groupBranches(branches);
  return [...groups.pipeline, ...groups.agent, ...groups.other][0]?.name ?? null;
}

export type RunTone = 'success' | 'failure' | 'running' | 'queued' | 'neutral' | 'warning';

/** GitHub reports `status` until a run completes, then `conclusion`. */
export function runState(run: Pick<RepoRun, 'status' | 'conclusion'>): { label: string; tone: RunTone } {
  const status = (run.status || '').toLowerCase();
  if (status && status !== 'completed') {
    if (status === 'in_progress') return { label: 'In progress', tone: 'running' };
    if (['queued', 'waiting', 'requested', 'pending'].includes(status)) {
      return { label: status === 'waiting' ? 'Waiting' : 'Queued', tone: 'queued' };
    }
    return { label: humanize(status), tone: 'neutral' };
  }
  const conclusion = (run.conclusion || '').toLowerCase();
  switch (conclusion) {
    case 'success': return { label: 'Success', tone: 'success' };
    case 'failure': return { label: 'Failed', tone: 'failure' };
    case 'timed_out': return { label: 'Timed out', tone: 'failure' };
    case 'startup_failure': return { label: 'Startup failure', tone: 'failure' };
    case 'cancelled': return { label: 'Cancelled', tone: 'neutral' };
    case 'skipped': return { label: 'Skipped', tone: 'neutral' };
    case 'neutral': return { label: 'Neutral', tone: 'neutral' };
    case 'action_required': return { label: 'Action required', tone: 'warning' };
    case 'stale': return { label: 'Stale', tone: 'neutral' };
    case '': return { label: 'Completed', tone: 'neutral' };
    default: return { label: humanize(conclusion), tone: 'neutral' };
  }
}

export const RUN_TONE_CLASS: Record<RunTone, { dot: string; text: string }> = {
  success: { dot: 'bg-emerald-400', text: 'text-emerald-300' },
  failure: { dot: 'bg-rose-400', text: 'text-rose-300' },
  running: { dot: 'bg-cyan-400 motion-safe:animate-pulse', text: 'text-cyan-300' },
  queued: { dot: 'bg-purple-400', text: 'text-purple-300' },
  warning: { dot: 'bg-amber-400', text: 'text-amber-300' },
  neutral: { dot: 'bg-gray-500', text: 'text-gray-400' }
};

export function humanize(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  children: FileTreeNode[];
}

/**
 * Nest GitHub's flat, recursive listing into folders.
 *
 * A folder can be implied by a file path without its own `dir` entry (a
 * truncated listing drops some), so every ancestor is created on demand.
 * Folders sort before files, each alphabetically.
 */
export function buildFileTree(entries: RepoTreeEntry[]): FileTreeNode[] {
  const root: FileTreeNode = { name: '', path: '', type: 'dir', children: [] };
  const dirs = new Map<string, FileTreeNode>([['', root]]);

  const ensureDir = (path: string): FileTreeNode => {
    const existing = dirs.get(path);
    if (existing) return existing;
    const slash = path.lastIndexOf('/');
    const parent = ensureDir(slash < 0 ? '' : path.slice(0, slash));
    const node: FileTreeNode = { name: path.slice(slash + 1), path, type: 'dir', children: [] };
    parent.children.push(node);
    dirs.set(path, node);
    return node;
  };

  for (const entry of entries) {
    const path = entry.path.replace(/^\/+|\/+$/g, '');
    if (!path) continue;
    if (entry.type === 'dir') {
      ensureDir(path);
      continue;
    }
    const slash = path.lastIndexOf('/');
    const parent = ensureDir(slash < 0 ? '' : path.slice(0, slash));
    parent.children.push({ name: path.slice(slash + 1), path, type: 'file', size: entry.size, children: [] });
  }

  const sort = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
    nodes.forEach(node => node.children.length > 0 && sort(node.children));
  };
  sort(root.children);
  return root.children;
}

export function formatBytes(size: number | undefined): string {
  if (size === undefined || !Number.isFinite(size)) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
