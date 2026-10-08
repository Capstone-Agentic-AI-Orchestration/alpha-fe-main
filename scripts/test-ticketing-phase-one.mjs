// Real application-shell rehearsal. All API responses are test-only fixtures;
// no request reaches a backend, provider, database or email service.
// node scripts/test-ticketing-phase-one.mjs <playwright-index.mjs> <loopback-url> <artifact-dir> [browser-executable]
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
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
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
const requests = [];
const faults = [];
const checks = [];
const workspaceId = 'phase-one-ui-test';
await context.addInitScript(({ workspaceId }) => {
  if (localStorage.getItem('phase_one_test_initialized')) return;
  localStorage.setItem('phase_one_test_initialized', 'true');
  localStorage.setItem('alpha_multica_active_workspace_id', JSON.stringify(workspaceId));
  localStorage.setItem('alpha_multica_workspace_tabs_v3', JSON.stringify([{ id: 'test-tickets', view: 'portal', sessionState: {} }]));
  localStorage.setItem('alpha_multica_active_tab_id_v3', JSON.stringify('test-tickets'));
}, { workspaceId });

await context.route('**/*', async route => {
  const request = route.request();
  const url = new URL(request.url());
  if (/^\/api(?:\/|$)/.test(url.pathname)) {
    requests.push({ path: url.pathname, method: request.method() });
    const headers = { 'access-control-allow-origin': origin.origin, 'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type,x-workspace-id,authorization,x-alpha-token', 'access-control-allow-methods': 'GET,OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let body = [];
    let status = 200;
    if (url.pathname === '/api/me') body = { authenticated: true, login: 'phase-one-test-pm', source: 'github', role: 'pm', github: 'ok', access: 'granted', teams: [] };
    else if (url.pathname === '/api/workspaces') body = [{ id: workspaceId, name: 'Phase One UI Test', slug: 'phase-one-ui-test', role: 'pm' }];
    else if (url.pathname === '/api/health') body = { status: 'ok' };
    else if (url.pathname === '/api/analytics') body = {};
    else if (/^\/api\/(?:tickets|client)(?:\/|$)/.test(url.pathname)) { status = 503; body = { error: 'Ticketing is not connected in this test environment.' }; }
    return route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
  }
  if (url.origin !== origin.origin) return route.abort();
  // Disable provider channels only in this isolated browser response. The
  // source module, user configuration and running application are untouched.
  if (url.pathname === '/src/shared/lib/supabase.ts') return route.fulfill({ contentType: 'application/javascript', body: 'export const supabase = null; export const isSupabaseConfigured = () => false;' });
  return route.continue();
});
if (context.routeWebSocket) await context.routeWebSocket('**/*', socket => {
  const url = new URL(socket.url());
  if (url.host === origin.host) socket.connectToServer();
  else socket.close();
});
const page = await context.newPage();
page.on('pageerror', error => faults.push(error.message));
const screenshot = name => page.screenshot({ path: resolve(outputPath, `${name}.png`), fullPage: true });
const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Horizontal overflow');

try {
  await mkdir(resolve(outputPath), { recursive: true });
  await page.goto(origin.href);
  await page.getByRole('button', { name: 'Tickets', exact: true }).first().waitFor();
  const skipGuide = page.getByRole('button', { name: 'Skip guide', exact: true });
  if (await skipGuide.count()) await skipGuide.click();
  const expand = page.getByRole('button', { name: 'Keep sidebar open', exact: true });
  if (await expand.count()) await expand.click();
  await page.getByRole('button', { name: 'Tickets', exact: true }).first().click();
  await page.getByRole('button', { name: 'Show sample tickets', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'Show sample tickets', exact: true }).waitFor();
  assert.equal(await page.getByRole('tab', { name: 'Tickets', exact: true }).getAttribute('aria-selected'), 'true');
  await page.getByText('Ticket intake is not enabled', { exact: false }).waitFor();
  for (const name of ['All Projects', 'All Issues', 'Chat', 'Settings']) {
    assert.ok(await page.getByRole('button', { name, exact: true }).count(), `Missing existing navigation: ${name}`);
  }
  checks.push('Real PM application shell, auth gate and existing navigation render with test-only API identity.');
  await page.getByRole('button', { name: 'Show sample tickets', exact: true }).click();
  await page.getByRole('heading', { name: 'Add CSV export to the monthly sales report', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Private notes', exact: true }).click();
  await page.getByText('Preview example: linked to the existing Operations Dashboard project and developer issue.', { exact: true }).waitFor();
  await screenshot('phase-one-pm-desktop');
  await noOverflow();
  assert.equal(await page.getByRole('form', { name: /create.*(?:developer|issue)/i }).count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Back to tickets', exact: true }).click();
  await page.getByPlaceholder('Search tickets…').fill('inventory');
  await page.getByText('Add CSV export to the monthly sales report', { exact: true }).waitFor({ state: 'hidden' });
  await page.getByText('Request an inventory overview', { exact: true }).waitFor();
  await noOverflow();
  await screenshot('phase-one-pm-mobile');
  await page.getByRole('button', { name: 'Use connected service', exact: true }).click();
  await page.getByText('Ticket intake is not enabled', { exact: false }).waitFor();
  assert.equal(await page.getByText('Request an inventory overview', { exact: true }).count(), 0);
  checks.push('PM samples, private notes, mobile back/search, disabled writes and return to connected mode.');

  await page.setViewportSize({ width: 1600, height: 1000 });
  const beforeClient = requests.length;
  await page.goto(new URL('/?ticketing-preview=client', origin).href);
  await page.getByRole('heading', { name: 'My tickets', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Add CSV export to the monthly sales report', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Private notes', exact: true }).count(), 0);
  assert.equal(await page.getByText('Request an inventory overview', { exact: true }).count(), 0);
  await screenshot('phase-one-client-desktop');
  await page.getByRole('button', { name: 'New request', exact: true }).click();
  await page.getByRole('heading', { name: 'New request', exact: true }).waitFor();
  assert.equal(await page.locator('button[type=submit]').isDisabled(), true);
  await screenshot('phase-one-client-new-request');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'My tickets', exact: true }).click();
  await page.getByPlaceholder('Search your tickets…').fill('cancelled');
  await page.getByText('Add CSV export to the monthly sales report', { exact: true }).waitFor({ state: 'hidden' });
  await page.getByText('Confirm how cancelled orders should appear', { exact: true }).waitFor();
  await noOverflow();
  await screenshot('phase-one-client-mobile');
  assert.equal(requests.length, beforeClient, 'Client sample must not call a real API.');
  checks.push('Actual client portal component: authorized sample projection, request form, desktop/mobile, no API requests.');

  await page.goto(new URL('/#/client', origin).href);
  await page.getByRole('heading', { name: 'Access your tickets', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Continue with email', exact: true }).isDisabled(), true);
  await screenshot('phase-one-client-access');
  await page.getByRole('link', { name: 'Have a new inquiry?', exact: true }).click();
  await page.getByRole('heading', { name: 'Tell us what you need', exact: true }).waitFor();
  assert.equal(await page.locator('button[type=submit]').isDisabled(), true);
  await noOverflow();
  await screenshot('phase-one-public-inquiry');
  await page.goBack();
  await page.getByRole('heading', { name: 'Access your tickets', exact: true }).waitFor();
  checks.push('Actual inquiry/access URLs navigate both ways using browser history; sign-in and submit stay disabled.');
  assert.deepEqual(faults, []);
  // Alpha already requests board sync during startup. It was intercepted above
  // like every API request; this is not a ticketing write or a forwarded call.
  const startupSync = requests.filter(request => request.path === '/api/board/sync' && request.method === 'POST');
  assert.deepEqual(requests.filter(request => !['GET', 'OPTIONS'].includes(request.method) && request.path !== '/api/board/sync'), [], 'Unexpected feature write request');
  await writeFile(resolve(outputPath, 'verification.json'), JSON.stringify({ checks, browserErrors: faults,
    interceptedApiRequests: requests.length, interceptedExistingBoardSync: startupSync.length, forwardedApiRequests: 0, externalWrites: 0 }, null, 2));
  console.log(JSON.stringify({ passed: checks, browserErrors: faults.length, artifactDirectory: resolve(outputPath) }, null, 2));
} catch (error) {
  await screenshot('phase-one-failure');
  console.error('Browser faults:', faults);
  console.error('Navigation state:', await page.evaluate(() => ({ tabs: localStorage.getItem('alpha_multica_workspace_tabs_v3'), active: localStorage.getItem('alpha_multica_active_tab_id_v3') })));
  console.error('Visible text:', (await page.locator('body').innerText()).slice(0, 4500));
  throw error;
} finally {
  await browser.close();
}
