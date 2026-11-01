import { describe, expect, it } from 'vitest';
import type { NavigationTab, UserRole } from '@/shared/types';
import { ARCHIVED_NAV_ITEMS, landingTab, NAV_ITEMS, ROLE_NAV, sectionsFor } from './navigation';
import { AI_FEATURES_BY_ROLE, AI_NAV_TABS } from './features';

/**
 * Navigation destinations retained after archiving standalone specifications.
 * Project managers see the AI destinations in review-only mode (config/features.ts).
 */
const existing: Record<UserRole, NavigationTab[]> = {
  client: ['portal', 'intake', 'chat', 'settings'],
  dev: ['issues', 'projects', 'agents', 'runtimes', 'skills', 'chat', 'settings'],
  pm: ['issues', 'projects', 'chat', 'agents', 'runtimes', 'skills', 'analytics', 'settings'],
  admin: ['issues', 'projects', 'chat', 'agents', 'runtimes', 'skills', 'analytics', 'operations', 'settings'],
};
/**
 * Existing sidebar ordering differs from ROLE_NAV; preserve it independently.
 * Internal roles find Chat first, under Build, since it is where work is planned and built.
 */
const existingVisible: Record<UserRole, NavigationTab[]> = {
  client: ['portal', 'intake', 'chat', 'settings'],
  dev: ['chat', 'issues', 'projects', 'agents', 'runtimes', 'skills', 'settings'],
  pm: ['chat', 'projects', 'issues', 'agents', 'runtimes', 'skills', 'analytics', 'settings'],
  admin: ['chat', 'projects', 'issues', 'agents', 'runtimes', 'skills', 'analytics', 'operations', 'settings'],
};
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
    expect(ROLE_NAV[role].filter(tab => tab !== 'tickets')).toEqual(existing[role]);
    expect(landingTab(role)).toBe(existing[role][0]);
    const visible = sectionsFor(role).flatMap(group => group.items.map(item => item.id));
    expect(visible.filter(tab => tab !== 'tickets')).toEqual(existingVisible[role]);
    expect(visible.every(tab => ROLE_NAV[role].includes(tab))).toBe(true);
    expect(visible.length).toBe(new Set(visible).size);
  });
  it('adds Tickets only to PM navigation without replacing Tasks or Chat', () => {
    expect(ROLE_NAV.pm).toContain('tickets');
    expect(sectionsFor('pm').flatMap(group => group.items.map(item => item.id))).toContain('tickets');
    for (const role of ['client', 'dev', 'admin'] as const) expect(ROLE_NAV[role]).not.toContain('tickets');
  });
  it('places the Operations Center in Administration for workspace admins only', () => {
    expect(NAV_ITEMS.find(item => item.id === 'operations')).toMatchObject({ title: 'Operations Center', section: 'administration' });
    expect(sectionsFor('admin').find(group => group.section.id === 'administration')?.items.map(item => item.id)).toContain('operations');
    for (const role of ['client', 'dev', 'pm'] as const) expect(ROLE_NAV[role]).not.toContain('operations');
  });
  it('has no squads page; the Orchestrator assigns agents per task', () => {
    expect(NAV_ITEMS.some(item => (item.id as string) === 'squads')).toBe(false);
  });
  it('shows PM AI destinations while keeping their actions capability-gated', () => {
    expect(AI_FEATURES_BY_ROLE.pm).toBe(true);
    for (const tab of AI_NAV_TABS) {
      expect(ROLE_NAV.pm).toContain(tab);
      if (NAV_ITEMS.some(item => item.id === tab)) {
        expect(ROLE_NAV.dev).toContain(tab);
        expect(ROLE_NAV.admin).toContain(tab);
      }
    }
    expect(sectionsFor('pm').map(group => group.section.id)).not.toContain('automation');
  });
  it('archives specifications for every role and all shared menus', () => {
    for (const tab of ['documents'] as const) {
      expect(ARCHIVED_NAV_ITEMS.some(item => item.id === tab)).toBe(true);
      expect(NAV_ITEMS.some(item => item.id === tab)).toBe(false);
      for (const role of Object.keys(existing) as UserRole[]) expect(ROLE_NAV[role]).not.toContain(tab);
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
