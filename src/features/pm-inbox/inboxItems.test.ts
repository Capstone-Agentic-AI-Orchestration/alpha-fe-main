import { describe, expect, it } from 'vitest';
import type { PmCentralIntakeItem, PmClientSummary } from '@/features/ticketing/pmApi';
import type { StageSummary } from '@/features/ticketing/projectStages';
import { clientAccountId, inInboxFilter, intakeInboxItem, requestsInboxItem, sortInbox, stageInboxItem } from './inboxItems';

const intake = (extra: Partial<PmCentralIntakeItem> = {}) => ({ kind: 'public_inquiry', id: 'q1', fullName: 'Maria Santos', email: 'm@example.com',
  company: 'Casa Verde Resort', title: 'Booking site', description: 'Rooms and deposits.', requestedDeadline: null,
  submittedAt: '2026-11-26T01:00:00Z', ...extra }) as PmCentralIntakeItem;
const client = (tickets: Partial<PmClientSummary['tickets']> = {}) => ({ key: 'client:acc1', displayName: 'Lumen Dental', company: null, access: 'active',
  tickets: { needsPm: 0, waitingClient: 0, open: 0, closed: 0, unlinkedOpen: 0, accessRevoked: 0, ...tickets },
  projects: [{ projectId: 'p1', name: 'Clinic website', previewPublished: true }], lastActivityAt: '2026-11-25T00:00:00Z' }) as PmClientSummary;
const stage = (who: 'pm' | 'client' | null, kind = 'classify_round') => ({ stage: 'development', stageLabel: 'Development',
  stageChangedAt: '2026-11-26T02:00:00Z', nextAction: who ? { who, kind, label: 'Sort round 2 into revisions or fixes' } : null }) as unknown as StageSummary;

describe('the project manager Inbox', () => {
  it('lists an inquiry as the PM\'s to answer, or the prospect\'s once asked a question', () => {
    expect(intakeInboxItem(intake())).toMatchObject({ kind: 'inquiry', label: 'Inquiry', turn: 'pm', title: 'Booking site',
      who: 'Maria Santos · Casa Verde Resort · No project yet', target: { view: 'inquiries', inquiryId: 'q1' } });
    expect(intakeInboxItem(intake({ status: 'awaiting_client' })).turn).toBe('client');
    expect(intakeInboxItem(intake({ kind: 'project_proposal' })).label).toBe('Project proposal');
  });

  it('turns a project stage into whose turn it is', () => {
    expect(stageInboxItem(client(), client().projects[0], stage(null))).toBeNull();
    expect(stageInboxItem(client(), client().projects[0], stage('pm'))).toMatchObject({ kind: 'revision', turn: 'pm',
      title: 'Clinic website', who: 'Lumen Dental · Development', nextStep: 'Sort round 2 into revisions or fixes',
      target: { view: 'clients', clientKey: 'client:acc1', projectId: 'p1' } });
    expect(stageInboxItem(client(), client().projects[0], stage('client', 'answer_request'))).toMatchObject({ label: 'Change request', turn: 'client' });
  });

  it('collects a client\'s requests that need the PM', () => {
    expect(requestsInboxItem(client())).toBeNull();
    expect(requestsInboxItem(client({ needsPm: 2, unreadReplies: 1 }))?.title).toBe('2 requests need you · 1 unread reply');
  });

  it('filters by whose turn it is and what it is', () => {
    const items = [intakeInboxItem(intake()), stageInboxItem(client(), client().projects[0], stage('pm'))!, stageInboxItem(client(), client().projects[0], stage('client'))!];
    expect(items.filter(item => inInboxFilter(item, 'all'))).toHaveLength(2);
    expect(items.filter(item => inInboxFilter(item, 'inquiries')).map(item => item.kind)).toEqual(['inquiry']);
    expect(items.filter(item => inInboxFilter(item, 'requests')).map(item => item.kind)).toEqual(['revision']);
    expect(items.filter(item => inInboxFilter(item, 'waiting'))).toHaveLength(1);
  });

  it('shows the newest first and reads the client account from its key', () => {
    const older = intakeInboxItem(intake({ id: 'old', submittedAt: '2026-11-20T00:00:00Z' }));
    const newer = intakeInboxItem(intake());
    expect(sortInbox([older, newer]).map(item => item.id)).toEqual(['intake:q1', 'intake:old']);
    expect(clientAccountId(client())).toBe('acc1');
  });
});

