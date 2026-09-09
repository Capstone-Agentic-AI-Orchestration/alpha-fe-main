import React, { useEffect, useState } from 'react';
import { Bot, CheckSquare, FolderKanban, Inbox, Rocket } from 'lucide-react';
import { useApp } from '@/app/AppContext';
import { Modal } from '@/shared/components/Modal';

const GUIDE_STORAGE_KEY = 'alpha_multica_prototype_guide_complete';

const steps = [
  {
    title: 'Start with project context',
    description: 'Choose a project, then open the issue you want the prototype agent to handle.',
    items: [
      { icon: FolderKanban, label: 'Choose a project' },
      { icon: CheckSquare, label: 'Open an issue' }
    ]
  },
  {
    title: 'Approve a clear plan',
    description: 'Select an agent, review the generated plan, and start a safe simulated run.',
    items: [
      { icon: Bot, label: 'Select an agent' },
      { icon: CheckSquare, label: 'Approve the plan' }
    ]
  },
  {
    title: 'Review and validate',
    description: 'Follow progress on the issue, review the output in Inbox, then inspect Preview validation.',
    items: [
      { icon: Inbox, label: 'Review agent output' },
      { icon: Rocket, label: 'Inspect CI/CD' }
    ]
  }
];

export const PrototypeGuide: React.FC = () => {
  const { setActiveTab } = useApp();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (localStorage.getItem(GUIDE_STORAGE_KEY) !== 'true') setOpen(true);

    const reopen = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener('alpha:open-prototype-guide', reopen);
    return () => window.removeEventListener('alpha:open-prototype-guide', reopen);
  }, []);

  const finish = (goToProjects = false) => {
    localStorage.setItem(GUIDE_STORAGE_KEY, 'true');
    setOpen(false);
    setStep(0);
    if (goToProjects) setActiveTab('projects');
  };

  const current = steps[step];

  return (
    <Modal
      isOpen={open}
      onClose={() => finish(false)}
      title="A quick guide to Alpha"
      subtitle="Complete the prototype workflow in a few focused steps."
      maxWidth="max-w-lg"
    >
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-xs text-gray-500" aria-label={`Step ${step + 1} of ${steps.length}`}>
          {steps.map((_, index) => (
            <span
              key={index}
              className={`h-0.5 flex-1 ${index <= step ? 'bg-brand-400' : 'bg-white/10'}`}
            />
          ))}
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
            Step {step + 1} of {steps.length}
          </p>
          <h4 className="mt-2 text-base font-semibold text-white">{current.title}</h4>
          <p className="mt-1 text-sm leading-relaxed text-gray-400">{current.description}</p>
        </div>

        <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
          {current.items.map(item => (
            <div key={item.label} className="flex items-center gap-3 py-3 text-sm text-gray-300">
              <item.icon className="h-4 w-4 text-brand-400" />
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => finish(false)}
            className="text-xs font-medium text-gray-500 transition-colors hover:text-gray-200"
          >
            Skip guide
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(value => value - 1)}
                className="px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:text-white"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => step === steps.length - 1 ? finish(true) : setStep(value => value + 1)}
              className="bg-brand-500 px-4 py-2 text-xs font-medium text-on-accent transition-colors hover:bg-brand-600"
            >
              {step === steps.length - 1 ? 'Open projects' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
