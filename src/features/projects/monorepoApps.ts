import type { MonorepoAppId, ProjectResource, ProjectResourceApp } from '@/shared/types';

/**
 * A monorepo's two apps, as the app talks about them. Mirrors the API's
 * `services/monorepoApps.ts`: the frontend lives in `apps/web`, the backend in
 * `apps/api`, and each is hosted on its own.
 */
export const MONOREPO_APP_LABEL: Record<MonorepoAppId, string> = { web: 'Frontend', api: 'Backend' };

/** Frontend first: the one a person opens to look at. */
export const MONOREPO_APP_ORDER: readonly MonorepoAppId[] = ['web', 'api'];

/** The `github_repo` resource that is `owner/name`, matched however its URL was written. */
export function repoResource(resources: readonly ProjectResource[] | undefined, repo: string): ProjectResource | undefined {
  const wanted = repo.toLowerCase();
  return resources?.find(resource => {
    if (resource.type !== 'github_repo') return false;
    const match = /github\.com[/:]([^/]+)\/([^/#?]+?)(?:\.git)?\/?$/i.exec(resource.pathOrUrl);
    const name = match ? `${match[1]}/${match[2]}` : resource.name;
    return name.toLowerCase() === wanted;
  });
}

/** A monorepo resource's apps in display order; empty for any other repository. */
export function monorepoApps(resource: ProjectResource | undefined): ProjectResourceApp[] {
  const apps = Array.isArray(resource?.apps) ? resource!.apps : [];
  return MONOREPO_APP_ORDER.flatMap(id => apps.filter(app => app.id === id));
}

/** The records a new React + Node.js monorepo stores, matching what the API records. */
export function newMonorepoApps(frontendStack: ProjectResourceApp['stack'], backendStack: ProjectResourceApp['stack']): ProjectResourceApp[] {
  return [
    { id: 'web', role: 'frontend', stack: frontendStack, path: 'apps/web' },
    { id: 'api', role: 'backend', stack: backendStack, path: 'apps/api' }
  ];
}
