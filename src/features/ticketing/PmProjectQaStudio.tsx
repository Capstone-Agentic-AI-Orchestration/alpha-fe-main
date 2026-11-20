import { LoadingRows } from '@/shared/components/ui/skeleton';
import { useEffect, useState, type ReactNode } from 'react';
import { ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { pmTicketApi, type PmProjectClientPreview } from './pmApi';
import { pmProjectQaApi } from './pmProjectQaApi';
import { qaError, type QaBuild } from './projectQaApi';
import { Notice, QaPreview } from './ProjectQaStudio';

/** Whether this UAT build is the one clients currently see. */
export function sharedBuildState(build: QaBuild | null, shared: PmProjectClientPreview | null): 'none' | 'current' | 'newer' | 'unshared' {
  if (!build) return shared ? 'current' : 'none';
  if (!shared) return 'unshared';
  return shared.url === build.frontend.url ? 'current' : 'newer';
}

/**
 * The PM's Project Review: test the UAT build, share it with the project's
 * clients, and talk with each client about it. No checklist — the client's
 * acceptance happens on the request, and feedback arrives as messages.
 */
export function PmProjectQaStudio({projectId,projectName,feedback}:{projectId:string;projectName:string;feedback:(clientId:string)=>ReactNode}) {
  const [targets,setTargets]=useState<Array<{repository:string}>>([]);
  const [clients,setClients]=useState<Array<{clientId:string;displayName:string}>>([]);
  const [repository,setRepository]=useState('');const [clientId,setClientId]=useState('');
  const [loadedBuild,setBuild]=useState<QaBuild|null>(null);const [buildFor,setBuildFor]=useState('');
  const build=buildFor===repository?loadedBuild:null;
  const [shared,setShared]=useState<PmProjectClientPreview|null>(null);
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);
  const [refresh,setRefresh]=useState(0);const [ack,setAck]=useState(false);

  useEffect(()=>{let active=true;setLoading(true);setError('');
    void Promise.all([pmProjectQaApi.targets(projectId),pmTicketApi.listProjectPreviewClients(projectId),pmTicketApi.getProjectClientPreview(projectId)]).then(([targets,clients,current])=>{
      if(!active)return;setTargets(targets.items);setClients(clients.items);setShared(current.preview);
      setRepository(value=>targets.items.some(item=>item.repository===value)?value
        :targets.items.find(item=>item.repository===current.preview?.repository)?.repository??(targets.items.length===1?targets.items[0].repository:''));
      setClientId(value=>clients.items.some(item=>item.clientId===value)?value:clients.items[0]?.clientId??'');
    }).catch(cause=>{if(active)setError(qaError(cause));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
  },[projectId,refresh]);
  useEffect(()=>{let active=true;setAck(false);if(!repository)return;
    void pmProjectQaApi.preview(projectId,repository).then(result=>{if(active){setBuild(result.build);setBuildFor(repository);}})
      .catch(cause=>{if(active){setBuild(null);setBuildFor(repository);setError(qaError(cause));}});return()=>{active=false;};
  },[projectId,repository,refresh]);

  async function save(next:PmProjectClientPreview|null){
    if(busy)return;setBusy(true);setError('');
    try{const result=await pmTicketApi.setProjectClientPreview(projectId,next);setShared(result.preview);setAck(false);}
    // A refused share usually means a newer build replaced the one on screen: load the current one to test and share.
    catch(cause){setError(qaError(cause));setAck(false);setRefresh(value=>value+1);}finally{setBusy(false);}
  }
  const state=sharedBuildState(build,shared);
  const buildPending=Boolean(repository&&buildFor!==repository);
  const preview=build?{branch:'uat' as const,url:build.frontend.url,embeddable:build.embeddable,reason:build.reason}
    :shared&&!repository?{branch:'uat' as const,url:shared.url,embeddable:true,reason:null}:null;

  return <section className="project-qa-studio" aria-label={`${projectName} Project Review`}>
    <header className="pqa-heading"><div><p>PROJECT REVIEW</p><h2>{projectName}</h2><span>Test the UAT build, share it with your client, then talk it through.</span></div>
      <button type="button" disabled={busy} onClick={()=>setRefresh(value=>value+1)}><RefreshCw size={14}/> Refresh</button></header>
    <Notice error={error}/>
    {loading&&!targets.length&&!clients.length?<LoadingRows label="Loading this project’s review" layout="detail" />:<>
      <div className="pqa-setup"><label>UAT frontend<select value={repository} disabled={busy} onChange={event=>{setRepository(event.target.value);setError('');}}>
        <option value="">Choose this project’s frontend</option>{targets.map(item=><option key={item.repository}>{item.repository}</option>)}</select></label>
        <label>Client conversation<select value={clientId} disabled={busy} onChange={event=>setClientId(event.target.value)}><option value="">Choose a client</option>
          {clients.map(client=><option key={client.clientId} value={client.clientId}>{client.displayName}</option>)}</select></label>
      </div>
      {!loading&&!error&&!targets.length&&<p className="pqa-hint">Attach a hosted frontend repository to this project to preview its UAT build.</p>}
      {!loading&&!error&&!clients.length&&<p className="pqa-hint">No client has access to this project yet. Link one of their requests to it to start a conversation.</p>}
      <div className="pqa-workspace"><QaPreview preview={preview} version={state==='current'?'Shared with client':'Internal PM preview'} pending={buildPending}/>
        <aside className="pqa-review" aria-label="Project review controls">
          <div className="pqa-handoff"><ShieldCheck size={20}/><h3>Client preview</h3>
            {shared?<p>Shared with this project’s clients: <a href={shared.url} target="_blank" rel="noopener noreferrer">{shared.repository} · {shared.branch} <ExternalLink size={12}/></a></p>
              :<p>Nothing shared yet. Clients see the preview only after you share it.</p>}
            {state==='current'&&<p className="pqa-success">Clients are seeing this UAT build.</p>}
            {(state==='unshared'||state==='newer')&&build&&<>
              {state==='newer'&&<p>A newer UAT build is ready. Clients still see the one shared earlier.</p>}
              <label className="pqa-checkbox"><input type="checkbox" checked={ack} disabled={busy} onChange={event=>setAck(event.target.checked)}/> I tested this UAT build and it is ready for the client.</label>
              <button type="button" className="pqa-primary" disabled={busy||!ack}
                onClick={()=>void save({repository:build.frontend.repository,branch:'uat',url:build.frontend.url})}>{busy?'Sharing…':state==='newer'?'Share newer build':'Share with client'}</button></>}
            {shared&&<button type="button" disabled={busy} onClick={()=>void save(null)}>Stop sharing</button>}
          </div>
          {feedback(clientId)}
        </aside>
      </div>
    </>}
  </section>;
}
