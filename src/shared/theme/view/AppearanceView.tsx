import { Check } from 'lucide-react';
import type { AppearancePresentation } from '../viewmodel/useAppearanceViewModel';

/** Presentation only. All choices, selection, persistence and errors come from the view model. */
export function AppearanceView({options,selectTheme,resetTheme,persistenceError}: AppearancePresentation) {
  return <section aria-labelledby="appearance-title" className="space-y-5">
    <div className="flex items-start justify-between gap-4">
      <div><h3 id="appearance-title" className="text-base font-semibold text-content">Workspace theme</h3><p className="mt-1 text-sm text-content-secondary">Choose your appearance. It applies immediately across your chats and workspaces on this device.</p></div>
      <button type="button" onClick={()=>void resetTheme()} className="shrink-0 rounded-lg border border-control px-3 py-2 text-xs text-content hover:bg-selected focus-visible:ring-2 focus-visible:ring-focus">Reset to default</button>
    </div>
    <div role="group" aria-label="Available themes" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {options.map(option=><button key={option.id} type="button" aria-pressed={option.selected} aria-label={`${option.name}, ${option.modeLabel}${option.isDefault?', default':''}`} onClick={()=>void selectTheme(option.id)}
        className={'min-w-0 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus '+(option.selected?'border-link bg-selected':'border-divider bg-surface hover:border-control')}>
        <div aria-hidden="true" className="relative mb-3 overflow-hidden rounded-lg border p-3" style={option.preview}>
          <div className="mb-3 flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{background:option.accent}}/><span className="text-[10px] font-medium">Alpha</span></div>
          <div className="flex gap-2"><div className="w-6 rounded py-2" style={{background:option.panelColor}}><div className="mx-auto h-8 w-0.5 rounded" style={{background:option.accent}}/></div><div className="min-w-0 flex-1"><div className="text-[11px] font-medium">Your workspace, your theme.</div><div className="mt-1 text-[10px]" style={{color:option.textColor}}>Plans, conversations and reviews</div><div className="mt-3 h-5 rounded border px-2" style={{background:option.panelColor,borderColor:option.preview.borderColor}}><div className="mt-2 h-0.5 w-2/3 rounded" style={{background:option.accent}}/></div></div></div>
        </div>
        <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-content">{option.name}</span>{option.selected&&<Check aria-hidden="true" className="h-4 w-4 text-link"/>}</div>
        <p className="mt-1 text-[11px] text-content-secondary">{option.modeLabel}{option.isDefault?' · Default':''}</p>
        <div aria-hidden="true" className="mt-3 flex gap-1.5">{option.colors.map((color,index)=><span key={index} className="h-4 w-7 rounded border border-control/30" style={{background:color}}/>)}</div>
      </button>)}
    </div>
    {persistenceError&&<p role="alert" className="text-sm text-status-danger">{persistenceError}</p>}
    <p className="text-xs text-content-muted">Fonts and layout stay consistent. Websites in the preview panel keep their own design.</p>
  </section>;
}
