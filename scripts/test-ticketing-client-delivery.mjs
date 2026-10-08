// Isolated real-component/real-client-transport rehearsal. All API responses are
// intercepted test fixtures; no server, storage provider or customer is contacted.
// node scripts/test-ticketing-client-delivery.mjs <playwright-index.mjs> <loopback-url> <artifact-dir> [browser-executable]
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
const page = await context.newPage();
const faults = []; const blocked = []; let downloads = 0; let mode = 'normal';
page.on('pageerror', error => faults.push(error.message)); page.on('download', () => { downloads++; });
const body = Buffer.from('Reviewed delivery rehearsal');
const sha256 = createHash('sha256').update(body).digest('hex');
const file = { id: 'file-a', filename: 'result.txt', mediaType: 'text/plain', byteLength: body.length, sha256 };
const resultPath = '/api/client/workspaces/workspace-a/tickets/ticket-a/deliveries/delivery-a';

await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.origin !== origin.origin) { blocked.push('external'); return route.abort(); }
  if (url.pathname === resultPath) {
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      deliveryId: 'delivery-a', scopeVersionId: mode === 'wrong-scope' ? 'foreign-scope' : 'scope-a', files: [file],
    }) });
  }
  if (url.pathname === `${resultPath}/files/file-a`) {
    if (mode === 'revoked') return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Sign in"}' });
    return route.fulfill({ headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(body.length),
      'Content-Disposition': 'attachment; filename="ignored-server-name.txt"', 'Cache-Control': 'no-store, private' },
      body: mode === 'corrupt' ? Buffer.alloc(body.length) : body });
  }
  if (/\/(?:api|rest\/v1|auth\/v1)(?:\/|$)/.test(url.pathname)) { blocked.push('unexpected API'); return route.abort(); }
  if (url.pathname === '/__client-delivery-rehearsal') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head>
    <link rel="stylesheet" href="/src/index.css"></head><body style="background:#101014"><div id="root" style="min-height:100vh"></div><script type="module">
    import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    const [{ default: React }, { default: ReactDom }, { ClientTicketDetail }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'), import('/node_modules/.vite/deps/react-dom_client.js'), import('/src/features/ticketing/ClientTicketDetail.tsx')
    ]);
    const timestamp = '2026-10-08T03:00:00.000Z';
    const ticket = { id: 'ticket-a', reference: 'TEST-1', title: 'Client delivery rehearsal', description: 'Test-only request', companyLabel: 'Test client',
      status: 'ready_for_review', version: 8, createdAt: timestamp, updatedAt: timestamp, closedAt: null,
      readOnly: false, writesAvailable: true, requestedAction: 'review_result', sharedProjectName: 'Shared project label', relatedTicket: null, request: null,
      scope: { id: 'scope-a', summary: 'Agreed work', proposedAt: timestamp, agreed: true },
      delivery: { id: 'delivery-a', scopeVersionId: 'scope-a', summary: 'Test-only reviewed result', sharedAt: timestamp, accepted: false } };
    ReactDom.createRoot(document.getElementById('root')).render(React.createElement(ClientTicketDetail, { workspaceId: 'workspace-a', ticket,
      messages: [], messageCursor: null, historyLoading: false, historyError: '', busy: false, error: '', replyResetVersion: 0,
      onBack() {}, onLoadMore() {}, async onReply() {}, onDecision() { throw new Error('Unexpected acceptance'); }, onAdditionalWork() {} }));
    </script></body></html>` });
  return route.continue();
});

try {
  await mkdir(resolve(outputPath), { recursive: true });
  const url = new URL('/__client-delivery-rehearsal', origin).href;
  await page.goto(url);
  await page.getByRole('button', { name: 'Download result.txt', exact: true }).waitFor();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download result.txt', exact: true }).click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), 'result.txt'); assert.equal(await download.failure(), null);
  await page.screenshot({ path: resolve(outputPath, 'client-delivery-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: resolve(outputPath, 'client-delivery-mobile.png'), fullPage: true });

  mode = 'corrupt';
  await page.getByRole('button', { name: 'Download result.txt', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'download could not be verified' }).waitFor();
  assert.equal(downloads, 1, 'Corrupt bytes must not create a browser download.');
  mode = 'revoked';
  await page.getByRole('button', { name: 'Download result.txt', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'download could not be verified' }).waitFor();
  assert.equal(downloads, 1, 'Revoked access must not create a browser download.');
  mode = 'wrong-scope';
  await page.getByRole('button', { name: 'Refresh files', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Protected result files are unavailable' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Download result.txt', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: /Accept.*result/i }).count(), 0, 'Acceptance remains gated.');
  assert.deepEqual(faults, []); assert.deepEqual(blocked, []);
  console.log(JSON.stringify({ result: 'passed', realClientView: true, realTransport: true, pinnedDownload: true,
    corruptFileBlocked: true, revokedAccessBlocked: true, wrongScopeBlocked: true, mobileNoOverflow: true,
    acceptanceStillGated: true, realApiRequests: 0, pageErrors: faults.length }));
} finally { await context.close(); await browser.close(); }
