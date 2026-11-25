import { useEffect, useState } from 'react';
import { runnerSocket } from '@/shared/services/runnerSocket';

interface LiveReplyEvent {
  threadId: string;
  text: string;
}

/**
 * Alpha's reply in this thread so far, while Alpha is still writing it.
 *
 * The daemon sends `chat_turn.text` with the whole reply so far a few times a
 * second. Only this view listens, so a streaming reply re-renders the
 * conversation alone and leaves the rest of the app still. The finished reply
 * arrives as a normal message and replaces this text. Empty when nothing has
 * been written yet, so the caller can keep showing that Alpha is working.
 */
export function useLiveReplyText(threadId: string | undefined, replying: boolean): string {
  const [live, setLive] = useState<LiveReplyEvent | null>(null);

  // A new turn or another thread starts from nothing.
  useEffect(() => setLive(null), [threadId, replying]);

  useEffect(() => {
    if (!threadId || !replying) return undefined;
    return runnerSocket.on('chat_turn.text', (event: LiveReplyEvent) => {
      if (event?.threadId === threadId && typeof event.text === 'string') setLive(event);
    });
  }, [threadId, replying]);

  return live && live.threadId === threadId ? live.text : '';
}
