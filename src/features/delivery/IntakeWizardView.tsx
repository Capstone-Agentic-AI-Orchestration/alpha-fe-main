import React, { useState } from 'react';
import { useApp } from '@/app/AppContext';
import { IntakeAnswers, IssuePriority } from '@/shared/types';
import { SectionLabel } from '@/features/delivery/Ledger';
import { ArrowLeft, ArrowRight, Check, Plus, X, Paperclip, Loader2 } from 'lucide-react';

const EMPTY: IntakeAnswers = {
  title: '',
  problem: '',
  affected: '',
  currentWorkaround: '',
  definitionOfDone: '',
  successMeasure: '',
  urgency: 'medium',
  capabilities: [''],
  outOfScope: '',
  concerns: [],
  targetDate: '',
  expectedUsers: 5000,
  integrations: '',
  attachments: [],
  approvers: '',
  updateCadence: 'weekly'
};

const STEPS = [
  { n: 1, label: 'The problem', hint: 'about a minute' },
  { n: 2, label: 'What success looks like', hint: 'about a minute' },
  { n: 3, label: 'What it should do', hint: 'about two minutes' },
  { n: 4, label: 'Constraints', hint: 'about a minute' },
  { n: 5, label: 'Who signs off', hint: 'under a minute' }
];

const CONCERN_OPTIONS = [
  'Personal data privacy',
  'Payment security',
  'Must work on older phones',
  'Accessibility',
  'Multiple languages',
  'High traffic peaks',
  'Offline capability'
];

const field =
  'w-full bg-[#14151B] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-sm text-white ' +
  'placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors';

