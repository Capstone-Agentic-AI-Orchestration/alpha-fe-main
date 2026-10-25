import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { desktop } from '@/shared/desktop';
import { DEFAULT_THEME_ID, getTheme, THEMES } from '../model/registry';
import { createPreferenceStore } from '../model/preferenceStore';
import type { ResolvedTheme, ThemeId } from '../model/types';
import { createAppearanceViewModel, type AppearanceViewModel } from './createAppearanceViewModel';

interface ThemeState {
  themeId: ThemeId;
  theme: ResolvedTheme;
  themes: readonly ResolvedTheme[];
  persistenceError: string | null;
  setTheme: (id: ThemeId) => Promise<void>;
  resetTheme: () => Promise<void>;
}
const fallback: ThemeState = {themeId:DEFAULT_THEME_ID,theme:getTheme(DEFAULT_THEME_ID),themes:THEMES,persistenceError:null,setTheme:async()=>undefined,resetTheme:async()=>undefined};
const Context = createContext<ThemeState>(fallback);
export function applyDocumentTheme(theme: ResolvedTheme, root = document.documentElement) {
  root.dataset.theme = theme.id;
  root.classList.toggle('dark',theme.mode==='dark');
  root.style.colorScheme=theme.mode;
}
export function ThemeProvider({children,viewModel:provided,enabled=true}: {children:React.ReactNode;viewModel?:AppearanceViewModel;enabled?:boolean}) {
  const [model] = useState(()=>provided ?? createAppearanceViewModel(createPreferenceStore(window, desktop)));
  const snapshot = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const theme = getTheme(enabled ? snapshot.themeId : DEFAULT_THEME_ID);
  useEffect(()=>model.connect(),[model]);
  useLayoutEffect(()=>{applyDocumentTheme(theme);},[theme]);
  const value = useMemo<ThemeState>(()=>({...snapshot,themeId:theme.id,theme,themes:THEMES,setTheme:model.selectTheme,resetTheme:model.resetTheme}),[snapshot,theme,model]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
/** Most DOM consumers only need semantic CSS. Controls and graphics use this hook. */
export const useTheme = () => useContext(Context);
