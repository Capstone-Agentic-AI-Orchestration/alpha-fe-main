import { describe, expect, it } from 'vitest';

import type { ProjectResource } from '@/shared/types';
import { monorepoApps, newMonorepoApps, repoResource } from './monorepoApps';

const resources: ProjectResource[] = [
  { id: 'r1', type: 'github_repo', name: 'acme/shop-fe', pathOrUrl: 'https://github.com/acme/shop-fe', stack: 'react' },
  {
    id: 'r2', type: 'github_repo', name: 'acme/shop', pathOrUrl: 'https://github.com/Acme/Shop.git', shape: 'monorepo',
    // Stored backend first, as the API answers; shown frontend first.
    apps: [...newMonorepoApps('react', 'nodejs')].reverse()
  }
];

describe('a monorepo resource', () => {
  it('is found by owner/name however its URL was written, and lists its apps frontend first', () => {
    const resource = repoResource(resources, 'acme/shop');
    expect(resource?.id).toBe('r2');
    expect(monorepoApps(resource).map(app => [app.id, app.path, app.stack])).toEqual([
      ['web', 'apps/web', 'react'],
      ['api', 'apps/api', 'nodejs']
    ]);
  });

  it('has no apps when it is any other repository', () => {
    expect(monorepoApps(repoResource(resources, 'acme/shop-fe'))).toEqual([]);
    expect(monorepoApps(repoResource(resources, 'acme/missing'))).toEqual([]);
  });
});
