import { describe, expect, it } from 'vitest';
import { acceptOutcome, handledOutcome, inquiryContact, inquiryFor, inquiryKind, inquiryStatus, shortReference } from './inquiryPresentation';

const proposal = { kind: 'project_proposal' as const, status: 'pending' as const, fullName: 'zane@example.com', email: 'zane@example.com', company: null };
const inquiry = { kind: 'public_inquiry' as const, status: 'pending' as const, fullName: 'Ana Cruz', email: 'ana@example.com', company: 'Cruz Bakery' };

describe('how an inquiry reads on the Inquiries page', () => {
  it('names the kind of request and which project it is for', () => {
    expect(inquiryKind(proposal)).toBe('New project request');
    expect(inquiryFor(proposal)).toBe('For a new project');
    expect(inquiryKind(inquiry)).toBe('Website inquiry');
    expect(inquiryFor(inquiry)).toBe('Project not decided');
  });

  it('shortens the 36-character reference to one people can read', () => {
    expect(shortReference('INQ-02D05BE4B1EF4B38A534C0BEE72B1EA0')).toBe('INQ-02D05BE4');
    expect(shortReference(undefined)).toBeNull();
  });

  it('shows the email once when a proposal stored it as the name, and never says "No company linked"', () => {
    expect(inquiryContact(proposal)).toEqual({ name: 'zane@example.com', detail: null });
    expect(inquiryContact(inquiry)).toEqual({ name: 'Ana Cruz', detail: 'ana@example.com · Cruz Bakery' });
  });

  it('words the status the same everywhere', () => {
    expect(inquiryStatus(proposal, 'pending')).toBe('Review project idea');
    expect(inquiryStatus({ ...proposal, status: 'awaiting_client' }, 'pending')).toBe('Waiting for client reply');
    expect(inquiryStatus({ ...proposal, clarificationMessages: [{ id: 'm', author: 'client', body: 'Retro', createdAt: '2026-11-19T00:00:00Z' }] }, 'pending')).toBe('Review client reply');
    expect(inquiryStatus(inquiry, 'pending')).toBe('New · email not verified');
    expect(inquiryStatus({ ...proposal, status: 'accepted' }, 'handled')).toBe('Accepted');
    expect(inquiryStatus({ ...proposal, status: 'declined' }, 'handled')).toBe('Declined');
  });

  it('says what became of a handled inquiry, without promising a project that was not made', () => {
    expect(handledOutcome({ ...proposal, status: 'accepted' })).toContain('start or link the project');
    expect(handledOutcome({ ...proposal, status: 'declined' })).toBe('Declined. No request or project was created.');
    expect(handledOutcome({ ...inquiry, status: 'declined' })).toBe('Declined. No request or client access was created.');
  });

  it('says what starting a project does', () => {
    expect(acceptOutcome(proposal, 'Alpha Workspace')).toContain('creates it in Alpha Workspace');
    expect(acceptOutcome(proposal, 'Alpha Workspace')).toContain('lets this client see the project');
    expect(acceptOutcome(inquiry, null)).toContain('an invitation to the client portal');
  });

  it('names the project an accepted inquiry went into, and says when it has none yet', () => {
    const accepted = { ...proposal, status: 'accepted' as const, acceptedTicketId: 't1' };
    expect(inquiryFor({ ...accepted, acceptedProjectName: 'Informational Website' })).toBe('Project: Informational Website');
    expect(inquiryFor(accepted)).toBe('No project linked yet');
    expect(handledOutcome({ ...accepted, acceptedProjectName: 'Informational Website' })).toBe('Accepted into Informational Website. The client follows it from their projects.');
  });
});
