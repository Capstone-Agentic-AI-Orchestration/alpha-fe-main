import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { HostingStatus, ScaffoldRepoResult } from '@/shared/types';
import { ScaffoldResultCard } from './ScaffoldResultCard';

const hosting = (platform: 'render' | 'vercel', url: string): HostingStatus => ({
  repo: 'acme/shop', role: platform === 'render' ? 'backend' : 'frontend', platform, configured: true, state: 'ready',
  environments: [{ branch: 'main', url, dashboardUrl: null, latestDeploy: null }], envVars: [], github: { secrets: [], variables: [] }
} as unknown as HostingStatus);

const monorepo: ScaffoldRepoResult = {
  shape: 'monorepo', url: 'https://github.com/acme/shop', nameWithOwner: 'acme/shop', files: [], commitSha: 'c'.repeat(40),
  branches: ['dev', 'uat', 'main'], protectedBranches: [], deployTarget: null, requiredSecrets: [], deployVariable: null, ciSource: 'x',
  apps: [
    { id: 'api', role: 'backend', stack: 'nodejs', path: 'apps/api', deployTarget: 'render', hosting: hosting('render', 'https://shop-api.onrender.com') },
    { id: 'web', role: 'frontend', stack: 'react', path: 'apps/web', deployTarget: 'vercel', hosting: hosting('vercel', 'https://shop-web.vercel.app') }
  ]
};

describe('the card for a new monorepo', () => {
  it('shows where each app is hosted', () => {
    const html = renderToStaticMarkup(<ScaffoldResultCard result={monorepo} onDismiss={() => undefined} />);
    expect(html).toContain('Backend (apps/api) on Render');
    expect(html).toContain('Frontend (apps/web) on Vercel');
    expect(html).toContain('shop-api.onrender.com');
    expect(html).toContain('shop-web.vercel.app');
    expect(html).not.toContain('Deploys weren');
  });
});
