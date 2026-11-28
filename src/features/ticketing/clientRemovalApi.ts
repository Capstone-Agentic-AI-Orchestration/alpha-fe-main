import { apiService } from '@/shared/services/apiService';
import type { RepoArchiveOutcome } from '@/shared/types';

/** `GET /tickets/clients/:key/removal`: what removing a client would do. */
export interface PmClientRemovalPreview {
  key: string;
  displayName: string;
  tickets: number;
  projects: Array<{
    projectId: string;
    name: string;
    key: string;
    repositories: string[];
    archived: boolean;
    /** Another client with access uses it; removal leaves it as it is. */
    sharedWithOtherClients: boolean;
  }>;
}

/** `POST /tickets/clients/:key/remove`: what removing the client did. */
export interface PmClientRemovalResult {
  key: string;
  displayName: string;
  ticketsRevoked: number;
  projects: Array<{
    projectId: string;
    name: string;
    outcome: 'archived' | 'kept_shared' | 'failed';
    repositories: RepoArchiveOutcome[];
    error?: string;
  }>;
  signIn: 'retired' | 'kept_other_access' | 'unavailable' | 'failed';
}

const path = (key: string, action: 'removal' | 'remove') => `/tickets/clients/${encodeURIComponent(key)}/${action}`;

function isPreview(value: unknown): value is PmClientRemovalPreview {
  const preview = value as PmClientRemovalPreview | null;
  return Boolean(preview) && typeof preview!.displayName === 'string' && Number.isSafeInteger(preview!.tickets)
    && Array.isArray(preview!.projects) && preview!.projects.every(project => typeof project?.projectId === 'string'
      && typeof project.name === 'string' && Array.isArray(project.repositories) && typeof project.sharedWithOtherClients === 'boolean');
}

function isResult(value: unknown): value is PmClientRemovalResult {
  const result = value as PmClientRemovalResult | null;
  return Boolean(result) && typeof result!.displayName === 'string' && Array.isArray(result!.projects)
    && ['retired', 'kept_other_access', 'unavailable', 'failed'].includes(result!.signIn);
}

/** PM-only; the desktop relays both to the cloud. */
export const pmClientRemovalApi = {
  async preview(key: string): Promise<PmClientRemovalPreview> {
    const value = await apiService.ticketRequest<unknown>(path(key, 'removal'));
    if (!isPreview(value)) throw new Error('Client removal response is invalid.');
    return value;
  },
  async remove(key: string): Promise<PmClientRemovalResult> {
    const value = await apiService.ticketRequest<unknown>(path(key, 'remove'), {
      method: 'POST', body: JSON.stringify({ confirm: key }),
    });
    if (!isResult(value)) throw new Error('Client removal response is invalid.');
    return value;
  },
};

export type PmClientRemovalApi = typeof pmClientRemovalApi;

const projectCount = (count: number) => (count === 1 ? '1 project' : `${count} projects`);

/** One sentence on what happened, for the toast after removing a client. */
export function removalSummary(result: PmClientRemovalResult): string {
  const archived = result.projects.filter(project => project.outcome === 'archived').length;
  const kept = result.projects.filter(project => project.outcome === 'kept_shared').length;
  const failedProjects = result.projects.filter(project => project.outcome === 'failed').map(project => project.name);
  const failedRepos = result.projects.flatMap(project => project.repositories.filter(repo => repo.state === 'failed').map(repo => repo.repo));
  const parts = [
    archived ? `${projectCount(archived)} archived` : 'No projects to archive',
    kept ? `${kept} kept for other clients` : '',
    failedProjects.length ? `could not archive ${failedProjects.join(', ')}` : '',
    failedRepos.length ? `GitHub did not archive ${failedRepos.join(', ')}` : '',
  ].filter(Boolean);
  const signIn = {
    retired: 'Their sign-in was removed, so they can send a new inquiry and get a new account.',
    kept_other_access: 'They keep their sign-in, because another workspace still gives them access.',
    unavailable: 'Their sign-in could not be removed from here, so the same email cannot be invited again yet.',
    failed: 'Their sign-in could not be removed, so the same email cannot be invited again yet.',
  }[result.signIn];
  return `${parts.join('; ')}. ${signIn}`;
}
