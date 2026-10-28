import { describe, expect, it } from 'vitest';
import { clientPreviewApi } from './clientPreviewApi';

describe('fictional client portal preview transport', () => {
  it('provides project-scoped sample data for the redesigned portal', async () => {
    const { items: projects } = await clientPreviewApi.listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ name: 'Operations Dashboard', intakeOptionId: 'sample-shared-project' });

    const all = await clientPreviewApi.listRequests({ limit: 20 });
    expect(all.items.length).toBeGreaterThan(0);
    expect(all.items.every(item => item.workspaceId && item.id)).toBe(true);

    const linked = await clientPreviewApi.listProjectRequests(projects[0].workspaceId, projects[0].projectId, { limit: 20 });
    expect(linked.items.length).toBeGreaterThan(0);
    expect(linked.items.every(item => item.projectId === projects[0].projectId)).toBe(true);
  });

  it('keeps project preview feedback empty and read-only in the fictional sample', async () => {
    const { items: projects } = await clientPreviewApi.listProjects();
    const page = await clientPreviewApi.getProjectFeedbackMessages(projects[0].workspaceId, projects[0].projectId);
    expect(page).toEqual({ items: [], nextCursor: null });
    await expect(clientPreviewApi.sendProjectFeedbackMessage(projects[0].workspaceId, projects[0].projectId,
      { schemaVersion: 1, operationId: 'preview-only', body: 'This must stay disabled.' }))
      .rejects.toMatchObject({ status: 503 });
  });
});
