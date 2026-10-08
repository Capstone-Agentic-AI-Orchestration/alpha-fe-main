// Isolated browser rehearsal: intercept test-only API modules before rendering
// the real PM view. No fixture or provider is added to application runtime.
// node scripts/test-ticketing-pm-handoff.mjs <playwright-index.mjs> <loopback-url> <artifact-dir> [browser-executable]
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [modulePath, target, outputPath, executable] = process.argv.slice(2);
if (!modulePath || !target || !outputPath) throw new Error('Expected Playwright module, loopback URL and artifact directory.');
const origin = new URL(target);
if (!['http:', 'https:'].includes(origin.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) || origin.username || origin.password) {
  throw new Error('Rehearsal requires a credential-free loopback URL.');
}
const { chromium } = await import(pathToFileURL(resolve(modulePath)).href);
const browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: resolve(executable) } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const faults = [];
const browserErrors = [];
page.on('pageerror', error => faults.push(error.message));
page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); });
const network = [];

const mockModule = `
export class ApiRequestError extends Error {}
const state = window.__pmHandoffTest = { version: 3, status: 'under_review', commands: [], uncertain: false, failMessages: false, failNotes: false, receipts: {} };
const timestamp = '2026-10-08T03:00:00.000Z';
const detail = () => ({
  id: 'ticket-a', reference: 'T-1', title: 'Browser handoff rehearsal', description: 'Test-only request',
  companyLabel: 'Test client', status: state.status, version: state.version, createdAt: timestamp,
  updatedAt: timestamp, closedAt: state.status === 'closed' ? timestamp : null, readOnly: state.status === 'closed', writesAvailable: state.status !== 'closed', requestedAction: null,
  sharedProjectName: null, relatedTicket: null, delivery: state.resultReady ? { id: 'delivery-a', scopeVersionId: 'scope-a', summary: 'Test-only reviewed result', sharedAt: timestamp, accepted: Boolean(state.accepted) } : null, request: null,
  scope: { id: 'scope-a', summary: 'Agreed browser rehearsal', proposedAt: timestamp, agreed: true },
  internal: { updatedAt: timestamp, projectId: state.version > 3 ? 'project-a' : null,
    requiredIssueIds: state.version > 3 ? (state.manifest || ['issue-a']) : [], actionOwner: state.version > 3 ? 'developer' : 'pm',
    nextAction: state.version > 3 ? 'execute_work' : 'authorize_work', authorizedScopeVersionId: state.version > 3 ? 'scope-a' : null,
    correctionRequestedFor: state.feedback ? 'delivery-a' : null, withdrawalRequested: false, closureReason: null, request: null,
    scopeVersion: { id: 'scope-a', summary: 'Agreed work', developerBrief: 'Test-only brief', proposedAt: timestamp, immutable: true, clientVisible: true },
    deliveryAssessment: state.resultReady ? { id: 'delivery-a', scopeVersionId: 'scope-a', summary: 'Test-only result', pinnedAssetId: 'test-asset', issueRevisionIds: ['test-revision'], immutable: true, clientVisible: true, shared: true } : null }
});
export const apiService = {
  async getProjects() { return [{ id: 'project-a', key: 'A', name: 'First project' }, { id: 'project-b', key: 'B', name: 'Second project' }]; },
  async getIssues() { return [
    { id: 'issue-a', projectId: 'project-a', identifier: 'A-1', title: 'Agreed existing Issue', status: state.reviewReady ? 'done' : 'todo', assignedHuman: 'dev' },
    ...(state.manifest ? [{ id: 'issue-c', projectId: 'project-a', identifier: 'A-4', title: 'Unaffected reviewed Issue', status: 'done', assignedHuman: 'dev' }] : []),
    { id: 'issue-started', projectId: 'project-a', identifier: 'A-2', title: 'Already running Issue', status: 'agent_running', assignedHuman: 'dev' },
    { id: 'issue-unassigned', projectId: 'project-a', identifier: 'A-3', title: 'Unassigned Issue', status: 'backlog' },
    { id: 'issue-b', projectId: 'project-b', identifier: 'B-1', title: 'Second project Issue', status: 'backlog', assignedHuman: 'dev' }
  ]; },
  async ticketRequest(path, options) {
    if (path.startsWith('/tickets?')) { const value = detail(); return { items: [{ ...value, internal: { ...value.internal, clientAccessActive: true } },
      ...(state.secondTicket ? [{ ...value, id: 'ticket-b', reference: 'T-2', title: 'Second ticket', internal: { ...value.internal, clientAccessActive: true } }] : [])], nextCursor: null,
      counters: { kind: 'pm', needsPm: state.version === 3 ? 1 : 0, inProgress: state.version > 3 ? 1 : 0, waitingClient: 0, closedMonth: 0 } }; }
    if (path === '/tickets/ticket-a') return detail();
    if (path === '/tickets/ticket-b') return { ...detail(), id: 'ticket-b', reference: 'T-2', title: 'Second ticket' };
    if (path.includes('/notes')) {
      if (state.failNotes) { const error = new ApiRequestError('Test-only private-note history read failed'); error.status = 503; throw error; }
      return { items: [], nextCursor: null };
    }
    if (path.includes('/messages')) {
      if (state.failMessages) { const error = new ApiRequestError('Test-only client-conversation read failed'); error.status = 404; throw error; }
      return { items: [], nextCursor: null };
    }
    if (path.endsWith('/commands')) {
      const input = JSON.parse(options.body); state.commands.push(input);
      if (!state.receipts[input.operationId]) {
        state.version++; state.status = input.command.type === 'close_accepted' ? 'closed' : 'in_progress';
        if (['request_fixes', 'authorize_correction'].includes(input.command.type)) {
          state.reviewReady = false; state.feedback = false; state.resultReady = false;
        }
        state.receipts[input.operationId] = { ticketId: 'ticket-a', operationId: input.operationId, version: state.version, status: state.status };
      }
      const receipt = state.receipts[input.operationId];
      state.receipt = receipt;
      if (state.uncertain) { const error = new ApiRequestError('Unknown test outcome'); error.reconciliationRequired = true; throw error; }
      return receipt;
    }
    if (path.startsWith('/tickets/operations/')) {
      if (state.uncertain) { const error = new ApiRequestError('Unknown lookup'); error.reconciliationRequired = true; throw error; }
      return state.receipt;
    }
    throw new Error('Unexpected test transport path');
  }
};`;

