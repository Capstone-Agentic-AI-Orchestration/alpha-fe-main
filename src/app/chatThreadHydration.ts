import type { ChatThread } from '@/shared/types';

/**
 * Thread list endpoints intentionally omit transcript rows. Keep the local
 * transcript while hydrating the durable thread metadata, then let the active
 * thread refresh from the server when it is opened.
 */
export function mergeThreadsWithCachedMessages(
  serverThreads: ChatThread[],
  cachedThreads: ChatThread[]
): ChatThread[] {
  const cachedMessages = new Map(cachedThreads.map(thread => [thread.id, thread.messages]));
  return serverThreads.map(thread => ({
    ...thread,
    messages: thread.messages ?? cachedMessages.get(thread.id)
  }));
}
