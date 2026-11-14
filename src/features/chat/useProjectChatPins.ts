import { useCallback, useSyncExternalStore } from 'react';
import { loadFromStorage, saveToStorage } from '@/shared/lib/storage';

const event = 'alpha:project-chat-pins';
const subscribe = (listener: () => void) => {
  window.addEventListener(event, listener);
  window.addEventListener('storage', listener);
  return () => { window.removeEventListener(event, listener); window.removeEventListener('storage', listener); };
};

export const projectChatStorageKey = (login: string, workspaceId: string | null) =>
  'projectChat:' + JSON.stringify([login, workspaceId ?? 'local']);

export function useProjectChatPins(scope: string) {
  const key = scope + '.pinned';
  // useSyncExternalStore requires a stable snapshot. A string avoids a new
  // array identity on each read and keeps the sidebar and history in sync.
  const snapshot = useSyncExternalStore(subscribe, () => JSON.stringify(loadFromStorage<string[]>(key, [])));
  const update = useCallback((change: (previous: string[]) => string[]) => {
    saveToStorage(key, change(loadFromStorage<string[]>(key, [])));
    window.dispatchEvent(new Event(event));
  }, [key]);
  return [JSON.parse(snapshot) as string[], update] as const;
}
