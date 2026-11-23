import React, { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

import { apiService, userMessage } from '@/shared/services/apiService';
import type { ProjectOrchestrationAutonomy, ProjectOrchestrationSettings } from '@/shared/types';

/** The three levels, in plain words, most hands-off first. */
export const AUTONOMY_OPTIONS: ReadonlyArray<{ value: ProjectOrchestrationAutonomy; label: string; description: string }> = [
  {
    value: 'standard',
    label: 'Fix routine problems and earlier work',
    description: 'Alpha fixes problems on its own, including small changes to earlier finished work. Anything sensitive, or a decision about what to build, comes to you.'
  },
  {
    value: 'strict',
    label: 'Fix routine problems only',
    description: 'Alpha fixes only problems in the stuck task’s own work. A fix that changes earlier finished work comes to you.'
  },
  {
    value: 'off',
    label: 'Always ask me',
    description: 'Alpha stops and waits for you whenever a build gets stuck.'
  }
];

/** One pattern per line, trimmed, blanks and repeats dropped. */
export function sensitivePathsFrom(text: string): string[] {
  return [...new Set(text.split(/\r?\n/).map(line => line.trim()).filter(Boolean))];
}

interface ProjectAutonomySectionProps {
  projectId: string;
  settings: ProjectOrchestrationSettings;
  /** Developers, project managers and admins may change it; anyone else sees it read-only. */
  canEdit: boolean;
  onSaved: (settings: ProjectOrchestrationSettings) => void;
}

/**
 * How far Alpha resolves a stuck build on its own. Shown only when the server sends the setting,
 * which it does for the team on the desktop app and never for clients.
 */
export const ProjectAutonomySection: React.FC<ProjectAutonomySectionProps> = ({ projectId, settings, canEdit, onSaved }) => {
  const saved = (settings.sensitivePaths ?? []).join('\n');
  const [paths, setPaths] = useState(saved);
  const [busy, setBusy] = useState<'autonomy' | 'paths' | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { setPaths(saved); }, [saved]);

  if (!settings.autonomy) return null;
  const current = settings.autonomy;

  const save = async (kind: 'autonomy' | 'paths', change: { autonomy?: ProjectOrchestrationAutonomy; sensitivePaths?: string[] }) => {
    setBusy(kind);
    setError('');
    try {
      onSaved(await apiService.setProjectOrchestrationAutonomy(projectId, change));
    } catch (caught) {
      setError(userMessage(caught, 'Alpha could not save this setting. Try again.'));
    } finally {
      setBusy(null);
    }
  };
  const pathsChanged = sensitivePathsFrom(paths).join('\n') !== saved;

  return <section aria-labelledby="project-autonomy" className="rounded-xl border border-divider bg-surface-raised p-4">
    <h2 id="project-autonomy" className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-content">
      <Sparkles className="h-3.5 w-3.5 text-status-info" aria-hidden />When a build gets stuck
    </h2>
    <p className="mb-3 text-content-muted">How much Alpha fixes on its own. Everything it fixes is listed for you before you approve a build.</p>
    {canEdit ? <fieldset className="space-y-2" disabled={busy !== null}>
      <legend className="sr-only">How much Alpha fixes on its own</legend>
      {AUTONOMY_OPTIONS.map(option => <label key={option.value} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 ${current === option.value ? 'border-control bg-selected' : 'border-divider hover:bg-surface-high'}`}>
        <input type="radio" name={`autonomy-${projectId}`} value={option.value} checked={current === option.value} className="mt-0.5"
          onChange={() => { if (option.value !== current) void save('autonomy', { autonomy: option.value }); }} />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 font-medium text-content">{option.label}
            {option.value === 'standard' && <span className="text-[10px] font-normal text-content-muted">recommended</span>}
            {busy === 'autonomy' && current !== option.value && <Loader2 className="h-3 w-3 animate-spin text-content-muted" aria-hidden />}
          </span>
          <span className="mt-0.5 block text-[11px] leading-4 text-content-secondary">{option.description}</span>
        </span>
      </label>)}
    </fieldset> : <p className="rounded-lg border border-divider bg-well p-2.5 text-content-secondary">
      <span className="font-medium text-content">{AUTONOMY_OPTIONS.find(option => option.value === current)?.label}.</span>{' '}
      {AUTONOMY_OPTIONS.find(option => option.value === current)?.description}
    </p>}

    <div className="mt-4">
      <label htmlFor={`sensitive-paths-${projectId}`} className="block font-medium text-content">Areas Alpha must always ask about</label>
      <p className="mb-2 mt-0.5 text-[11px] leading-4 text-content-muted">
        Sign-in, data, payments, personal data, secrets, dependencies, build and deployment files are already covered.
        Add this project’s own areas, one per line, for example src/billing/**.
      </p>
      {canEdit ? <>
        <textarea id={`sensitive-paths-${projectId}`} value={paths} onChange={event => setPaths(event.target.value)} rows={3} disabled={busy !== null}
          placeholder="src/billing/**" className="w-full resize-y rounded-lg border border-control bg-well px-3 py-2 font-mono text-[11px] leading-5 text-content placeholder:text-content-muted outline-none focus:ring-2 focus:ring-focus" />
        {pathsChanged && <div className="mt-2 flex items-center gap-2">
          <button type="button" onClick={() => void save('paths', { sensitivePaths: sensitivePathsFrom(paths) })} disabled={busy !== null}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-action px-3 text-[11px] font-semibold text-on-action hover:bg-action-hover disabled:opacity-50">
            {busy === 'paths' && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}Save areas
          </button>
          <button type="button" onClick={() => setPaths(saved)} disabled={busy !== null} className="text-[11px] text-content-muted hover:text-content-secondary">Undo</button>
        </div>}
      </> : <p className="font-mono text-[11px] text-content-secondary">{settings.sensitivePaths?.length ? settings.sensitivePaths.join(', ') : 'None added.'}</p>}
    </div>
    {error && <p role="alert" className="mt-2 text-[11px] text-status-danger">{error}</p>}
  </section>;
};
