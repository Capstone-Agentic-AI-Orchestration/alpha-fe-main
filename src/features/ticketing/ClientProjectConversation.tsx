import { useCallback, useEffect, useRef, useState } from 'react';
import { ClientTicketApiError, clientTicketApi, type ClientProject } from './clientApi';
import { CxPageHeader } from './clientKit';
import { ProjectConversationView } from './ProjectConversationView';
import type { ConversationItem, ConversationRequest } from './projectConversation';

const REFRESH_MS = 30_000;
const newOperationId = () => crypto.randomUUID();
const errorText = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;

/**
 * The client's one conversation about a project: questions and answers, the
 * requests made here (a checklist they can tick off), and what the project
 * manager did with each request.
 */
export function ClientProjectConversation({ api = clientTicketApi, project, clientName, readOnly = false, canCreateRequests = true,
  focusTicketId = null, onBack, onOpenRequest }: {
  api?: typeof clientTicketApi;
  project: ClientProject;
  clientName: string;
  readOnly?: boolean;
  canCreateRequests?: boolean;
  focusTicketId?: string | null;
  onBack: () => void;
  onOpenRequest: (request: ConversationRequest) => void;
}) {
  const [items, setItems] = useState<ConversationItem[] | null>(null);
  const [requests, setRequests] = useState<ConversationRequest[] | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const token = useRef(0);
  const { workspaceId, projectId } = project;

  const load = useCallback(async (quiet = false) => {
    const current = ++token.current;
    if (!quiet) { setItems(null); setRequests(null); setError(''); }
    try {
      const [timeline, list] = await Promise.all([api.getProjectConversation(workspaceId, projectId), api.getProjectConversationRequests(workspaceId, projectId)]);
      if (current !== token.current) return;
      setItems(timeline.items); setRequests(list.items); setError('');
    } catch (failure) {
      if (current !== token.current || quiet) return;
      setError(failure instanceof ClientTicketApiError && failure.status === 404
        ? 'This conversation isn’t available yet. Your requests are still in the list on the Requests page.'
        : errorText(failure, 'The conversation could not be loaded. Refresh to try again.'));
    }
  }, [api, workspaceId, projectId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const run = async (work: () => Promise<unknown>, fallback: string): Promise<boolean> => {
    setBusy(true); setActionError('');
    try { await work(); await load(true); return true; }
    catch (failure) { setActionError(errorText(failure, fallback)); return false; }
    finally { setBusy(false); }
  };

  const send = (body: string) => void run(async () => {
    await api.sendProjectFeedbackMessage(workspaceId, projectId, { schemaVersion: 1, operationId: newOperationId(), body });
    setDraft('');
  }, 'Your message was not sent. Try again.');

  const toggle = (request: ConversationRequest, done: boolean) => void run(async () => {
    const updated = await api.setConversationRequestDone(workspaceId, projectId, request.ticketId, done);
    setRequests(previous => previous?.map(item => item.ticketId === updated.ticketId ? updated : item) ?? previous);
  }, 'That request could not be updated. Try again.');

  // A request made here is an ordinary request on this project, so it keeps the
  // usual plan and result steps and shows on the Requests and project pages too.
  const createRequest = (input: { title: string; description: string }) => run(async () => {
    const context = await api.getIntakeContext(workspaceId);
    if (!context.canCreate) throw new Error('New requests are not available for this project right now.');
    await api.createTicket({ intakeContextId: context.intakeContextId, schemaVersion: 1, operationId: newOperationId(),
      title: input.title, description: input.description, projectPreference: { kind: 'shared_project', optionId: project.intakeOptionId } });
  }, 'Your request was not sent. Try again.');

  return <section className="cx-page flex min-h-0 flex-col" aria-labelledby="client-conversation-title">
    <CxPageHeader titleId="client-conversation-title" title={project.name} back={{ label: 'Back to requests', onClick: onBack, disabled: busy }}
      description="Your conversation with your project manager about this project. Make new requests here and tick them off when they are done." />
    {error && <p role="alert" className="cx-error">{error}</p>}
    {/* A fixed height keeps the composer in view; the chat and the requests panel scroll inside it. */}
    <div className="flex flex-col rounded-xl border border-divider bg-surface lg:h-[calc(100dvh-20rem)] lg:min-h-[440px] lg:overflow-hidden">
      <ProjectConversationView role="client" projectName={project.name} items={items} requests={requests} error=""
        actionError={actionError} clientName={clientName} clientInitial={clientName.trim()[0]?.toUpperCase() ?? 'C'}
        draft={draft} onDraftChange={setDraft} onSend={send} busy={busy} writesAvailable={!readOnly}
        onToggleDone={toggle} onCreateRequest={readOnly || !canCreateRequests ? undefined : createRequest}
        onOpenRequest={onOpenRequest} focusTicketId={focusTicketId} inputId={`client-conversation-${projectId}`} />
    </div>
  </section>;
}
