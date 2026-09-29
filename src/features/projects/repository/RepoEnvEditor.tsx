import React, { useMemo, useState } from 'react';
import { ClipboardPaste, KeyRound, Loader2, Lock, Plus, Trash2, X } from 'lucide-react';

import { apiService } from '@/shared/services/apiService';
import type { EnvChangeResult, HostingEnvList, PipelineBranch } from '@/shared/types';
import { envKeyProblem, envRowsProblem, parseEnvText, type EnvRow } from './envRules';
import { describeRepoError } from './repoFormat';
import { RefreshButton, RepoSection, SectionEmpty, SectionError, SectionLoading } from './SectionState';
import { useRepoResource } from './useRepoResource';

/** Set by Alpha from the pairing; listed even before the server reports them, so a new row cannot claim one. */
const ALPHA_MANAGED = ['NODE_ENV', 'CORS_ORIGINS', 'FRONTEND_URL', 'VITE_API_URL', 'NEXT_PUBLIC_API_URL'];

const inputClass =
  'min-w-0 rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 font-mono text-[11px] text-gray-200 placeholder:text-gray-600 focus:border-brand-500 focus:outline-none';

/**
 * A hosted repository's environment variables, per environment.
 *
 * Values are write-only: typed or pasted here, sent once to the server in a
 * request body, stored by the platform as secret, and never shown again --
 * only a variable's name and that it is set. Production (`main`) is a
 * project manager's or admin's to change; uat and dev any developer's.
 */