await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.origin !== origin.origin || /\/(?:api|rest\/v1|auth\/v1)(?:\/|$)/.test(url.pathname)) {
    network.push(url.pathname); return route.abort();
  }
  if (url.pathname === '/__pm-handoff-rehearsal') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><link rel="stylesheet" href="/src/index.css"></head><body><div id="root" style="height:100vh"></div><script type="module">
    import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    const [{ default: React }, { default: ReactDom }, { PmTicketsView }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'), import('/node_modules/.vite/deps/react-dom_client.js'), import('/src/features/ticketing/PmTicketsView.tsx')
    ]);
    ReactDom.createRoot(document.getElementById('root')).render(React.createElement(PmTicketsView));
  </script></body></html>` });
  if (url.pathname === '/src/shared/services/apiService.ts') return route.fulfill({ contentType: 'application/javascript', body: mockModule });
  return route.continue();
});

try {
  await mkdir(resolve(outputPath), { recursive: true });
  await page.goto(new URL('/__pm-handoff-rehearsal', origin).href);
  await page.getByRole('button', { name: 'Link agreed work', exact: true }).click();
  const form = page.getByRole('form', { name: 'Authorize ticket work' });
  await form.getByLabel('Choose a project').click();
  await form.getByRole('button', { name: 'A · First project', exact: true }).click();
  await form.getByLabel(/A-1 Agreed existing Issue/).check();
  await form.getByLabel(/The selected 1 Issue/).check();
  assert.equal(await form.getByRole('button', { name: 'Authorize agreed work', exact: true }).isEnabled(), true);
  assert.equal(await form.getByText('Already running Issue', { exact: false }).count(), 0);
  assert.equal(await form.getByText('Unassigned Issue', { exact: false }).count(), 0);

  // Changing project clears selection and the acknowledgement.
  await form.getByLabel('Choose a project').click();
  await form.getByRole('button', { name: 'B · Second project', exact: true }).click();
  assert.equal(await form.getByRole('button', { name: 'Authorize agreed work', exact: true }).isDisabled(), true);
  assert.equal(await form.getByLabel(/The selected 1 Issue/).count(), 0);
  await form.getByLabel('Choose a project').click();
  await form.getByRole('button', { name: 'A · First project', exact: true }).click();
  await form.getByLabel(/A-1 Agreed existing Issue/).check();
  await form.getByLabel(/The selected 1 Issue/).check();
  await page.screenshot({ path: resolve(outputPath, 'pm-ticket-handoff-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  await page.screenshot({ path: resolve(outputPath, 'pm-ticket-handoff-mobile.png'), fullPage: true });

  // A lost outcome must block editing; recovery retains the original operation.
  await page.evaluate(() => { window.__pmHandoffTest.uncertain = true; });
  await form.getByRole('button', { name: 'Authorize agreed work', exact: true }).click();
  await page.getByRole('button', { name: 'Check and retry', exact: true }).waitFor();
  assert.equal(await form.getByRole('button', { name: 'Authorize agreed work', exact: true }).isDisabled(), true);
  await page.evaluate(() => { window.__pmHandoffTest.uncertain = false; });
  await page.getByRole('button', { name: 'Check and retry', exact: true }).click();
  await page.getByText('Scope locked after work authorization · new work needs a linked ticket', { exact: true }).waitFor();
  const commands = await page.evaluate(() => window.__pmHandoffTest.commands);
  assert.equal(commands.length, 2);
  assert.deepEqual(commands[0], commands[1]);
  assert.deepEqual(commands[0].command, { type: 'authorize_work', scopeVersionId: 'scope-a', projectId: 'project-a', issueIds: ['issue-a'] });

  // Separate public/private drafts: changing tabs must never publish a PM note.
  await page.getByLabel('Message to client', { exact: true }).fill('Unsaved public update');
  await page.getByRole('button', { name: 'Private notes', exact: true }).click();
  await page.getByLabel('Private note', { exact: true }).fill('Private draft must stay private');
  await page.getByRole('button', { name: 'Conversation', exact: true }).click();
  assert.equal(await page.getByLabel('Message to client', { exact: true }).inputValue(), 'Unsaved public update');

  // A separate completed-work fixture represents the later review phase.
  await page.evaluate(() => { Object.assign(window.__pmHandoffTest, { reviewReady: true, manifest: ['issue-a', 'issue-c'] }); });
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('button', { name: 'Return affected Issues', exact: true }).click();
  const correction = page.getByRole('form', { name: 'Return affected Issues' });
  await correction.getByLabel(/A-1 Agreed existing Issue/).check();
  await correction.getByLabel('Developer correction instructions').fill('Correct the agreed validation behavior only.');
  await correction.getByLabel(/I reviewed the affected work/).check();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('region', { name: 'Ticket detail panel' }).evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: resolve(outputPath, 'pm-ticket-correction-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  await correction.getByLabel('Developer correction instructions').scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(outputPath, 'pm-ticket-correction-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => { window.__pmHandoffTest.uncertain = true; });
  await correction.getByRole('button', { name: 'Return selected Issues', exact: true }).click();
  await page.getByRole('button', { name: 'Check and retry', exact: true }).waitFor();
  assert.equal(await correction.getByRole('button', { name: 'Return selected Issues', exact: true }).isDisabled(), true);
  await page.evaluate(() => { window.__pmHandoffTest.uncertain = false; });
  await page.getByRole('button', { name: 'Check and retry', exact: true }).click();
  await correction.waitFor({ state: 'detached' });
  const fixes = await page.evaluate(() => window.__pmHandoffTest.commands.filter(input => input.command.type === 'request_fixes'));
  assert.equal(fixes.length, 2); assert.deepEqual(fixes[0], fixes[1]);
  assert.deepEqual(fixes[0].command, { type: 'request_fixes', issueIds: ['issue-a'], reason: 'Correct the agreed validation behavior only.' });
  assert.equal(await page.getByLabel('Message to client', { exact: true }).inputValue(), 'Unsaved public update');
  await page.getByRole('button', { name: 'Private notes', exact: true }).click();
  assert.equal(await page.getByLabel('Private note', { exact: true }).inputValue(), 'Private draft must stay private');
  await page.getByRole('button', { name: 'Conversation', exact: true }).click();

  // Client feedback follows the same targeted flow, not initial authorization.
  await page.evaluate(() => { Object.assign(window.__pmHandoffTest, { reviewReady: true, resultReady: true, feedback: true, status: 'under_review' }); });
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('button', { name: 'Review client correction', exact: true }).click();
  await correction.getByLabel(/A-1 Agreed existing Issue/).check();
  await correction.getByLabel('Developer correction instructions').fill('Fix the defect within the agreed scope.');
  await correction.getByLabel(/I reviewed the affected work/).check();
  await correction.getByRole('button', { name: 'Return selected Issues', exact: true }).click();
  await correction.waitFor({ state: 'detached' });
  const feedback = await page.evaluate(() => window.__pmHandoffTest.commands.find(input => input.command.type === 'authorize_correction'));
  assert.deepEqual(feedback.command, { type: 'authorize_correction', deliveryId: 'delivery-a', issueIds: ['issue-a'], reason: 'Fix the defect within the agreed scope.' });

  // Switching tickets must not move either public or private drafts to a client.
  await page.evaluate(() => { window.__pmHandoffTest.secondTicket = true; });
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('button').filter({ has: page.getByText('Second ticket', { exact: true }) }).click();
  await page.getByRole('heading', { name: 'Second ticket', exact: true }).waitFor();
  assert.equal(await page.getByLabel('Message to client', { exact: true }).inputValue(), '');
  await page.getByRole('button', { name: 'Private notes', exact: true }).click();
  assert.equal(await page.getByLabel('Private note', { exact: true }).inputValue(), '');
  await page.getByRole('button').filter({ has: page.getByText('Browser handoff rehearsal', { exact: true }) }).click();
  await page.getByRole('heading', { name: 'Browser handoff rehearsal', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Conversation', exact: true }).click();

  // Only an actual accepted-state fixture offers closure; no client silence is
  // inferred and no project completion/deployment request is sent.
  await page.evaluate(() => { Object.assign(window.__pmHandoffTest, { resultReady: true, accepted: true, status: 'ready_for_review' }); });
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('button', { name: 'Close accepted ticket', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm ticket closure', exact: true }).click();
  await page.getByText('This ticket is read-only or ticket changes are disabled.', { exact: true }).waitFor();
  const closed = await page.evaluate(() => window.__pmHandoffTest.commands.find(input => input.command.type === 'close_accepted'));
  assert.deepEqual(closed.command, { type: 'close_accepted', deliveryId: 'delivery-a' });
  // A failed private-note history read must stay inside the notes panel rather
  // than replacing the already loaded ticket detail.
  await page.evaluate(() => { window.__pmHandoffTest.failNotes = true; });
  await page.getByRole('button', { name: 'Private notes', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Ticket service is temporarily unavailable.' }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Browser handoff rehearsal', exact: true }).count(), 1);
  assert.equal(await page.getByLabel('Private note', { exact: true }).count(), 1);
  await page.evaluate(() => { window.__pmHandoffTest.failMessages = true; });
  await page.getByRole('button', { name: 'Conversation', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Ticket service is not connected in this environment, or this ticket is no longer available.' }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Browser handoff rehearsal', exact: true }).count(), 1);
  assert.deepEqual(faults, []); assert.deepEqual(network, []);
  console.log(JSON.stringify({ result: 'passed', realPmView: true, selectionReset: true, mobileNoOverflow: true,
    exactOperationRecovery: true, targetedPmFixes: true, clientCorrection: true, acceptedClosure: true,
    privateDraftIsolation: true, crossTicketDraftIsolation: true, unrelatedDraftPreservedOnRetry: true,
    messageAndNoteReadFailuresAreLocalized: true, realApiRequests: 0, pageErrors: 0 }));
} catch (error) {
  console.error(JSON.stringify({ faults, browserErrors, body: (await page.locator('body').innerText()).slice(0, 1600) }));
  throw error;
} finally { await context.close(); await browser.close(); }
