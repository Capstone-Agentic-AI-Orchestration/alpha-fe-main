import { apiService } from '@/shared/services/apiService';
import { recover, type QaBuild, type QaRoundPage, type QaRound, type QaReceipt, type QaCheck } from './projectQaApi';
const id=encodeURIComponent;
const pmPath=(project:string)=>`/tickets/projects/${id(project)}/uat`;
export const pmProjectQaApi={
  targets:(project:string)=>apiService.ticketRequest<{items:Array<{repository:string}>}>(`${pmPath(project)}/targets`),
  preview:(project:string,repository:string)=>apiService.ticketRequest<{build:QaBuild}>(`${pmPath(project)}/preview?repository=${id(repository)}`),
  list:(project:string,client:string,before?:number)=>apiService.ticketRequest<QaRoundPage>(`${pmPath(project)}/rounds?clientId=${id(client)}${before?`&before=${before}`:''}`),
  get:(project:string,round:string)=>apiService.ticketRequest<QaRound>(`${pmPath(project)}/rounds/${id(round)}`),
  edit(project:string,round:string,input:{operationId:string;expectedVersion:number;title:string;items:QaCheck[]}){
    return recover(()=>apiService.ticketRequest<QaReceipt>(`${pmPath(project)}/rounds/${id(round)}`,{method:'PUT',body:JSON.stringify(input)}),
      ()=>apiService.ticketRequest<QaReceipt>(`${pmPath(project)}/operations/${id(input.operationId)}`));
  },
  evidence:(project:string,round:string,evidence:string)=>apiService.ticketDownloadDocument(`${pmPath(project)}/rounds/${id(round)}/evidence/${id(evidence)}/content`),
  triage(project:string,round:string,item:string,input:{operationId:string;expectedVersion:number;classification:string;note:string;issueId:string|null}){
    return recover(()=>apiService.ticketRequest<QaReceipt>(`${pmPath(project)}/rounds/${id(round)}/items/${id(item)}/triage`,{method:'POST',body:JSON.stringify(input)}),
      ()=>apiService.ticketRequest<QaReceipt>(`${pmPath(project)}/operations/${id(input.operationId)}`));
  },
  create(project:string,input:{operationId:string;clientId:string;repository:string;title:string;items:QaCheck[]}){
    return recover(()=>apiService.ticketRequest<QaReceipt>(`${pmPath(project)}/rounds`,{method:'POST',body:JSON.stringify(input)}),
      ()=>apiService.ticketRequest<QaReceipt>(`${pmPath(project)}/operations/${id(input.operationId)}`));
  },
  command(project:string,round:string,input:{operationId:string;expectedVersion:number;action:'ready'|'publish'|'withdraw'}){
    return recover(()=>apiService.ticketRequest<QaReceipt>(`${pmPath(project)}/rounds/${id(round)}/commands`,{method:'POST',body:JSON.stringify(input)}),
      ()=>apiService.ticketRequest<QaReceipt>(`${pmPath(project)}/operations/${id(input.operationId)}`));
  },
};
