import { LoadingRows } from '@/shared/components/ui/skeleton';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ExternalLink, Monitor, RefreshCw, Smartphone, Tablet } from 'lucide-react';
import type { QaRound } from './projectQaApi';
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

/** On a phone a desktop-width site would shrink to about a quarter, so clients start in phone view there. */
function initialDevice(client:boolean):'desktop'|'phone' {
  if(!client||typeof window==='undefined'||typeof window.matchMedia!=='function')return 'desktop';
  return window.matchMedia('(max-width: 760px)').matches?'phone':'desktop';
}

type Device='desktop'|'tablet'|'phone';
type PreviewViewport=ReturnType<typeof previewViewport>;
const DEVICES=[['desktop',Monitor],['tablet',Tablet],['phone',Smartphone]] as const;
/** The words the preview uses, for clients and for project managers. */
const PREVIEW_TEXT={
  client:{name:'project',label:'Project preview',reload:'Reload project preview',frame:'Project application',section:'Project application preview',
    none:'No preview shared yet',noneDetail:'Your preview will appear here when it is shared.'},
  pm:{name:'UAT',label:'UAT preview',reload:'Reload UAT preview',frame:'Project UAT application',section:'UAT application preview',
    none:'No UAT preview shared yet',noneDetail:'The project manager reviews the UAT build before sharing it here.'},
} as const;
type PreviewText=typeof PREVIEW_TEXT[keyof typeof PREVIEW_TEXT];

/** `emptyAction` shows beneath the "nothing shared yet" message, such as a way to ask for a preview. */
export function QaPreview({preview,version,audience='pm',toolbarEnd,pending=false,emptyAction}:{preview:Preview|null;version?:string;audience?:'pm'|'client';toolbarEnd?:ReactNode;pending?:boolean;emptyAction?:ReactNode}) {
  const client=audience==='client';
  const text=client?PREVIEW_TEXT.client:PREVIEW_TEXT.pm;
  const [device,setDevice]=useState<Device>(()=>initialDevice(client));
  const [reload,setReload]=useState(0);
  const stage=useRef<HTMLDivElement|null>(null);
  const size=useStageSize(stage);
  const viewport=previewViewport(device,size);
  const safe=preview&&isEmbeddablePreviewUrl(preview.url)?preview:null;
  const frameKey=safe?safe.url+':'+reload+':'+(device==='desktop'?'desktop':'device'):'';
  const screen=safe?.embeddable?<PreviewFrame key={frameKey} url={safe.url} title={text.frame} viewport={viewport}/>:null;
  return <section className="pqa-preview" aria-label={text.section}>
    <div className="pqa-toolbar">{!client&&<><span className="pqa-env">{text.label}</span>{version&&<span>{version}</span>}</>}
      <div className="pqa-devices" role="group" aria-label="Preview device">
        {DEVICES.map(([value,Icon])=><button key={value} type="button" disabled={!safe}
          aria-label={label(value)+' preview'} aria-pressed={device===value} onClick={()=>setDevice(value)}><Icon size={15}/></button>)}
      </div>
      <button type="button" disabled={!safe} aria-label={text.reload} onClick={()=>setReload(value=>value+1)}><RefreshCw size={15}/></button>
      {safe&&<a href={safe.url} target="_blank" rel="noopener noreferrer">Open preview <ExternalLink size={13}/></a>}
      {screen&&<span className="pqa-size">{sizeLabel(viewport)}</span>}
      {toolbarEnd&&<div className="pqa-toolbar-end">{toolbarEnd}</div>}
    </div>
    <div ref={stage} className="pqa-stage" data-device={device}>
      <PreviewStage pending={pending} screen={screen} device={device} safe={safe} text={text} emptyAction={emptyAction}/>
    </div>
  </section>;
}

/** The stage's measured size, kept up to date as the page or window changes. */
function useStageSize(stage:React.RefObject<HTMLDivElement|null>) {
  const [size,setSize]=useState({width:1000,height:650});
  useEffect(()=>{
    if(!stage.current||typeof ResizeObserver==='undefined')return;
    const observer=new ResizeObserver(entries=>{
      const rect=entries[0]?.contentRect;
      if(rect&&rect.width>0&&rect.height>0)setSize({width:rect.width,height:rect.height});
    });
    observer.observe(stage.current);
    return()=>observer.disconnect();
  },[stage]);
  return size;
}

function sizeLabel(viewport:PreviewViewport) {
  const percent=viewport.scale<1?' · '+Math.round(viewport.scale*100)+'%':'';
  return Math.round(viewport.width)+' × '+Math.round(viewport.height)+percent;
}

/** The site itself, drawn at its real CSS size and scaled to fit, with a loading cover until it loads. */
function PreviewFrame({url,title,viewport}:{url:string;title:string;viewport:PreviewViewport}) {
  const [loaded,setLoaded]=useState(false);
  const {width,height,scale}=viewport;
  return <div className="pqa-screen" style={{width:width*scale,height:height*scale}}><iframe onLoad={()=>setLoaded(true)} src={url} title={title}
    style={{width,height,minHeight:0,transform:'scale('+scale+')',transformOrigin:'top left'}}
    sandbox="allow-scripts allow-forms allow-same-origin allow-popups" referrerPolicy="no-referrer"/>
    {!loaded&&<LoadingRows label="Loading embedded preview" layout="detail" className="pointer-events-none absolute inset-0 bg-canvas px-5" />}</div>;
}

function PreviewStage({pending,screen,device,safe,text,emptyAction}:{pending:boolean;screen:ReactNode;device:Device;safe:Preview|null;text:PreviewText;emptyAction?:ReactNode}) {
  if(pending)return <LoadingRows label="Loading project preview" layout="detail" className="w-full px-5" />;
  if(screen)return device==='desktop'?<>{screen}</>:<div className="pqa-device">{screen}</div>;
  if(!safe)return <div className="pqa-empty"><Monitor size={30}/><h3>{text.none}</h3><p>{text.noneDetail}</p>{emptyAction}</div>;
  return <div className="pqa-empty"><Monitor size={30}/><h3>{'Open the '+text.name+' preview in a new tab'}</h3>
    <p>{safe.reason||'This site does not allow an embedded preview. Open it in a new tab to test it.'}</p>
    <a href={safe.url} target="_blank" rel="noopener noreferrer">Open {text.name} preview <ExternalLink size={14}/></a></div>;
}
/** Only a project's own hosted preview (an https *.vercel.app site on another origin) may be shown inside the portal. */
export function isEmbeddablePreviewUrl(value:string) {try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port
  &&url.hostname.endsWith('.vercel.app')&&url.origin!==window.location.origin;}catch{return false;}}
export function Notice({error,onRetry}:{error:string;onRetry?:()=>void}) {
  return error?<div className="pqa-error" role="alert">{error}{onRetry&&<button type="button" onClick={onRetry}>Reload review</button>}</div>:null;
}
