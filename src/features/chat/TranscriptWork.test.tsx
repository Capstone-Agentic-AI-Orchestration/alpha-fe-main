import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AgentCall, ProjectBuildAgentCard, ProjectBuildOrchestration } from '@/shared/types';
import { BuildWork, PlanChecklist, TurnWork, WorkingStatusLine } from './TranscriptWork';

const task = (id: string, title: string, status: string) => ({ id, title, status }) as unknown as ProjectBuildOrchestration['tasks'][number];

const orchestration = (status: string): ProjectBuildOrchestration => ({
  run: { id: 'run-1', status, planVersion: 1, createdAt: '2026-11-26T00:00:00.000Z' },
  tasks: [task('t1', 'Add an endpoint that sends the email', 'accepted'), task('t2', 'Build the form', 'running'), task('t3', 'Run the checks', 'pending')],
  attempts: [
    { agentName: 'Backend agent', prototypeRunId: 'run-be', startedAt: '2026-11-26T00:00:00.000Z', completedAt: '2026-11-26T00:01:00.000Z' },
    { agentName: 'Frontend agent', prototypeRunId: 'run-fe', startedAt: '2026-11-26T00:01:00.000Z', completedAt: '2026-11-26T00:03:12.000Z' }
  ],
  finalValidation: { commands: [{ script: 'test', exitCode: 0, signal: null }], missingScripts: [], noOpenBlockingFindings: true }
}) as unknown as ProjectBuildOrchestration;

const card = (agentName: string, runId: string, status: string, activity: Array<[string, string, string[]?]>) => ({
  agentName, runId, status,
  activity: activity.map(([kind, message, paths], index) => ({ id: runId + index, sequence: index, kind, message, paths, createdAt: `2026-11-26T00:0${index}:00.000Z` }))
}) as unknown as ProjectBuildAgentCard;

const cards = [
  card('Backend agent', 'run-be', 'completed', [['tool', 'Read server/index.ts'], ['file_change', 'x', ['server/routes/contact.ts']], ['summary', 'Run completed']]),
  card('Frontend agent', 'run-fe', 'running', [['tool', 'Read src/App.tsx'], ['file_change', 'x', ['src/ContactForm.tsx']]]),
  card('Someone else', 'run-other', 'running', [['tool', 'Read elsewhere.ts']])
];

describe('a build in the conversation', () => {
  it('ticks the plan off as tasks are accepted', () => {
    const html = renderToStaticMarkup(<PlanChecklist tasks={orchestration('executing').tasks} />);
    expect(html).toContain('Done: </span><span class="text-content-muted line-through">Add an endpoint that sends the email');
    expect(html).toContain('In progress: </span><span class="text-content">Build the form');
    expect(html).toContain('Not started: </span><span class="text-content-secondary">Run the checks');
  });

  it('shows the plan and each agent\'s steps while it works, with the latest step marked', () => {
    const html = renderToStaticMarkup(<BuildWork orchestration={orchestration('executing')} agentCards={cards} entries={[]} now={0} />);
    expect(html).toContain('aria-label="Plan"');
    expect(html).toContain('What Backend agent did');
    expect(html).toContain('<code class="font-mono text-[12px] text-content">server/routes/contact.ts</code>');
    expect(html).toMatch(/text-content motion-safe:animate-pulse" ?[^>]*>Edited <code[^>]*>src\/ContactForm\.tsx/);
    expect(html).not.toContain('Run completed');
    expect(html).not.toContain('elsewhere.ts');
    expect(html).toContain('Technical details');
  });

  it('folds into one line when it is done', () => {
    const html = renderToStaticMarkup(<BuildWork orchestration={orchestration('awaiting_approval')} agentCards={cards} entries={[]} now={0} />);
    expect(html).toContain('Worked for 3m 12s · 2 agents · every check passed');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('aria-label="Plan"');
  });
});

describe('the work behind a chat message', () => {
  const call = (status: AgentCall['status']): AgentCall => ({
    id: 'call-1', agentId: 'alpha-assistant', squadId: 'alpha-chat', status, createdAt: '2026-11-26T00:00:00.000Z',
    startedAt: '2026-11-26T00:00:00.000Z', completedAt: status === 'running' ? undefined : '2026-11-26T00:00:21.000Z',
    activities: [{ id: 'a1', sequence: 1, kind: 'tool', message: 'Reading project files', paths: ['src/App.tsx'], createdAt: '2026-11-26T00:00:05.000Z' }]
  }) as unknown as AgentCall;

  it('shows steps while Alpha works and "Worked for" once it is done', () => {
    const working = renderToStaticMarkup(<TurnWork calls={[call('running')]} agents={[]} entries={[]} now={0} working />);
    expect(working).toContain('What Alpha did');
    expect(working).toContain('src/App.tsx');
    const done = renderToStaticMarkup(<TurnWork calls={[call('completed')]} agents={[]} entries={[]} now={0} working={false} />);
    expect(done).toContain('Worked for 21s');
    expect(done).not.toContain('tokens');
    expect(renderToStaticMarkup(<TurnWork calls={[call('cancelled')]} agents={[]} entries={[]} now={0} working={false} />)).toContain('Stopped after 21s');
  });

  it('shows nothing for a plain answer still being written', () => {
    const plain = { ...call('running'), activities: [] };
    expect(renderToStaticMarkup(<TurnWork calls={[plain]} agents={[]} entries={[]} now={0} working />)).toBe('');
  });

  it('says what is working, for how long, and how to stop it', () => {
    const html = renderToStaticMarkup(<WorkingStatusLine label="Working" since="2026-11-26T00:00:00.000Z" now={Date.parse('2026-11-26T00:01:42.000Z')} hint="Esc to stop" />);
    expect(html).toContain('Working');
    expect(html).toContain('· 1m 42s');
    expect(html).toContain('· Esc to stop');
    expect(renderToStaticMarkup(<WorkingStatusLine label="Working" now={0} hint="" />)).not.toContain('·');
  });
});
