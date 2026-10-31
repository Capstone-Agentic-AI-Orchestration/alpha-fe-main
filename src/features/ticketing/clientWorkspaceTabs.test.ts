import { describe, expect, it } from 'vitest';
import { clientWorkspaceTabsReducer as reduce, initialClientTabs } from './clientWorkspaceTabs';

describe('client workspace tabs', () => {
  it('opens duplicate destinations with independent request selections and filters', () => {
    let state = reduce(initialClientTabs(), { type: 'open', id: 'first', page: 'requests' });
    state = reduce(state, { type: 'update', id: 'first', update: navigation => ({ ...navigation, selectedId: 'request-a', filter: 'history', searchInput: 'report', replyDrafts: { 'workspace:request-a': 'Unsent reply' } }) });
    state = reduce(state, { type: 'open', id: 'second', page: 'requests' });
    expect(state.activeId).toBe('second');
    expect(state.items[2].navigation).toMatchObject({ selectedId: null, filter: 'all', searchInput: '', replyDrafts: {} });
    state = reduce(state, { type: 'activate', id: 'first' });
    expect(state.items.find(tab => tab.id === state.activeId)?.navigation).toMatchObject({ selectedId: 'request-a', filter: 'history', searchInput: 'report', replyDrafts: { 'workspace:request-a': 'Unsent reply' } });
  });

  it('keeps the active tab when closing a background tab and selects a remaining tab when closing the active one', () => {
    let state = reduce(initialClientTabs(), { type: 'open', id: 'projects', page: 'projects' });
    state = reduce(state, { type: 'open', id: 'requests', page: 'requests' });
    state = reduce(state, { type: 'close', id: 'projects', fallbackId: 'unused' });
    expect(state.activeId).toBe('requests');
    state = reduce(state, { type: 'close', id: 'requests', fallbackId: 'unused' });
    expect(state.activeId).toBe('client-tab-default');
  });

  it('replaces the final closed tab with a fresh Overview', () => {
    const state = reduce(initialClientTabs('needs_client'), { type: 'close', id: 'client-tab-default', fallbackId: 'fresh' });
    expect(state.items).toHaveLength(1);
    expect(state.activeId).toBe('fresh');
    expect(state.items[0].navigation).toMatchObject({ page: 'overview', filter: 'all' });
  });

  it('does not restore a closed tab when an earlier request completes', () => {
    let state = reduce(initialClientTabs(), { type: 'open', id: 'closed', page: 'requests' });
    state = reduce(state, { type: 'close', id: 'closed', fallbackId: 'unused' });
    state = reduce(state, { type: 'update', id: 'closed', update: navigation => ({ ...navigation, selectedId: 'late-response' }) });
    expect(state.items).toHaveLength(1);
    expect(state.items[0].navigation.selectedId).toBeNull();
  });

  it('clears every tab and its selections when the client session ends', () => {
    let state = reduce(initialClientTabs(), { type: 'open', id: 'projects', page: 'projects' });
    state = reduce(state, { type: 'update', id: 'projects', update: navigation => ({ ...navigation, selectedProjectKey: 'private-project' }) });
    expect(reduce(state, { type: 'reset' })).toEqual(initialClientTabs());
  });
});
