import { useEffect, useRef, useState } from 'react';
import { Globe, ExternalLink, RotateCw, Square } from 'lucide-react';
import { desktop, isDesktop } from '@/shared/desktop';
import { getLocalPreviews, startLocalPreview, stopLocalPreview } from '@/shared/services/apiService';
import type { LocalPreview } from '@/shared/types/localPreview';

const surfaceValue = (record: LocalPreview) => ({ id: record.id, capability: record.capability });
export function useLocalPreviews(threadId: string | undefined, scope: string, enabled: boolean, onRequested: () => void) {
  const [data, setData] = useState<{ scope: string; records: LocalPreview[] }>({ scope, records: [] });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const callback = useRef(onRequested); callback.current = onRequested;
  const live = useRef<LocalPreview[]>([]);
  const generation = useRef(0);
  useEffect(() => {
    const version = ++generation.current;
    live.current = []; setError(''); setBusy(false);
    if (!threadId || !enabled || !isDesktop) return;
    let cancelled = false;
    const seen = new Set<string>();
    const poll = async () => {
      try {
        const records = await getLocalPreviews(threadId);
        if (cancelled) return;
        live.current = records;
        setData({ scope, records });
        for (const record of records) if (record.messageId && !seen.has(record.id + ':' + record.messageId)) {
          seen.add(record.id + ':' + record.messageId);
          if (['starting', 'ready'].includes(record.state)) callback.current();
        }
      } catch (error) { if (!cancelled) setError((error as Error).message); }
    };
    void poll(); const timer = setInterval(() => void poll(), 2500);
    return () => {
      cancelled = true; clearInterval(timer);
      const records = live.current;
      // Main owns these capabilities, so stopping still works after account/workspace switches.
      for (const record of records) if (['starting', 'ready'].includes(record.state)) void desktop?.localPreview?.('stop', surfaceValue(record)).catch(() => {});
      if (generation.current === version) live.current = [];
    };
  }, [threadId, scope, enabled]);
  const records = data.scope === scope ? data.records : [];
  const start = async (repository?: string) => {
    if (!threadId || busy) return;
    const version = generation.current; setBusy(true); setError('');
    try {
      const record = await startLocalPreview(threadId, repository);
      if (generation.current !== version) { await desktop?.localPreview?.('stop', surfaceValue(record)); return; }
      live.current = [...live.current.filter(row => row.id !== record.id), record];
      setData({ scope, records: live.current }); callback.current();
    } catch (error) { if (generation.current === version) setError((error as Error).message); }
    finally { if (generation.current === version) setBusy(false); }
  };
  const stop = async () => {
    const record = records.at(-1); if (!threadId || !record) return;
    try { await desktop?.localPreview?.('stop', surfaceValue(record)); await stopLocalPreview(threadId, record.id); setData({ scope, records: records.map(row => row.id === record.id ? { ...row, state: 'stopped', origin: undefined } : row) }); }
    catch (error) { setError((error as Error).message); }
  };
  return { records, record: records.at(-1), error, busy, start, stop };
}

export function WebPreviewCard({ record, onOpen }: { record: LocalPreview; onOpen: () => void }) {
  return <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
    <Globe className="h-5 w-5 shrink-0 text-sky-300" /><div className="min-w-0 flex-1"><div className="text-xs font-semibold text-white">Web preview</div><div className="truncate text-[11px] text-gray-400">Website · Local · {record.state}</div></div>
    <details className="relative"><summary className="cursor-pointer rounded-md border border-white/10 px-2 py-1 text-xs text-gray-300">Open in</summary><div className="absolute right-0 z-50 mt-1 w-40 rounded-lg border border-white/10 bg-surface-raised p-1 shadow-xl"><button type="button" onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); onOpen(); }} className="block w-full rounded p-2 text-left text-xs hover:bg-white/10">Right panel</button><button type="button" disabled={record.state !== 'ready'} onClick={() => void desktop?.localPreview?.('external', surfaceValue(record)).catch(() => {})} className="block w-full rounded p-2 text-left text-xs hover:bg-white/10 disabled:opacity-40">Default browser</button></div></details>
  </div>;
}

function NativePreview({ record, blocked }: { record: LocalPreview; blocked: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (blocked || !desktop?.localPreview) return;
    let cancelled = false;
    let pending = false;
    const update = () => {
      const node = container.current; if (!node || cancelled || pending) return;
      const rect = node.getBoundingClientRect();
      const obscured = Boolean(document.querySelector('[role="dialog"], [role="menu"], details[open]')) || document.hidden;
      pending = true;
      const job = obscured ? desktop!.localPreview!('detach') : desktop!.localPreview!('attach', { ...surfaceValue(record), bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } });
      void job.then(() => { if (!cancelled) setError(''); }).catch(error => { if (!cancelled) setError(error.message); }).finally(() => { pending = false; });
    };
    const observer = new ResizeObserver(update); if (container.current) observer.observe(container.current);
    const mutations = new MutationObserver(update); mutations.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'aria-expanded'] });
    window.addEventListener('resize', update); document.addEventListener('visibilitychange', update);
    const timer = setInterval(update, 2000); update();
    return () => { cancelled = true; observer.disconnect(); mutations.disconnect(); window.removeEventListener('resize', update); document.removeEventListener('visibilitychange', update); clearInterval(timer); void desktop?.localPreview?.('detach').catch(() => {}); };
  }, [record.id, record.capability, blocked]);
  return <div ref={container} aria-label="Local website preview" className="relative min-h-40 flex-1 bg-white">{error && <p role="alert" className="p-4 text-xs text-red-700">{error}</p>}{blocked && <p className="p-4 text-xs text-gray-600">Preview hidden while a dialog is open.</p>}</div>;
}

