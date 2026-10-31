import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { pmTicketApi } from './pmApi';
import { pmProjectQaApi } from './pmProjectQaApi';
import { qaError, uncertainQaOperation, type QaBuild, type QaCheck, type QaRound, type QaRoundPage } from './projectQaApi';
import { History, Notice, QaPreview, QaEvidence, ReadOnlyChecks, RoundPicker, StudioPanels, label } from './ProjectQaStudio';
const newCheck=():QaCheck=>({title:'',steps:'',expectedResult:'',required:true});

export function PmProjectQaStudio({projectId,projectName,feedback,issues=[]}:{projectId:string;projectName:string;feedback:(clientId:string)=>ReactNode;issues?:Array<{id:string;identifier:string;title:string}>}) {
  const [targets,setTargets]=useState<Array<{repository:string}>>([]);
  const [clients,setClients]=useState<Array<{clientId:string;displayName:string}>>([]);
  const [repository,setRepository]=useState('');const [clientId,setClientId]=useState('');
  const [build,setBuild]=useState<QaBuild|null>(null);const [page,setPage]=useState<QaRoundPage|null>(null);
  const [selected,setSelected]=useState('');const [round,setRound]=useState<QaRound|null>(null);
  const [checks,setChecks]=useState<QaCheck[]>([newCheck()]);const [title,setTitle]=useState('UAT review');
  const [editing,setEditing]=useState(false);
  const [uncertain,setUncertain]=useState(false);
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);
  const [refresh,setRefresh]=useState(0);const [ack,setAck]=useState(false);
  const pending=useRef<{key:string;run:()=>Promise<unknown>}|null>(null);

  useEffect(()=>{let active=true;setLoading(true);setError('');
    void Promise.all([pmProjectQaApi.targets(projectId),pmTicketApi.listProjectPreviewClients(projectId)]).then(([targets,clients])=>{
      if(!active)return;setTargets(targets.items);setClients(clients.items);
      setRepository(current=>targets.items.some(item=>item.repository===current)?current:targets.items.length===1?targets.items[0].repository:'');
      setClientId(current=>clients.items.some(item=>item.clientId===current)?current:clients.items.length===1?clients.items[0].clientId:'');
    }).catch(cause=>{if(active)setError(qaError(cause));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
  },[projectId,refresh]);
  useEffect(()=>{let active=true;setBuild(null);setAck(false);if(!repository)return;
    void pmProjectQaApi.preview(projectId,repository).then(result=>{if(active)setBuild(result.build);})
      .catch(cause=>{if(active)setError(qaError(cause));});return()=>{active=false;};
  },[projectId,repository,refresh]);
  useEffect(()=>{let active=true;setPage(null);setRound(null);setSelected('');setAck(false);if(!clientId)return;
    void pmProjectQaApi.list(projectId,clientId).then(value=>{if(active){setPage(value);setSelected(value.items[0]?.id??'');}})
      .catch(cause=>{if(active)setError(qaError(cause));});return()=>{active=false;};
  },[projectId,clientId,refresh]);
  useEffect(()=>{let active=true;setRound(null);setAck(false);setEditing(false);if(!selected)return;
    void pmProjectQaApi.get(projectId,selected).then(value=>{if(active)setRound(value);}).catch(cause=>{if(active)setError(qaError(cause));});return()=>{active=false;};
  },[projectId,selected]);
  async function reloadRound(id=selected){if(id)setRound(await pmProjectQaApi.get(projectId,id));if(clientId)setPage(await pmProjectQaApi.list(projectId,clientId));}
  async function run(key:string,action:()=>Promise<unknown>) {
    if(busy)return;setBusy(true);setError('');pending.current??={key,run:action};
    try{await pending.current.run();pending.current=null;setUncertain(false);await reloadRound();}
    catch(cause){const unknown=uncertainQaOperation(cause);setUncertain(unknown);if(!unknown)pending.current=null;setError(qaError(cause));}finally{setBusy(false);}
  }
  async function create(){
    if(editing&&round){const input={operationId:crypto.randomUUID(),expectedVersion:round.version,title,items:checks};
      await run('edit',async()=>{await pmProjectQaApi.edit(projectId,round.id,input);setEditing(false);});return;}
    const input={operationId:crypto.randomUUID(),clientId,repository,title,items:checks};
    await run('create',async()=>{const receipt=await pmProjectQaApi.create(projectId,input);setSelected(receipt.roundId);setRound(await pmProjectQaApi.get(projectId,receipt.roundId));});
  }
  async function command(action:'ready'|'publish'|'withdraw') {
    if(!round)return;const id=round.id,input={operationId:crypto.randomUUID(),expectedVersion:round.version,action};
    await run(action,()=>pmProjectQaApi.command(projectId,id,input));setAck(false);
  }
  async function older(){if(!page?.nextBefore)return;try{const next=await pmProjectQaApi.list(projectId,clientId,page.nextBefore);setPage({items:[...page.items,...next.items],nextBefore:next.nextBefore});}catch(cause){setError(qaError(cause));}}
  function retest(){if(round){setChecks(round.items.map(({title,steps,expectedResult,required})=>({title,steps,expectedResult,required})));setTitle(`${round.title.replace(/ · retest$/,'')} · retest`);setSelected('');setRound(null);setAck(false);}}
  const preview=round?.preview??(build?{branch:'uat' as const,url:build.frontend.url,embeddable:build.embeddable,reason:build.reason}:null);
  return <section className="project-qa-studio" aria-label={`${projectName} Project Review`}>
    <header className="pqa-heading"><div><p>PROJECT REVIEW</p><h2>{projectName}</h2><span>Review UAT first, then hand the reviewed build to your client.</span></div>
      <button type="button" disabled={busy||uncertain} onClick={()=>{pending.current=null;setRefresh(value=>value+1);}}><RefreshCw size={14}/> Refresh</button></header>
    <Notice error={error}/>
    {uncertain&&<p className="pqa-error">The last action needs reconciliation. Retry that same action before starting another.
      <button type="button" disabled={busy} onClick={()=>void run('retry',()=>Promise.resolve())}>Retry pending action</button></p>}
    {loading?<p role="status">Loading this project’s review…</p>:<>
      <div className="pqa-setup"><label>UAT frontend<select value={repository} disabled={busy||uncertain} onChange={event=>{setRepository(event.target.value);setSelected('');setRound(null);setError('');}}>
        <option value="">Choose this project’s frontend</option>{targets.map(item=><option key={item.repository}>{item.repository}</option>)}</select></label>
        <label>Client<select value={clientId} disabled={busy||uncertain} onChange={event=>setClientId(event.target.value)}><option value="">Choose a client</option>
          {clients.map(client=><option key={client.clientId} value={client.clientId}>{client.displayName}</option>)}</select></label>
        <RoundPicker page={page} selected={selected} disabled={busy||uncertain} onChange={setSelected} onOlder={()=>void older()}/>
      </div>
      {!targets.length&&<p className="pqa-hint">Attach a hosted frontend repository to this project to preview its UAT build.</p>}
      {!clients.length&&<p className="pqa-hint">Share a linked project request with a client before publishing a QA review.</p>}
      <div className="pqa-workspace"><QaPreview preview={preview} version={round?`Review ${round.number}`:'Internal PM preview'}/>
        <aside className="pqa-review" aria-label="Project review controls">
          <StudioPanels feedback={feedback(clientId)} history={round?<History round={round}/>:<p>No review selected.</p>} checklist={<>
            {round&&!editing?<><div className="pqa-review-heading"><h3>{round.title}</h3><span className="pqa-status">{label(round.status)}{round.outcome?` · ${label(round.outcome)}`:''}</span></div>
              <p className="pqa-hint">{round.items.filter(item=>item.result.status==='passed').length}/{round.items.length} checks passed</p>
              <ReadOnlyChecks round={round} extra={item=><>
                <QaEvidence items={(round.evidence??[]).filter(evidence=>evidence.itemId===item.id)} load={id=>pmProjectQaApi.evidence(projectId,round.id,id)}/>
                {['failed','blocked'].includes(item.result.status)&&<PmTriage key={`${round.id}:${item.id}`} itemId={item.id} round={round} issues={issues} busy={busy||uncertain}
                  save={input=>run('triage',()=>pmProjectQaApi.triage(projectId,round.id,item.id,input))}/>} 
              </>}/>
              {round.status==='draft'&&<div className="pqa-handoff"><ShieldCheck size={20}/><h3>PM review before client handoff</h3>
                <p>Open and test this UAT preview. Confirm it is ready before making it visible to this client.</p>
                {!round.reviewed?<><label className="pqa-checkbox"><input type="checkbox" checked={ack} onChange={event=>setAck(event.target.checked)}/> I reviewed this UAT build and it is ready for client QA.</label>
                  <button type="button" className="pqa-primary" disabled={busy||uncertain||!ack} onClick={()=>void command('ready')}>Mark reviewed and ready</button></>
                  :<><p className="pqa-success">PM review recorded for this build.</p><button type="button" className="pqa-primary" disabled={busy||uncertain} onClick={()=>void command('publish')}>Hand off to client</button></>}
              </div>}
              {['draft','published'].includes(round.status)&&<button type="button" disabled={busy||uncertain} onClick={()=>void command('withdraw')}>Withdraw review</button>}
              {round.status==='draft'&&<button type="button" disabled={busy||uncertain} onClick={()=>{setChecks(round.items.map(({title,steps,expectedResult,required})=>({title,steps,expectedResult,required})));setTitle(round.title);setEditing(true);}}>Edit draft checklist</button>}
              <button type="button" disabled={busy||uncertain||!build} onClick={retest}>Prepare new review / retest</button>
            </>:<form className="pqa-draft" onSubmit={event=>{event.preventDefault();void create();}}>
              <h3>Prepare a client review</h3><p className="pqa-hint">This draft stays internal until you review the build and explicitly hand it off.</p>
              <label>Review title<input value={title} maxLength={300} required onChange={event=>setTitle(event.target.value)}/></label>
              {checks.map((check,index)=><fieldset key={index} disabled={busy||uncertain}><legend>Check {index+1}</legend>
                <label>What to test<input required value={check.title} maxLength={300} onChange={event=>setChecks(values=>values.map((value,i)=>i===index?{...value,title:event.target.value}:value))}/></label>
                <label>Steps<textarea value={check.steps} maxLength={4000} onChange={event=>setChecks(values=>values.map((value,i)=>i===index?{...value,steps:event.target.value}:value))}/></label>
                <label>Expected result<textarea required value={check.expectedResult} maxLength={4000} onChange={event=>setChecks(values=>values.map((value,i)=>i===index?{...value,expectedResult:event.target.value}:value))}/></label>
                <label className="pqa-checkbox"><input type="checkbox" checked={check.required} onChange={event=>setChecks(values=>values.map((value,i)=>i===index?{...value,required:event.target.checked}:value))}/> Required check</label>
                {checks.length>1&&<button type="button" onClick={()=>setChecks(values=>values.filter((_,i)=>i!==index))}><Trash2 size={13}/> Remove check</button>}
              </fieldset>)}
              <button type="button" disabled={busy||uncertain||checks.length>=100} onClick={()=>setChecks(values=>[...values,newCheck()])}><Plus size={14}/> Add check</button>
              <button className="pqa-primary" type="submit" disabled={busy||uncertain||(!editing&&!build)||!clientId}>{busy?'Saving…':editing?'Save draft changes':'Save internal review draft'}</button>
              {editing&&<button type="button" disabled={busy||uncertain} onClick={()=>setEditing(false)}>Cancel editing</button>}
            </form>}
          </>}/>
        </aside>
      </div>
    </>}
  </section>;
}

function PmTriage({itemId,round,issues,busy,save}:{itemId:string;round:QaRound;issues:Array<{id:string;identifier:string;title:string}>;busy:boolean;
  save:(input:{operationId:string;expectedVersion:number;classification:string;note:string;issueId:string|null})=>Promise<void>}) {
  const previous=round.triage?.find(entry=>entry.itemId===itemId);
  const [classification,setClassification]=useState(previous?.classification??'correction');
  const [note,setNote]=useState(previous?.note??'');const [issueId,setIssueId]=useState(previous?.issueId??'');
  return <form className="pqa-triage" onSubmit={event=>{event.preventDefault();void save({operationId:crypto.randomUUID(),expectedVersion:round.version,classification,note,issueId:issueId||null});}}>
    <h4>PM triage</h4><label>Classification<select value={classification} disabled={busy} onChange={event=>setClassification(event.target.value)}>
      <option value="correction">Correction within approved scope</option><option value="clarification">Clarification needed</option><option value="new_scope">New scope / request</option></select></label>
    <label>Internal triage note<textarea aria-label="Internal triage note" required maxLength={4000} value={note} disabled={busy} onChange={event=>setNote(event.target.value)}/></label>
    <label>Link an existing issue in this project<select aria-label="Link an existing issue in this project" value={issueId} disabled={busy} onChange={event=>setIssueId(event.target.value)}>
      <option value="">No issue linked</option>{issues.map(issue=><option key={issue.id} value={issue.id}>{issue.identifier} · {issue.title}</option>)}</select></label>
    <p className="pqa-hint">Create any new issue through this project’s existing task controls. Linking here does not authorize work.</p>
    <button type="submit" disabled={busy}>Save triage</button>{previous&&<span className="pqa-saved">Triage recorded</span>}
  </form>;
}

