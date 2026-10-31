import { describe, expect, it } from 'vitest';
import type { ChatMessage, ChatThread } from '@/shared/types';
import { applyChatReplies, mergeLoadedTranscript, mergeThreadsWithCachedMessages } from './chatThreadHydration';

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

const message = (id: string, senderType: ChatMessage['senderType'], content: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  senderType,
  senderName: senderType === 'user' ? 'Lloyd' : 'Alpha',
  content,
  timestamp: '2026-10-31T19:43:37.000Z',
  ...extra
});

describe('first reply in a new conversation', () => {
  const question = message('msg-user', 'user', 'can you see this project and see the repositories?');
  const placeholder = message('msg-placeholder', 'agent', 'Thinking...', { isStreaming: true });
  const reply = message('msg-reply', 'agent', 'Yes. The selected project is capstone-website.');

  it('keeps the reply when the transcript is read back while the turn is still running', () => {
    // The daemon has saved the question but not the reply yet.
    const afterRead = mergeLoadedTranscript([question], [question, placeholder]);
    expect(afterRead).toEqual([question, placeholder]);

    expect(applyChatReplies(afterRead, placeholder.id, [reply])).toEqual([question, reply]);
  });

  it('still shows the reply when the placeholder was removed by another reload', () => {
    expect(applyChatReplies([question], placeholder.id, [reply])).toEqual([question, reply]);
  });

  it('does not show a reply twice when a read already brought it in', () => {
    const readBack = message(reply.id, 'agent', reply.content);
    expect(applyChatReplies([question, placeholder, readBack], placeholder.id, [reply])).toEqual([question, reply]);
  });

  it('keeps several agent replies in the order they spoke', () => {
    const second = message('msg-reply-2', 'agent', 'And the backend is on Render.');
    expect(applyChatReplies([question, placeholder], placeholder.id, [reply, second])).toEqual([question, reply, second]);
  });

  it('drops nothing local once the daemon has saved the reply', () => {
    expect(mergeLoadedTranscript([question, reply], [question])).toEqual([question, reply]);
  });
});
