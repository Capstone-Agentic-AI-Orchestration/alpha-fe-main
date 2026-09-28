import React, { useMemo } from 'react';
import { GitBranch } from 'lucide-react';

import { RepoBranch } from '@/shared/types';
import { groupBranches } from './repoFormat';

interface BranchSwitcherProps {
  id: string;
  branches: RepoBranch[];
  value: string | null;
  onChange: (branch: string) => void;
  disabled?: boolean;
}

/**
 * A native select, grouped: the pipeline in promotion order, then the agents'
 * working branches, then anything else. Native keeps keyboard and screen
 * reader behaviour for free, and a repository with a hundred agent branches
 * still fits.
 */
export const BranchSwitcher: React.FC<BranchSwitcherProps> = ({ id, branches, value, onChange, disabled }) => {
  const groups = useMemo(() => groupBranches(branches), [branches]);

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="flex items-center gap-1.5 text-[11px] text-gray-500">
        <GitBranch className="h-3.5 w-3.5" aria-hidden />
        Branch
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={event => onChange(event.target.value)}
        disabled={disabled || branches.length === 0}
        className="max-w-[16rem] rounded-lg border border-white/10 bg-surface px-2.5 py-1.5 font-mono text-xs text-white transition-colors focus:border-brand-500 focus:outline-none disabled:opacity-50"
      >
        {branches.length === 0 && <option value="">No branches</option>}
        {groups.pipeline.length > 0 && (
          <optgroup label="Pipeline">
            {groups.pipeline.map(branch => (
              <option key={branch.name} value={branch.name}>
                {branch.name}{branch.protected ? ' (protected)' : ''}
              </option>
            ))}
          </optgroup>
        )}
        {groups.agent.length > 0 && (
          <optgroup label="Agent branches">
            {groups.agent.map(branch => (
              <option key={branch.name} value={branch.name}>{branch.name}</option>
            ))}
          </optgroup>
        )}
        {groups.other.length > 0 && (
          <optgroup label="Other branches">
            {groups.other.map(branch => (
              <option key={branch.name} value={branch.name}>{branch.name}</option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
};
