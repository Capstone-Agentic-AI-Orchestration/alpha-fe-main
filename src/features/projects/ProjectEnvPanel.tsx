import React, { useState } from 'react';
import { Plus, Trash2, KeyRound } from 'lucide-react';

/**
 * Environment values for one project, used to resolve `${VAR}` in MCP servers.
 *
 * The MCP catalog is a single global file, so a hosted server is listed once —
 * but what it points at is per project. A Supabase entry written as
 * `?project_ref=${SUPABASE_PROJECT_REF}` is the same server on every board and
 * must not be the same Supabase project, so the reference lives in the catalog
 * and the value lives here.
 *
 * The secret itself does not have to. A token shared across every project
 * belongs in the daemon's own environment; these override it only where a
 * project genuinely differs. An empty field falls through to the layer beneath
 * rather than overriding it with nothing.
 */

export interface EnvVar {
  key: string;
  value: string;
  isSecret?: boolean;
}

interface Props {
  envVars: EnvVar[];
  onChange: (next: EnvVar[]) => void;
}

/** Same rule the daemon applies, so the form refuses what the run would drop. */
const VALID_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const ProjectEnvPanel: React.FC<Props> = ({ envVars, onChange }) => {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [isSecret, setIsSecret] = useState(true);

  const trimmedKey = key.trim().toUpperCase();
  const duplicate = envVars.some(e => e.key === trimmedKey);
  const keyError =
    !trimmedKey ? null
    : !VALID_KEY.test(trimmedKey) ? 'Letters, digits and underscore only, not starting with a digit.'
    : duplicate ? 'This project already sets that variable.'
    : null;

  const canAdd = Boolean(trimmedKey) && Boolean(value.trim()) && !keyError;

  const add = () => {
    if (!canAdd) return;
    onChange([...envVars, { key: trimmedKey, value: value.trim(), isSecret }]);
    setKey('');
    setValue('');
    setIsSecret(true);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
          <KeyRound className="w-3 h-3" />
          Project Variables
        </span>
        <span className="font-mono text-[10px] text-gray-500">{envVars.length} set</span>
      </div>

      {envVars.length === 0 ? (
        <p className="rounded-xl border border-white/5 bg-well p-2.5 text-[11px] leading-snug text-gray-500">
          None. MCP servers written with <code className="text-gray-400">{'${VAR}'}</code> resolve
          from the daemon&apos;s environment. Set one here to point this project at its own
          Supabase, database or workspace.
        </p>
      ) : (
        <div className="space-y-1">
          {envVars.map(entry => (
            <div
              key={entry.key}
              className="flex items-center gap-2 rounded-xl border border-white/5 bg-well px-2.5 py-1.5"
            >
              <span className="flex-1 truncate font-mono text-[11px] text-white">{entry.key}</span>
              {/*
                A stored secret is never redisplayed. Showing it would put the
                value back on screen every time anyone opens the project, which
                is the opposite of what marking it secret asked for.
              */}
              <span className="shrink-0 font-mono text-[10px] text-gray-500">
                {entry.isSecret ? '••••••••' : entry.value}
              </span>
              <button
                type="button"
                onClick={() => onChange(envVars.filter(e => e.key !== entry.key))}
                title={`Remove ${entry.key}`}
                className="shrink-0 rounded-lg p-1 text-gray-500 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5 rounded-xl border border-white/5 bg-well p-2.5">
        <div className="flex gap-1.5">
          <input
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="SUPABASE_PROJECT_REF"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-surface px-2 py-1.5 font-mono text-[11px] text-white placeholder:text-gray-600 focus:border-brand-500 focus:outline-none"
          />
          <input
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add(); }}
            placeholder="value"
            spellCheck={false}
            type={isSecret ? 'password' : 'text'}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-surface px-2 py-1.5 font-mono text-[11px] text-white placeholder:text-gray-600 focus:border-brand-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={add}
            disabled={!canAdd}
            title="Add variable"
            className="shrink-0 rounded-lg bg-white/10 px-2 text-gray-200 transition-colors hover:bg-white/20 disabled:cursor-default disabled:opacity-30"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {keyError ? (
          <p className="text-[10px] text-rose-300">{keyError}</p>
        ) : (
          <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-gray-500">
            <input
              type="checkbox"
              checked={isSecret}
              onChange={e => setIsSecret(e.target.checked)}
              className="accent-brand-500"
            />
            Hide this value after saving
          </label>
        )}
      </div>
    </div>
  );
};
