import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Download, FileText, LoaderCircle, X } from 'lucide-react';
import { apiService } from '../../shared/services/apiService';

type PlanDocument = Awaited<ReturnType<typeof apiService.getOrchestrationPlans>>['documents'][number];

export interface PlanPanelRequest { projectId: string; runId: string; planVersion: number; auto: boolean }

/**
 * Where a saved plan opens. The chat provides one so the plan becomes a tab in its side
 * panel beside the agents; without a chat panel handler the plan opens as an overlay.
 */
export const PlanPanelContext = createContext<((request: PlanPanelRequest) => void) | null>(null);

export const planFileName = (version: number) => `build-plan-v${version}.md`;

/** The plan's version picker, source toggle, download and rendered Markdown. */
export function PlanDocumentBody({ documents, planVersion, header }: { documents: PlanDocument[]; planVersion: number; header?: React.ReactNode }) {
  const [selected, setSelected] = useState(planVersion);
  const [source, setSource] = useState(false);
  useEffect(() => setSelected(planVersion), [planVersion]);
  const document = documents.find(item => item.version === selected) ?? documents.find(item => item.version === planVersion);
  const download = () => {
    if (!document) return;
    const url = URL.createObjectURL(new Blob([document.content], { type: 'text/markdown;charset=utf-8' }));
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = document.fileName;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <>
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-divider px-4 py-3">
      {header}
      <div className="flex w-full flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-2">Version <select value={document?.version ?? selected} onChange={event => setSelected(Number(event.target.value))} className="rounded-md border border-control bg-well px-2 py-1.5">
          {[...documents].reverse().map(item => <option key={item.version} value={item.version}>v{item.version}{item.version === planVersion ? ' · current' : ''}</option>)}
        </select></label>
        <button type="button" onClick={() => setSource(value => !value)} className="ml-auto rounded-md border border-divider px-2 py-1.5">{source ? 'Preview' : 'View source'}</button>
        <button type="button" onClick={download} className="flex items-center gap-1 rounded-md border border-divider px-2 py-1.5"><Download size={13} />Download .md</button>
      </div>
    </header>
    <div className="min-h-0 flex-1 overflow-auto p-5 sm:p-7">
      {!document ? <p className="text-xs text-content-secondary">This plan version is not available.</p>
        : source ? <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6">{document.content}</pre>
        : <div className="break-words text-sm leading-7 [&_h1]:mb-6 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:border-b [&_h2]:border-divider [&_h2]:pb-2 [&_h2]:text-lg [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:font-semibold [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-5"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{ img: () => null, a: ({ children }) => <span>{children}</span> }}>{document.content}</ReactMarkdown></div>}
    </div>
  </>;
}

/** A saved plan as a side-panel tab: loads its documents and shows them. */
export function PlanDocumentTab({ projectId, runId, planVersion }: { projectId: string; runId: string; planVersion: number }) {
  const [documents, setDocuments] = useState<PlanDocument[] | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError('');
    void apiService.getOrchestrationPlans(projectId, runId)
      .then(result => { if (!cancelled) setDocuments(result.documents); })
      .catch(failure => { if (!cancelled) setError(failure instanceof Error ? failure.message : 'The plan document could not be loaded.'); });
    return () => { cancelled = true; };
  }, [projectId, runId, retry]);
  if (error) return <p role="alert" className="p-5 text-xs text-status-danger">{error} <button type="button" onClick={() => setRetry(value => value + 1)} className="underline">Retry</button></p>;
  if (!documents) return <p role="status" className="flex items-center gap-2 p-5 text-xs text-content-secondary"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Loading the plan…</p>;
  return <div className="flex min-h-0 flex-1 flex-col text-content"><PlanDocumentBody documents={documents} planVersion={planVersion} /></div>;
}

export function OrchestrationPlanPreview({ projectId, runId, planVersion, autoShow = true, onReady }: {
  projectId: string; runId: string; planVersion: number; autoShow?: boolean; onReady?: (version: number) => void;
}) {
  const openInPanel = useContext(PlanPanelContext);
  const [documents, setDocuments] = useState<PlanDocument[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const headingId = useId();
  const readyCallback = useRef(onReady);
  readyCallback.current = onReady;
  const panelOpener = useRef(openInPanel);
  panelOpener.current = openInPanel;
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let cancelled = false;
    setError('');
    setDocuments([]);
    void apiService.getOrchestrationPlans(projectId, runId).then(result => {
      if (cancelled) return;
      if (!result.documents.some(document => document.version === planVersion)) throw new Error('The current plan document is not available yet. Retry before starting work.');
      setDocuments(result.documents);
      if (autoShow) {
        if (panelOpener.current) panelOpener.current({ projectId, runId, planVersion, auto: true });
        else setOpen(true);
      }
      readyCallback.current?.(planVersion);
    }).catch(failure => { if (!cancelled) setError(failure instanceof Error ? failure.message : 'The plan document could not be loaded.'); });
    return () => { cancelled = true; };
  }, [projectId, runId, planVersion, autoShow, retry]);
  useEffect(() => { if (open) closeButton.current?.focus(); }, [open]);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const show = () => {
    if (openInPanel) openInPanel({ projectId, runId, planVersion, auto: false });
    else setOpen(true);
  };
  const current = documents.find(item => item.version === planVersion);
  return <section className="rounded-xl border border-divider bg-selected p-3" aria-label="Saved plan document">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><div className="flex items-center gap-2 text-sm font-medium text-link"><FileText size={16} />Build plan · v{planVersion}</div>
        <p className="mt-1 text-xs text-content-secondary">Each plan is saved as Markdown before its tasks begin.</p></div>
      <button ref={trigger} type="button" disabled={!current} onClick={show} className="rounded-lg border border-divider px-3 py-2 text-xs text-link hover:bg-surface-high disabled:opacity-40">{documents.length ? 'Open plan.md' : 'Loading plan…'}</button>
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-status-danger">{error} <button type="button" onClick={() => setRetry(value => value + 1)} className="underline">Retry</button></p>}
    {open && current && createPortal(<aside role="dialog" aria-modal="false" aria-labelledby={headingId} onKeyDown={event => { if (event.key === 'Escape') close(); }}
      className="fixed bottom-3 right-3 top-16 z-50 flex w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-divider bg-surface-raised text-content shadow-2xl md:w-[min(55vw,900px)]">
      <PlanDocumentBody documents={documents} planVersion={planVersion} header={<>
        <FileText size={16} className="text-link" /><h2 id={headingId} className="min-w-0 flex-1 truncate text-sm font-semibold">{current.fileName}</h2>
        <button ref={closeButton} type="button" onClick={close} aria-label="Close plan preview" className="rounded-md p-2 hover:bg-surface-high"><X size={18} /></button>
      </>} />
    </aside>, window.document.body)}
  </section>;
}

