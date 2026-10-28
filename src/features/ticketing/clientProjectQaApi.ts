import { requestJson,requestResponse } from './clientApi';
import { recover, type QaResult, type QaRoundPage, type QaRound, type QaReceipt } from './projectQaApi';
const id=encodeURIComponent;
const clientPath=(workspace:string,project:string)=>`/projects/${id(workspace)}/${id(project)}/uat`;
export const clientProjectQaApi={
  list:(workspace:string,project:string,before?:number)=>requestJson<QaRoundPage>(`${clientPath(workspace,project)}/rounds${before?`?before=${before}`:''}`),
  get:(workspace:string,project:string,round:string)=>requestJson<QaRound>(`${clientPath(workspace,project)}/rounds/${id(round)}`),
  async evidence(workspace:string,project:string,round:string,evidence:string){
    return (await requestResponse(`${clientPath(workspace,project)}/rounds/${id(round)}/evidence/${id(evidence)}/content`,{accept:'application/octet-stream'})).blob();
  },
  upload(workspace:string,project:string,round:string,item:string,file:File,operationId:string){
    return recover(()=>requestJson<QaReceipt>(`${clientPath(workspace,project)}/rounds/${id(round)}/items/${id(item)}/evidence`,{method:'POST',body:file,
      headers:{'Content-Type':file.type,'X-Alpha-Ticket-Document':encodeURIComponent(JSON.stringify({operationId,filename:file.name,contentType:file.type}))}}),
      ()=>requestJson<QaReceipt>(`${clientPath(workspace,project)}/operations/${id(operationId)}`));
  },
  save(workspace:string,project:string,round:string,item:string,input:QaResult&{operationId:string;expectedVersion:number}){
    return recover(()=>requestJson<QaReceipt>(`${clientPath(workspace,project)}/rounds/${id(round)}/items/${id(item)}/result`,{method:'PUT',body:JSON.stringify(input)}),
      ()=>requestJson<QaReceipt>(`${clientPath(workspace,project)}/operations/${id(input.operationId)}`));
  },
  submit(workspace:string,project:string,round:string,input:{operationId:string;expectedVersion:number}){
    return recover(()=>requestJson<QaReceipt>(`${clientPath(workspace,project)}/rounds/${id(round)}/submit`,{method:'POST',body:JSON.stringify(input)}),
      ()=>requestJson<QaReceipt>(`${clientPath(workspace,project)}/operations/${id(input.operationId)}`));
  },
};
