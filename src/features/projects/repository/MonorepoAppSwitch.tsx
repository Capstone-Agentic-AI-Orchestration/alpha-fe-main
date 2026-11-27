import React from 'react';

import type { MonorepoAppId, ProjectResourceApp } from '@/shared/types';
import { MONOREPO_APP_LABEL } from '../monorepoApps';

/**
 * Which app of a monorepo the hosting, variables and logs below are for. A
 * monorepo hosts its frontend and backend separately, so each has its own.
 */
export const MonorepoAppSwitch: React.FC<{
  id: string;
  apps: readonly ProjectResourceApp[];
  value: MonorepoAppId;
  onChange: (app: MonorepoAppId) => void;
}> = ({ id, apps, value, onChange }) => (
  <div role="group" aria-labelledby={`${id}-label`} className="flex flex-wrap items-center gap-2">
    <span id={`${id}-label`} className="text-[11px] text-content-muted">App</span>
    <div className="flex gap-1 rounded-xl border border-divider bg-surface p-0.5">
      {apps.map(app => (
        <button
          key={app.id}
          type="button"
          aria-pressed={app.id === value}
          onClick={() => onChange(app.id)}
          className={`rounded-lg px-2.5 py-1 text-[11px] transition-colors ${
            app.id === value ? 'bg-surface-raised font-medium text-content' : 'text-content-secondary hover:text-content'
          }`}
        >
          {MONOREPO_APP_LABEL[app.id]} <span className="font-mono text-content-muted">{app.path}</span>
        </button>
      ))}
    </div>
  </div>
);
