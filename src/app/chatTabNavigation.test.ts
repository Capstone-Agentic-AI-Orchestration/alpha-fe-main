import { describe, expect, it } from 'vitest';
import type { TabItem } from '@/shared/types';
import { chatTabForThread } from './chatTabNavigation';

const tasks: TabItem = { id: 'tasks', view: 'issues' };
const chat: TabItem = { id: 'chat', view: 'chat', sessionState: { activeThreadId: 'thread-a' } };
const history: TabItem = { id: 'history', view: 'chat', sessionState: { 'chat.history': true } };

describe('opening a chat from navigation', () => {
  it('focuses the tab already displaying the selected conversation', () => {
    expect(chatTabForThread([tasks, history, chat], history, 'thread-a')).toBe(chat);
  });

  it('switches conversations in the active Chat tab, including from All chats', () => {
    expect(chatTabForThread([tasks, chat, history], chat, 'thread-b')).toBe(chat);
    expect(chatTabForThread([tasks, chat, history], history, 'thread-b')).toBe(history);
  });

  it('reuses an existing Chat tab from another view and falls back to the active tab', () => {
    expect(chatTabForThread([tasks, chat], tasks, 'thread-b')).toBe(chat);
    expect(chatTabForThread([tasks], tasks, 'thread-b')).toBe(tasks);
  });
});
