import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ExternalLink, RefreshCw, Send } from 'lucide-react';

import { ApiRequestError } from '@/shared/services/apiService';
import {
  pmTicketApi, type PmProjectClientPreview, type PmProjectFeedbackMessage, type PmProjectPreviewClient,
} from '@/features/ticketing/pmApi';
import { input, primary, secondary } from '@/features/ticketing/ticketUi';

export function ProjectClientPreviewPanel({ projectId, canManage, conversationOnly=false, requestedClientId, api = pmTicketApi }: {
  projectId: string;
  canManage: boolean;
  conversationOnly?: boolean;
  requestedClientId?: string;
  api?: typeof pmTicketApi;
}) {
  const [preview, setPreview] = useState<PmProjectClientPreview | null>(null);
  const [repository, setRepository] = useState('');
  const [branch, setBranch] = useState<'main' | 'uat'>('uat');
  const [url, setUrl] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [clients, setClients] = useState<PmProjectPreviewClient[]>([]);
  const [clientLoading, setClientLoading] = useState(true);
  const [clientError, setClientError] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [messages, setMessages] = useState<PmProjectFeedbackMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState('');
  const [messagesRefresh, setMessagesRefresh] = useState(0);
  const [moreLoading, setMoreLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  useEffect(()=>{setDraft('');setSendError('');},[selectedClientId]);

  const selectedClient = useMemo(() => clients.find(client => client.clientId === selectedClientId) ?? null,
    [clients, selectedClientId]);
  const previewFormValid = useMemo(() => {
    if(branch!=='uat')return false;
    if (!repository.trim()) return false;
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository.trim())) return false;
    try {
      const parsed = new URL(url.trim());
      return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.port
        && parsed.hostname !== 'vercel.app' && parsed.hostname.endsWith('.vercel.app');
    } catch { return false; }
  }, [repository, url,branch]);

  useEffect(() => {
    let active = true;
    if(conversationOnly){setSettingsLoading(false);return;}
    setSettingsLoading(true); setSettingsError(''); setSettingsSaved(false);
    void api.getProjectClientPreview(projectId).then(result => {
      if (!active) return;
      setPreview(result.preview);
      setRepository(result.preview?.repository ?? ''); setBranch(result.preview?.branch ?? 'uat'); setUrl(result.preview?.url ?? '');
    }).catch(error => {
      if (active) setSettingsError(errorText(error, 'settings'));
    }).finally(() => { if (active) setSettingsLoading(false); });
    return () => { active = false; };
  }, [api, projectId,conversationOnly]);

  useEffect(() => {
    let active = true;
    setClientLoading(true); setClientError(''); setClients([]); setSelectedClientId('');
    void api.listProjectPreviewClients(projectId).then(result => {
      if (!active) return;
      const unique = result.items.filter((client, index, items) => items.findIndex(item => item.clientId === client.clientId) === index);
      setClients(unique);
      if (requestedClientId!==undefined) setSelectedClientId(unique.some(client=>client.clientId===requestedClientId)?requestedClientId:'');
      else if (unique.length === 1) setSelectedClientId(unique[0].clientId);
    }).catch(error => {
      if (active) setClientError(errorText(error, 'clients'));
    }).finally(() => { if (active) setClientLoading(false); });
    return () => { active = false; };
  }, [api, projectId,requestedClientId]);

  useEffect(() => {
    if (!selectedClientId) { setMessages([]); setCursor(null); setMessagesLoading(false); return; }
    let active = true;
    setMessagesLoading(true); setMessagesError(''); setMessages([]); setCursor(null);
    void api.getProjectFeedbackMessages(projectId, selectedClientId, { limit: 50 }).then(page => {
      if (!active) return;
      const safeItems = page.items.filter(message => message.clientId === selectedClientId);
      setMessages(safeItems); setCursor(page.nextCursor);
    }).catch(error => {
      if (active) setMessagesError(errorText(error, 'messages'));
    }).finally(() => { if (active) setMessagesLoading(false); });
    return () => { active = false; };
  }, [api, projectId, selectedClientId, messagesRefresh]);

  async function savePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || settingsSaving || !previewFormValid) return;
    const next = { repository: repository.trim(), branch, url: url.trim() } satisfies PmProjectClientPreview;
    setSettingsSaving(true); setSettingsError(''); setSettingsSaved(false);
    try {
      const result = await api.setProjectClientPreview(projectId, next);
      setPreview(result.preview); setRepository(result.preview?.repository ?? ''); setBranch(result.preview?.branch ?? 'uat');
      setUrl(result.preview?.url ?? ''); setSettingsSaved(true);
    } catch (error) { setSettingsError(errorText(error, 'save')); }
    finally { setSettingsSaving(false); }
  }

  async function clearPreview() {
    if (!canManage || settingsSaving || !preview) return;
    setSettingsSaving(true); setSettingsError(''); setSettingsSaved(false);
    try {
      const result = await api.setProjectClientPreview(projectId, null);
      setPreview(result.preview); setRepository(''); setUrl(''); setBranch('uat'); setSettingsSaved(true);
    } catch (error) { setSettingsError(errorText(error, 'save')); }
    finally { setSettingsSaving(false); }
  }

  async function loadEarlierMessages() {
    if (!selectedClientId || !cursor || moreLoading) return;
    setMoreLoading(true); setMessagesError('');
    try {
      const page = await api.getProjectFeedbackMessages(projectId, selectedClientId, { limit: 50, before: cursor });
      const safeItems = page.items.filter(message => message.clientId === selectedClientId);
      setMessages(current => [...safeItems, ...current]); setCursor(page.nextCursor);
    } catch (error) { setMessagesError(errorText(error, 'messages')); }
    finally { setMoreLoading(false); }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClientId || !draft.trim() || sending) return;
    const body = draft.trim(); const operationId = crypto.randomUUID();
    setSending(true); setSendError('');
    try {
      await api.sendProjectFeedbackMessage(projectId, selectedClientId, { schemaVersion: 1, operationId, body });
      setDraft(''); setMessagesRefresh(value => value + 1);
    } catch (error) { setSendError(errorText(error, 'send')); }
    finally { setSending(false); }
  }

  return <section className="project-client-preview-panel" aria-labelledby={`client-preview-heading-${projectId}`}>
    {!conversationOnly&&<header className="project-client-preview-header">
      <div><h2 id={`client-preview-heading-${projectId}`}>Client preview &amp; feedback</h2>
        <p>Share a hosted preview and keep project feedback in a separate thread for each client with active project access.</p></div>
    </header>}

    <div className="project-client-preview-grid">
      {!conversationOnly&&<form className="project-client-preview-settings" onSubmit={event => void savePreview(event)}>
        <h3>Hosted preview</h3>
        {settingsLoading ? <p role="status">Loading the saved preview…</p> : <>
          {preview && <p className="project-client-current-preview">Currently shared: <a href={preview.url} target="_blank" rel="noreferrer">{preview.repository} · {preview.branch} <ExternalLink size={13} /></a></p>}
          <label>Repository
            <input className={input} value={repository} onChange={event => { setRepository(event.target.value); setSettingsSaved(false); }}
              placeholder="organization/repository" disabled={!canManage || settingsSaving} required />
          </label>
          <div className="project-client-preview-fields">
            <label>Branch<select className={input} value={branch} onChange={event => { setBranch(event.target.value as 'main' | 'uat'); setSettingsSaved(false); }} disabled={!canManage || settingsSaving}>
              <option value="uat">uat</option>
              {branch==='main'&&<option value="main" disabled>main (historical configuration)</option>}
            </select></label>
            <label>Preview URL<input className={input} type="url" value={url} onChange={event => { setUrl(event.target.value); setSettingsSaved(false); }}
              placeholder="https://…" disabled={!canManage || settingsSaving} required /></label>
          </div>
          {!canManage && <p>Only project managers with project edit access can change the shared preview.</p>}
        </>}
        {settingsError && <p role="alert" className="project-client-preview-error">{settingsError}</p>}
        {settingsSaved && <p role="status" className="project-client-preview-success">Preview settings saved.</p>}
        {canManage && <div className="project-client-preview-actions">
          {preview && <button type="button" className={secondary} disabled={settingsSaving} onClick={() => void clearPreview()}>Remove preview</button>}
          <button type="submit" className={primary} disabled={settingsLoading || settingsSaving || !previewFormValid}>{settingsSaving ? 'Saving…' : 'Save preview'}</button>
        </div>}
      </form>}

      <div className="project-client-feedback-panel">
        <div className="project-client-feedback-heading"><div><h3>Project conversation</h3>
          <p>{selectedClient ? `Private thread with ${selectedClient.displayName}.` : 'Messages are separated by client.'}</p></div>
          {selectedClient && <button type="button" className="client-icon-action" aria-label="Refresh selected client conversation" disabled={messagesLoading}
            onClick={() => setMessagesRefresh(value => value + 1)}><RefreshCw size={14} /></button>}
        </div>
        {clientLoading ? <p role="status" className="project-client-thread-state">Loading clients with project access…</p>
          : clientError ? <p role="alert" className="project-client-preview-error">{clientError}</p>
            : !clients.length ? <p className="project-client-thread-state">No clients with active access to this project yet.</p>
              : requestedClientId!==undefined ? <p className="project-client-selected-name">{selectedClient?.displayName??'Choose a client above to open their feedback.'}</p>
              : clients.length === 1 ? <p className="project-client-selected-name"><span>Client</span><strong>{clients[0].displayName}</strong></p>
                : <label className="project-client-selector">Client
                  <select className={input} value={selectedClientId} onChange={event => setSelectedClientId(event.target.value)}>
                    {clients.map(client => <option key={client.clientId} value={client.clientId}>{client.displayName}</option>)}
                  </select>
                </label>}
        {selectedClient && <>
          {messagesError && <p role="alert" className="project-client-preview-error">{messagesError} <button type="button" onClick={() => setMessagesRefresh(value => value + 1)}>Try again</button></p>}
          <div className="project-client-messages" aria-live="polite">
            {messagesLoading ? <p role="status" className="project-client-thread-state">Loading this client’s messages…</p>
              : messages.length ? <>
                {cursor && <button type="button" className="client-text-action" disabled={moreLoading} onClick={() => void loadEarlierMessages()}>
                  {moreLoading ? 'Loading…' : 'Load earlier messages'}</button>}
                {messages.map(message => <article className={`project-client-message ${message.author === 'pm' ? 'is-mine' : ''}`} key={message.id}>
                  <span>{message.author === 'pm' ? 'You' : selectedClient.displayName}</span><p>{message.body}</p><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>
                </article>)}
              </> : !messagesError && <p className="project-client-thread-state">No messages with this client yet.</p>}
          </div>
          <form className="project-client-composer" onSubmit={event => void sendMessage(event)}>
            <label className="sr-only" htmlFor={`pm-project-message-${projectId}`}>Message {selectedClient.displayName}</label>
            <textarea id={`pm-project-message-${projectId}`} maxLength={4000} value={draft} disabled={sending}
              onChange={event => setDraft(event.target.value)} placeholder={`Message ${selectedClient.displayName}…`} />
            {sendError && <p role="alert" className="project-client-preview-error">{sendError}</p>}
            <button type="submit" className={primary} disabled={sending || !draft.trim()}><Send size={14} />{sending ? 'Sending…' : 'Send'}</button>
          </form>
        </>}
      </div>
    </div>
  </section>;
}

function errorText(error: unknown, area: 'settings' | 'clients' | 'messages' | 'save' | 'send'): string {
  if (error instanceof ApiRequestError && error.status === 401) return 'Your sign-in expired. Sign in again to continue.';
  if (error instanceof ApiRequestError && error.status === 403) return 'Your workspace role cannot access this project conversation.';
  if (error instanceof ApiRequestError && error.status === 404) return 'This project or client access is no longer available. Refresh and check the project.';
  if (error instanceof ApiRequestError && error.reconciliationRequired) return area === 'send'
    ? 'The result is uncertain. Checking this message operation before retrying.' : 'The result is uncertain. Refresh and check the current state.';
  if (area === 'settings') return 'Could not load the saved preview settings.';
  if (area === 'clients') return 'Could not load clients with access to this project.';
  if (area === 'messages') return 'Could not load this client’s project conversation.';
  if (area === 'save') return 'Could not save the preview settings. Try again.';
  return 'Could not send the message. Try again.';
}
