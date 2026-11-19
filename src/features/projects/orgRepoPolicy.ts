import type { GitHubOrgMembership } from '@/shared/services/apiService';

/**
 * Whether to warn that this org stops the person creating repositories: only when
 * GitHub says so. It used to warn every member, even where members may create them,
 * and the warning was then taken for the reason an unrelated creation failed.
 * Unknown (no membership, or a rule GitHub does not show) is not a warning.
 */
export function orgBlocksRepoCreation(membership: GitHubOrgMembership | undefined): boolean {
  return Boolean(membership) && membership!.role !== 'admin' && membership!.membersCanCreateRepositories === false;
}
