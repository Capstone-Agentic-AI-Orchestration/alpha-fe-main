import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { ApiRequestError } from '@/shared/services/apiService';
import { PmDeliveryAssessment } from './PmDeliveryAssessment';
import { pmTicketApi, type PmTicketDetail } from './pmApi';

// The project uses Node/static-markup tests without a DOM dependency. This small
// hook harness drives the real form handlers and their asynchronous UI state.
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], index: 0 }));
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useEffect: () => undefined,
  useState: (initial: unknown) => {
    const index = hooks.index++;
    if (!(index in hooks.slots)) hooks.slots[index] = initial;
    return [hooks.slots[index], (value: unknown) => {
      hooks.slots[index] = typeof value === 'function' ? value(hooks.slots[index]) : value;
    }];
  },
  useRef: (initial: unknown) => {
    const index = hooks.index++;
    if (!(index in hooks.slots)) hooks.slots[index] = { current: initial };
    return hooks.slots[index];
  },
}));

function ticket(): PmTicketDetail {
  return {
    id: 'ticket', reference: 'TEST-1', title: 'Test request', description: 'Test only', companyLabel: 'Test client',
    version: 5, status: 'in_progress', createdAt: '2026-10-28T00:00:00Z', updatedAt: '2026-10-28T00:00:00Z',
    closedAt: null, readOnly: false, writesAvailable: true, requestedAction: null,
    sharedProjectName: 'Test project', relatedTicket: null, request: null, delivery: null,
    scope: { id: 'scope', summary: 'Agreed work', agreed: true, proposedAt: '2026-10-28T00:00:00Z' },
    internal: { updatedAt: '2026-10-28T00:00:00Z', projectId: 'project', requiredIssueIds: ['task'],
      actionOwner: 'pm', nextAction: 'assess_result', authorizedScopeVersionId: 'scope',
      correctionRequestedFor: null, withdrawalRequested: false, closureReason: null, request: null,
      scopeVersion: { id: 'scope', summary: 'Agreed work', developerBrief: 'Internal brief', proposedAt: '2026-10-28T00:00:00Z', immutable: true, clientVisible: true },
      deliveryAssessment: null },
  };
}
// Event props remain typed at the component boundary; these tests inspect the
// native element tree returned by that component rather than mount a browser.
type Element = ReactElement<{ children?: ReactNode; [key: string]: any }>;
function elements(node: ReactNode): Element[] {
  if (!isValidElement(node)) return [];
  const element = node as Element;
  return [element, ...Children.toArray(element.props.children).flatMap(elements)];
}
function form(tree: ReactNode) { return elements(tree).find(element => element.props['aria-label'] === 'Prepare client result'); }
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
beforeEach(() => { hooks.slots = []; hooks.index = 0; vi.restoreAllMocks(); });

describe('PM result preparation UI', () => {
  function setup(value = ticket(), options: { disabled?: boolean; clientAccessActive?: boolean } = {}) {
    const onPrepared = vi.fn(); const onAssess = vi.fn(async () => true);
    const render = () => {
      hooks.index = 0;
      return PmDeliveryAssessment({ ticket: value, clientAccessActive: options.clientAccessActive ?? true,
        disabled: options.disabled ?? false, onAssess, onPrepared });
    };
    const change = (summary: string) => elements(render()).find(element => element.type === 'textarea')!.props.onChange({ target: { value: summary } });
    const submit = () => form(render())!.props.onSubmit({ preventDefault: () => undefined });
    return { render, change, submit, onPrepared, onAssess };
  }

  it('prepares the typed summary, refreshes the ticket, and keeps assessment separate', async () => {
    const prepare = vi.spyOn(pmTicketApi, 'prepareResult').mockResolvedValue({ deliveryId: 'candidate' });
    const ui = setup(); ui.change('  Agreed report filters are ready.  '); ui.submit(); await flush();
    expect(prepare).toHaveBeenCalledWith('ticket', {
      schemaVersion: 1, operationId: expect.any(String), expectedVersion: 5, publicSummary: 'Agreed report filters are ready.',
    }, expect.any(AbortSignal));
    expect(ui.onPrepared).toHaveBeenCalledTimes(1);
    expect(ui.onAssess).not.toHaveBeenCalled();
    expect(elements(ui.render()).some(element => element.props.role === 'status'
      && String(element.props.children).includes('Result prepared'))).toBe(true);
  });
  it.each(['execute_work', 'reply', 'share_result'] as const)('does not offer preparation for next action %s', action => {
    const value = ticket(); value.internal.nextAction = action;
    expect(form(setup(value).render())).toBeUndefined();
  });
  it.each(['readOnly', 'writesUnavailable', 'scopeMismatch', 'withdrawal', 'noTasks', 'noAccess'])('respects the %s gate', gate => {
    const value = ticket();
    if (gate === 'readOnly') value.readOnly = true;
    if (gate === 'writesUnavailable') value.writesAvailable = false;
    if (gate === 'scopeMismatch') value.internal.authorizedScopeVersionId = 'other';
    if (gate === 'withdrawal') value.internal.withdrawalRequested = true;
    if (gate === 'noTasks') value.internal.requiredIssueIds = [];
    expect(form(setup(value, { clientAccessActive: gate !== 'noAccess' }).render())).toBeUndefined();
  });
  it('blocks disabled or empty submissions and duplicate clicks during preparation', async () => {
    const prepare = vi.spyOn(pmTicketApi, 'prepareResult').mockReturnValue(new Promise(() => undefined));
    const disabled = setup(ticket(), { disabled: true }); disabled.change('Summary'); disabled.submit();
    expect(prepare).not.toHaveBeenCalled();
    hooks.slots = [];
    const ui = setup(); ui.change('   '); ui.submit(); expect(prepare).not.toHaveBeenCalled();
    ui.change('Summary'); ui.submit(); ui.submit(); expect(prepare).toHaveBeenCalledTimes(1);
    expect(elements(ui.render()).find(element => element.type === 'textarea')!.props.disabled).toBe(true);
  });
  it.each([new ApiRequestError(409, 'Changed'), new ApiRequestError(null, 'Unknown', null, true)])(
    'retains the draft and requires refresh after conflict or uncertain transport (%s)', async error => {
      const prepare = vi.spyOn(pmTicketApi, 'prepareResult').mockRejectedValue(error);
      const ui = setup(); ui.change('Keep this summary'); ui.submit(); await flush();
      const tree = elements(ui.render());
      expect(tree.find(element => element.type === 'textarea')!.props.value).toBe('Keep this summary');
      expect(tree.find(element => element.type === 'textarea')!.props.disabled).toBe(true);
      expect(tree.some(element => element.props.role === 'alert' && /Refresh/.test(String(element.props.children)))).toBe(true);
      ui.submit(); expect(prepare).toHaveBeenCalledTimes(1); expect(ui.onPrepared).not.toHaveBeenCalled();
    });
  it('retains the draft and allows retry after a definitive server rejection', async () => {
    const prepare = vi.spyOn(pmTicketApi, 'prepareResult').mockRejectedValue(new ApiRequestError(403, 'Denied'));
    const ui = setup(); ui.change('Summary'); ui.submit(); await flush();
    expect(elements(ui.render()).find(element => element.type === 'textarea')!.props.value).toBe('Summary');
    expect(elements(ui.render()).some(element => element.props.role === 'alert')).toBe(true);
    prepare.mockResolvedValue({ deliveryId: 'candidate' }); ui.submit(); await flush();
    expect(prepare).toHaveBeenCalledTimes(2); expect(ui.onPrepared).toHaveBeenCalledTimes(1);
  });
});
