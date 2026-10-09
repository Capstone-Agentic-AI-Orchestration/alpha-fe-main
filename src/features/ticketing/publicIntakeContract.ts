/** Wire shape paired with backend src/ticketing/intake.ts. */
export const PUBLIC_TICKET_INQUIRY_SCHEMA_VERSION = 1 as const;

export interface PublicTicketInquiryPayload {
  schemaVersion: typeof PUBLIC_TICKET_INQUIRY_SCHEMA_VERSION;
  /** UUID idempotency key. Reuse for an unchanged retry; rotate after edits. */
  operationId: string;
  fullName: string;
  email: string;
  company: string | null;
  title: string;
  description: string;
  requestedDeadline: string | null;
}

export interface PublicTicketInquiryRequest {
  inquiry: PublicTicketInquiryPayload;
}

/** The anonymous caller must never receive a ticket id, reference or status. */
export interface PublicTicketInquiryResponse {
  received: true;
}
