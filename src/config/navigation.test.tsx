import { describe, expect, it, vi } from 'vitest';
import type { NavigationTab, UserRole } from '@/shared/types';
import { ARCHIVED_NAV_ITEMS, landingTab as runtimeLandingTab, listedInMenus, NAV_ITEMS, navItem, roleNav, sectionsFor as runtimeSectionsFor } from './navigation';
import { AI_FEATURES_BY_ROLE, AI_NAV_TABS, CHAT_TAB_ENABLED, aiFeaturesEnabled } from './features';

/**
 * The desktop app's navigation, which these compatibility tests describe. Tests run
 * outside Electron, so the default runtime here is the hosted web app.
 */
const ROLE_NAV = roleNav(true);
const landingTab = (role: UserRole) => runtimeLandingTab(role, true);
const sectionsFor = (role: UserRole) => runtimeSectionsFor(role, true);

/** While the Chat tab is off, every role's navigation is the existing one without it. */
const withoutHiddenChat = (tabs: NavigationTab[]) => tabs.filter(tab => CHAT_TAB_ENABLED || tab !== 'chat');

/**
 * Navigation destinations retained after archiving standalone pages.
 * Project managers and admins see the AI destinations, Chat included, in the desktop app (config/features.ts).
 */
const existing: Record<UserRole, NavigationTab[]> = {
  client: ['portal', 'intake', 'settings'],
  dev: ['issues', 'projects', 'agents', 'skills', 'chat', 'settings'],
  pm: ['clients', 'inquiries', 'projects', 'issues', 'chat', 'agents', 'skills', 'analytics', 'settings'],
  admin: ['issues', 'projects', 'chat', 'agents', 'skills', 'analytics', 'operations', 'settings'],
};
/**
 * Existing sidebar ordering differs from ROLE_NAV; preserve it independently.
 * Chat leads the Build section for every role that builds with agents.
 */