export const IntakeWizardView: React.FC = () => {
  const { submitIntake, setActiveTab } = useApp();

  const [step, setStep] = useState(1);
  const [a, setA] = useState<IntakeAnswers>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const set = <K extends keyof IntakeAnswers>(key: K, value: IntakeAnswers[K]) => {
    setA(prev => ({ ...prev, [key]: value }));
    setSaved('Saved');
    window.setTimeout(() => setSaved(null), 1400);
  };

  const setCapability = (i: number, value: string) => {
    const next = [...a.capabilities];
    next[i] = value;
    set('capabilities', next);
  };

  const addCapability = () => set('capabilities', [...a.capabilities, '']);

  const removeCapability = (i: number) =>
    set('capabilities', a.capabilities.filter((_, idx) => idx !== i));

  const toggleConcern = (c: string) =>
    set('concerns', a.concerns.includes(c) ? a.concerns.filter(x => x !== c) : [...a.concerns, c]);

  const canAdvance = (): boolean => {
    switch (step) {
      case 1: return a.title.trim().length > 2 && a.problem.trim().length > 10;
      case 2: return a.definitionOfDone.trim().length > 5;
      case 3: return a.capabilities.filter(c => c.trim()).length > 0;
      case 4: return a.targetDate !== '';
      case 5: return a.approvers.trim().length > 0;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    // Stands in for the architect agent compiling the specification.
    await new Promise(r => setTimeout(r, 1600));
    submitIntake({ ...a, capabilities: a.capabilities.filter(c => c.trim()) });
    setSubmitting(false);
    setActiveTab('documents');
  };

  return (
    <div className="h-full overflow-y-auto bg-[#16171D]">
      <div className="max-w-3xl mx-auto px-8 py-10 space-y-8">

        {/* Header + step rail */}
        <div className="space-y-5">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="text-lg font-semibold text-white tracking-tight">Tell us what you need</h1>
            <span className="text-xs text-gray-500 font-mono">
              {saved ? <span className="text-emerald-400">{saved}</span> : `Step ${step} of 5`}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {STEPS.map(s => (
              <button
                key={s.n}
                onClick={() => s.n < step && setStep(s.n)}
                disabled={s.n > step}
                className={`h-0.5 flex-1 rounded-full transition-colors ${
                  s.n < step ? 'bg-brand-500' : s.n === step ? 'bg-brand-400' : 'bg-white/[0.08]'
                } ${s.n < step ? 'cursor-pointer' : 'cursor-default'}`}
                aria-label={`Step ${s.n}: ${s.label}`}
              />
            ))}
          </div>

          <div className="flex items-baseline gap-3">
            <h2 className="text-sm font-semibold text-white">{STEPS[step - 1].label}</h2>
            <span className="text-xs text-gray-500">{STEPS[step - 1].hint}</span>
          </div>
        </div>

        {/* Step 1 — the problem */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-2">
              <label className="text-sm text-gray-300 block">What should we call this?</label>
              <input
                autoFocus
                className={field}
                value={a.title}
                onChange={e => set('title', e.target.value)}
                placeholder="Online appointment booking"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-300 block">What problem are you facing?</label>
              <p className="text-xs text-gray-500">Plain language is fine. Describe it the way you would to a colleague.</p>
              <textarea
                rows={4}
                className={field}
                value={a.problem}
                onChange={e => set('problem', e.target.value)}
                placeholder="Patients book by calling the front desk, and staff spend most of the morning on the phone…"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm text-gray-300 block">Who does this affect?</label>
                <input
                  className={field}
                  value={a.affected}
                  onChange={e => set('affected', e.target.value)}
                  placeholder="Front desk staff, about 900 patients"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-300 block">How do you handle it today?</label>
                <input
                  className={field}
                  value={a.currentWorkaround}
                  onChange={e => set('currentWorkaround', e.target.value)}
                  placeholder="A paper diary at each branch"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — success */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-2">
              <label className="text-sm text-gray-300 block">When this is working, what can someone do that they can't today?</label>
              <textarea
                autoFocus
                rows={3}
                className={field}
                value={a.definitionOfDone}
                onChange={e => set('definitionOfDone', e.target.value)}
                placeholder="A patient can book, reschedule, or cancel online without calling."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-300 block">How would you know it worked?</label>
              <p className="text-xs text-gray-500">A number is ideal, but "fewer complaints about X" is a real answer too.</p>
              <input
                className={field}
                value={a.successMeasure}
                onChange={e => set('successMeasure', e.target.value)}
                placeholder="No-show rate under 8% within three months"
              />
            </div>
            <div className="space-y-2.5">
              <label className="text-sm text-gray-300 block">How urgent is this?</label>
              <div className="flex flex-wrap gap-2">
                {(['urgent', 'high', 'medium', 'low'] as IssuePriority[]).map(p => (
                  <button
                    key={p}
                    onClick={() => set('urgency', p)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs capitalize transition-colors border ${
                      a.urgency === p
                        ? 'bg-white/[0.10] text-white border-white/20 font-medium'
                        : 'text-gray-400 border-white/[0.08] hover:text-gray-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — scope */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-3">
              <label className="text-sm text-gray-300 block">What should it do?</label>
              <p className="text-xs text-gray-500">
                One thing per line. Each becomes a priced item you can keep or drop before approving.
              </p>
              <div className="space-y-2">
                {a.capabilities.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-gray-600 w-5 flex-shrink-0">{i + 1}</span>
                    <input
                      autoFocus={i === a.capabilities.length - 1 && c === ''}
                      className={field}
                      value={c}
                      onChange={e => setCapability(i, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); addCapability(); }
                      }}
                      placeholder={i === 0 ? 'Let patients see open slots and book one' : 'Add another…'}
                    />
                    {a.capabilities.length > 1 && (
                      <button
                        onClick={() => removeCapability(i)}
                        className="text-gray-600 hover:text-rose-400 p-1 transition-colors"
                        aria-label={`Remove item ${i + 1}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={addCapability}
                className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors pl-7"
              >
                <Plus className="w-3.5 h-3.5" />
                Add another
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-300 block">What is definitely out of scope?</label>
              <p className="text-xs text-gray-500">Saying this now prevents an argument later.</p>
              <input
                className={field}
                value={a.outOfScope}
                onChange={e => set('outOfScope', e.target.value)}
                placeholder="Insurance claims and clinical records"
              />
            </div>

            <div className="space-y-2.5">
              <label className="text-sm text-gray-300 block">Anything we must be careful about?</label>
              <div className="flex flex-wrap gap-2">
                {CONCERN_OPTIONS.map(c => (
                  <button
                    key={c}
                    onClick={() => toggleConcern(c)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors border ${
                      a.concerns.includes(c)
                        ? 'bg-white/[0.10] text-white border-white/20'
                        : 'text-gray-400 border-white/[0.08] hover:text-gray-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    {a.concerns.includes(c) && <Check className="w-3 h-3 inline mr-1.5 -mt-px" />}
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4 — constraints */}
        {step === 4 && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm text-gray-300 block">When do you need it?</label>
                <input
                  autoFocus
                  type="date"
                  className={field}
                  value={a.targetDate}
                  onChange={e => set('targetDate', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-300 block">Budget ceiling, if you have one</label>
                <input
                  type="number"
                  className={field}
                  value={a.budgetCeiling ?? ''}
                  onChange={e => set('budgetCeiling', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-300 block">Roughly how many people will use this each month?</label>
              <p className="text-xs text-gray-500">
                This sets the hosting tier in your estimate. A rough number is fine.
              </p>
              <input
                type="number"
                className={field}
                value={a.expectedUsers}
                onChange={e => set('expectedUsers', Number(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-300 block">Any existing systems this must work with?</label>
              <input
                className={field}
                value={a.integrations}
                onChange={e => set('integrations', e.target.value)}
                placeholder="We use Xero for accounting"
              />
            </div>

            <div className="space-y-2.5">
              <label className="text-sm text-gray-300 block">Anything to show us?</label>
              <button
                onClick={() =>
                  set('attachments', [
                    ...a.attachments,
                    { id: `att-${Date.now()}`, name: `reference-${a.attachments.length + 1}.png`, sizeKb: 640 }
                  ])
                }
                className="flex items-center gap-2.5 w-full px-3.5 py-3 rounded-lg border border-dashed border-white/[0.12] text-sm text-gray-400 hover:text-gray-200 hover:border-white/20 transition-colors"
              >
                <Paperclip className="w-4 h-4" />
                Attach screenshots, documents, or examples
              </button>
              {a.attachments.length > 0 && (
                <div className="divide-y divide-white/[0.04]">
                  {a.attachments.map(f => (
                    <div key={f.id} className="flex items-center justify-between py-2 text-xs">
                      <span className="font-mono text-gray-300">{f.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-gray-600">{f.sizeKb} KB</span>
                        <button
                          onClick={() => set('attachments', a.attachments.filter(x => x.id !== f.id))}
                          className="text-gray-600 hover:text-rose-400 transition-colors"
                          aria-label={`Remove ${f.name}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 5 — stakeholders + review */}
        {step === 5 && (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-2">
              <label className="text-sm text-gray-300 block">Who else needs to approve before we start?</label>
              <input
                autoFocus
                className={field}
                value={a.approvers}
                onChange={e => set('approvers', e.target.value)}
                placeholder="Me, and Dr. Alvarez for anything touching patient records"
              />
            </div>

            <div className="space-y-2.5">
              <label className="text-sm text-gray-300 block">How often do you want updates?</label>
              <div className="flex flex-wrap gap-2">
                {([
                  ['daily', 'Daily'],
                  ['weekly', 'Weekly'],
                  ['on_milestone', 'When something ships']
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => set('updateCadence', value)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs transition-colors border ${
                      a.updateCadence === value
                        ? 'bg-white/[0.10] text-white border-white/20 font-medium'
                        : 'text-gray-400 border-white/[0.08] hover:text-gray-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <SectionLabel>What happens next</SectionLabel>
              <ol className="space-y-2.5 text-sm text-gray-400">
                <li className="flex gap-3">
                  <span className="font-mono text-[11px] text-gray-600 pt-0.5">01</span>
                  <span>We turn your answers into a written specification — you do not write it.</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-[11px] text-gray-600 pt-0.5">02</span>
                  <span>You get a price for each item, with what it rests on and how confident we are.</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-[11px] text-gray-600 pt-0.5">03</span>
                  <span>
                    You keep or drop items and watch the total change.
                    <span className="text-gray-500"> Nothing is built until you approve.</span>
                  </span>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Footer nav */}
        <div className="flex items-center justify-between pt-6 border-t border-white/[0.06]">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : setActiveTab('portal'))}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {step > 1 ? 'Back' : 'Cancel'}
          </button>

          {step < 5 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canAdvance()}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canAdvance() || submitting}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white text-sm font-medium transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Writing your specification…
                </>
              ) : (
                <>
                  Send request
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
