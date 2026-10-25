import type { ClientTicketMessage } from './clientApi';

/** Refresh visible portals without overlapping requests or polling hidden tabs. */
export function startClientAutoRefresh(refresh: () => Promise<void>): () => void {
  let stopped = false;
  let busy = false;
  const tick = async () => {
    if (stopped || busy || document.visibilityState !== 'visible') return;
    busy = true;
    try { await refresh(); } catch { /* The portal owns the visible error state. */ }
    finally { busy = false; }
  };
  const timer = window.setInterval(() => { void tick(); }, 30_000);
  const visible = () => { void tick(); };
  document.addEventListener('visibilitychange', visible);
  return () => { stopped = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
}

/** Keep previously loaded history while adding the latest server messages. */
export function mergeClientMessages(previous: ClientTicketMessage[], latest: ClientTicketMessage[]): ClientTicketMessage[] {
  const messages = new Map(previous.map(message => [message.id, message]));
  for (const message of latest) messages.set(message.id, message);
  const ordered = [...messages.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
  return ordered.length === previous.length && ordered.every((message, index) => {
    const before = previous[index];
    return before.id === message.id && before.author === message.author && before.body === message.body && before.createdAt === message.createdAt;
  }) ? previous : ordered;
}
