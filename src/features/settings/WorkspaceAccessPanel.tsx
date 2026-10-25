import React, { useEffect, useMemo, useState } from 'react';
import { Check, LockKeyhole, Shield, Users, UserRound, FolderKanban, UserPlus } from 'lucide-react';
import { useApp } from '@/app/AppContext';
import { apiService } from '@/shared/services/apiService';
import { UserRole, WorkspaceProjectAssignment } from '@/shared/types';

type WorkspaceMember = {
  id: string;
  userId: string;
  role: UserRole;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type WorkspaceAccessPanelProps = {
  mode: 'members' | 'project_access';
};

const ROLE_LABEL: Record<UserRole, string> = {
  client: 'Client',
  dev: 'Developer',
  pm: 'Project Manager',
  admin: 'Admin'
};

type TeamRoster = Awaited<ReturnType<typeof apiService.getWorkspaceTeamRoster>>;

/**
 * The role someone joins this workspace with when added from a GitHub team row.
 *
 * `teamRole` is what their team grants org-wide (developers -> dev,
 * project-managers -> pm, admins -> admin, clients -> client); `callerRole` is
 * the person doing the adding. The server refuses `admin` from anyone who is
 * not an admin, so a project manager adding a member of the `admins` team has
 * to land on something else.
 */
export function defaultRoleFor(teamRole: UserRole, callerRole: UserRole): UserRole {
  // The role their team grants, capped at what the caller may hand out.
  return teamRole === 'admin' && callerRole !== 'admin' ? 'pm' : teamRole;
}

export const WorkspaceAccessPanel: React.FC<WorkspaceAccessPanelProps> = ({ mode }) => {
  const {
    activeWorkspace,
    activeWorkspaceId,
    projects,
    role,
    can,
    showToast
  } = useApp();
  const canViewMembers = can('view_members');
  const canManageMembers = can('manage_members');
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id ?? '');
  const [assignments, setAssignments] = useState<WorkspaceProjectAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [candidates, setCandidates] = useState<Array<{ login: string; avatarUrl: string | null }>>([]);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [invitee, setInvitee] = useState('');
  const [inviteeRole, setInviteeRole] = useState<UserRole>('dev');
  const [adding, setAdding] = useState(false);
  const [teams, setTeams] = useState<TeamRoster>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsError, setTeamsError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeWorkspaceId || !canViewMembers) return;
    let cancelled = false;
    setLoading(true);
    void apiService.getWorkspaceMembers(activeWorkspaceId)
      .then(rows => {
        if (!cancelled) setMembers(rows as WorkspaceMember[]);
      })
      .catch(error => {
        if (!cancelled) showToast('Members unavailable', error instanceof Error ? error.message : String(error), 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeWorkspaceId, canViewMembers]);

  /**
   * Who there is to add.
   *
   * The organisation's people, so staffing a workspace is picking a name
   * rather than typing a login exactly right. A deployment with no
   * organisation configured, or a GitHub that will not answer, falls back to
   * typing one -- the add itself does not depend on this list.
   */
  useEffect(() => {
    if (mode !== 'members' || !activeWorkspaceId || !canManageMembers) return;
    let cancelled = false;
    void apiService.getWorkspaceMemberCandidates(activeWorkspaceId)
      .then(rows => {
        if (!cancelled) {
          setCandidates(rows);
          setCandidateError(null);
        }
      })
      .catch(error => {
        if (!cancelled) setCandidateError(error instanceof Error ? error.message : String(error));
      });
    return () => { cancelled = true; };
  }, [activeWorkspaceId, canManageMembers, mode, members.length]);

  /**
   * The organisation's GitHub teams and who is in them, so a project manager
   * staffs by team and can see at a glance who from each is still missing.
   * Loaded once per workspace; an add updates it in place.
   */
  useEffect(() => {
    if (mode !== 'members' || !activeWorkspaceId || !canManageMembers) return;
    let cancelled = false;
    setTeamsLoading(true);
    void apiService.getWorkspaceTeamRoster(activeWorkspaceId)
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
  }, [activeWorkspaceId, canManageMembers, mode]);

  useEffect(() => {
    if (projects.length > 0 && !projects.some(project => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (mode !== 'project_access' || !activeWorkspaceId || !selectedProjectId || !canViewMembers) return;
    let cancelled = false;
    setAssignmentLoading(true);
    void apiService.getProjectAssignments(activeWorkspaceId, selectedProjectId)
      .then(rows => {
        if (!cancelled) setAssignments(rows);
      })
      .catch(error => {
        if (!cancelled) showToast('Project access unavailable', error instanceof Error ? error.message : String(error), 'error');
      })
      .finally(() => {
        if (!cancelled) setAssignmentLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeWorkspaceId, canViewMembers, mode, selectedProjectId]);

  const developers = useMemo(
    () => members.filter(member => member.role === 'dev' && member.status === 'active'),
    [members]
  );
  const selectedProject = projects.find(project => project.id === selectedProjectId);
  const activeAssignments = useMemo(
    () => new Set(assignments.filter(assignment => assignment.status === 'active').map(assignment => assignment.userId)),
    [assignments]
  );

  const addMember = async (login = invitee.trim(), memberRole = inviteeRole) => {
    if (!activeWorkspaceId || !login || adding) return;
    setAdding(true);
    try {
      const added = await apiService.addWorkspaceMember(activeWorkspaceId, login, memberRole);
      const addedLogin = added.userId.toLowerCase();
      setMembers(prev => [...prev.filter(item => item.userId !== added.userId), added as WorkspaceMember]);
      setCandidates(prev => prev.filter(person => person.login.toLowerCase() !== addedLogin));
      setTeams(prev => prev.map(team => ({
        ...team,
        members: team.members.map(person =>
          person.login.toLowerCase() === addedLogin ? { ...person, workspaceRole: added.role } : person
        )
      })));
      if (login === invitee.trim()) setInvitee('');
      showToast('Added to the workspace', `${added.userId} is now a ${ROLE_LABEL[added.role]} here.`, 'success');
    } catch (error) {
      showToast('Not added', error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setAdding(false);
    }
  };

  const updateMemberRole = async (member: WorkspaceMember, role: UserRole) => {
    if (!activeWorkspaceId || !canManageMembers || role === member.role) return;
    try {
      const updated = await apiService.updateWorkspaceMember(activeWorkspaceId, member.id, { role }) as WorkspaceMember;
      setMembers(prev => prev.map(item => item.id === member.id ? updated : item));
      setTeams(prev => prev.map(team => ({
        ...team,
        members: team.members.map(person =>
          person.login.toLowerCase() === member.userId.toLowerCase() ? { ...person, workspaceRole: updated.role } : person
        )
      })));
      showToast('Role updated', `${member.userId} is now a ${ROLE_LABEL[role]}.`, 'success');
    } catch (error) {
      showToast('Role not updated', error instanceof Error ? error.message : String(error), 'error');
    }
  };

  const toggleProjectAccess = async (userId: string) => {
    if (!activeWorkspaceId || !selectedProjectId || !canManageMembers || assignmentLoading) return;
    const isAssigned = activeAssignments.has(userId);
    setAssignmentLoading(true);
    try {
      if (isAssigned) {
        await apiService.removeProjectMember(activeWorkspaceId, selectedProjectId, userId);
        setAssignments(prev => prev.map(item => item.userId === userId ? { ...item, status: 'removed' } : item));
      } else {
        const assignment = await apiService.assignProjectMember(activeWorkspaceId, selectedProjectId, userId);
        setAssignments(prev => [...prev.filter(item => item.userId !== userId), assignment]);
      }
    } catch (error) {
      showToast('Project access not updated', error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setAssignmentLoading(false);
    }
  };

  if (!canViewMembers) return null;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-divider bg-surface/60 p-4">
          <div className="flex items-center gap-2 text-content-muted"><Users className="h-4 w-4" /><span className="text-[11px] uppercase tracking-[0.14em]">Members</span></div>
          <div className="mt-3 text-2xl font-semibold text-content">{members.length}</div>
          <p className="mt-1 text-[11px] text-content-muted">Active workspace identities</p>
        </div>
        <div className="rounded-2xl border border-divider bg-surface/60 p-4">
          <div className="flex items-center gap-2 text-content-muted"><UserRound className="h-4 w-4" /><span className="text-[11px] uppercase tracking-[0.14em]">Developers</span></div>
          <div className="mt-3 text-2xl font-semibold text-content">{developers.length}</div>
          <p className="mt-1 text-[11px] text-content-muted">Eligible for project assignment</p>
        </div>
        <div className="rounded-2xl border border-divider bg-surface/60 p-4">
          <div className="flex items-center gap-2 text-content-muted"><Shield className="h-4 w-4" /><span className="text-[11px] uppercase tracking-[0.14em]">Control</span></div>
          <div className="mt-3 text-sm font-semibold text-content">{canManageMembers ? 'Full control' : 'Read only'}</div>
          <p className="mt-1 text-[11px] text-content-muted">{activeWorkspace?.name ?? 'Active workspace'}</p>
        </div>
      </div>

      {mode === 'members' ? (
        <section className="overflow-hidden rounded-2xl border border-divider bg-surface/50">
          <div className="flex items-center justify-between border-b border-divider px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-content">Members & roles</h3>
              <p className="mt-1 text-[11px] text-content-muted">Workspace membership controls what a person can discover and use.</p>
            </div>
            <span className="rounded-full border border-divider bg-selected px-2.5 py-1 text-[10px] font-medium text-selected-content">{canManageMembers ? 'Can add and change' : 'Read only'}</span>
          </div>
          {canManageMembers && (
            <div className="border-b border-divider bg-surface-raised px-5 py-4">
              <div className="flex items-center gap-2 text-content-secondary">
                <UserPlus className="h-4 w-4 text-link" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">Add someone</span>
              </div>
              <p className="mt-1 text-[11px] text-content-muted">
                They are in the workspace straight away — there is no code to send and nothing for them to accept.
              </p>
              <form
                className="mt-3 flex flex-col gap-2 sm:flex-row"
                onSubmit={event => {
                  event.preventDefault();
                  void addMember();
                }}
              >
                <input
                  list="workspace-member-candidates"
                  value={invitee}
                  onChange={event => setInvitee(event.target.value)}
                  placeholder={candidates.length ? 'GitHub username' : 'GitHub username (type it in)'}
                  className="min-w-0 flex-1 rounded-xl border border-divider bg-surface-raised px-3 py-2.5 text-xs text-content outline-none placeholder:text-content-muted focus:border-control"
                />
                <datalist id="workspace-member-candidates">
                  {candidates.map(person => <option key={person.login} value={person.login} />)}
                </datalist>
                <select
                  value={inviteeRole}
                  onChange={event => setInviteeRole(event.target.value as UserRole)}
                  className="rounded-xl border border-divider bg-surface-raised px-3 py-2.5 text-xs text-content outline-none focus:border-control"
                >
                  {/* Only an admin may make another admin; the server refuses the rest. */}
                  {(['dev', 'pm', 'client', ...(role === 'admin' ? ['admin' as UserRole] : [])] as UserRole[]).map(option => (
                    <option key={option} value={option}>{ROLE_LABEL[option]}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={adding || !invitee.trim()}
                  className="rounded-xl bg-action px-4 py-2.5 text-xs font-medium text-on-action transition-opacity disabled:opacity-40"
                >
                  {adding ? 'Adding…' : 'Add'}
                </button>
              </form>
              {candidateError && (
                <p className="mt-2 text-[11px] text-status-warning">
                  Could not list the organisation’s people ({candidateError}). Type a GitHub username instead.
                </p>
              )}

              <div className="mt-5">
                <div className="flex items-center gap-2 text-content-secondary">
                  <Users className="h-4 w-4 text-link" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">GitHub teams</span>
                </div>
                <p className="mt-1 text-[11px] text-content-muted">
                  Everyone in the organisation’s teams, and whether they are in this workspace yet.
                </p>
                {teamsLoading ? (
                  <div className="mt-3 text-[11px] text-content-muted">Loading teams…</div>
                ) : teamsError ? (
                  <p className="mt-3 text-[11px] text-status-warning">Could not read the GitHub teams ({teamsError}).</p>
                ) : teams.length === 0 ? (
                  <p className="mt-3 text-[11px] text-content-muted">No teams in the organisation grant an Alpha role.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {teams.map(team => {
                      const joined = team.members.filter(person => person.workspaceRole).length;
                      return (
                        <div key={team.slug} className="overflow-hidden rounded-xl border border-divider bg-surface-raised/60">
                          <div className="flex items-center justify-between gap-3 border-b border-divider px-3.5 py-2.5">
                            <div className="min-w-0">
                              <div className="truncate text-xs font-semibold text-content">{team.name}</div>
                              <div className="mt-0.5 text-[10px] text-content-muted">@{team.slug} · grants {ROLE_LABEL[team.role]}</div>
                            </div>
                            <span className="flex-shrink-0 text-[10px] tabular-nums text-content-muted">
                              {joined} of {team.members.length} here
                            </span>
                          </div>
                          {team.members.length === 0 ? (
                            <div className="px-3.5 py-3 text-[11px] text-content-muted">Nobody in this team yet.</div>
                          ) : (
                            <div className="divide-y divide-divider">
                              {team.members.map(person => {
                                const joinAs = defaultRoleFor(team.role, role);
                                return (
                                  <div key={person.login} className="flex items-center gap-3 px-3.5 py-2">
                                    {person.avatarUrl ? (
                                      <img src={person.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover ring-1 ring-content/10" />
                                    ) : (
                                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-raised text-[10px] font-semibold text-content-secondary">
                                        {person.login.slice(0, 1).toUpperCase()}
                                      </span>
                                    )}
                                    <span className="min-w-0 flex-1 truncate text-xs text-content">{person.login}</span>
                                    {person.workspaceRole ? (
                                      <span className="rounded-full bg-status-success-subtle px-2 py-0.5 text-[10px] text-status-success">
                                        Here · {ROLE_LABEL[person.workspaceRole]}
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={adding}
                                        onClick={() => void addMember(person.login, joinAs)}
                                        className="rounded-lg border border-divider bg-selected px-2.5 py-1 text-[10px] font-medium text-selected-content transition-colors hover:bg-selected disabled:opacity-40"
                                      >
                                        Add as {ROLE_LABEL[joinAs]}
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          {loading ? (
            <div className="px-5 py-10 text-center text-xs text-content-muted">Loading workspace members…</div>
          ) : members.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-content-muted">No active members found.</div>
          ) : (
            <div className="divide-y divide-divider">
              {members.map(member => (
                <div key={member.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-divider bg-surface-raised text-xs font-semibold text-content-secondary">{member.userId.slice(0, 1).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-content">{member.userId}</div>
                    <div className="mt-0.5 text-[11px] text-content-muted">Added {new Date(member.createdAt).toLocaleDateString()}</div>
                  </div>
                  {canManageMembers ? (
                    <select
                      value={member.role}
                      onChange={event => void updateMemberRole(member, event.target.value as UserRole)}
                      className="rounded-lg border border-divider bg-surface-raised px-2.5 py-1.5 text-[11px] text-content outline-none focus:border-control"
                    >
                      {(['client', 'dev', 'pm', 'admin'] as UserRole[]).map(role => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
                    </select>
                  ) : (
                    <span className="rounded-full bg-surface-raised px-2.5 py-1 text-[11px] text-content-secondary">{ROLE_LABEL[member.role]}</span>
                  )}
                  <span className={`hidden rounded-full px-2 py-1 text-[10px] sm:inline-flex ${member.status === 'active' ? 'bg-status-success-subtle text-status-success' : 'bg-surface-raised text-content-muted'}`}>{member.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-divider bg-surface/50">
          <div className="border-b border-divider px-5 py-4">
            <div className="flex items-center gap-2"><FolderKanban className="h-4 w-4 text-link" /><h3 className="text-sm font-semibold text-content">Project access</h3></div>
            <p className="mt-1 text-[11px] text-content-muted">Developers see only projects with an active assignment. There is no workspace-wide fallback.</p>
          </div>
          <div className="border-b border-divider px-5 py-4">
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-content-muted">Selected project</label>
            <select
              value={selectedProjectId}
              onChange={event => setSelectedProjectId(event.target.value)}
              className="w-full rounded-xl border border-divider bg-surface-raised px-3 py-2.5 text-xs text-content outline-none focus:border-control"
            >
              {projects.map(project => <option key={project.id} value={project.id}>{project.name} · {project.key}</option>)}
            </select>
          </div>
          {!selectedProject ? (
            <div className="px-5 py-10 text-center text-xs text-content-muted">No workspace projects available.</div>
          ) : developers.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-content-muted">No active developers are available to assign.</div>
          ) : (
            <div className="divide-y divide-divider">
              {developers.map(member => {
                const assigned = activeAssignments.has(member.userId);
                return (
                  <button
                    key={member.id}
                    type="button"
                    disabled={!canManageMembers || assignmentLoading}
                    onClick={() => void toggleProjectAccess(member.userId)}
                    className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface-high disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg border ${assigned ? 'border-divider bg-selected text-selected-content' : 'border-divider bg-surface-raised text-content-muted'}`}>
                      {assigned ? <Check className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-content">{member.userId}</span><span className="block text-[11px] text-content-muted">Developer</span></span>
                    <span className={`text-[11px] ${assigned ? 'text-link' : 'text-content-muted'}`}>{assigned ? 'Assigned' : canManageMembers ? 'Assign' : 'Not assigned'}</span>
                  </button>
                );
              })}
            </div>
          )}
          {!canManageMembers && <div className="flex items-center gap-2 border-t border-divider px-5 py-3 text-[11px] text-content-muted"><LockKeyhole className="h-3.5 w-3.5" />Project assignments are managed by workspace admins.</div>}
        </section>
      )}
    </div>
  );
};
