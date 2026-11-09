import { LoadingRows } from '@/shared/components/ui/skeleton';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ExternalLink, Monitor, RefreshCw, Smartphone, Tablet } from 'lucide-react';
import { qaError, type QaRound, type QaRoundPage } from './projectQaApi';
import './projectQaStudio.css';
export const label=(value:string)=>value.replace(/_/g,' ').replace(/^./,character=>character.toUpperCase());
type Preview=QaRound['preview'];

const DEVICE_SIZES={tablet:{width:768,height:1024},phone:{width:390,height:844}} as const;
const DESKTOP_MIN_WIDTH=1280,STAGE_GAP=16,BEZEL=6;

/** Real CSS sizes: devices keep their true width (shrinking only when the stage is narrower) and use the available height. */
export function previewViewport(device:'desktop'|'tablet'|'phone',stage:{width:number;height:number}) {
  if(device==='desktop'){const width=Math.max(DESKTOP_MIN_WIDTH,stage.width);const scale=Math.min(1,stage.width/width);
    return {width,height:stage.height/scale,scale};}
  const target=DEVICE_SIZES[device],inset=2*(STAGE_GAP+BEZEL);
  const scale=Math.min(1,Math.max(stage.width-inset,1)/target.width);
  return {width:target.width,height:Math.max(1,Math.min(target.height,(stage.height-inset)/scale)),scale};
}

export function QaPreview({preview,version,audience='pm',toolbarEnd,pending=false}:{preview:Preview|null;version?:string;audience?:'pm'|'client';toolbarEnd?:ReactNode;pending?:boolean}) {
  const client=audience==='client';
  const previewLabel=client?'Project preview':'UAT preview';
  const [device,setDevice]=useState<'desktop'|'tablet'|'phone'>('desktop');
  const [reload,setReload]=useState(0);
  const stage=useRef<HTMLDivElement|null>(null),[size,setSize]=useState({width:1000,height:650});
  useEffect(()=>{if(!stage.current||typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(entries=>{
    const rect=entries[0]?.contentRect;if(rect&&rect.width>0&&rect.height>0)setSize({width:rect.width,height:rect.height});
  });observer.observe(stage.current);return()=>observer.disconnect();},[]);
  const viewport=previewViewport(device,size),scale=viewport.scale;
  const safe=preview&&safePreview(preview.url)?preview:null;
  const [loadedFrame, setLoadedFrame] = useState('');
  const frameKey = safe ? `${safe.url}:${reload}:${device === 'desktop' ? 'desktop' : 'device'}` : '';
  const frameLoading = loadedFrame !== frameKey;
  const screen=safe?.embeddable?<div className="pqa-screen" style={{width:viewport.width*scale,height:viewport.height*scale}}><iframe key={frameKey} onLoad={() => setLoadedFrame(frameKey)} src={safe.url} title={client?'Project application':'Project UAT application'}
    style={{width:viewport.width,height:viewport.height,minHeight:0,transform:`scale(${scale})`,transformOrigin:'top left'}}
    sandbox="allow-scripts allow-forms allow-same-origin allow-popups" referrerPolicy="no-referrer"/>{frameLoading && <LoadingRows label="Loading embedded preview" layout="detail" className="pointer-events-none absolute inset-0 bg-canvas px-5" />}</div>:null;
  return <section className="pqa-preview" aria-label={client?'Project application preview':'UAT application preview'}>
    <div className="pqa-toolbar">{!client&&<><span className="pqa-env">{previewLabel}</span>{version&&<span>{version}</span>}</>}
      <div className="pqa-devices" role="group" aria-label="Preview device">
        {([['desktop',Monitor],['tablet',Tablet],['phone',Smartphone]] as const).map(([value,Icon])=><button key={value} type="button"
          aria-label={`${label(value)} preview`} aria-pressed={device===value} onClick={()=>setDevice(value)}><Icon size={15}/></button>)}
      </div>
      <button type="button" disabled={!safe} aria-label={`Reload ${client?'project preview':'UAT preview'}`} onClick={()=>setReload(value=>value+1)}><RefreshCw size={15}/></button>
      {safe&&<a href={safe.url} target="_blank" rel="noopener noreferrer">Open preview <ExternalLink size={13}/></a>}
      {screen&&<span className="pqa-size">{Math.round(viewport.width)} × {Math.round(viewport.height)}{scale<1?` · ${Math.round(scale*100)}%`:''}</span>}
      {toolbarEnd&&<div className="pqa-toolbar-end">{toolbarEnd}</div>}
    </div>
    <div ref={stage} className="pqa-stage" data-device={device}>
      {pending?<LoadingRows label="Loading project preview" layout="detail" className="w-full px-5" />:screen?(device==='desktop'?screen:<div className="pqa-device">{screen}</div>)
        :<div className="pqa-empty"><Monitor size={30}/><h3>{safe?`Open the ${client?'project':'UAT'} preview in a new tab`:client?'No preview shared yet':'No UAT preview shared yet'}</h3>
          <p>{safe?(safe.reason||'This site does not allow an embedded preview. Keep the checklist open while testing in another tab.'):client?'Your preview will appear here when it is shared.':'Your project manager reviews the UAT build before sharing it here.'}</p>
          {safe&&<a href={safe.url} target="_blank" rel="noopener noreferrer">Open {client?'project':'UAT'} preview <ExternalLink size={14}/></a>}</div>}
    </div>
  </section>;
}
function safePreview(value:string) {try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port
  &&url.hostname.endsWith('.vercel.app')&&url.origin!==window.location.origin;}catch{return false;}}
