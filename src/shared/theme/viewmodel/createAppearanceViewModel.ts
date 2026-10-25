import { DEFAULT_THEME_ID, isThemeId, normalizeThemeId } from '../model/registry';
import type { ThemeId, ThemePreferenceStore } from '../model/types';

export interface AppearanceSnapshot { themeId: ThemeId; persistenceError: string | null }
/** Observable view state/actions. No React, DOM, storage implementation or API dependency. */
export function createAppearanceViewModel(store: ThemePreferenceStore) {
  let snapshot: AppearanceSnapshot = { themeId: store.read(), persistenceError: null };
  let sequence = 0, pending = 0;
  let writes = Promise.resolve();
  const listeners = new Set<() => void>();
  const publish = (next: AppearanceSnapshot) => { snapshot = next; listeners.forEach(listener=>listener()); };
  const selectTheme = (value: ThemeId) => {
    if(!isThemeId(value)) return Promise.resolve();
    const request = ++sequence;
    pending++;
    publish({themeId:value,persistenceError:null});
    // Keep native persistence ordered during rapid selection; do not let old callbacks undo the UI.
    const attempt = writes.then(()=>store.write(value));
    writes = attempt.catch(()=>undefined);
    return attempt.catch(() => {
      if(request===sequence) publish({...snapshot,persistenceError:'Theme applied, but it could not be saved. Try selecting it again.'});
    }).finally(()=>{pending--;});
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener:()=>void) => {listeners.add(listener);return ()=>{listeners.delete(listener);};},
    connect: () => store.subscribe(id => {if(!pending) publish({themeId:normalizeThemeId(id),persistenceError:null});}),
    selectTheme,
    resetTheme: () => selectTheme(DEFAULT_THEME_ID),
  };
}
export type AppearanceViewModel = ReturnType<typeof createAppearanceViewModel>;
