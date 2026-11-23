import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { ProjectOrchestrationSettings } from '@/shared/types';
import { ProjectAutonomySection, sensitivePathsFrom } from './ProjectAutonomySection';

/**
 * The project's "when a build gets stuck" setting: the team chooses how much Alpha fixes on its
 * own and which areas it must always ask about. Clients never get the setting, so it never shows.
 */

const settings: ProjectOrchestrationSettings = { enabled: true, available: true, localOnly: true, autonomy: 'standard', sensitivePaths: ['src/billing/**'] };
const render = (value: ProjectOrchestrationSettings, canEdit: boolean) =>
  renderToStaticMarkup(<ProjectAutonomySection projectId="p1" settings={value} canEdit={canEdit} onSaved={() => undefined} />);

describe('project autonomy setting', () => {
  it('lets the team choose one of the three levels and edit the sensitive areas', () => {
    const html = render(settings, true);
    for (const shown of ['When a build gets stuck', 'Fix routine problems and earlier work', 'Fix routine problems only', 'Always ask me', 'recommended', 'Areas Alpha must always ask about']) expect(html).toContain(shown);
    expect(html.match(/type="radio"/g)).toHaveLength(3);
    const checked = (html.match(/<input[^>]*type="radio"[^>]*>/g) ?? []).filter(input => input.includes('checked'));
    expect(checked).toHaveLength(1);
    expect(checked[0]).toContain('value="standard"');
    expect(html).toContain('src/billing/**</textarea>');
  });

  it('is read-only for someone who cannot edit the project', () => {
    const html = render({ ...settings, autonomy: 'off', sensitivePaths: [] }, false);
    expect(html).toContain('Always ask me.');
    expect(html).toContain('None added.');
    expect(html).not.toContain('type="radio"');
    expect(html).not.toContain('<textarea');
  });

  it('shows nothing when the server did not send the setting (clients and the web app)', () => {
    expect(render({ enabled: true, available: true, localOnly: true }, true)).toBe('');
  });

  it('reads one sensitive area per line, without blanks or repeats', () => {
    expect(sensitivePathsFrom(' src/billing/**\r\n\nsrc/billing/**\ninfra/*.tf \n')).toEqual(['src/billing/**', 'infra/*.tf']);
  });
});
