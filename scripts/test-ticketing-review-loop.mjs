// Real PM/client components and ticket facades; intercepted test-only authority.
// No backend, email, storage provider, customer data or runner is contacted.
// node scripts/test-ticketing-review-loop.mjs <playwright-index.mjs> <loopback-url> <artifact-dir> [browser-executable]
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [modulePath, target, outputPath, executable] = process.argv.slice(2);
if (!modulePath || !target || !outputPath) throw new Error('Expected Playwright module, loopback URL and artifact directory.');
const origin = new URL(target);
if (!['http:', 'https:'].includes(origin.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
  || origin.username || origin.password) throw new Error('Rehearsal requires a credential-free loopback URL.');
const { chromium } = await import(pathToFileURL(resolve(modulePath)).href);
const browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: resolve(executable) } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const pm = await context.newPage(); const client = await context.newPage();
const faults = []; const blocked = [];
for (const page of [pm, client]) page.on('pageerror', error => faults.push(error.message));
await context.addCookies([{ name: 'alpha_client_csrf_dev', value: 'a'.repeat(43), url: origin.origin }]);
const timestamp = '2026-10-08T03:00:00.000Z';
const bytes = Buffer.from('Reviewed delivery for client acceptance');
const file = { id: 'file-a', filename: 'result.txt', mediaType: 'text/plain', byteLength: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex') };
const secondFile = { ...file, id: 'file-b', filename: 'acceptance-notes.txt' };
const manifest = { deliveryId: 'delivery-a', scopeVersionId: 'scope-a', files: [file, secondFile] };
const fresh = () => ({ version: 5, status: 'in_progress', assessed: false, shared: false, accepted: false, feedback: false,
  commands: [], messages: [], receipts: {}, lookups: [], loseAcceptance: false, loseAssessment: true, corruptCandidate: false, downloads: 0 });
let state = fresh();
function detail(internal = false) {
  const value = { id: 'ticket-a', reference: 'TEST-1', title: 'Review loop rehearsal', description: 'Test-only agreed request',
    companyLabel: 'Test client', version: state.version, status: state.status, createdAt: timestamp, updatedAt: timestamp,
    closedAt: state.status === 'closed' ? timestamp : null, readOnly: state.status === 'closed', writesAvailable: state.status !== 'closed',
    requestedAction: state.shared && !state.accepted && !state.feedback ? 'review_result' : null,
    relatedTicket: null, request: null, sharedProjectName: 'Shared project label',
    scope: { id: 'scope-a', summary: 'Agreed work', proposedAt: timestamp, agreed: true },
    delivery: state.shared ? { id: 'delivery-a', scopeVersionId: 'scope-a', summary: 'Client-safe reviewed result', sharedAt: timestamp, accepted: state.accepted } : null };
  if (internal) value.internal = { updatedAt: timestamp, projectId: 'project-a', requiredIssueIds: ['issue-a'],
    clientAccessActive: true, actionOwner: state.feedback || state.accepted || !state.shared ? 'pm' : 'client',
    nextAction: state.feedback ? 'triage_correction' : state.accepted ? 'close_ticket' : state.shared ? 'review_result' : state.assessed ? 'share_result' : 'assess_result',
    authorizedScopeVersionId: 'scope-a', correctionRequestedFor: state.feedback ? 'delivery-a' : null,
    withdrawalRequested: false, closureReason: state.status === 'closed' ? 'accepted' : null, request: null,
    scopeVersion: { id: 'scope-a', summary: 'Agreed work', developerBrief: 'Private developer brief', proposedAt: timestamp, immutable: true, clientVisible: true },
    deliveryAssessment: state.assessed ? { id: 'delivery-a', scopeVersionId: 'scope-a', summary: 'Client-safe reviewed result',
      pinnedAssetId: 'private-bundle', issueRevisionIds: ['private-revision'], immutable: true, clientVisible: true, shared: state.shared } : null };
  return value;
}
function queue(internal) {
  return { items: [detail(internal)], nextCursor: null,
    counters: internal ? { kind: 'pm', needsPm: state.accepted || state.feedback || !state.shared ? 1 : 0,
      inProgress: state.status === 'in_progress' ? 1 : 0, waitingClient: state.shared && !state.accepted && !state.feedback ? 1 : 0,
      closedMonth: state.status === 'closed' ? 1 : 0 } : { kind: 'client', open: state.status === 'closed' ? 0 : 1,
      needsClient: state.shared && !state.accepted && !state.feedback ? 1 : 0 } };
}
const pmModule = `
export class ApiRequestError extends Error { constructor(status, message, code = null, reconciliationRequired = false) {
  super(message); this.status = status; this.code = code; this.reconciliationRequired = reconciliationRequired; } }
export const apiService = {
  async ticketRequest(path, options) {
    const response = await fetch('/__pm-review-api' + path, { ...options, headers: { 'Content-Type': 'application/json' } });
    const value = await response.json(); if (!response.ok) throw new ApiRequestError(response.status, 'Test transport error', value.code, value.reconciliationRequired === true);
    return value;
  },
  async getIssues() { return [{ id: 'issue-a', projectId: 'project-a', identifier: 'P-1', title: 'Agreed Issue', status: 'done', assignedHuman: 'dev-a' }]; }
};`;
function shell(component, module) {
  return `<!doctype html><html><head><link rel="stylesheet" href="/src/index.css"></head><body style="background:#101014"><div id="root" style="height:100vh"></div><script type="module">
    import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    const [{ default: React }, { default: ReactDom }, view] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'), import('/node_modules/.vite/deps/react-dom_client.js'), import('${module}')]);
    ReactDom.createRoot(document.getElementById('root')).render(React.createElement(view.${component}));
    </script></body></html>`;
}
await context.route('**/*', async route => {
  const url = new URL(route.request().url()); const method = route.request().method();
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (url.origin !== origin.origin) { blocked.push('external'); return route.abort(); }
  if (url.pathname === '/__pm-review') return route.fulfill({ contentType: 'text/html', body: shell('PmTicketsView', '/src/features/ticketing/PmTicketsView.tsx') });
  if (url.pathname === '/__client-review') return route.fulfill({ contentType: 'text/html', body: shell('default', '/src/features/ticketing/ClientPortal.tsx') });
  if (url.pathname === '/src/shared/services/apiService.ts') return route.fulfill({ contentType: 'application/javascript', body: pmModule });
  const isPm = url.pathname.startsWith('/__pm-review-api');
  const isClient = url.pathname.startsWith('/api/client');
  const path = isPm ? url.pathname.replace('/__pm-review-api', '') : url.pathname.replace('/api/client', '');
  if (isClient && path === '/session') return json({ authenticated: true, expiresAt: '2026-10-09T03:00:00.000Z' });
  if (isClient && path === '/workspaces') return json({ items: [{ workspaceId: 'workspace-a', displayName: 'Test service' }] });
  if (isPm || isClient) {
    const ticketBase = isPm ? '/tickets/ticket-a' : '/workspaces/workspace-a/tickets/ticket-a';
    if ((isPm && path === '/tickets') || (isClient && path === '/workspaces/workspace-a/tickets')) return json(queue(isPm));
    if (path === ticketBase) return json(detail(isPm));
    if (path === `${ticketBase}/notes`) return json({ items: [], nextCursor: null });
    if (path === `${ticketBase}/messages` && method === 'GET') return json({ items: state.messages, nextCursor: null });
    if (isPm && path === `${ticketBase}/delivery-candidates`) return json({ items: state.assessed ? [] : [{ id: 'delivery-a', scopeVersionId: 'scope-a', summary: 'Client-safe reviewed result', fileCount: 2 }], nextCursor: null });
    if (isPm && path === `${ticketBase}/delivery-candidates/delivery-a`) return json(manifest);
    if (isPm && path.startsWith(`${ticketBase}/delivery-candidates/delivery-a/files/`)) {
      const selected = path.includes('/file-b/') ? secondFile : file;
      return json({ file: selected, bytesBase64: (state.corruptCandidate ? Buffer.alloc(bytes.length) : bytes).toString('base64') });
    }
    if (path === `${ticketBase}/deliveries/delivery-a`) return json(manifest);
    if (isPm && path === `${ticketBase}/deliveries/delivery-a/files/file-a/content`) return json({ file, bytesBase64: bytes.toString('base64') });
    if (isClient && path === `${ticketBase}/deliveries/delivery-a/files/file-a`) return route.fulfill({
      headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(bytes.length), 'Content-Disposition': 'attachment; filename="result.txt"' }, body: bytes });
    if (path.includes('/operations/')) {
      const operationId = decodeURIComponent(path.split('/').at(-1)); state.lookups.push(operationId);
      return json(state.receipts[operationId] ?? { error: 'Not found' }, state.receipts[operationId] ? 200 : 404);
    }
    if (method === 'POST' && (path === `${ticketBase}/commands` || path === `${ticketBase}/messages`)) {
      const input = route.request().postDataJSON();
      state.commands.push({ isPm, ...input });
      if (state.receipts[input.operationId]) return json(state.receipts[input.operationId]);
      if (input.expectedVersion !== state.version) return json({ error: 'Changed', code: 'ticket_version_conflict' }, 409);
      const action = input.command ?? input.action;
      assert.equal(action.deliveryId, 'delivery-a');
      if (action.type === 'assess_delivery') { assert.equal(isPm && !state.assessed && !state.shared, true); state.assessed = true; }
      else if (action.type === 'share_delivery') { assert.equal(isPm && state.assessed, true); state.shared = true; state.status = 'ready_for_review'; }
      else if (action.type === 'accept_delivery') { assert.equal(isPm, false); state.accepted = true; }
      else if (action.type === 'request_correction') {
        assert.equal(isPm, false); state.feedback = true; state.status = 'under_review';
        state.messages.push({ id: 'feedback-a', author: 'client', body: input.body, createdAt: timestamp });
      } else if (action.type === 'close_accepted') { assert.equal(isPm && state.accepted, true); state.status = 'closed'; }
      else throw new Error('Unexpected review-loop command');
      state.version++;
      const receipt = { ticketId: 'ticket-a', operationId: input.operationId, version: state.version, status: state.status,
        ...(action.type === 'request_correction' ? { messageId: 'feedback-a' } : {}) };
      state.receipts[input.operationId] = receipt;
      if (action.type === 'assess_delivery' && state.loseAssessment) {
        state.loseAssessment = false;
        return json({ code: 'ticket_commit_outcome_unknown', reconciliationRequired: true }, 503);
      }
      if (action.type === 'accept_delivery' && state.loseAcceptance) {
        state.loseAcceptance = false;
        return json({ code: 'ticket_commit_outcome_unknown', reconciliationRequired: true }, 503);
      }
      return json(receipt);
    }
    blocked.push('unexpected test API'); return route.abort();
  }
  if (/\/(?:api|rest\/v1|auth\/v1)(?:\/|$)/.test(url.pathname)) { blocked.push('real API'); return route.abort(); }
  return route.continue();
});

