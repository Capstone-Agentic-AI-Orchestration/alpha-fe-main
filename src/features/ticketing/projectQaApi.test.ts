import {describe,expect,it,vi} from 'vitest';
import {ClientTicketApiError} from './clientApiError';
import {recover,qaError} from './projectQaApi';
const receipt={roundId:'round-a',version:3,operationId:'operation-a'};
describe('QA uncertain-operation recovery',()=>{
  it('returns the committed receipt after a lost acknowledgement without repeating publication',async()=>{
    const submit=vi.fn().mockRejectedValue(new ClientTicketApiError(null,'Uncertain','transaction_outcome_unknown',true));
    const lookup=vi.fn().mockResolvedValue(receipt);
    expect(await recover(submit,lookup)).toEqual(receipt);expect(submit).toHaveBeenCalledTimes(1);
  });
  it('retries the exact original action only when the receipt is absent',async()=>{
    const input={operationId:'operation-a',title:'Review'};
    const write=vi.fn().mockRejectedValueOnce(new ClientTicketApiError(null,'Uncertain',null,true)).mockResolvedValueOnce(receipt);
    const submit=()=>write(input);
    const lookup=vi.fn().mockRejectedValue(new ClientTicketApiError(404,'Absent'));
    expect(await recover(submit,lookup)).toEqual(receipt);
    expect(write.mock.calls.map(call=>call[0])).toEqual([input,input]);
  });
  it('does not retry after revoked access or a definite version conflict',async()=>{
    const submit=vi.fn().mockRejectedValue(new ClientTicketApiError(null,'Uncertain',null,true));
    await expect(recover(submit,()=>Promise.reject(new ClientTicketApiError(403,'Revoked')))).rejects.toMatchObject({status:403});
    expect(submit).toHaveBeenCalledTimes(1);
    const lookup=vi.fn();
    await expect(recover(()=>Promise.reject(new ClientTicketApiError(409,'Changed','uat_version_conflict')),lookup)).rejects.toMatchObject({status:409});
    expect(lookup).not.toHaveBeenCalled();
  });
  it('explains stale UAT builds without claiming a client-approved delivery',()=>{
    expect(qaError(new ClientTicketApiError(409,'Changed','uat_build_changed'))).toContain('project manager must review the new build');
  });
});
