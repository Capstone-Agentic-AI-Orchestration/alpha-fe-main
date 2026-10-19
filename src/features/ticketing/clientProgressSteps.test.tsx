import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ClientTicketDetail } from './clientApi';
import { clientProgressSteps } from './clientProgressSteps';
import { ClientProgressStrip } from './ClientProgressStrip';

type Case = Pick<ClientTicketDetail, 'status' | 'requestedAction' | 'scope' | 'delivery'>;
const scope = (agreed: boolean) => ({ id: 's1', summary: 'Work', proposedAt: '2026-10-17T00:00:00Z', agreed });
const delivery = (accepted: boolean) => ({ id: 'd1', scopeVersionId: 's1', summary: 'Done', sharedAt: '2026-10-18T00:00:00Z', accepted });
const states = (ticket: Case) => clientProgressSteps(ticket).map(step => step.state[0]).join('');

describe('client progress steps', () => {
  it.each<[string, Case, string]>([
    ['a new request', { status: 'received', requestedAction: null, scope: null, delivery: null }, 'cuuuu'],
    ['PM review', { status: 'under_review', requestedAction: null, scope: null, delivery: null }, 'dcuuu'],
    ['asked for more details', { status: 'awaiting_client', requestedAction: 'reply', scope: null, delivery: null }, 'dcuuu'],
    ['a proposed scope', { status: 'awaiting_client', requestedAction: 'agree_scope', scope: scope(false), delivery: null }, 'ddcuu'],
    ['a scope the client asked to change', { status: 'under_review', requestedAction: null, scope: scope(false), delivery: null }, 'ddcuu'],
    ['an agreed scope waiting to start', { status: 'under_review', requestedAction: null, scope: scope(true), delivery: null }, 'dddcu'],
    ['work in progress', { status: 'in_progress', requestedAction: null, scope: scope(true), delivery: null }, 'dddcu'],
    ['a result back for a fix', { status: 'under_review', requestedAction: null, scope: scope(true), delivery: delivery(false) }, 'dddcu'],
    ['a result to review', { status: 'ready_for_review', requestedAction: 'review_result', scope: scope(true), delivery: delivery(false) }, 'ddddc'],
    ['an accepted result', { status: 'ready_for_review', requestedAction: null, scope: scope(true), delivery: delivery(true) }, 'ddddd'],
    ['an accepted, closed request', { status: 'closed', requestedAction: null, scope: scope(true), delivery: delivery(true) }, 'ddddd'],
  ])('shows %s', (_name, ticket, expected) => { expect(states(ticket)).toBe(expected); });

  it.each<[string, Case]>([
    ['on hold', { status: 'on_hold', requestedAction: null, scope: scope(true), delivery: null }],
    ['declined', { status: 'declined', requestedAction: null, scope: null, delivery: null }],
    ['cancelled', { status: 'cancelled', requestedAction: null, scope: null, delivery: null }],
    ['closed without a result', { status: 'closed', requestedAction: null, scope: null, delivery: null }],
  ])('shows no path for a request that is %s', (_name, ticket) => { expect(clientProgressSteps(ticket)).toEqual([]); });

  it('marks only the current step as needing the client, and only when something is asked of them', () => {
    const asked = clientProgressSteps({ status: 'awaiting_client', requestedAction: 'agree_scope', scope: scope(false), delivery: null });
    expect(asked.filter(step => step.needsYou).map(step => step.label)).toEqual(['Agree scope']);
    const quiet = clientProgressSteps({ status: 'in_progress', requestedAction: null, scope: scope(true), delivery: null });
    expect(quiet.some(step => step.needsYou)).toBe(false);
  });

  it('renders an accessible list that names the current step and what the client has to do', () => {
    const html = renderToStaticMarkup(<ClientProgressStrip steps={clientProgressSteps({ status: 'awaiting_client', requestedAction: 'agree_scope', scope: scope(false), delivery: null })} />);
    expect(html).toContain('aria-label="Request progress"');
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('Agree scope · you');
    expect(html).toContain('Step 3 of 5: Agree scope · you');
    expect(html).toContain('(current step)');
    expect(html).toContain('(done)');
    expect(renderToStaticMarkup(<ClientProgressStrip steps={[]} />)).toBe('');
    const finished = renderToStaticMarkup(<ClientProgressStrip steps={clientProgressSteps({ status: 'closed', requestedAction: null, scope: scope(true), delivery: delivery(true) })} />);
    expect(finished).toContain('All steps complete');
  });
});