const existingVisible: Record<UserRole, NavigationTab[]> = {
  client: ['portal', 'intake', 'settings'],
  dev: ['chat', 'issues', 'projects', 'agents', 'skills', 'settings'],
  pm: ['chat', 'clients', 'issues', 'projects', 'inquiries', 'agents', 'skills', 'analytics', 'settings'],
  admin: ['chat', 'issues', 'projects', 'agents', 'skills', 'analytics', 'operations', 'settings'],
};
/** PMs start with their clients; the project conversation owns each project's tickets. */
const landing = (role: UserRole) => withoutHiddenChat(existing[role])[0];
describe('existing navigation compatibility', () => {
  it('shows Tasks while preserving the existing issues route identifier', () => {
    const tasks = NAV_ITEMS.find(item => item.id === 'issues');
    expect(tasks).toMatchObject({ id: 'issues', label: 'Tasks', title: 'Tasks' });
    expect(tasks?.labels).toMatchObject({ pm: 'All Tasks', admin: 'All Tasks' });
  });
  it('places the Operations Center in Administration for admins only', () => {
    const operations = NAV_ITEMS.find(item => item.id === 'operations');
    expect(operations).toMatchObject({ id: 'operations', title: 'Operations Center', section: 'administration' });
    expect(ROLE_NAV.admin).toContain('operations');
    expect(sectionsFor('admin').find(group => group.section.id === 'administration')?.items.map(item => item.id)).toContain('operations');
    for (const role of ['client', 'dev', 'pm'] as const) expect(ROLE_NAV[role]).not.toContain('operations');
  });
  it.each(Object.keys(existing) as UserRole[])('preserves every existing %s destination and landing page', role => {
    expect(ROLE_NAV[role]).toEqual(withoutHiddenChat(existing[role]));
    expect(landingTab(role)).toBe(landing(role));
    const visible = sectionsFor(role).flatMap(group => group.items.map(item => item.id));
    expect(visible).toEqual(withoutHiddenChat(existingVisible[role]));
    expect(visible.every(tab => ROLE_NAV[role].includes(tab))).toBe(true);
    expect(visible.length).toBe(new Set(visible).size);
  });
  it('lists Inquiries in the menus now the Inbox is archived, and scopes tickets to project conversations', () => {
    expect(ROLE_NAV.pm).not.toContain('tickets');
    // The only way in to new prospects' requests, so it is listed itself; Clients still opens one there.
    expect(ROLE_NAV.pm).toContain('inquiries');
    expect(sectionsFor('pm').flatMap(group => group.items.map(item => item.id))).not.toContain('tickets');
    expect(sectionsFor('pm').find(group => group.section.id === 'clients')?.items.map(item => item.id)).toEqual(['clients']);
    expect(sectionsFor('pm').find(group => group.section.id === 'requests')?.items.map(item => item.id)).toEqual(['inquiries']);
    expect(listedInMenus(navItem('inquiries'))).toBe(true);
    for (const role of ['client', 'dev', 'admin'] as const) {
      expect(ROLE_NAV[role]).not.toContain('tickets');
      expect(ROLE_NAV[role]).not.toContain('inquiries');
    }
  });
  it('shows the Chat tab to developers, project managers and admins in the desktop app', () => {
    expect(CHAT_TAB_ENABLED).toBe(true);
    for (const role of ['dev', 'pm', 'admin'] as const) expect(ROLE_NAV[role]).toContain('chat');
    expect(ROLE_NAV.client).not.toContain('chat');
    expect(NAV_ITEMS.some(item => item.id === 'chat')).toBe(true);
  });

  it('restores build chat for every building role, exactly as before, when the flag is turned back on', async () => {
    vi.resetModules();
    vi.doMock('./features', async importOriginal => ({ ...(await importOriginal<typeof import('./features')>()), CHAT_TAB_ENABLED: true }));
    try {
      const restored = await import('./navigation');
      expect(restored.roleNav(true).dev).toEqual(existing.dev);
      expect(restored.sectionsFor('dev', true).flatMap(group => group.items.map(item => item.id))).toEqual(existingVisible.dev);
      expect(restored.landingTab('dev', true)).toBe('issues');
      for (const role of ['pm', 'admin'] as const) expect(restored.roleNav(true)[role]).toEqual(existing[role]);
      expect(restored.roleNav(true).client).not.toContain('chat');
    } finally {
      vi.doUnmock('./features');
      vi.resetModules();
    }
  });
  it('places the Operations Center in Administration for workspace admins only', () => {
    expect(NAV_ITEMS.find(item => item.id === 'operations')).toMatchObject({ title: 'Operations Center', section: 'administration' });
    expect(sectionsFor('admin').find(group => group.section.id === 'administration')?.items.map(item => item.id)).toContain('operations');
    for (const role of ['client', 'dev', 'pm'] as const) expect(ROLE_NAV[role]).not.toContain('operations');
  });
  it('has no squads page; the Orchestrator assigns agents per task', () => {
    expect(NAV_ITEMS.some(item => (item.id as string) === 'squads')).toBe(false);
  });
  it('shows PM AI destinations in the desktop app, the same as a developer and an admin', () => {
    expect(AI_FEATURES_BY_ROLE.pm).toBe('desktop');
    for (const tab of AI_NAV_TABS) {
      if (tab === 'runtimes') {
        expect(ROLE_NAV.pm).not.toContain(tab);
        continue;
      }
      expect(ROLE_NAV.pm).toContain(tab);
      if (NAV_ITEMS.some(item => item.id === tab)) {
        expect(ROLE_NAV.dev).toContain(tab);
        expect(ROLE_NAV.admin).toContain(tab);
      }
    }
    expect(sectionsFor('pm').map(group => group.section.id)).not.toContain('automation');
  });
  it('archives attention, the inbox and specifications on desktop and web', () => {
    for (const tab of ['attention', 'inbox', 'documents'] as const) {
      expect(ARCHIVED_NAV_ITEMS.some(item => item.id === tab)).toBe(true);
      expect(NAV_ITEMS.some(item => item.id === tab)).toBe(false);
      for (const role of Object.keys(existing) as UserRole[]) expect(ROLE_NAV[role]).not.toContain(tab);
      for (const tabs of Object.values(roleNav(false))) expect(tabs).not.toContain(tab);
    }
  });
  it('removes the standalone Live Build Room destination', () => {
    expect(ARCHIVED_NAV_ITEMS.some(item => (item.id as string) === 'live_build_room')).toBe(false);
    expect(NAV_ITEMS.some(item => (item.id as string) === 'live_build_room')).toBe(false);
    for (const role of Object.keys(existing) as UserRole[]) expect(ROLE_NAV[role]).not.toContain('live_build_room');
  });
  it('places the agent directory under Resources for every internal AI-enabled role', () => {
    for (const role of ['dev', 'pm', 'admin'] as const) {
      expect(sectionsFor(role).find(group => group.section.id === 'resources')?.items.map(item => item.id)).toContain('agents');
      expect(sectionsFor(role).find(group => group.section.id === 'automation')?.items.map(item => item.id) ?? []).not.toContain('agents');
    }
  });
});

