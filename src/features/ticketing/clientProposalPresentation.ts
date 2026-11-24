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
export function clientProposalView(proposal: Pick<ClientProjectProposal, 'status' | 'project'>, projects: readonly ClientProject[]): ClientProposalView {
  switch (proposal.status) {
    case 'awaiting_client':
      return { badge: 'Needs your reply', tone: 'pending', next: 'The project manager needs a little more information to review this proposal.', project: null };
    case 'pending':
      return { badge: 'With the project manager', tone: 'pending', next: 'The project manager will review this proposal and update you here.', project: null };
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
