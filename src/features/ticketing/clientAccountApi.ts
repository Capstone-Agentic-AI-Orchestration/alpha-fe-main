import { ClientTicketApiError, requestJson } from './clientApi';

export interface ClientAccountSetup {
  email: string;
  action: 'set_password' | 'sign_in' | 'reset_password';
  expiresAt: string;
}
export interface ClientAccountLink {
  invitationToken: string | null;
  providerTokenHash: string;
  providerTokenType: 'invite' | 'magiclink' | 'recovery';
}
function setupView(value: ClientAccountSetup): ClientAccountSetup {
  if (!value || typeof value.email !== 'string' || !value.email.includes('@')
    || !['set_password', 'sign_in', 'reset_password'].includes(value.action)
    || !Number.isFinite(Date.parse(value.expiresAt))) throw new Error('Account setup could not be confirmed.');
  return value;
}
function setupCsrf(): string {
  const name = window.location.protocol === 'https:' ? 'alpha_client_setup_csrf' : 'alpha_client_setup_csrf_dev';
  const values = document.cookie.split(';').map(part => part.trim()).filter(part => part.startsWith(`${name}=`));
  if (values.length !== 1) throw new Error('Refresh the setup page and try again.');
  const token = decodeURIComponent(values[0].slice(name.length + 1));
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('Refresh the setup page and try again.');
  return token;
}
export const clientAccountApi = {
  async signIn(email: string, password: string) {
    try { return await requestJson<{ authenticated: true }>('/auth/sign-in', {
      method: 'POST', csrf: false, body: JSON.stringify({ email, password }),
    }); } catch (error) {
      if (error instanceof ClientTicketApiError && error.status === 401) {
        throw new Error('We could not sign you in. Check your email and password, or ask your project manager to confirm your access.');
      }
      throw error;
    }
  },
  async begin(link: ClientAccountLink) {
    return setupView(await requestJson<ClientAccountSetup>('/auth/setup/link', {
      method: 'POST', csrf: false, body: JSON.stringify({
        ...(link.invitationToken ? { invitationToken: link.invitationToken } : {}),
        providerTokenHash: link.providerTokenHash, providerTokenType: link.providerTokenType,
      }),
    }));
  },
  async setup() { return setupView(await requestJson<ClientAccountSetup>('/auth/setup')); },
  async complete(password: string) {
    return requestJson<{ authenticated: true }>('/auth/setup/complete', { method: 'POST', csrf: false,
      headers: { 'X-CSRF-Token': setupCsrf() }, body: JSON.stringify({ password }) });
  },
  recover(email: string) {
    return requestJson<{ accepted: true }>('/auth/recovery', { method: 'POST', csrf: false, body: JSON.stringify({ email }) });
  },
};
