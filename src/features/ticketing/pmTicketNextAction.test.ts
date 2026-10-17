import { describe, expect, it } from 'vitest';
import { pmTicketNextAction } from './pmTicketNextAction';

describe('PM ticket queue next-action labels', () => {
  it.each([
    ['review_ticket', 'Review request'],
    ['reply', 'Reply to client'],
    ['agree_scope', 'Waiting for client scope decision'],
    ['authorize_work', 'Authorize agreed work'],
    ['execute_work', 'Developer work in progress'],
    ['assess_result', 'Assess completed work'],
    ['share_result', 'Share approved result'],
    ['review_result', 'Waiting for client result review'],
    ['close_ticket', 'Close accepted request'],
    ['triage_correction', 'Review correction request'],
    ['handle_withdrawal', 'Review withdrawal request'],
    ['resolve_hold', 'Resolve request hold'],
    [null, null],
  ] as const)('maps %s to a precise queue hint', (action, label) => {
    expect(pmTicketNextAction(action)).toBe(label);
  });
});
