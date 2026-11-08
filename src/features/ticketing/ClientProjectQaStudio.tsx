import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { clientProjectQaApi } from './clientProjectQaApi';
import { qaError, uncertainQaOperation, type QaResult, type QaRound, type QaRoundPage } from './projectQaApi';
import { History, Notice, QaPreview, QaEvidence, RoundPicker, StudioPanels, label } from './ProjectQaStudio';

const PANEL_PREFERENCE_KEY = 'alpha.client.projectReview.panelCollapsed';
function readPanelPreference(): boolean {
  try { return localStorage.getItem(PANEL_PREFERENCE_KEY) === 'true'; } catch { return false; }
}

export function ClientProjectQaStudio({workspaceId,projectId,projectName,inspectionOnly,feedback,refreshToken}:{workspaceId:string;projectId:string;projectName:string;inspectionOnly:boolean;feedback:ReactNode;refreshToken:number}) {
  const [page,setPage]=useState<QaRoundPage|null>(null);const [round,setRound]=useState<QaRound|null>(null);
  const [selected,setSelected]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);
  const [refresh,setRefresh]=useState(0);const [confirm,setConfirm]=useState(false);
  const [dirtyItems,setDirtyItems]=useState<Record<string,boolean>>({});
  const setDirty=useCallback((id:string,dirty:boolean)=>setDirtyItems(items=>items[id]===dirty?items:{...items,[id]:dirty}),[]);
  const hasUnsaved=Object.values(dirtyItems).some(Boolean);
  useEffect(()=>{if(!hasUnsaved)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[hasUnsaved]);
  const [mobile,setMobile]=useState<'preview'|'review'>('review');
  const [panelCollapsed,setPanelCollapsedState]=useState(readPanelPreference);
  const [peek,setPeek]=useState(false);
  const review=useRef<HTMLElement|null>(null);const peekTimer=useRef<number|undefined>(undefined);
  // Hiding leaves the pointer over the new rail; wait until it leaves once before hover can reopen the panel.
  const holdPeek=useRef(false);
  function setPanelCollapsed(collapsed:boolean){setPanelCollapsedState(collapsed);setPeek(false);holdPeek.current=collapsed;
    try{localStorage.setItem(PANEL_PREFERENCE_KEY,String(collapsed));}catch{/* The choice still applies for this visit. */}}
  function openPeek(){window.clearTimeout(peekTimer.current);if(panelCollapsed&&!holdPeek.current)setPeek(true);}
  // Keep the panel open while someone is typing in it, even if the pointer drifts over the preview.
  function closePeekSoon(){window.clearTimeout(peekTimer.current);
    peekTimer.current=window.setTimeout(()=>{if(!review.current?.contains(document.activeElement))setPeek(false);},250);}
  useEffect(()=>()=>window.clearTimeout(peekTimer.current),[]);
  const panelState=!panelCollapsed?'docked':peek?'peek':'collapsed';
  const roundPicker=<RoundPicker hideLabel disabled={busy||hasUnsaved} page={page} selected={selected} onChange={value=>{setSelected(value);submission.current=null;}} onOlder={()=>void older()}/>;
  useEffect(()=>{let active=true;setLoading(true);setError('');setRound(null);
    if(inspectionOnly){setPage({items:[],nextBefore:null});setLoading(false);return;}
    void clientProjectQaApi.list(workspaceId,projectId).then(value=>{if(active){setPage(value);setSelected(current=>value.items.some(item=>item.id===current)?current:value.items.find(item=>item.status==='published')?.id??value.items[0]?.id??'');}})
      .catch(cause=>{if(active)setError(qaError(cause));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
  },[workspaceId,projectId,refresh,refreshToken,inspectionOnly]);
  useEffect(()=>{let active=true;setRound(null);setConfirm(false);setDirtyItems({});if(!selected||inspectionOnly)return;
    void clientProjectQaApi.get(workspaceId,projectId,selected).then(value=>{if(active)setRound(value);}).catch(cause=>{if(active)setError(qaError(cause));});return()=>{active=false;};
  },[workspaceId,projectId,selected,refresh,refreshToken,inspectionOnly]);
  async function reload(){if(selected)setRound(await clientProjectQaApi.get(workspaceId,projectId,selected));}
  async function older(){if(!page?.nextBefore)return;try{const next=await clientProjectQaApi.list(workspaceId,projectId,page.nextBefore);setPage({items:[...page.items,...next.items],nextBefore:next.nextBefore});}catch(cause){setError(qaError(cause));}}
  const submission=useRef<{roundId:string;input:{operationId:string;expectedVersion:number}}|null>(null);
  async function submit(){if(!round||busy||inspectionOnly||hasUnsaved)return;setBusy(true);setError('');
    submission.current??={roundId:round.id,input:{operationId:crypto.randomUUID(),expectedVersion:round.version}};
    try{await clientProjectQaApi.submit(workspaceId,projectId,submission.current.roundId,submission.current.input);submission.current=null;setConfirm(false);await reload();}
    catch(cause){if(!uncertainQaOperation(cause))submission.current=null;setError(qaError(cause));}finally{setBusy(false);}}
  const editable=round?.status==='published'&&!inspectionOnly;
  const completed=round?.items.filter(item=>item.result.status!=='not_tested').length??0;
  const incomplete=round?.items.some(item=>item.required&&item.result.status==='not_tested');
  return <section className="project-qa-studio pqa-client" data-panel={panelState} aria-label={`${projectName} Project Review`}>
    <div className="pqa-client-controls">
    <Notice error={error} onRetry={()=>setRefresh(value=>value+1)}/>
    {/* Phones switch between preview and review, so the picker also lives here where it stays reachable. */}
    <div className="pqa-mobile-round">{roundPicker}</div>
    </div>
    {loading?<p role="status">Loading your project review…</p>:<>
      <div className="pqa-mobile-switch" role="group" aria-label="Review view"><button type="button" aria-pressed={mobile==='preview'} onClick={()=>setMobile('preview')}>Preview</button>
        <button type="button" aria-pressed={mobile==='review'} onClick={()=>setMobile('review')}>Review</button></div>
      <div className="pqa-workspace" data-mobile={mobile}><QaPreview preview={round?.preview??null} audience="client" toolbarEnd={roundPicker}/>
        {panelCollapsed&&<div className="pqa-panel-rail" onMouseEnter={openPeek} onMouseLeave={()=>{holdPeek.current=false;closePeekSoon();}}>
          <button type="button" aria-label="Show review panel" title="Show review panel" onClick={()=>setPanelCollapsed(false)}><PanelRightOpen size={16}/></button>
          <span aria-hidden="true">Review{round?` · ${completed}/${round.items.length}`:''}</span>
        </div>}
        <aside ref={review} className="pqa-review" aria-label="Your project review" onMouseEnter={openPeek} onMouseLeave={()=>{if(panelCollapsed)closePeekSoon();}}
          onBlur={event=>{if(panelCollapsed&&!event.currentTarget.contains(event.relatedTarget as Node|null))closePeekSoon();}}
          onKeyDown={event=>{if(event.key==='Escape'&&panelState==='peek'){setPeek(false);(document.activeElement as HTMLElement|null)?.blur();}}}>
          <StudioPanels ariaLabel="Project review panels" actions={panelCollapsed?undefined
            :<button type="button" className="pqa-panel-toggle" aria-label="Hide review panel" title="Hide review panel" onClick={()=>setPanelCollapsed(true)}><PanelRightClose size={15}/></button>}
            feedback={feedback} history={round?<History round={round}/>:<p>No review history yet.</p>} checklist={round?<>
            <div className="pqa-review-heading"><h3>{round.title}</h3><span>{completed}/{round.items.length} tested</span></div>
            <progress max={round.items.length} value={completed} aria-label="Checks tested"/>
            <p className="pqa-hint">{round.status==='published'?'Save each result, then submit your review.':`This review is ${label(round.status).toLowerCase()}${round.outcome?` · ${label(round.outcome)}`:''}. Results are preserved.`}</p>
            <ol className="pqa-checks">{round.items.map(item=><ClientCheck key={`${round.id}:${item.id}`} item={item} round={round} editable={editable} busy={busy} onDirty={setDirty}
              evidence={<QaEvidence items={(round.evidence??[]).filter(value=>value.itemId===item.id)} load={id=>clientProjectQaApi.evidence(workspaceId,projectId,round.id,id)}/>}
              upload={round.evidenceEnabled?async(file,operationId)=>{setBusy(true);try{await clientProjectQaApi.upload(workspaceId,projectId,round.id,item.id,file,operationId);await reload();}finally{setBusy(false);}}:undefined}
              onSave={async(result,operationId,expectedVersion)=>{setBusy(true);try{await clientProjectQaApi.save(workspaceId,projectId,round.id,item.id,
                {...result,operationId,expectedVersion});await reload();submission.current=null;}finally{setBusy(false);}}}/>)}</ol>
            {editable&&<div className="pqa-submit"><p>Submitting records your QA findings. Delivery acceptance remains a separate step.</p>
              {confirm?<><p>Submit the saved results for Review {round.number}? You can continue discussing any issues with your project manager.</p>
                <button type="button" className="pqa-primary" disabled={busy||hasUnsaved||incomplete} onClick={()=>void submit()}>{busy?'Submitting…':'Confirm submission'}</button>
                <button type="button" disabled={busy} onClick={()=>setConfirm(false)}>Keep testing</button></>
                :<button type="button" className="pqa-primary" disabled={busy||incomplete||hasUnsaved} onClick={()=>setConfirm(true)}>Submit review</button>}
              {hasUnsaved&&<span>Save or discard your changes before submitting or switching rounds.</span>}
              {incomplete&&<span>Test every required check before submitting.</span>}
            </div>}
          </>:<div className="pqa-empty"><h3>No review shared yet</h3><p>Your project manager will share a review here when it is ready. You can send a message in Feedback.</p></div>}/>
        </aside>
      </div>
    </>}
  </section>;
}

function ClientCheck({item,round,editable,busy,onSave,onDirty,evidence,upload}:{item:QaRound['items'][number];round:QaRound;editable:boolean;busy:boolean;onDirty:(id:string,dirty:boolean)=>void;evidence:ReactNode;upload?: (file:File,operationId:string)=>Promise<void>;
  onSave:(result:QaResult,operationId:string,expectedVersion:number)=>Promise<void>}) {
  const [draft,setDraft]=useState<QaResult>(item.result);const [error,setError]=useState('');
  const pending=useRef<{result:QaResult;operationId:string;version:number}|null>(null);
  const dirty=JSON.stringify(draft)!==JSON.stringify(item.result);
  const [file,setFile]=useState<File|null>(null);const uploadId=useRef<string|null>(null);
  useEffect(()=>onDirty(item.id,dirty),[dirty,item.id,onDirty]);
  async function attach(){if(!file||!upload)return;setError('');uploadId.current??=crypto.randomUUID();try{await upload(file,uploadId.current);uploadId.current=null;setFile(null);}catch(cause){setError(qaError(cause));}}
  useEffect(()=>{if(!dirty)setDraft(item.result);},[item.result]);
  async function save(){setError('');pending.current??={result:{...draft,notes:draft.notes.trim(),reproduction:draft.reproduction.trim(),device:draft.device.trim()},operationId:crypto.randomUUID(),version:round.version};
    try{await onSave(pending.current.result,pending.current.operationId,pending.current.version);setDraft(pending.current.result);pending.current=null;}
    catch(cause){if(!uncertainQaOperation(cause))pending.current=null;setError(qaError(cause));}}
  return <li><form onSubmit={event=>{event.preventDefault();void save();}}><h4>{item.title}{item.required&&<small>Required</small>}</h4>
    {item.steps&&<p className="pqa-preserve">{item.steps}</p>}<p className="pqa-preserve"><b>Expected:</b> {item.expectedResult}</p>
    <fieldset disabled={!editable||busy}><label>Result<select aria-label="Result" value={draft.status} onChange={event=>{pending.current=null;setDraft({...draft,status:event.target.value as QaResult['status']});}}>
      {(['not_tested','passed','failed','blocked'] as const).map(status=><option value={status} key={status}>{label(status)}</option>)}</select></label>
      <label>{draft.status==='blocked'?'What blocked you?':'Notes / what happened'}<textarea aria-label={draft.status==='blocked'?'What blocked you?':'Notes / what happened'} maxLength={4000} value={draft.notes} required={draft.status==='failed'||draft.status==='blocked'}
        onChange={event=>{pending.current=null;setDraft({...draft,notes:event.target.value});}}/></label>
      {draft.status==='failed'&&<label>Steps to reproduce<textarea aria-label="Steps to reproduce" required maxLength={4000} value={draft.reproduction} onChange={event=>{pending.current=null;setDraft({...draft,reproduction:event.target.value});}}/></label>}
      <label>Device / browser<input maxLength={100} value={draft.device} placeholder="e.g. Chrome on Windows" onChange={event=>{pending.current=null;setDraft({...draft,device:event.target.value});}}/></label>
      {editable&&<button type="submit" disabled={!dirty||busy}>{busy?'Saving…':'Save result'}</button>}
    </fieldset><Notice error={error}/>{dirty&&<button type="button" disabled={busy} onClick={()=>{pending.current=null;setDraft(item.result);}}>Discard unsaved changes</button>}{!dirty&&item.result.status!=='not_tested'&&<span className="pqa-saved">Saved</span>}
  </form>{evidence}{editable&&upload&&<div className="pqa-upload"><label>Screenshot (PNG or JPEG, up to 3 MB)<input type="file" accept="image/png,image/jpeg" disabled={busy} onChange={event=>{const next=event.target.files?.[0]??null;uploadId.current=null;setFile(next);}}/></label>
    <button type="button" disabled={busy||!file} onClick={()=>void attach()}>Attach screenshot</button></div>}</li>;
}
