import { describe, expect, it } from 'vitest';
import type { ChatThread } from '@/shared/types';
import { mergeThreadsWithCachedMessages } from './chatThreadHydration';

const thread = (id: string, messages?: ChatThread['messages']): ChatThread => ({
  id,
  title: id,
  agentIds: [],
  lastMessageAt: '2026-10-18T00:00:00.000Z',
  pinned: false,
  messages
});

describe('mergeThreadsWithCachedMessages', () => {
  it('retains cached transcripts when a server refresh returns thread metadata only', () => {
    const transcript = [{
      id: 'm-1',
      threadId: 'thread-a',
      senderType: 'user' as const,
      senderName: 'Francis',
      content: 'Build the calculator',
      timestamp: '2026-10-18T00:00:00.000Z'
    }];

    expect(mergeThreadsWithCachedMessages(
      [thread('thread-a'), thread('thread-b')],
      [thread('thread-a', transcript)]
    )).toEqual([thread('thread-a', transcript), thread('thread-b')]);
  });

  it('prefers a transcript supplied by the server', () => {
    const serverMessages = [{
      id: 'server-message',
      threadId: 'thread-a',
      senderType: 'agent' as const,
      senderName: 'Alpha',
      content: 'Saved on the server',
      timestamp: '2026-10-18T00:00:00.000Z'
    }];
    const cachedMessages = [{
      id: 'stale-message',
      threadId: 'thread-a',
      senderType: 'user' as const,
      senderName: 'Francis',
      content: 'Stale local copy',
      timestamp: '2026-10-17T00:00:00.000Z'
    }];

    expect(mergeThreadsWithCachedMessages(
      [thread('thread-a', serverMessages)],
      [thread('thread-a', cachedMessages)]
    )[0].messages).toEqual(serverMessages);
  });
});
