import { useReducer, type Dispatch, type SetStateAction } from 'react';
import type { ClientProjectRequestItem, ClientTicketQueueOptions } from './clientApi';

type ClientPortalFilter = NonNullable<ClientTicketQueueOptions['filter']>;

export type ClientPage = 'overview' | 'projects' | 'requests';
interface Navigation {
  page: ClientPage;
  selectedProjectKey: string | null;
  selectedId: string | null;
  selectedWorkspaceId: string | null;
  selectedItemFallback: ClientProjectRequestItem | null;
  filter: ClientPortalFilter;
  searchInput: string;
  search: string;
  replyDrafts: Record<string, string>;
  returnToProjects: boolean;
  navigationCollapsed: boolean;
  requestListShown: boolean;
  notificationProjectFocus: number;
}
interface Tab { id: string; navigation: Navigation }
interface Tabs { items: Tab[]; activeId: string }
type Action = { type: 'open'; id: string; page: ClientPage }
  | { type: 'activate'; id: string }
  | { type: 'close'; id: string; fallbackId: string }
  | { type: 'update'; id: string; update: (navigation: Navigation) => Navigation }
  | { type: 'reset' };

export function initialClientTabs(filter: ClientPortalFilter = 'all'): Tabs {
  return { items: [createTab('client-tab-default', 'overview', filter)], activeId: 'client-tab-default' };
}
function createTab(id: string, page: ClientPage, filter: ClientPortalFilter = 'all'): Tab {
  return { id, navigation: { page, selectedProjectKey: null, selectedId: null, selectedWorkspaceId: null,
    selectedItemFallback: null, filter, searchInput: '', search: '', replyDrafts: {}, returnToProjects: false,
    navigationCollapsed: false, requestListShown: true, notificationProjectFocus: 0 } };
}
export function clientWorkspaceTabsReducer(state: Tabs, action: Action): Tabs {
  switch (action.type) {
    case 'open': return { items: [...state.items, createTab(action.id, action.page)], activeId: action.id };
    case 'activate': return state.items.some(tab => tab.id === action.id) ? { ...state, activeId: action.id } : state;
    case 'update': return { ...state, items: state.items.map(tab => tab.id === action.id ? { ...tab, navigation: action.update(tab.navigation) } : tab) };
    case 'close': {
      const remaining = state.items.filter(tab => tab.id !== action.id);
      if (!remaining.length) return { items: [createTab(action.fallbackId, 'overview')], activeId: action.fallbackId };
      return { items: remaining, activeId: state.activeId === action.id ? remaining[remaining.length - 1].id : state.activeId };
    }
    case 'reset': return initialClientTabs();
  }
}

export function useClientWorkspaceTabs(initialFilter: ClientPortalFilter) {
  const [tabs, dispatch] = useReducer(clientWorkspaceTabsReducer, initialFilter, initialClientTabs);
  const activeTab = tabs.items.find(tab => tab.id === tabs.activeId)!;
  function tabState<K extends keyof Navigation>(key: K): [Navigation[K], Dispatch<SetStateAction<Navigation[K]>>] {
    return [activeTab.navigation[key], value => dispatch({ type: 'update', id: activeTab.id,
      update: navigation => ({ ...navigation, [key]: typeof value === 'function'
        ? (value as (previous: Navigation[K]) => Navigation[K])(navigation[key]) : value }) })];
  }
  return { tabs: tabs.items, activeTabId: activeTab.id, tabState,
    selectProject: (id: string, selectedProjectKey: string | null) => dispatch({ type: 'update', id, update: navigation => ({ ...navigation, selectedProjectKey }) }),
    openTab: (page: ClientPage) => dispatch({ type: 'open', id: crypto.randomUUID(), page }),
    activateTab: (id: string) => dispatch({ type: 'activate', id }),
    closeTab: (id: string) => dispatch({ type: 'close', id, fallbackId: crypto.randomUUID() }),
    resetTabs: () => dispatch({ type: 'reset' }) };
}