export function Notice({error,onRetry}:{error:string;onRetry?:()=>void}) {
  return error?<div className="pqa-error" role="alert">{error}{onRetry&&<button type="button" onClick={onRetry}>Reload review</button>}</div>:null;
}
export function History({round}:{round:QaRound}) {
  return <ol className="pqa-history">{round.events.map((event,index)=><li key={`${event.createdAt}:${index}`}>
    <strong>{label(event.action)}</strong><span>{event.author==='pm'?'Project manager':'Client'} · {new Date(event.createdAt).toLocaleString()}</span>
  </li>)}</ol>;
}
export function RoundPicker({page,selected,onChange,onOlder,disabled=false,hideLabel=false}:{page:QaRoundPage|null;selected:string;onChange:(id:string)=>void;onOlder:()=>void;disabled?:boolean;hideLabel?:boolean}) {
  return <div className="pqa-round-picker"><label>{hideLabel?<span className="sr-only">Review round</span>:'Review round'}<select value={selected} disabled={disabled} onChange={event=>onChange(event.target.value)}>
    <option value="">Choose a review</option>{page?.items.map(round=><option key={round.id} value={round.id}>Review {round.number} · {round.title} · {label(round.status)}</option>)}
  </select></label>{page?.nextBefore&&<button type="button" disabled={disabled} onClick={onOlder}>Load older rounds</button>}</div>;
}

export function ReadOnlyChecks({round,extra}:{round:QaRound;extra?:(item:QaRound['items'][number])=>ReactNode}) {
  return <ol className="pqa-checks">{round.items.map(item=><li key={item.id}><strong>{item.title}</strong><span className="pqa-status">{label(item.result.status)}</span>
    {item.steps&&<p>{item.steps}</p>}<p><b>Expected:</b> {item.expectedResult}</p>
    {item.result.notes&&<p><b>Client notes:</b> {item.result.notes}</p>}{item.result.reproduction&&<p><b>Reproduction:</b> {item.result.reproduction}</p>}{extra?.(item)}</li>)}</ol>;
}

/** Panels stay mounted so switching to feedback/history never discards an unsaved result. */
export function StudioPanels({checklist,feedback,history,ariaLabel='Project review panels',actions}:{checklist:ReactNode;feedback:ReactNode;history:ReactNode;ariaLabel?:string;actions?:ReactNode}) {
  const [active,setActive]=useState<'checklist'|'feedback'|'history'>('checklist');
  const base=useId(),tabs=['checklist','feedback','history'] as const;
  const refs=useRef<Partial<Record<typeof active,HTMLButtonElement|null>>>({});
  return <><div className="pqa-panel-tabs" role="tablist" aria-label={ariaLabel}>{tabs.map((value,index)=><button key={value} type="button"
    role="tab" id={`${base}-tab-${value}`} aria-selected={active===value} aria-controls={`${base}-panel-${value}`} tabIndex={active===value?0:-1}
    ref={element=>{refs.current[value]=element;}} onClick={()=>setActive(value)} onKeyDown={event=>{
      const next=event.key==='Home'?tabs[0]:event.key==='End'?tabs[2]:event.key==='ArrowRight'?tabs[(index+1)%3]:event.key==='ArrowLeft'?tabs[(index+2)%3]:null;
      if(next){event.preventDefault();setActive(next);refs.current[next]?.focus();}
    }}>{label(value)}</button>)}{actions}</div>
    {tabs.map(value=><div key={value} role="tabpanel" hidden={active!==value} id={`${base}-panel-${value}`} aria-labelledby={`${base}-tab-${value}`}>
      {value==='checklist'?checklist:value==='feedback'?feedback:history}
    </div>)}
  </>;
}

export function QaEvidence({items,load}:{items:QaRound['evidence'];load:(id:string)=>Promise<Blob>}) {
  const [image,setImage]=useState<{url:string;name:string}|null>(null);const [error,setError]=useState('');
  useEffect(()=>()=>{if(image)URL.revokeObjectURL(image.url);},[image]);
  async function open(item:QaRound['evidence'][number]){setError('');try{const bytes=await load(item.id);setImage({url:URL.createObjectURL(new Blob([bytes],{type:item.contentType})),name:item.filename});}catch(cause){setError(qaError(cause));}}
  return <div className="pqa-evidence">{items.map(item=><button key={item.id} type="button" onClick={()=>void open(item)}>Screenshot: {item.filename}</button>)}
    <Notice error={error}/>{image&&<div><img src={image.url} alt={image.name}/><button type="button" onClick={()=>setImage(null)}>Close screenshot</button></div>}</div>;
}