async function share() {
  await pm.goto(new URL('/__pm-review', origin).href);
  const approve = pm.getByRole('button', { name: 'Approve result for sharing', exact: true });
  await approve.waitFor(); assert.equal(await approve.isDisabled(), true);
  state.corruptCandidate = true;
  await pm.getByRole('button', { name: 'Inspect candidate result.txt', exact: true }).click();
  await pm.getByText('The file could not be verified. No file was opened.', { exact: true }).waitFor();
  assert.equal(await approve.isDisabled(), true); assert.equal(state.assessed, false);
  state.corruptCandidate = false;
  await pm.getByRole('button', { name: 'Refresh prepared results', exact: true }).click();
  for (const candidateFile of [file, secondFile]) {
    const inspected = pm.waitForEvent('download');
    await pm.getByRole('button', { name: `Inspect candidate ${candidateFile.filename}`, exact: true }).click(); await inspected;
    assert.equal(await approve.isDisabled(), true);
  }
  await pm.getByRole('checkbox', { name: 'I inspected all result files and the summary, and confirm they match the agreed work and are suitable to share with the client.' }).check();
  await pm.screenshot({ path: resolve(outputPath, 'pm-assessment-desktop.png'), fullPage: true });
  await pm.setViewportSize({ width: 390, height: 844 });
  await approve.scrollIntoViewIfNeeded();
  assert.equal(await pm.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await approve.isVisible(), true);
  await pm.screenshot({ path: resolve(outputPath, 'pm-assessment-mobile.png'), fullPage: false });
  await pm.setViewportSize({ width: 1440, height: 1000 });
  await approve.click();
  await pm.getByRole('heading', { name: 'Assessed result · not shared yet', exact: true }).waitFor();
  assert.equal(state.assessed, true); assert.equal(state.shared, false);
  const assessment = state.commands.filter(item => item.command?.type === 'assess_delivery');
  assert.equal(assessment.length, 1); assert.deepEqual(state.lookups, [assessment[0].operationId]);
  const shareButton = pm.getByRole('button', { name: 'Share result with client', exact: true });
  await shareButton.waitFor(); assert.equal(await shareButton.isDisabled(), true);
  const download = pm.waitForEvent('download'); await pm.getByRole('button', { name: 'Inspect result.txt', exact: true }).click();
  assert.equal((await download).suggestedFilename(), 'result.txt');
  await pm.getByRole('checkbox', { name: 'I reviewed this result and its client-facing content against the agreed work.' }).check();
  await shareButton.click(); await pm.getByRole('heading', { name: 'Shared result', exact: true }).waitFor();
  assert.equal(state.shared, true); assert.equal(state.status, 'ready_for_review');
}
async function openClient() {
  await client.goto(new URL('/__client-review', origin).href);
  await client.getByRole('button').filter({ hasText: 'Review loop rehearsal' }).click();
  await client.getByRole('button', { name: 'Download result.txt', exact: true }).waitFor();
  assert.equal(await client.getByRole('button', { name: 'Accept result', exact: true }).count(), 0);
  const download = client.waitForEvent('download'); await client.getByRole('button', { name: 'Download result.txt', exact: true }).click(); await download;
  await client.getByRole('button', { name: 'Accept result', exact: true }).waitFor();
}
try {
  await mkdir(resolve(outputPath), { recursive: true });
  await share(); await openClient(); state.loseAcceptance = true;
  assert.equal(await client.getByRole('button', { name: 'Accept result', exact: true }).isDisabled(), true);
  await client.getByRole('checkbox', { name: 'I reviewed the shared result against the agreed work.' }).check();
  await client.getByRole('button', { name: 'Accept result', exact: true }).click();
  await client.getByRole('button', { name: 'Confirm acceptance', exact: true }).click();
  await client.getByText('Acceptance is recorded; the PM still needs to close the ticket.', { exact: true }).waitFor();
  assert.equal(state.accepted, true); assert.equal(state.status, 'ready_for_review');
  const acceptedCommands = state.commands.filter(item => item.command?.type === 'accept_delivery');
  assert.equal(acceptedCommands.length, 1);
  assert.deepEqual(state.lookups, [state.commands.find(item => item.command?.type === 'assess_delivery').operationId, acceptedCommands[0].operationId]);
  await client.screenshot({ path: resolve(outputPath, 'client-accepted-result.png'), fullPage: true });
  await pm.getByRole('button', { name: 'Refresh', exact: true }).click();
  await pm.getByRole('button', { name: 'Close accepted ticket', exact: true }).click();
  await pm.getByRole('button', { name: 'Confirm ticket closure', exact: true }).click();
  await pm.getByText('This ticket is read-only or ticket changes are disabled.', { exact: true }).waitFor();
  assert.equal(state.status, 'closed');
  await pm.screenshot({ path: resolve(outputPath, 'pm-closed-result.png'), fullPage: true });

  state = fresh(); await share(); await openClient();
  await client.getByRole('button', { name: 'Needs a fix', exact: true }).click();
  await client.getByLabel('What does not match the agreed work?').fill('The agreed validation behavior is missing.');
  await client.getByRole('button', { name: 'Send correction feedback', exact: true }).click();
  await client.getByText('The agreed validation behavior is missing.', { exact: true }).waitFor();
  assert.equal(state.feedback, true); assert.equal(state.status, 'under_review');
  const feedback = state.commands.find(item => item.action?.type === 'request_correction');
  assert.equal(feedback.action.deliveryId, 'delivery-a'); assert.equal(feedback.body, 'The agreed validation behavior is missing.');
  await pm.getByRole('button', { name: 'Refresh', exact: true }).click();
  await pm.getByRole('button', { name: 'Review client correction', exact: true }).waitFor();
  assert.equal(state.commands.some(item => item.command?.type === 'authorize_correction'), false, 'Feedback cannot restart work.');
  await client.setViewportSize({ width: 390, height: 844 });
  assert.equal(await client.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await client.screenshot({ path: resolve(outputPath, 'client-correction-mobile.png'), fullPage: true });
  assert.deepEqual(blocked, []); assert.deepEqual(faults, []);
  console.log(JSON.stringify({ result: 'passed', realPmAndClientViews: true, inspectedPmAssessment: true,
    allCandidateFilesRequired: true, corruptCandidateRefusal: true, lostAssessmentRecovery: true, inspectedPmSharing: true,
    inspectedClientAcceptance: true, lostAcceptanceRecovery: true, explicitPmClosure: true,
    sameTicketCorrectionFeedback: true, noAutomaticRestart: true, mobileNoOverflow: true, realApiRequests: 0, pageErrors: 0 }));
} finally { await context.close(); await browser.close(); }
