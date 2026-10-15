import type { PmTicketQueueItem } from './pmApi';

export interface PmTicketProjectGroup {
  key: string;
  projectId: string | null;
  name: string | null;
  tickets: PmTicketQueueItem[];
}

export interface PmTicketClientGroup {
  key: string;
  name: string;
  accessActive: boolean;
  acceptsNewRequests: boolean;
  tickets: number;
  projects: PmTicketProjectGroup[];
}

/** Groups verified accounts together; a contact-only inquiry is always its own group. */
export function groupPmTickets(items: readonly PmTicketQueueItem[]): PmTicketClientGroup[] {
  const clients = new Map<string, PmTicketClientGroup>();
  const projects = new Map<string, Map<string, PmTicketProjectGroup>>();

  for (const item of items) {
    const source = item.internal.clientGroup;
    const clientKey = source?.key ?? `ticket:${item.id}`;
    let client = clients.get(clientKey);
    if (!client) {
      client = {
        key: clientKey,
        name: source?.displayName ?? 'Separate inquiry',
        accessActive: source?.accessActive ?? false,
        acceptsNewRequests: source?.acceptsNewRequests ?? false,
        tickets: 0,
        projects: [],
      };
      clients.set(clientKey, client);
      projects.set(clientKey, new Map());
    }
    client.tickets += 1;

    const projectId = item.internal.projectId;
    const projectKey = projectId ?? 'unlinked';
    const clientProjects = projects.get(clientKey)!;
    let project = clientProjects.get(projectKey);
    if (!project) {
      project = {
        key: projectKey,
        projectId,
        name: projectId ? item.internal.projectName ?? null : null,
        tickets: [],
      };
      clientProjects.set(projectKey, project);
      client.projects.push(project);
    } else if (!project.name && item.internal.projectName) {
      project.name = item.internal.projectName;
    }
    project.tickets.push(item);
  }

  return [...clients.values()];
}
