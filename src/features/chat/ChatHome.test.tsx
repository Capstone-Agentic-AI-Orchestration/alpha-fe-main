import { describe, expect, it } from 'vitest';
import { greetingName } from './ChatHome';
import { sectionsFor } from '@/config/navigation';
import { aiFeaturesEnabled } from '@/config/features';

describe('fresh chat home', () => {
  it('greets the person by their first name', () => {
    expect(greetingName('Lloyd1020')).toBe('Lloyd');
    expect(greetingName('LloydLim1')).toBe('Lloyd');
    expect(greetingName('lloyd.lim')).toBe('Lloyd');
    expect(greetingName('Maria Santos')).toBe('Maria');
    expect(greetingName('')).toBe('');
  });

  it('lists Chat first, under Build, for internal roles with AI features, and keeps a client chat under Communication', () => {
    for (const role of (['dev', 'pm', 'admin'] as const).filter(aiFeaturesEnabled)) {
      const [first] = sectionsFor(role);
      expect(first.section.id).toBe('build');
      expect(first.items.map(item => item.id)).toEqual(['chat']);
    }
    const client = sectionsFor('client').find(group => group.items.some(item => item.id === 'chat'));
    expect(client?.section.id).toBe('communication');
  });
});

