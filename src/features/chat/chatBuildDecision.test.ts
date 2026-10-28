import { describe, expect, it } from 'vitest';
import { buildDecisionAction } from './chatBuildDecision';

describe('main-chat build decisions', () => {
  it.each(['start', 'Start it.', 'please start the plan', 'go ahead with this plan', 'continue'])('recognizes plan consent: %s', text => {
    expect(buildDecisionAction(text)).toBe('start');
  });
  it.each(['approve', 'approve publication', 'publish this build'])('recognizes separate publication consent: %s', text => {
    expect(buildDecisionAction(text)).toBe('approve');
  });
  it('distinguishes publication retry', () => expect(buildDecisionAction('retry publication')).toBe('retry_publication'));
  it.each(['yes', 'do not start', 'should I approve?', '"start"', '```\nstart\n```', 'start and delete the project', '/ask start', '@Ada approve'])('does not treat unrelated text as consent: %s', text => {
    expect(buildDecisionAction(text)).toBeUndefined();
  });
});
