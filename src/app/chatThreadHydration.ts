import type { ChatMessage, ChatThread } from '@/shared/types';

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

/**
 * Adopt a transcript read from the daemon without losing a reply in flight.
 *
 * The daemon saves the user's message as soon as a send arrives and the reply
 * only when the turn ends. A read that lands in between returns the question
 * without its "Thinking..." placeholder; replacing the transcript wholesale
 * removed the placeholder, so the reply that later replaced it was dropped.
 */
export function mergeLoadedTranscript(
  serverMessages: ChatMessage[],
  localMessages: ChatMessage[] | undefined
): ChatMessage[] {
  const saved = new Set(serverMessages.map(message => message.id));
  const pending = (localMessages ?? []).filter(message => message.isStreaming && !saved.has(message.id));
  return pending.length ? [...serverMessages, ...pending] : serverMessages;
}

/**
 * Put the replies to one send into a transcript.
 *
 * The first reply takes the placeholder's place. A reply that is already in
 * the transcript (read back from the daemon meanwhile) is updated in place,
 * and anything with nowhere to go is appended, so a reply is never dropped
 * and never shown twice.
 */
export function applyChatReplies(
  messages: ChatMessage[],
  placeholderId: string,
  replies: ChatMessage[]
): ChatMessage[] {
  const byId = new Map(replies.map(reply => [reply.id, reply]));
  const placed = new Set<string>();
  const result: ChatMessage[] = [];
  const place = (reply: ChatMessage | undefined) => {
    if (!reply || placed.has(reply.id)) return;
    placed.add(reply.id);
    result.push(reply);
  };

  for (const message of messages) {
    if (message.id === placeholderId) place(replies[0]);
    else if (byId.has(message.id)) place(byId.get(message.id));
    else result.push(message);
  }
  replies.forEach(place);
  return result;
}
