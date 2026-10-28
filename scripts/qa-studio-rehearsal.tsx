// Development browser harness only. Production entrypoints never import this file.
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import '../src/index.css';
import {PmProjectQaStudio} from '../src/features/ticketing/PmProjectQaStudio';
import {ClientProjectQaStudio} from '../src/features/ticketing/ClientProjectQaStudio';
function Harness(){
  const [role,setRole]=useState<'pm'|'client'>('pm'),[project,setProject]=useState('project-a');
  return <main style={{padding:16,height:'100dvh',background:'rgb(var(--ui-canvas))',color:'rgb(var(--ui-text-primary))'}}>
    <nav style={{display:'flex',gap:16,marginBottom:20}}><button onClick={()=>setRole('pm')}>Rehearse PM</button><button onClick={()=>setRole('client')}>Rehearse client</button>
      <label>Rehearsal project<select value={project} onChange={event=>setProject(event.target.value)}><option value="project-a">Storefront</option><option value="project-b">Other project</option></select></label></nav>
    <div style={{height:'calc(100% - 65px)'}}>{role==='pm'?<PmProjectQaStudio key={project} projectId={project} projectName={project==='project-a'?'Storefront':'Other project'}
      issues={[{id:'issue-a',identifier:'ST-1',title:'Fix checkout'}]} feedback={clientId=><p>Private project feedback with {clientId}</p>}/>
      :<ClientProjectQaStudio key={project} workspaceId="workspace-a" projectId={project} projectName={project==='project-a'?'Storefront':'Other project'} inspectionOnly={false}
        feedback={<label>Project feedback<textarea placeholder="Message your project manager"/></label>}/>}</div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
