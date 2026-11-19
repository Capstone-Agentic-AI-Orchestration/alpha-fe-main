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
    expect(inquiryStatus(proposal, 'pending')).toBe('Ready for your review');
    expect(inquiryStatus({ ...proposal, status: 'awaiting_client' }, 'pending')).toBe('Waiting for the client');
    expect(inquiryStatus({ ...proposal, clarificationMessages: [{ id: 'm', author: 'client', body: 'Retro', createdAt: '2026-11-19T00:00:00Z' }] }, 'pending')).toBe('Client replied');
    expect(inquiryStatus(inquiry, 'pending')).toBe('New · email not verified');
    expect(inquiryStatus({ ...proposal, status: 'accepted' }, 'handled')).toBe('Accepted');
    expect(inquiryStatus({ ...proposal, status: 'declined' }, 'handled')).toBe('Declined');
  });

  it('says what became of a handled inquiry, without promising a project that was not made', () => {
    expect(handledOutcome({ ...proposal, status: 'accepted' })).toContain('start or link the project');
    expect(handledOutcome({ ...proposal, status: 'declined' })).toBe('Declined. No request or project was created.');
    expect(handledOutcome({ ...inquiry, status: 'declined' })).toBe('Declined. No request or client access was created.');
  });

  it('says what accepting does, including that it does not start the project by itself', () => {
    expect(acceptOutcome(proposal, 'Alpha Workspace')).toContain("Alpha Workspace's Tickets");
    expect(acceptOutcome(proposal, 'Alpha Workspace')).toContain('start or link the project');
    expect(acceptOutcome(inquiry, null)).toContain('no portal access until you invite them');
  });
});
