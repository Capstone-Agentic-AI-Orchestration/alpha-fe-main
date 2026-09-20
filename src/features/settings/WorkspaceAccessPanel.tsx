import React, { useEffect, useMemo, useState } from 'react';
import { Check, LockKeyhole, Shield, Users, UserRound, FolderKanban } from 'lucide-react';
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

export const WorkspaceAccessPanel: React.FC<WorkspaceAccessPanelProps> = ({ mode }) => {
  const {
    activeWorkspace,
    activeWorkspaceId,
    projects,
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

  const updateMemberRole = async (member: WorkspaceMember, role: UserRole) => {
    if (!activeWorkspaceId || !canManageMembers || role === member.role) return;
    try {
      const updated = await apiService.updateWorkspaceMember(activeWorkspaceId, member.id, { role }) as WorkspaceMember;
      setMembers(prev => prev.map(item => item.id === member.id ? updated : item));
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
        <div className="rounded-2xl border border-white/[0.08] bg-surface-200/60 p-4">
          <div className="flex items-center gap-2 text-gray-500"><Users className="h-4 w-4" /><span className="text-[11px] uppercase tracking-[0.14em]">Members</span></div>
          <div className="mt-3 text-2xl font-semibold text-white">{members.length}</div>
          <p className="mt-1 text-[11px] text-gray-500">Active workspace identities</p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-surface-200/60 p-4">
          <div className="flex items-center gap-2 text-gray-500"><UserRound className="h-4 w-4" /><span className="text-[11px] uppercase tracking-[0.14em]">Developers</span></div>
          <div className="mt-3 text-2xl font-semibold text-white">{developers.length}</div>
          <p className="mt-1 text-[11px] text-gray-500">Eligible for project assignment</p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-surface-200/60 p-4">
          <div className="flex items-center gap-2 text-gray-500"><Shield className="h-4 w-4" /><span className="text-[11px] uppercase tracking-[0.14em]">Control</span></div>
          <div className="mt-3 text-sm font-semibold text-white">{canManageMembers ? 'Full control' : 'Read only'}</div>
          <p className="mt-1 text-[11px] text-gray-500">{activeWorkspace?.name ?? 'Active workspace'}</p>
        </div>
      </div>

      {mode === 'members' ? (
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-surface-200/50">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Members & roles</h3>
              <p className="mt-1 text-[11px] text-gray-500">Workspace membership controls what a person can discover and use.</p>
            </div>
            <span className="rounded-full border border-brand-400/20 bg-brand-500/10 px-2.5 py-1 text-[10px] font-medium text-brand-200">{canManageMembers ? 'Admin controls' : 'PM visibility'}</span>
          </div>
          {loading ? (
            <div className="px-5 py-10 text-center text-xs text-gray-500">Loading workspace members…</div>
          ) : members.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-gray-500">No active members found.</div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {members.map(member => (
                <div key={member.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.06] text-xs font-semibold text-gray-300">{member.userId.slice(0, 1).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-white">{member.userId}</div>
                    <div className="mt-0.5 text-[11px] text-gray-500">Added {new Date(member.createdAt).toLocaleDateString()}</div>
                  </div>
                  {canManageMembers ? (
                    <select
                      value={member.role}
                      onChange={event => void updateMemberRole(member, event.target.value as UserRole)}
                      className="rounded-lg border border-white/[0.08] bg-surface-100 px-2.5 py-1.5 text-[11px] text-gray-200 outline-none focus:border-brand-400/50"
                    >
                      {(['client', 'dev', 'pm', 'admin'] as UserRole[]).map(role => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
                    </select>
                  ) : (
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-gray-300">{ROLE_LABEL[member.role]}</span>
                  )}
                  <span className={`hidden rounded-full px-2 py-1 text-[10px] sm:inline-flex ${member.status === 'active' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/[0.06] text-gray-500'}`}>{member.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-white/[0.08] bg-surface-200/50">
          <div className="border-b border-white/[0.07] px-5 py-4">
            <div className="flex items-center gap-2"><FolderKanban className="h-4 w-4 text-brand-300" /><h3 className="text-sm font-semibold text-white">Project access</h3></div>
            <p className="mt-1 text-[11px] text-gray-500">Developers see only projects with an active assignment. There is no workspace-wide fallback.</p>
          </div>
          <div className="border-b border-white/[0.07] px-5 py-4">
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Selected project</label>
            <select
              value={selectedProjectId}
              onChange={event => setSelectedProjectId(event.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-surface-100 px-3 py-2.5 text-xs text-white outline-none focus:border-brand-400/50"
            >
              {projects.map(project => <option key={project.id} value={project.id}>{project.name} · {project.key}</option>)}
            </select>
          </div>
          {!selectedProject ? (
            <div className="px-5 py-10 text-center text-xs text-gray-500">No workspace projects available.</div>
          ) : developers.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-gray-500">No active developers are available to assign.</div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {developers.map(member => {
                const assigned = activeAssignments.has(member.userId);
                return (
                  <button
                    key={member.id}
                    type="button"
                    disabled={!canManageMembers || assignmentLoading}
                    onClick={() => void toggleProjectAccess(member.userId)}
                    className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.03] disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg border ${assigned ? 'border-brand-400/30 bg-brand-500/15 text-brand-200' : 'border-white/[0.08] bg-white/[0.04] text-gray-500'}`}>
                      {assigned ? <Check className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-white">{member.userId}</span><span className="block text-[11px] text-gray-500">Developer</span></span>
                    <span className={`text-[11px] ${assigned ? 'text-brand-200' : 'text-gray-600'}`}>{assigned ? 'Assigned' : canManageMembers ? 'Assign' : 'Not assigned'}</span>
                  </button>
                );
              })}
            </div>
          )}
          {!canManageMembers && <div className="flex items-center gap-2 border-t border-white/[0.07] px-5 py-3 text-[11px] text-gray-500"><LockKeyhole className="h-3.5 w-3.5" />Project assignments are managed by workspace admins.</div>}
        </section>
      )}
    </div>
  );
};
