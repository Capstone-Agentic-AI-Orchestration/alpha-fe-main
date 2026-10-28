export interface QaCheck {title:string;steps:string;expectedResult:string;required:boolean}
export type QaStatus='not_tested'|'passed'|'failed'|'blocked';
export interface QaResult {status:QaStatus;notes:string;reproduction:string;device:string}
export interface QaBuild {frontend:{repository:string;branch:'uat';deploymentId:string;commitSha:string;url:string};
  backends:Array<{repository:string;branch:'uat';deploymentId:string;commitSha:string;url:string}>;
  verifiedAt:string;embeddable:boolean;reason:string|null}
export interface QaRoundSummary {id:string;number:number;title:string;version:number;
  status:'draft'|'published'|'submitted'|'withdrawn'|'superseded';outcome:string|null;reviewed:boolean;
  createdAt:string;publishedAt:string|null;submittedAt:string|null;clientId?:string;reviewedBy?:string|null}
export interface QaRound extends QaRoundSummary {
  preview:{branch:'uat';url:string;embeddable:boolean;reason:string|null};build?:QaBuild;
  items:Array<QaCheck&{id:string;result:QaResult}>;
  events:Array<{action:string;author:'pm'|'client';createdAt:string}>;
  evidenceEnabled:boolean;evidence:Array<{id:string;itemId:string;filename:string;contentType:string;byteLength:number}>;
  triage?:Array<{itemId:string;classification:string;note:string;issueId:string|null}>;
}
export interface QaRoundPage {items:QaRoundSummary[];nextBefore:number|null}
export interface QaReceipt {roundId:string;version:number;operationId:string;outcome?:string}

function isTransportError(error:unknown):error is Error & {status:number|null;code:string|null;reconciliationRequired:boolean} {
  return error instanceof Error && 'status' in error && ('code' in error || 'reconciliationRequired' in error);
}
export function uncertainQaOperation(error:unknown):boolean {return isTransportError(error)&&(error.reconciliationRequired||error.status===null);}
export async function recover(submit:()=>Promise<QaReceipt>,lookup:()=>Promise<QaReceipt>):Promise<QaReceipt> {
  try{return await submit();}catch(error){
    if(!(isTransportError(error)
      &&(error.reconciliationRequired||error.status===null)))throw error;
    try{return await lookup();}catch(lookupError){
      if(!(isTransportError(lookupError)&&lookupError.status===404))throw lookupError;
    }
    return submit();
  }
}
export function qaError(error:unknown):string {
  const code=isTransportError(error)?error.code:null;
  const messages:Record<string,string>={
    uat_build_changed:'UAT has changed. Your project manager must review the new build and share a new round.',
    uat_pm_review_required:'Review the UAT preview and mark it ready before handing it to the client.',
    uat_version_conflict:'This review changed in another session. Reload it before saving.',
    uat_incomplete:'Test every required check before submitting.',
    uat_deployment_not_ready:'This project does not have a ready deployment from the uat branch yet.',
    uat_provenance_missing:'The UAT deployment’s source commit could not be verified.',
    uat_backend_not_ready:'This project’s UAT API is not ready yet.',
    uat_backend_unverified:'The project’s UAT API deployment could not be verified.',
    uat_repository_mismatch:'The hosting project is not linked to the selected repository.',
    uat_provider_unavailable:'UAT deployment verification is not configured on the server.',
    uat_review_unavailable:'This review is no longer available to your account.',
    uat_round_locked:'This round is closed. Reload to see the latest review.',
    invalid_uat_evidence:'Choose a PNG or JPEG screenshot up to 3 MB.',
    uat_evidence_limit:'This check already has 10 screenshots.',
    uat_evidence_storage_failed:'The upload could not be confirmed. Retry the same screenshot.',
    uat_evidence_unavailable:'Private screenshot storage is unavailable. You can still report the problem in text.',
  };
  return code&&messages[code]?messages[code]:error instanceof Error?error.message:'The review could not be loaded. Try again.';
}