export const RepoEnvEditor: React.FC<{
  projectId: string;
  repo: string;
  canManageMain: boolean;
  canManagePreview: boolean;
}> = ({ projectId, repo, canManageMain, canManagePreview }) => {
  const env = useRepoResource<HostingEnvList>(() => apiService.getRepoHostingEnv(projectId, repo), `${projectId}|${repo}|env`);
  const data = env.data;
  const [selected, setSelected] = useState<PipelineBranch>('uat');
  const environment = data?.environments.includes(selected) ? selected : data?.environments[0] ?? 'main';
  const canWrite = environment === 'main' ? canManageMain : canManagePreview;

  return (
    <RepoSection
      id={`repo-env-${repo}`}
      title="Variables"
      icon={<KeyRound className="h-3.5 w-3.5 text-brand-400" aria-hidden />}
      actions={<RefreshButton onClick={env.reload} loading={env.loading} label="Refresh variables" />}
    >
      {env.loading && !data ? (
        <SectionLoading label="Loading variables…" />
      ) : env.error ? (
        <SectionError message={env.error} onRetry={env.reload} />
      ) : !data || data.environments.length === 0 || data.state === 'not_set_up' || data.state === 'unavailable' ? (
        <SectionEmpty>{data?.error ?? 'Set up hosting first; variables live on the hosted environments.'}</SectionEmpty>
      ) : (
        <>
          <div role="tablist" aria-label="Environment" className="flex gap-1 border-b border-white/[0.06] px-3.5 py-2">
            {data.environments.map(name => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={name === environment}
                onClick={() => setSelected(name)}
                className={`rounded-md px-2 py-1 font-mono text-[11px] transition-colors ${
                  name === environment ? 'bg-brand-500/20 text-brand-100' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {name}
                {name === 'main' && <span className="ml-1 font-sans text-[10px] text-gray-500">production</span>}
              </button>
            ))}
          </div>
          <EnvironmentPanel
            key={environment}
            projectId={projectId}
            repo={repo}
            environment={environment}
            data={data}
            canWrite={canWrite}
            onChanged={env.reload}
          />
        </>
      )}
    </RepoSection>
  );
};

const EnvironmentPanel: React.FC<{
  projectId: string;
  repo: string;
  environment: PipelineBranch;
  data: HostingEnvList;
  canWrite: boolean;
  onChanged: () => void;
}> = ({ projectId, repo, environment, data, canWrite, onChanged }) => {
  const [rows, setRows] = useState<EnvRow[]>([{ key: '', value: '' }]);
  const [redeploy, setRedeploy] = useState(true);
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [result, setResult] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);

  const vars = data.vars.filter(v => v.environment === environment || (environment !== 'main' && v.environment === 'all-previews'));
  const managed = useMemo(
    () => new Set([...ALPHA_MANAGED, ...data.vars.filter(v => v.managedByAlpha).map(v => v.key)]),
    [data.vars]
  );
  const filled = rows.filter(row => row.key || row.value);
  const problem = filled.length ? envRowsProblem(filled, managed) : null;

  const report = (change: EnvChangeResult, verb: string) => {
    const parts = [];
    if (change.changed.length) parts.push(`${verb} ${change.changed.join(', ')}.`);
    if (change.failed.length) parts.push(`Not ${verb.toLowerCase()}: ${change.failed.map(f => `${f.key} (${f.error})`).join('; ')}.`);
    if (change.redeployed) parts.push(`Redeploying ${environment}.`);
    if (change.redeployError) parts.push(`The redeploy did not start: ${change.redeployError}`);
    setResult({ tone: change.failed.length || change.redeployError ? 'warn' : 'ok', text: parts.join(' ') });
  };

  const save = async () => {
    if (problem || filled.length === 0) return;
    setBusy('save');
    setResult(null);
    try {
      const change = await apiService.setRepoHostingEnv(projectId, repo, { environment, vars: filled, redeploy });
      report(change, 'Saved');
      // Values leave the page once saved; nothing keeps them afterwards.
      setRows(change.failed.length ? filled.filter(row => change.failed.some(f => f.key === row.key)) : [{ key: '', value: '' }]);
      onChanged();
    } catch (err) {
      setResult({ tone: 'warn', text: describeRepoError(err) });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (key: string) => {
    if (confirmDelete !== key) {
      setConfirmDelete(key);
      return;
    }
    setConfirmDelete(null);
    setBusy(key);
    setResult(null);
    try {
      report(await apiService.deleteRepoHostingEnv(projectId, repo, environment, key, redeploy), 'Removed');
      onChanged();
    } catch (err) {
      setResult({ tone: 'warn', text: describeRepoError(err) });
    } finally {
      setBusy(null);
    }
  };

  const applyPaste = () => {
    const parsed = parseEnvText(pasteText);
    setPasteText('');
    setPasting(false);
    if (parsed.rows.length === 0) {
      setResult({ tone: 'warn', text: 'Nothing to add: no KEY=value lines found.' });
      return;
    }
    const kept = rows.filter(row => row.key && !parsed.rows.some(p => p.key === row.key));
    setRows([...kept, ...parsed.rows]);
    const notes = [`Added ${parsed.rows.length} from the paste.`];
    if (parsed.duplicates.length) notes.push(`Repeated in the paste, last one kept: ${parsed.duplicates.join(', ')}.`);
    if (parsed.skipped) notes.push(`${parsed.skipped} line${parsed.skipped === 1 ? '' : 's'} were not KEY=value and were skipped.`);
    setResult({ tone: parsed.duplicates.length || parsed.skipped ? 'warn' : 'ok', text: notes.join(' ') });
  };

  return (
    <div className="divide-y divide-white/[0.06]">
      <ul aria-label={`${environment} variables`} className="divide-y divide-white/[0.04]">
        {vars.length === 0 && <li className="px-3.5 py-3 text-[11px] text-gray-500">No variables in {environment} yet.</li>}
        {vars.map(v => (
          <li key={`${v.environment}-${v.key}`} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <code className="truncate font-mono text-[11px] text-gray-200">{v.key}</code>
              {v.environment === 'all-previews' && (
                <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-gray-400">every preview</span>
              )}
              {v.managedByAlpha && (
                <span className="rounded bg-brand-500/15 px-1.5 py-px text-[10px] text-brand-400">Set by Alpha</span>
              )}
            </span>
            <span className="flex items-center gap-2">
              {v.managedByAlpha && v.value ? (
                <code className="max-w-[14rem] truncate font-mono text-[11px] text-gray-400" title={v.value}>{v.value}</code>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-gray-500">
                  <Lock className="h-3 w-3" aria-hidden /> set
                </span>
              )}
              {canWrite && !v.managedByAlpha && v.environment !== 'all-previews' && (
                <button
                  type="button"
                  onClick={() => void remove(v.key)}
                  disabled={busy !== null}
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition-colors disabled:opacity-50 ${
                    confirmDelete === v.key ? 'bg-rose-500/20 text-rose-200' : 'text-gray-500 hover:bg-white/5 hover:text-rose-300'
                  }`}
                >
                  {busy === v.key ? <Loader2 className="h-3 w-3 motion-safe:animate-spin" aria-hidden /> : <Trash2 className="h-3 w-3" aria-hidden />}
                  {confirmDelete === v.key ? 'Confirm remove' : <span className="sr-only">Remove {v.key}</span>}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>

      {canWrite ? (
        <form
          className="space-y-2 px-3.5 py-3"
          onSubmit={e => {
            e.preventDefault();
            void save();
          }}
        >
          <p className="text-[10px] text-gray-500">
            Add or replace variables in <span className="font-mono">{environment}</span>. Values are stored as secrets and
            cannot be read back.
          </p>
          {rows.map((row, index) => {
            const keyError = row.key ? envKeyProblem(row.key, managed) : null;
            return (
              <div key={index} className="flex flex-wrap items-start gap-2">
                <div className="flex flex-col">
                  <input
                    aria-label="Variable name"
                    placeholder="NAME"
                    value={row.key}
                    onChange={e => setRows(rows.map((r, i) => (i === index ? { ...r, key: e.target.value.toUpperCase() } : r)))}
                    aria-invalid={Boolean(keyError)}
                    className={`${inputClass} w-48 ${keyError ? 'border-rose-400/60' : ''}`}
                  />
                  {keyError && <span className="mt-0.5 text-[10px] text-rose-300">{keyError}</span>}
                </div>
                <input
                  aria-label={`Value of ${row.key || 'variable'}`}
                  placeholder="value"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={row.value}
                  onChange={e => setRows(rows.map((r, i) => (i === index ? { ...r, value: e.target.value } : r)))}
                  className={`${inputClass} flex-1`}
                />
                <button
                  type="button"
                  aria-label="Remove row"
                  onClick={() => setRows(rows.length > 1 ? rows.filter((_, i) => i !== index) : [{ key: '', value: '' }])}
                  className="rounded-md p-1.5 text-gray-500 hover:bg-white/5 hover:text-white"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </div>
            );
          })}

          {pasting && (
            <div className="space-y-1.5">
              <textarea
                aria-label="Paste a .env file"
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                rows={5}
                spellCheck={false}
                placeholder={'KEY=value\nOTHER_KEY="value"'}
                className={`${inputClass} w-full`}
              />
              <p className="text-[10px] text-gray-500">Read here in your browser; the text itself is never sent.</p>
              <div className="flex gap-2">
                <button type="button" onClick={applyPaste} className="rounded-md bg-white/[0.06] px-2 py-1 text-[11px] text-gray-200 hover:bg-white/10">
                  Add these
                </button>
                <button type="button" onClick={() => { setPasting(false); setPasteText(''); }} className="px-2 py-1 text-[11px] text-gray-500 hover:text-white">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setRows([...rows, { key: '', value: '' }])}
              className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-white"
            >
              <Plus className="h-3 w-3" aria-hidden /> Add variable
            </button>
            {!pasting && (
              <button type="button" onClick={() => setPasting(true)} className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-white">
                <ClipboardPaste className="h-3 w-3" aria-hidden /> Paste .env
              </button>
            )}
            <label className="inline-flex items-center gap-1.5 text-[11px] text-gray-400">
              <input type="checkbox" checked={redeploy} onChange={e => setRedeploy(e.target.checked)} className="accent-brand-500" />
              Redeploy {environment} so it takes effect now
            </label>
            <button
              type="submit"
              disabled={busy !== null || filled.length === 0 || Boolean(problem)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-2.5 py-1.5 text-[11px] font-medium text-on-accent transition-colors hover:bg-brand-600 disabled:opacity-50"
            >
              {busy === 'save' && <Loader2 className="h-3 w-3 motion-safe:animate-spin" aria-hidden />}
              Save to {environment}
            </button>
          </div>
          {problem && filled.length > 0 && <p className="text-[11px] text-amber-300">{problem}</p>}
        </form>
      ) : (
        <p className="px-3.5 py-3 text-[11px] text-gray-500">
          {environment === 'main'
            ? 'Only a project manager or admin can change production variables.'
            : 'Your role cannot change hosting variables.'}
        </p>
      )}

      {result && (
        <p role="status" className={`px-3.5 py-2.5 text-[11px] leading-relaxed ${result.tone === 'ok' ? 'text-emerald-300' : 'text-amber-300'}`}>
          {result.text}
        </p>
      )}
    </div>
  );
};
