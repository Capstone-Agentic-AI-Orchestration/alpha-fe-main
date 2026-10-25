import type { RepoRun } from './index';

export interface ActionsPage { page: number; perPage: number; totalCount: number; nextPage: number | null; limited: boolean }
export interface ActionsFilters { branch?: string; workflow?: string; status?: string; event?: string; from?: string; to?: string; page?: number; perPage?: number }
export interface ActionsRun extends RepoRun {
  repository: string; title: string; workflowId: number; path?: string; number: number; attempt: number;
  sha: string; actor: string; updatedAt: string; startedAt?: string;
}
export interface ActionsWorkflow { id: number; name: string; path: string; state: string }
export interface ActionsStep { number: number; name: string; status: string; conclusion: string | null; startedAt?: string; completedAt?: string }
export interface ActionsJob {
  id: number; runId: number; attempt: number; name: string; status: string; conclusion: string | null;
  startedAt?: string; completedAt?: string; steps: ActionsStep[];
}
export interface ActionsArtifact { id: number; name: string; size: number; expired: boolean; expiresAt: string }
export interface ActionsLog { state: 'available' | 'not_ready' | 'unavailable'; text: string; truncated: boolean }
export type ActionsRunsPage = ActionsPage & { runs: ActionsRun[] };
export type ActionsWorkflowsPage = ActionsPage & { workflows: ActionsWorkflow[] };
export type ActionsJobsPage = ActionsPage & { jobs: ActionsJob[]; attempt: number };
export type ActionsArtifactsPage = ActionsPage & { artifacts: ActionsArtifact[] };
