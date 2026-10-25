import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { DEFAULT_THEME_ID, getTheme, normalizeThemeId, THEMES } from './registry';
import { contrastRatio, resolveTheme } from './themeResolver.mjs';
import { APPEARANCE_STORAGE_KEY, browserPreferenceStore, createPreferenceStore, parsePreference } from './preferenceStore';
import type { DesktopBridge } from '@/shared/desktop';
import modes from './modes.json';
import mist from './palettes/mist.json';

describe('theme model',()=>{
  it('provides the eight reviewed palettes, default violet and genuinely light blue Mist',()=>{
    expect(THEMES).toHaveLength(8);
    expect(getTheme(DEFAULT_THEME_ID).colors.canvas).toBe('#09090B');
    expect(getTheme('mist')).toMatchObject({mode:'light',colors:{canvas:'#EFF6FF',accent:'#2563EB'}});
    expect(getTheme('graphite').colors.canvas).toBe('#242426');
  });
  it.each([null,undefined,'unknown','__proto__','constructor',{},1])('rejects unknown stored identity %s',value=>{
    expect(normalizeThemeId(value)).toBe(DEFAULT_THEME_ID);
  });
  it.each(THEMES)('$id has readable opaque text, action and focus pairs',theme=>{
    for(const surface of ['canvas','shell','surface','raised'] as const){
      for(const foreground of ['textPrimary','textSecondary','textMuted','link','success','warning','danger','info'] as const) expect(contrastRatio(theme.colors[foreground],theme.colors[surface])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.colors.focus,theme.colors[surface])).toBeGreaterThanOrEqual(3);
    }
    expect(contrastRatio(theme.colors.onAction,theme.colors.action)).toBeGreaterThanOrEqual(4.5);
    expect(theme.scene.background).toBe(theme.colors.shell);
  });
  it('fails closed for incomplete palettes and CSS-like color payloads',()=>{
    expect(()=>resolveTheme({...mist,colors:{canvas:'#fff'}},modes)).toThrow();
    expect(()=>resolveTheme({...mist,colors:{...mist.colors,canvas:'url(https://example.invalid)'}},modes)).toThrow();
    expect(()=>resolveTheme({...mist,id:'mist--blue'},modes)).toThrow();
    expect(()=>resolveTheme({...mist,name:{}},modes)).toThrow();
    expect(()=>resolveTheme(mist,{...modes,light:{...modes.light,canvas:'#000000'}})).toThrow();
  });
  it.each(['broken','null','{"version":2,"themeId":"mist"}','{"version":1,"themeId":"__proto__"}'])('safely falls back for corrupt preference %s',value=>expect(parsePreference(value)).toBe(DEFAULT_THEME_ID));
  it('does not write any other application preference',async()=>{
    const setItem=vi.fn();
    const store=browserPreferenceStore({localStorage:{getItem:()=>null,setItem},addEventListener:vi.fn(),removeEventListener:vi.fn()} as unknown as Window);
    await store.write('mist');
    expect(setItem).toHaveBeenCalledExactlyOnceWith(APPEARANCE_STORAGE_KEY,JSON.stringify({version:1,themeId:'mist'}));
  });
  it('handles blocked browser reads and surfaces blocked writes',async()=>{
    const target={get localStorage(){throw Error('Storage blocked');},addEventListener:vi.fn(),removeEventListener:vi.fn()} as unknown as Window;
    const store=browserPreferenceStore(target);
    expect(store.read()).toBe(DEFAULT_THEME_ID);
    await expect(store.write('mist')).rejects.toThrow('Storage blocked');
  });
  it('uses native persistence rather than origin-local storage when available',async()=>{
    const setter=vi.fn(async(themeId:string)=>({themeId}));
    const bridge={isDesktop:true,appearanceThemeId:'graphite',setAppearanceTheme:setter} as unknown as DesktopBridge;
    const store=createPreferenceStore({get localStorage(){throw Error('Wrong adapter');}} as unknown as Window,bridge);
    expect(store.read()).toBe('graphite');await store.write('mist');expect(setter).toHaveBeenCalledWith('mist');
  });
});

describe('first-paint bootstrap',()=>{
  const script=readFileSync(new URL('../../../../public/theme-startup.js',import.meta.url),'utf8');
  function boot({saved='mist',hash='#/app',native=false,blocked=false,pathname='/'}={}){
    const root={dataset:{} as Record<string,string>,style:{colorScheme:''},classList:{toggle:vi.fn()}};
    runInNewContext(script,{URLSearchParams,document:{documentElement:root},window:{location:{pathname,hash},alphaDesktop:native?{appearanceThemeId:'sand'}:undefined},get localStorage(){if(blocked)throw Error('Blocked');return{getItem:()=>JSON.stringify({version:1,themeId:saved})};}});
    return root;
  }
  it('applies saved light mode before React',()=>expect(boot().dataset.theme).toBe('mist'));
  it('uses native startup ID even when browser storage is unavailable',()=>expect(boot({native:true,blocked:true}).dataset.theme).toBe('sand'));
  it('keeps public branded entry pages on their original appearance',()=>{
    expect(boot({hash:''}).dataset.theme).toBe(DEFAULT_THEME_ID);
    expect(boot({hash:'#/client/forgot'}).dataset.theme).toBe(DEFAULT_THEME_ID);
    expect(boot({hash:'#/client/activate?token=fixture'}).dataset.theme).toBe(DEFAULT_THEME_ID);
  });
  it('restores appearance for the authenticated client portal before React',()=>expect(boot({hash:'#/client'}).dataset.theme).toBe('mist'));
  it('falls back for inaccessible storage',()=>expect(boot({blocked:true}).dataset.theme).toBe(DEFAULT_THEME_ID));
});
