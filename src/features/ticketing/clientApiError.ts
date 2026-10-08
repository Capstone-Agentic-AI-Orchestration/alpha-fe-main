export class ClientTicketApiError extends Error {
  constructor(
    readonly status: number | null,
    message: string,
    readonly code: string | null = null,
    readonly reconciliationRequired = false,
  ) {
    super(message);
    this.name = 'ClientTicketApiError';
  }
}
