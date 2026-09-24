import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Users } from 'lucide-react';
import { useApp } from '@/app/AppContext';
import { Modal } from '@/shared/components/Modal';
import { apiService } from '@/shared/services/apiService';
import { UserRole } from '@/shared/types';
import { defaultRoleFor } from './WorkspaceAccessPanel';

type OrgRoster = Awaited<ReturnType<typeof apiService.getOrgTeamRoster>>;

const ROLE_LABEL: Record<UserRole, string> = {
  client: 'Client',
  dev: 'Developer',
  pm: 'Project Manager',
  admin: 'Admin'
};

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fires once the workspace exists and is open. */
  onCreated?: () => void;
}

/**
 * Name a workspace and staff it in one step.
 *
 * The people ticked here are in the workspace the moment it exists -- there
 * is no invitation for them to find or accept. A developer on the desktop app
 * sees it on their next refresh, within a minute.
 */
export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({ isOpen, onClose, onCreated }) => {
  const { identity, createWorkspace } = useApp();
  const callerRole: UserRole = identity?.role ?? 'pm';
  const self = identity?.login?.toLowerCase();

  const [name, setName] = useState('');
  const [teams, setTeams] = useState<OrgRoster>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  /** Chosen people, by lower-cased login, with the role they will join as. */
  const [chosen, setChosen] = useState<Map<string, { userId: string; role: UserRole }>>(new Map());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setChosen(new Map());
    let cancelled = false;
    setTeamsLoading(true);
    void apiService.getOrgTeamRoster()
      .then(rows => {
        if (!cancelled) {
          setTeams(rows);
          setTeamsError(null);
        }
      })
      .catch(error => {
        if (!cancelled) setTeamsError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setTeamsLoading(false);
      });
    return () => { cancelled = true; };
  }, [isOpen]);

  const toggle = (login: string, role: UserRole) => {
    setChosen(prev => {
      const next = new Map(prev);
      const key = login.toLowerCase();
      if (next.has(key)) next.delete(key);
      else next.set(key, { userId: login, role });
      return next;
    });
  };

  /** Everyone in a team, or nobody from it: staffing is usually "the developers". */
  const toggleTeam = (team: OrgRoster[number]) => {
    const role = defaultRoleFor(team.role, callerRole);
    const people = team.members.filter(person => person.login.toLowerCase() !== self);
    const allIn = people.length > 0 && people.every(person => chosen.has(person.login.toLowerCase()));
    setChosen(prev => {
      const next = new Map(prev);
      for (const person of people) {
        const key = person.login.toLowerCase();
        if (allIn) next.delete(key);
        else if (!next.has(key)) next.set(key, { userId: person.login, role });
      }
      return next;
    });
  };

  const members = useMemo(() => [...chosen.values()], [chosen]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    const created = await createWorkspace(name.trim(), members);
    setBusy(false);
    if (created) {
      onClose();
      onCreated?.();
    }
  };

  // Portalled: it opens from the sidebar, whose backdrop blur would otherwise
  // become the containing block for the modal's fixed overlay and clip it.
  return createPortal(
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New workspace"
      subtitle="Everyone you tick is in it straight away — there is nothing for them to accept."
      maxWidth="max-w-lg"
    >
      <form className="space-y-4" onSubmit={submit}>
        <input
          autoFocus
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder="Workspace name"
          className="w-full rounded-xl border border-white/[0.10] bg-surface-100 px-3 py-2.5 text-sm text-white outline-none placeholder:text-gray-600 focus:border-brand-400/60"
        />

        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-400">
              <Users className="h-4 w-4 text-brand-300" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">Members</span>
            </div>
            <span className="text-[11px] tabular-nums text-gray-500">
              {members.length ? `${members.length} chosen` : 'You can also add people later'}
            </span>
          </div>

          <div className="mt-2 max-h-72 space-y-3 overflow-y-auto pr-1">
            {teamsLoading ? (
              <div className="py-4 text-[11px] text-gray-500">Loading GitHub teams…</div>
            ) : teamsError ? (
              <p className="py-2 text-[11px] text-amber-300/80">
                Could not read the GitHub teams ({teamsError}). Create the workspace and add people from Settings.
              </p>
            ) : teams.length === 0 ? (
              <p className="py-2 text-[11px] text-gray-500">No teams in the organisation grant an Alpha role.</p>
            ) : (
              teams.map(team => {
                const joinAs = defaultRoleFor(team.role, callerRole);
                const people = team.members.filter(person => person.login.toLowerCase() !== self);
                const picked = people.filter(person => chosen.has(person.login.toLowerCase())).length;
                return (
                  <div key={team.slug} className="overflow-hidden rounded-xl border border-white/[0.08] bg-surface-100/60">
                    <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-3.5 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-white">{team.name}</div>
                        <div className="mt-0.5 text-[10px] text-gray-500">Join as {ROLE_LABEL[joinAs]}</div>
                      </div>
                      {people.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleTeam(team)}
                          className="flex-shrink-0 rounded-lg px-2 py-1 text-[10px] font-medium text-brand-200 hover:bg-brand-500/10"
                        >
                          {picked === people.length ? 'Clear' : 'Add all'}
                        </button>
                      )}
                    </div>
                    {people.length === 0 ? (
                      <div className="px-3.5 py-3 text-[11px] text-gray-500">Nobody else in this team.</div>
                    ) : (
                      <div className="divide-y divide-white/[0.05]">
                        {people.map(person => {
                          const on = chosen.has(person.login.toLowerCase());
                          return (
                            <button
                              key={person.login}
                              type="button"
                              onClick={() => toggle(person.login, joinAs)}
                              aria-pressed={on}
                              className="flex w-full items-center gap-3 px-3.5 py-2 text-left transition-colors hover:bg-white/[0.03]"
                            >
                              <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${on ? 'border-brand-400 bg-brand-500 text-on-accent' : 'border-white/20'}`}>
                                {on && <Check className="h-3 w-3" />}
                              </span>
                              {person.avatarUrl ? (
                                <img src={person.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover ring-1 ring-white/10" />
                              ) : (
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-semibold text-gray-300">
                                  {person.login.slice(0, 1).toUpperCase()}
                                </span>
                              )}
                              <span className="min-w-0 flex-1 truncate text-xs text-white">{person.login}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] pt-3">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-xs text-gray-400 hover:text-gray-200">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded-lg bg-brand-500 px-3.5 py-2 text-xs font-medium text-on-accent disabled:opacity-40"
          >
            {busy ? 'Creating…' : members.length ? `Create with ${members.length} ${members.length === 1 ? 'person' : 'people'}` : 'Create'}
          </button>
        </div>
      </form>
    </Modal>,
    document.body
  );
};
