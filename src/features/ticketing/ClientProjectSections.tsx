import type { ClientProject } from './clientApi';

/** One key per shared project, unique across workspaces. */
export function clientProjectKey(project: Pick<ClientProject, 'workspaceId' | 'projectId'>): string {
  return JSON.stringify([project.workspaceId, project.projectId]);
}
