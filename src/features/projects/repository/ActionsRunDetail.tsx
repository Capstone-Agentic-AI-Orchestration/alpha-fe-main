import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, ExternalLink, RefreshCw } from 'lucide-react';
import { apiService } from '@/shared/services/apiService';
import type { ActionsRun, ActionsJob, ActionsArtifact } from '@/shared/types/actions';
import { SectionEmpty, SectionError, SectionLoading } from './SectionState';
import { runState, RUN_TONE_CLASS } from './repoFormat';
import { useActionsResource, actionsError } from './useActionsResource';
import { actionsDuration, actionsSize, saveActionsFile } from './actionsFormat';

export const actionsButton = 'rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-gray-200 hover:bg-white/5 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400';
export const actionsInput = 'min-w-0 rounded-md border border-white/10 bg-surface-raised px-2.5 py-1.5 text-xs text-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400';

export function ActionsStatus({ value }: { value: { status: string; conclusion: string | null } }) {
  const status = runState(value);
  return <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs ${RUN_TONE_CLASS[status.tone].text}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${RUN_TONE_CLASS[status.tone].dot}`} aria-hidden />{status.label}
  </span>;
}

export function ActionsRunDetail({ projectId, selected, active, onBack }: { projectId: string; selected: ActionsRun; active: boolean; onBack: () => void }) {
  const repo = selected.repository;
  const resource = useActionsResource(s => apiService.getActionsRun(projectId, repo, selected.id, s), `${repo}|${selected.id}`, active, selected.status === 'completed' ? 60000 : 15000);
  const run = resource.data?.run || selected;
  const [tab, setTab] = useState('summary');
  const [attemptChoice, setAttempt] = useState<number | null>(null);
  const attempt = attemptChoice ?? run.attempt;
  const tabs = ['summary', 'jobs', 'logs', 'artifacts'];
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  return <section aria-label="Workflow run details" className="min-w-0 rounded-xl border border-white/10 bg-surface-200/50">
    <header className="space-y-3 border-b border-white/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className={actionsButton} onClick={onBack}><ArrowLeft className="mr-1 inline h-3.5 w-3.5" />Back to runs</button>
        <ActionsStatus value={run} />
      </div>
      <div><h2 className="break-words text-base font-semibold text-white">{run.name} #{run.number}</h2><p className="mt-1 break-words text-xs text-gray-400">{run.title}</p></div>
      <p className="break-all font-mono text-xs text-gray-300">{repo} · {run.branch || 'Branch unavailable'} · {run.sha.slice(0, 7)}</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-gray-400">Attempt <input aria-label="Run attempt" className={`${actionsInput} w-16`} type="number" min={1} max={run.attempt} value={attempt}
          onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n <= run.attempt) setAttempt(n); }} /> of {run.attempt}</label>
        <button type="button" className={actionsButton} disabled={resource.loading} onClick={resource.reload}><RefreshCw className="mr-1 inline h-3 w-3" />Refresh run</button>
        <a className="text-xs text-gray-400 underline hover:text-white" href={run.url} target="_blank" rel="noreferrer">Open on GitHub <ExternalLink className="inline h-3 w-3" /></a>
      </div>
      {resource.error && <SectionError message={resource.error} onRetry={resource.reload} />}
      <div role="tablist" aria-label="Run detail sections" className="flex gap-1 overflow-x-auto" onKeyDown={event => {
        const index = tabs.indexOf(tab); const next = event.key === 'ArrowRight' ? (index + 1) % 4 : event.key === 'ArrowLeft' ? (index + 3) % 4 : event.key === 'Home' ? 0 : event.key === 'End' ? 3 : -1;
        if (next >= 0) { event.preventDefault(); setTab(tabs[next]); refs.current[next]?.focus(); }
      }}>
        {tabs.map((id, index) => <button key={id} ref={el => { refs.current[index] = el; }} type="button" role="tab" id={`run-${run.id}-${id}-tab`} aria-controls={`run-${run.id}-${id}`} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1}
          onClick={() => setTab(id)} className={`${actionsButton} shrink-0 ${tab === id ? 'bg-brand-500/15 text-brand-200' : ''}`}>{id === 'jobs' ? 'Jobs and steps' : id[0].toUpperCase() + id.slice(1)}</button>)}
      </div>
    </header>
    <div role="tabpanel" id={`run-${run.id}-${tab}`} aria-labelledby={`run-${run.id}-${tab}-tab`} className="min-w-0 p-4">
      {tab === 'summary' && <div className="space-y-4">
        <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
          {Object.entries({ Repository: repo, Branch: run.branch || 'Unavailable', Commit: run.sha, Actor: run.actor || 'Unavailable', Event: run.event,
            Workflow: run.path || run.name, Created: new Date(run.createdAt).toLocaleString(), Updated: new Date(run.updatedAt).toLocaleString() }).map(([label, value]) => <div key={label}><dt className="text-gray-400">{label}</dt><dd className="mt-1 break-all text-gray-200">{value}</dd></div>)}
        </dl>
        <p className="text-xs text-gray-400">Summary reflects the latest run. Jobs and logs use attempt {attempt}. Select Jobs and steps to inspect individual check results.</p>
        <button type="button" className={actionsButton} onClick={() => setTab('jobs')}>Inspect jobs and steps</button>
      </div>}
      {(tab === 'jobs' || tab === 'logs') && <Jobs key={`${run.id}|${attempt}`} projectId={projectId} run={run} attempt={attempt} active={active} logs={tab === 'logs'} />}
      {tab === 'artifacts' && <Artifacts projectId={projectId} run={run} active={active} />}
    </div>
  </section>;
}

function Jobs({ projectId, run, attempt, active, logs }: { projectId: string; run: ActionsRun; attempt: number; active: boolean; logs: boolean }) {
  const [page, setPage] = useState(1);
  const jobs = useActionsResource(s => apiService.getActionsJobs(projectId, run.repository, run.id, attempt, page, s), `${run.id}|${attempt}|${page}`, active, run.status === 'completed' ? 60000 : 15000);
  const [chosen, selectJob] = useState<number | null>(null);
  const list = jobs.data?.jobs || [];
  const job = list.find(j => j.id === chosen) || list[0];
  return <div className="space-y-3">
    {jobs.error && <SectionError message={jobs.error} onRetry={jobs.reload} />}
    {!jobs.data && jobs.loading && <SectionLoading label="Loading jobs…" />}
    {jobs.data && list.length === 0 && <SectionEmpty>No jobs have been created for this attempt yet.</SectionEmpty>}
    {!!list.length && <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(160px,0.7fr)_minmax(0,1.3fr)]">
      <div className="min-w-0 space-y-1" aria-label="Workflow jobs">
        {list.map(j => <button type="button" aria-pressed={job?.id === j.id} key={j.id} onClick={() => selectJob(j.id)} className={`w-full rounded-lg border p-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 ${job?.id === j.id ? 'border-brand-400/50 bg-brand-500/10' : 'border-white/5 hover:bg-white/5'}`}>
          <span className="block break-words text-xs text-white">{j.name}</span><span className="mt-1 flex flex-wrap items-center justify-between gap-2"><ActionsStatus value={j} /><span className="text-[11px] text-gray-400">{actionsDuration(j.startedAt, j.completedAt)}</span></span>
        </button>)}
      </div>
      {job && <div className="min-w-0">
        <h3 className="mb-3 break-words text-sm font-medium text-white">{job.name}</h3>
        {logs ? <JobLog key={job.id} projectId={projectId} run={run} job={job} active={active} /> : <ol className="space-y-2">
          {job.steps.map(step => <li key={step.number} className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/5 p-2 text-xs"><span className="min-w-0 break-words text-gray-200">{step.number}. {step.name}</span><ActionsStatus value={step} /></li>)}
          {!job.steps.length && <SectionEmpty>This job has no reported steps.</SectionEmpty>}
        </ol>}
      </div>}
    </div>}
    <PageControls page={page} nextPage={jobs.data?.nextPage} loading={jobs.loading} onPage={n => { selectJob(null); setPage(n); }} />
  </div>;
}

function JobLog({ projectId, run, job, active }: { projectId: string; run: ActionsRun; job: ActionsJob; active: boolean }) {
  const log = useActionsResource(s => apiService.getActionsLogs(projectId, run.repository, run.id, job.id, s), `${run.id}|${job.id}`, active, job.status === 'completed' ? 0 : 15000);
  const [search, setSearch] = useState(''); const [notice, setNotice] = useState('');
  const text = log.data?.text || '';
  const lines = search ? text.split('\n').filter(line => line.toLowerCase().includes(search.toLowerCase())).join('\n') : text;
  return <div className="min-w-0 space-y-3">
    <div className="flex flex-wrap gap-2"><input aria-label="Find in job logs" placeholder="Find in job logs" value={search} onChange={e => setSearch(e.target.value)} className={`${actionsInput} flex-1`} />
      <button className={actionsButton} type="button" disabled={log.loading} onClick={log.reload}>Refresh logs</button>
      <button className={actionsButton} type="button" disabled={!text} onClick={() => void navigator.clipboard.writeText(text).then(() => setNotice('Logs copied.'), () => setNotice('Copy was unavailable. Use Download instead.'))}>Copy</button>
      <button className={actionsButton} type="button" disabled={!text} onClick={() => saveActionsFile(new Blob([text], { type: 'text/plain' }), `run-${run.id}-job-${job.id}.txt`)}>Download</button>
    </div>
    {notice && <p role="status" className="text-xs text-gray-300">{notice}</p>}
    {log.error && <SectionError message={log.error} onRetry={log.reload} />}
    {log.loading && !log.data && <SectionLoading label="Loading job logs…" />}
    {log.data?.state === 'not_ready' && <p role="status" className="text-xs text-gray-400">GitHub has not made these logs available yet. Status refreshes while this page is visible.</p>}
    {log.data?.state === 'unavailable' && <p className="text-xs text-amber-200">{text}</p>}
    {log.data?.state === 'available' && <>
      <p className="text-xs text-gray-400">{search ? 'Showing matching lines from the available whole-job log.' : 'Whole-job output from GitHub.'} {log.data.truncated && 'Showing the first 2 MB; output is truncated.'}</p>
      <pre aria-label="Job log output" tabIndex={0} className="max-h-[65vh] min-w-0 overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-[11px] leading-5 text-gray-200 focus-visible:outline focus-visible:outline-brand-400">{lines || (search ? 'No matching lines.' : 'GitHub returned an empty log.')}</pre>
    </>}
  </div>;
}

function Artifacts({ projectId, run, active }: { projectId: string; run: ActionsRun; active: boolean }) {
  const [page, setPage] = useState(1); const [downloading, setDownloading] = useState<number | null>(null); const [error, setError] = useState('');
  const artifacts = useActionsResource(s => apiService.getActionsArtifacts(projectId, run.repository, run.id, page, s), `${run.id}|${page}`, active);
  const downloadController = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!active) { downloadController.current?.abort(); setDownloading(null); }
    return () => downloadController.current?.abort();
  }, [active]);
  const download = async (artifact: ActionsArtifact) => {
    setDownloading(artifact.id); setError('');
    const controller = new AbortController(); downloadController.current = controller;
    try {
      const file = await apiService.downloadActionsArtifact(projectId, run.repository, run.id, artifact.id, controller.signal);
      if (!controller.signal.aborted) saveActionsFile(file, `${artifact.name.replace(/[^A-Za-z0-9._-]/g, '_')}.zip`);
    } catch (e) { if (!controller.signal.aborted) setError(actionsError(e)); } finally { if (!controller.signal.aborted) setDownloading(null); }
  };
  return <div className="space-y-3">
    <p className="text-xs text-gray-400">Artifacts belong to this run. Retention and availability are controlled by GitHub. In-app downloads are limited to 50 MB.</p>
    {(artifacts.error || error) && <SectionError message={artifacts.error || error} onRetry={artifacts.reload} />}
    {artifacts.loading && !artifacts.data && <SectionLoading label="Loading artifacts…" />}
    {artifacts.data?.artifacts.length === 0 && <SectionEmpty>No retained artifacts were found for this run.</SectionEmpty>}
    {artifacts.data?.artifacts.map(a => <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 p-3">
      <div className="min-w-0"><p className="break-words text-xs text-white">{a.name}</p><p className="mt-1 text-[11px] text-gray-400">{actionsSize(a.size)} · {a.expired ? 'Expired' : `Expires ${new Date(a.expiresAt).toLocaleString()}`}</p></div>
      <button type="button" className={actionsButton} disabled={a.expired || a.size > 50 * 1024 * 1024 || downloading !== null} onClick={() => void download(a)}><Download className="mr-1 inline h-3 w-3" />{downloading === a.id ? 'Downloading…' : 'Download artifact'}</button>
    </div>)}
    <PageControls page={page} nextPage={artifacts.data?.nextPage} loading={artifacts.loading} onPage={setPage} />
  </div>;
}

export function PageControls({ page, nextPage, loading, onPage }: { page: number; nextPage?: number | null; loading: boolean; onPage: (page: number) => void }) {
  if (page === 1 && !nextPage) return null;
  return <div className="flex items-center gap-3 text-xs text-gray-400"><button type="button" disabled={loading || page <= 1} className={actionsButton} onClick={() => onPage(page - 1)}>Previous page</button>
    <span>Page {page}</span><button type="button" disabled={loading || !nextPage} className={actionsButton} onClick={() => nextPage && onPage(nextPage)}>Next page</button></div>;
}
