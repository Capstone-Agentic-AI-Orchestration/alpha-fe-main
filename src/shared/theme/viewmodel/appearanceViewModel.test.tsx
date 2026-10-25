import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createAppearanceViewModel } from './createAppearanceViewModel';
import { AppearanceView } from '../view/AppearanceView';
import type { ThemeId, ThemePreferenceStore } from '../model/types';
import { THEMES } from '../model/registry';

function store(overrides: Partial<ThemePreferenceStore>={}) {
  let listener:((id:ThemeId)=>void)|undefined;
  return {read:()=> 'alpha-violet' as const,write:vi.fn(async()=>undefined),subscribe:(next:(id:ThemeId)=>void)=>{listener=next;return ()=>{listener=undefined;};},emit:(id:ThemeId)=>listener?.(id),...overrides};
}
describe('appearance view model',()=>{
  it('updates immediately and persists independently of React or the DOM',async()=>{
    const persistence=store(),model=createAppearanceViewModel(persistence),notify=vi.fn();
    model.subscribe(notify);const pending=model.selectTheme('mist');
    expect(model.getSnapshot().themeId).toBe('mist');expect(notify).toHaveBeenCalledOnce();
    await pending;expect(persistence.write).toHaveBeenCalledWith('mist');
  });
  it('keeps live appearance and reports a failed save',async()=>{
    const model=createAppearanceViewModel(store({write:async()=>{throw Error('Permission denied');}}));
    await model.selectTheme('sand');
    expect(model.getSnapshot()).toMatchObject({themeId:'sand',persistenceError:expect.stringContaining('could not be saved')});
  });
  it('serializes rapid selections and ignores obsolete native broadcasts',async()=>{
    const releases:Array<()=>void>=[],writes:ThemeId[]=[];
    const persistence=store({write:(id)=>{writes.push(id);return new Promise<void>(resolve=>releases.push(resolve));}});
    const model=createAppearanceViewModel(persistence);model.connect();
    const first=model.selectTheme('mist'),second=model.selectTheme('forest');
    await Promise.resolve();persistence.emit('mist');expect(model.getSnapshot().themeId).toBe('forest');
    releases.shift()!();await first;await Promise.resolve();
    expect(writes).toEqual(['mist','forest']);releases.shift()!();await second;
    expect(model.getSnapshot().themeId).toBe('forest');
  });
  it('recovers after a failed write and supports reset to default',async()=>{
    const write=vi.fn().mockRejectedValueOnce(Error('Full disk')).mockResolvedValue(undefined);
    const model=createAppearanceViewModel(store({write}));
    await model.selectTheme('mist');await model.resetTheme();
    expect(model.getSnapshot()).toEqual({themeId:'alpha-violet',persistenceError:null});
  });
  it('subscribes across windows and releases its listener',()=>{
    const persistence=store(),model=createAppearanceViewModel(persistence),disconnect=model.connect();
    persistence.emit('graphite');expect(model.getSnapshot().themeId).toBe('graphite');
    disconnect();persistence.emit('mist');expect(model.getSnapshot().themeId).toBe('graphite');
  });
  it('never dispatches an unsupported palette',async()=>{
    const persistence=store(),model=createAppearanceViewModel(persistence);
    await model.selectTheme('__proto__' as ThemeId);
    expect(persistence.write).not.toHaveBeenCalled();
  });
});

describe('appearance view',()=>{
  it('renders all options, exactly one selected choice and accessible immediate actions',()=>{
    const html=renderToStaticMarkup(<AppearanceView options={THEMES.map(t=>({id:t.id,name:t.name,description:t.description,modeLabel:t.mode,isDefault:t.id==='alpha-violet',selected:t.id==='mist',colors:[t.colors.canvas],preview:{backgroundColor:t.colors.canvas,color:t.colors.textPrimary,borderColor:t.colors.divider},panelColor:t.colors.surface,accent:t.colors.accent,textColor:t.colors.textSecondary}))} selectTheme={async()=>undefined} resetTheme={async()=>undefined} persistenceError={null}/>);
    expect(html.match(/aria-pressed=/g)).toHaveLength(8);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toContain('Reset to default');expect(html).toContain('Mist, light');
    expect(html).not.toContain('type="submit"');
  });
});
