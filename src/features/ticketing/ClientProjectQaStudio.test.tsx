import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClientProjectQaStudio } from './ClientProjectQaStudio';
import { QaPreview } from './ProjectQaStudio';

describe('client project review presentation', () => {
  it('names the review region without repeating the removed introduction', () => {
    const html = renderToStaticMarkup(<ClientProjectQaStudio workspaceId="workspace-a" projectId="project-a"
      projectName="Calculator" inspectionOnly feedback={<p>Project feedback</p>} refreshToken={0} />);
    expect(html).toContain('aria-label="Calculator Project Review"');
    expect(html).toContain('Review round');
    expect(html).not.toContain('pqa-heading');
    expect(html).not.toContain('QA Studio');
    expect(html).not.toContain('Test the UAT build reviewed and shared by your project manager.');
  });

  it('uses plain client preview wording while keeping the PM default', () => {
    const client = renderToStaticMarkup(<QaPreview preview={null} audience="client" />);
    expect(client).toContain('Project preview');
    expect(client).toContain('No preview shared yet');
    expect(client).toContain('Your preview will appear here when it is shared.');
    expect(client).not.toContain('UAT');
    const pm = renderToStaticMarkup(<QaPreview preview={null} />);
    expect(pm).toContain('UAT preview');
    expect(pm).toContain('Reload UAT preview');
    expect(pm).toContain('Your project manager reviews the UAT build before sharing it here.');
  });
});
