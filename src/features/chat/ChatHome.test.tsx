import { describe, expect, it } from 'vitest';
import { greetingName } from './ChatHome';
import { sectionsFor } from '@/config/navigation';
import { CHAT_TAB_ENABLED } from '@/config/features';

describe('fresh chat home', () => {
  it('greets the person by their first name', () => {
    expect(greetingName('Lloyd1020')).toBe('Lloyd');
    expect(greetingName('LloydLim1')).toBe('Lloyd');
    expect(greetingName('lloyd.lim')).toBe('Lloyd');
    expect(greetingName('Maria Santos')).toBe('Maria');
    expect(greetingName('')).toBe('');
  });

  it('honors the standalone Chat visibility flag without removing its role-aware destination metadata', () => {
    if (!CHAT_TAB_ENABLED) {
      for (const role of ['dev', 'pm', 'admin', 'client'] as const) expect(sectionsFor(role).flatMap(group => group.items).some(item => item.id === 'chat')).toBe(false);
      return;
    }
    const developer = sectionsFor('dev').find(group => group.items.some(item => item.id === 'chat'));
    expect(developer?.section.id).toBe('build');
    // Agent chat is for developers; a client keeps its own Messages elsewhere.
    expect(sectionsFor('client').some(group => group.items.some(item => item.id === 'chat'))).toBe(false);
  });
});