export function LocalPreviewTab({ record, repositories, busy, error, onStart, onStop, blocked = false }: {
  record?: LocalPreview; repositories: string[]; busy: boolean; error: string;
  onStart: (repository?: string) => void; onStop: () => void; blocked?: boolean;
}) {
  const [repository, setRepository] = useState('');
  const [mobile, setMobile] = useState(false);
  const [surfaceError, setSurfaceError] = useState('');
  const control = (action: 'reload' | 'external') => { if (record) void desktop?.localPreview?.(action, surfaceValue(record)).catch(error => setSurfaceError(error.message)); };
  const bridge = Boolean(desktop?.localPreview);
  const active = record && ['starting', 'ready', 'stopping'].includes(record.state);
  return <section className="flex min-h-0 flex-1 flex-col" aria-label="Web preview">
    <div className="space-y-3 border-b border-white/10 p-4"><h2 className="flex items-center gap-2 text-sm font-semibold"><Globe className="h-4 w-4 text-sky-300" />Web preview <span className="ml-auto text-[10px] font-normal text-gray-400">Local · {record?.state ?? 'stopped'}</span></h2>
      {record && <p className="break-all text-[10px] text-gray-400">{record.repository} · {record.branch || 'detached'} · {record.commit.slice(0, 8)}<br />{record.source === 'saved-build' ? 'Saved build checkpoint' : 'Saved checkout commit'} · Later uncommitted edits are excluded.</p>}
      {!active && <div className="flex gap-2"><select aria-label="Preview codebase" value={repository} onChange={event => setRepository(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-shell p-2 text-xs"><option value="">Detect website</option>{repositories.map(repo => <option key={repo}>{repo}</option>)}</select><button type="button" disabled={!bridge || busy} onClick={() => onStart(repository || record?.repository || undefined)} className="rounded-lg bg-violet-500/20 px-3 text-xs text-violet-100 disabled:opacity-40">{busy ? 'Starting…' : record ? 'Restart' : 'Start preview'}</button></div>}
      {active && <div className="flex flex-wrap gap-2 text-[11px]"><button type="button" disabled={record.state !== 'ready'} onClick={() => control('reload')} className="inline-flex items-center gap-1 disabled:opacity-40"><RotateCw className="h-3 w-3" />Reload</button><button type="button" aria-pressed={mobile} onClick={() => setMobile(value => !value)}>{mobile ? 'Full width' : 'Mobile width'}</button><button type="button" disabled={record.state !== 'ready'} onClick={() => control('external')} className="inline-flex items-center gap-1 disabled:opacity-40"><ExternalLink className="h-3 w-3" />Browser</button><button type="button" onClick={onStop} className="ml-auto inline-flex items-center gap-1"><Square className="h-3 w-3" />Stop</button></div>}
      {!bridge && <p className="text-xs text-amber-200">{isDesktop ? 'Update the desktop bridge to use embedded previews.' : 'Local previews are available in Alpha desktop.'}</p>}
      {(error || record?.error || surfaceError) && <p role="alert" className="break-words text-xs text-amber-200">{error || record?.error || surfaceError}</p>}
      {record?.logs && <details><summary className="cursor-pointer text-[11px] text-gray-400">Startup output</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[10px] text-gray-400">{record.logs}</pre></details>}
      {Boolean(record?.browserDiagnostics?.length) && <details><summary className="cursor-pointer text-[11px] text-amber-200">Browser diagnostics · {record!.browserDiagnostics!.length}</summary><p className="mt-2 text-[10px] text-gray-400">Captured warnings, errors and failed resources. Blocked resources reflect preview isolation. Agents can inspect this evidence when you ask about the local website.</p><ul className="mt-2 max-h-40 space-y-2 overflow-auto text-[10px] text-gray-300">{record!.browserDiagnostics!.map((entry, index) => <li key={entry.timestamp + index}><span className="text-gray-500">{entry.kind} · {new Date(entry.timestamp).toLocaleTimeString()}</span><pre className="whitespace-pre-wrap break-all">{entry.message}</pre></li>)}</ul></details>}
    </div>
    {record?.state === 'ready' && bridge ? <div className={'mx-auto flex min-h-0 w-full flex-1 flex-col ' + (mobile ? 'max-w-[390px]' : '')}><NativePreview record={record} blocked={blocked} /></div> : <div className="p-5 text-xs leading-6 text-gray-400">{record?.state === 'starting' ? 'Preparing dependencies and waiting for the local server…' : 'Start an existing supported website from a saved commit. Opening this panel starts no processes.'}</div>}
  </section>;
}
