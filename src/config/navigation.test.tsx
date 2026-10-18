import { describe, expect, it } from 'vitest';
import type { NavigationTab, UserRole } from '@/shared/types';
import { landingTab, NAV_ITEMS, ROLE_NAV, sectionsFor } from './navigation';

/** Navigation destinations retained after archiving the PM/admin Overview entry. */
const existing: Record<UserRole, NavigationTab[]> = {
  client: ['portal', 'intake', 'documents', 'inbox', 'chat', 'settings'],
  dev: ['issues', 'projects', 'agents', 'squads', 'live_build_room', 'deployments', 'runtimes', 'skills', 'inbox', 'chat', 'documents', 'settings'],
  pm: ['issues', 'projects', 'documents', 'inbox', 'chat', 'agents', 'squads', 'live_build_room', 'deployments', 'runtimes', 'skills', 'analytics', 'settings'],
  admin: ['issues', 'projects', 'documents', 'inbox', 'chat', 'agents', 'squads', 'live_build_room', 'deployments', 'runtimes', 'skills', 'analytics', 'settings'],
};
/** Existing sidebar ordering differs from ROLE_NAV; preserve it independently. */
const existingVisible: Record<UserRole, NavigationTab[]> = {
  client: ['portal', 'intake', 'inbox', 'chat', 'documents', 'settings'],
  dev: ['issues', 'projects', 'deployments', 'agents', 'squads', 'live_build_room', 'runtimes', 'skills', 'inbox', 'chat', 'documents', 'settings'],
  // Existing PM/admin grouping omits Specifications despite allowing its route.
  // That unrelated baseline gap is not introduced or silently fixed by ticketing.
  pm: ['projects', 'issues', 'inbox', 'chat', 'agents', 'squads', 'live_build_room', 'runtimes', 'skills', 'deployments', 'analytics', 'settings'],
  admin: ['projects', 'issues', 'inbox', 'chat', 'agents', 'squads', 'live_build_room', 'runtimes', 'skills', 'deployments', 'analytics', 'settings'],
};
describe('existing navigation compatibility', () => {
  it.each(Object.keys(existing) as UserRole[])('preserves every existing %s destination and landing page', role => {
    expect(ROLE_NAV[role].filter(tab => tab !== 'tickets')).toEqual(existing[role]);
    expect(landingTab(role)).toBe(existing[role][0]);
    const visible = sectionsFor(role).flatMap(group => group.items.map(item => item.id));
    expect(visible.filter(tab => tab !== 'tickets')).toEqual(existingVisible[role]);
    expect(visible.every(tab => ROLE_NAV[role].includes(tab))).toBe(true);
    expect(visible.length).toBe(new Set(visible).size);
  });
  it('adds Tickets only to PM navigation without replacing Issues, Chat or Documents', () => {
    expect(ROLE_NAV.pm).toContain('tickets');
    expect(sectionsFor('pm').flatMap(group => group.items.map(item => item.id))).toContain('tickets');
    for (const role of ['client', 'dev', 'admin'] as const) expect(ROLE_NAV[role]).not.toContain('tickets');
  });
  it('labels developer squads as a workspace-shared catalogue', () => {
    const squads = NAV_ITEMS.find(item => item.id === 'squads');
    expect(squads?.labels?.dev).toBe('Workspace Squads');
    expect(squads?.labels?.dev).not.toMatch(/^My /);
  });
});
