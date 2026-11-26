import type { ClientProject, ClientProjectProposal } from './clientApi';

export interface ClientProposalView {
  /** The short status in the row's corner. */
  badge: string;
  tone: 'pending' | 'accepted' | 'declined';
  /** One sentence on what happens next. */
  next: string;
  /** The project it became, when the client can open it. */
  project: ClientProject | null;
}

/**
 * How a proposal reads to the client who sent it. An accepted one names its project and
 * links to it only when that project is in the client's own project list, so the link
 * always opens something they can see.
 */
export function clientProposalView(proposal: Pick<ClientProjectProposal, 'status' | 'project' | 'clarificationMessages'>, projects: readonly ClientProject[]): ClientProposalView {
  switch (proposal.status) {
    case 'awaiting_client':
      return { badge: 'Your reply is needed', tone: 'pending', next: 'Your project manager has a question. Reply below so they can review your idea.', project: null };
    case 'pending':
      return { badge: 'Waiting for project manager', tone: 'pending', project: null,
        next: proposal.clarificationMessages?.at(-1)?.author === 'client'
          ? 'Your project manager will review your reply and update you here.'
          : 'Your project manager is reviewing your idea.' };
    case 'declined':
      return { badge: 'Not moving forward', tone: 'declined', next: 'The project manager decided not to move forward. No project was created.', project: null };
    case 'accepted': {
      const linked = proposal.project;
      const project = linked ? projects.find(item => item.workspaceId === linked.workspaceId && item.projectId === linked.projectId) ?? null : null;
      if (linked) {
        return { badge: `Accepted · ${linked.name}`, tone: 'accepted', project,
          next: `The project manager started ${linked.name} from this proposal. Follow its progress in your projects.` };
      }
      return { badge: 'Accepted · being set up', tone: 'accepted', project: null,
        next: 'The project manager accepted this proposal and is setting up the project. It will appear in your projects.' };
    }
  }
}
