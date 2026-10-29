import { ArrowRight, FolderKanban, LayoutDashboard, ListChecks, MessageSquareText } from 'lucide-react';
import { Modal } from '@/shared/components/Modal';

type ClientPage = 'overview' | 'projects' | 'requests';

const guideSections = [
  {
    icon: LayoutDashboard,
    title: 'Overview',
    description: 'See recent project updates and requests that need your attention.',
    page: 'overview' as const,
    action: 'Open overview',
  },
  {
    icon: FolderKanban,
    title: 'Projects',
    description: 'Browse the projects shared with you, review progress, and start a request when available.',
    page: 'projects' as const,
    action: 'Browse projects',
  },
  {
    icon: ListChecks,
    title: 'Requests',
    description: 'Open a request to follow its status, read updates, and see what happens next.',
    page: 'requests' as const,
    action: 'View requests',
  },
];

export function ClientQuickGuide({ isOpen, onClose, onNavigate }: {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: ClientPage) => void;
}) {
  return <Modal isOpen={isOpen} onClose={onClose} title="A quick guide to your portal"
    subtitle="Find project updates, follow requests, and reply to your project manager."
    maxWidth="max-w-xl" contentClassName="space-y-5 overflow-y-auto p-5 sm:p-6">
    <div className="client-quick-guide-list">
      {guideSections.map(({ icon: Icon, title, description, page, action }, index) => <section key={page} className="client-quick-guide-item">
        <span className="client-quick-guide-icon" aria-hidden="true"><Icon size={17} /></span>
        <div className="client-quick-guide-copy">
          <span className="client-quick-guide-step">0{index + 1}</span>
          <h3>{title}</h3>
          <p>{description}</p>
          <button type="button" onClick={() => onNavigate(page)}>{action}<ArrowRight size={14} /></button>
        </div>
      </section>)}
    </div>
    <p className="client-quick-guide-note"><MessageSquareText size={15} />To ask a question, open a request and reply in its conversation. Your project manager will see your message there.</p>
  </Modal>;
}