describe('AI tooling for project managers and admins is desktop-only', () => {
  const web = roleNav(false);
  const desktopNav = roleNav(true);

  it('turns AI features on per role and runtime', () => {
    for (const role of ['pm', 'admin'] as const) {
      expect(aiFeaturesEnabled(role, true)).toBe(true);
      expect(aiFeaturesEnabled(role, false)).toBe(false);
    }
    for (const role of ['client', 'dev'] as const) {
      expect(aiFeaturesEnabled(role, true)).toBe(true);
      expect(aiFeaturesEnabled(role, false)).toBe(true);
    }
  });
  it.each(['pm', 'admin'] as const)('hides every AI destination from a %s on the hosted web app', role => {
    for (const tab of AI_NAV_TABS) expect(web[role]).not.toContain(tab);
    const sections = runtimeSectionsFor(role, false).map(group => group.section.id);
    expect(sections).not.toContain('build');
    expect(sections).not.toContain('resources');
    expect(sections).not.toContain('operations');
    // Everything else they work with stays, and they land on the same page.
    expect(web[role]).toEqual(desktopNav[role].filter(tab => !AI_NAV_TABS.includes(tab)));
    expect(web[role].length).toBeGreaterThan(0);
    expect(runtimeLandingTab(role, false)).toBe(runtimeLandingTab(role, true));
  });
  it.each(['pm', 'admin'] as const)('gives a %s Chat, Agents and Integrations in the desktop app', role => {
    for (const tab of ['chat', 'agents', 'skills'] as const) expect(desktopNav[role]).toContain(tab);
  });
  it('leaves every other role the same on the web and the desktop', () => {
    for (const role of ['client', 'dev'] as const) expect(web[role]).toEqual(desktopNav[role]);
  });
});

describe('Clients section for project managers', () => {
  const ids = (role: UserRole, section: string) => sectionsFor(role).find(group => group.section.id === section)?.items.map(item => item.id) ?? [];
  it('keeps clients, inquiries, tasks, and projects in their own navigation groups', () => {
    expect(ids('pm', 'clients')).toEqual(['clients']);
    expect(ids('pm', 'requests')).toEqual(['inquiries']);
    expect(ids('pm', 'projects')).toEqual(['issues', 'projects']);
    expect(sectionsFor('pm').map(group => group.section.id)).not.toContain('delivery');
  });
  it('shows Clients on the web and in the desktop app alike: it is not AI tooling', () => {
    expect(roleNav(false).pm).toContain('clients');
    expect(roleNav(true).pm).toContain('clients');
  });
  it('gives Clients to project managers only', () => {
    for (const role of ['client', 'dev', 'admin'] as const) expect(ROLE_NAV[role]).not.toContain('clients');
  });
});
