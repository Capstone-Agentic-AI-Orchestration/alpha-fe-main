import { describe, expect, it } from 'vitest';
import type { ClientProject } from './clientApi';
import { clientProposalView } from './clientProposalPresentation';

const shared = { workspaceId: 'ws-1', projectId: 'proj-1', name: 'Info site', updatedAt: '2026-11-19T09:00:00Z', intakeOptionId: 'opt', preview: null } as ClientProject;

describe('how a proposal reads to the client', () => {
  it('keeps the open states clear', () => {
    expect(clientProposalView({ status: 'pending' }, []).badge).toBe('With the project manager');
    expect(clientProposalView({ status: 'awaiting_client' }, []).badge).toBe('Needs your reply');
    expect(clientProposalView({ status: 'declined' }, [])).toMatchObject({ badge: 'Not moving forward', tone: 'declined' });
  });

  it('names the project an accepted proposal became and links to it when the client has it', () => {
    const view = clientProposalView({ status: 'accepted', project: { workspaceId: 'ws-1', projectId: 'proj-1', name: 'Info site' } }, [shared]);
    expect(view).toMatchObject({ badge: 'Accepted · Info site', tone: 'accepted', project: shared });
    expect(view.next).toContain('started Info site');
  });

  it('never links to a project the client cannot open yet', () => {
    expect(clientProposalView({ status: 'accepted', project: { workspaceId: 'ws-1', projectId: 'proj-1', name: 'Info site' } }, []).project).toBeNull();
  });

  it('says "being set up" while there is no project yet', () => {
    expect(clientProposalView({ status: 'accepted', project: null }, [])).toMatchObject({ badge: 'Accepted · being set up', project: null });
  });
});
