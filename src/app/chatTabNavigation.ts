import type { TabItem } from '@/shared/types';

export function chatTabForThread(tabs: readonly TabItem[], currentTab: TabItem, threadId: string): TabItem {
  // An already open conversation may have a draft or other state in that tab.
  const openThread = tabs.find(tab => tab.view === 'chat' && !tab.sessionState?.['chat.history']
    && tab.sessionState?.activeThreadId === threadId);
  if (openThread) return openThread;
  if (currentTab.view === 'chat') return currentTab;
  return tabs.find(tab => tab.view === 'chat') ?? currentTab;
}
