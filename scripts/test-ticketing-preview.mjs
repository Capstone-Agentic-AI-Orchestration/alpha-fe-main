// Optional local browser rehearsal. Supply a separately installed Playwright
// module; no application dependency or lockfile change is required.
// node scripts/test-ticketing-preview.mjs <playwright-index.mjs> <loopback-url> <output-directory>
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [modulePath, target, outputPath, browserExecutable, mode] = process.argv.slice(2);
if (!modulePath || !target || !outputPath) throw new Error('Expected Playwright module, loopback URL and artifact directory.');
const origin = new URL(target);
if (!['http:', 'https:'].includes(origin.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) || origin.username || origin.password) {
  throw new Error('Browser rehearsal requires a credential-free loopback URL.');
}
const { chromium } = await import(pathToFileURL(resolve(modulePath)).href);
const browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: resolve(browserExecutable) } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const faults = [];
const dataRequests = [];
const internalModules = [];
page.on('pageerror', error => faults.push(error.message));
page.on('request', request => {
  const url = new URL(request.url());
  if (/\/(?:api|rest\/v1|auth\/v1)(?:\/|$)/.test(url.pathname)) dataRequests.push(url.pathname);
  if (/\/src\/(?:app\/(?:AppContext|InternalApp)|shared\/(?:services|lib\/supabase))/.test(url.pathname)) internalModules.push(url.pathname);
});
// Do not allow fonts, hosted APIs or any other external request from this test.
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  return url.origin === origin.origin && !/\/(?:api|rest\/v1|auth\/v1)(?:\/|$)/.test(url.pathname)
    ? route.continue() : route.abort();
});
await context.addInitScript(() => {
  localStorage.setItem('alpha_multica_preview_regression', 'synthetic-internal-cache');
  const read = Storage.prototype.getItem;
  window.__ticketPreviewCacheReads = [];
  Storage.prototype.getItem = function (key) {
    window.__ticketPreviewCacheReads.push(key);
    return read.call(this, key);
  };
});
await mkdir(resolve(outputPath), { recursive: true });
const shown = locator => locator.waitFor({ state: 'visible' });
const hidden = async locator => assert.equal(await locator.count(), 0);
const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, 'Horizontal viewport overflow');

try {
  if (mode === '--production') {
    await page.goto(new URL('/?ticketing-preview=pm#/client/tickets/not-authorized', origin).href);
    await shown(page.getByRole('heading', { name: 'Client access is not available yet' }));
    await hidden(page.getByText('Local UI preview.', { exact: true }));
    await hidden(page.getByRole('button', { name: 'Project Manager', exact: true }));
    await page.reload();
    await shown(page.getByRole('heading', { name: 'Client access is not available yet' }));
    assert.deepEqual(await page.evaluate(() => window.__ticketPreviewCacheReads), []);
    assert.deepEqual(dataRequests, []);
    assert.deepEqual(internalModules, []);
    assert.deepEqual(faults, []);
    await page.screenshot({ path: resolve(outputPath, 'production-client-disabled.png'), fullPage: true });
    console.log(JSON.stringify({ result: 'passed', productionClientEntry: true, previewDisabled: true, protectedRequests: 0, internalModules: 0, pageErrors: 0 }));
  } else {
  await page.goto(new URL('/?ticketing-preview=client', origin).href);
  await shown(page.getByRole('heading', { name: 'My Tickets', exact: true }));
  await shown(page.getByRole('heading', { name: 'Your first request starts here' }));
  await page.getByRole('button', { name: 'Create your first ticket' }).click();
  await page.getByLabel(/^Title/).fill('Browser rehearsal request');
  await page.getByLabel(/^Description/).fill('User-entered test text, not a seeded project or customer.');
  await page.getByRole('button', { name: 'Create preview ticket', exact: true }).click();
  await shown(page.getByRole('heading', { name: 'Browser rehearsal request', exact: true }).last());
  await page.getByLabel('Reply on this ticket').fill('<script>not executable</script> Client question');
  await page.getByRole('button', { name: 'Send preview reply' }).click();
  await shown(page.getByText('<script>not executable</script> Client question', { exact: true }));

  await page.getByRole('button', { name: 'Project Manager', exact: true }).click();
  await shown(page.getByRole('heading', { name: 'Tickets', exact: true }));
  await page.getByLabel('Reply on this ticket').fill('PM public reply');
  await page.getByRole('button', { name: 'Send preview reply' }).click();
  await page.getByRole('button', { name: 'Internal notes', exact: true }).click();
  await page.getByLabel('Internal note — never sent to the client').fill('Private PM context - must stay private');
  await page.getByRole('button', { name: 'Save preview note' }).click();
  await shown(page.getByText('Private PM context - must stay private', { exact: true }));
  await page.screenshot({ path: resolve(outputPath, 'pm-tickets-desktop.png'), fullPage: true });

  await page.getByRole('button', { name: 'Client', exact: true }).click();
  await hidden(page.getByText('Private PM context - must stay private', { exact: true }));
  await hidden(page.getByRole('button', { name: 'Internal notes', exact: true }));
  await shown(page.getByText('PM public reply', { exact: true }));
  await page.screenshot({ path: resolve(outputPath, 'client-ticket-desktop.png'), fullPage: true });

  await page.getByRole('button', { name: 'Documents', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Upload document' }).isDisabled(), true);
  await page.getByRole('button', { name: 'Delivery', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Accept shared result' }).isDisabled(), true);
  await page.getByText('UI rehearsal controls · not business actions', { exact: true }).click();
  await page.getByLabel('Preview scene').selectOption('closed');
  await page.getByRole('button', { name: 'Show scene', exact: true }).click();
  await page.getByRole('button', { name: 'Conversation', exact: true }).click();
  await shown(page.getByText('This ticket is read-only.', { exact: false }));
  await hidden(page.getByRole('button', { name: 'Send preview reply' }));
  await page.getByRole('button', { name: 'Request additional work', exact: true }).click();
  await shown(page.getByText('Linked to LOCAL-1', { exact: false }));
  await page.getByLabel(/^Title/).fill('Separate follow-up request');
  await page.getByLabel(/^Description/).fill('Additional work is a separate linked ticket.');
  await page.getByRole('button', { name: 'Create preview ticket', exact: true }).click();
  await shown(page.getByRole('heading', { name: 'Separate follow-up request', exact: true }).last());

  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow();
  await page.screenshot({ path: resolve(outputPath, 'client-ticket-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'My Tickets', exact: true }).last().click();
  await page.getByLabel('Search tickets').fill('no-match-query');
  await shown(page.getByText('No tickets match this view', { exact: true }));
  await page.getByRole('button', { name: 'Clear search and filters' }).click();
  await noOverflow();
  assert.equal(await page.evaluate(() => localStorage.getItem('alpha_multica_preview_regression')), 'synthetic-internal-cache');
  // Exclude the deliberate assertion read above; the application must read none.
  const reads = await page.evaluate(() => window.__ticketPreviewCacheReads);
  assert.deepEqual(reads, ['alpha_multica_preview_regression']);
  await page.reload();
  await shown(page.getByRole('heading', { name: 'Your first request starts here' }));
  await hidden(page.getByText('Browser rehearsal request', { exact: true }));
  await page.goto(new URL('/client/tickets/not-authorized', origin).href);
  await shown(page.getByRole('heading', { name: 'Client access is not available yet' }));
  assert.deepEqual(dataRequests, [], 'Preview/client page attempted protected API requests');
  assert.deepEqual(internalModules, [], 'Preview/client page loaded internal workspace modules');
  assert.deepEqual(faults, [], 'Browser rendering errors');
  console.log(JSON.stringify({ result: 'passed', publicConversation: true, privateNotesHidden: true,
    readOnlyHistory: true, linkedExtraWork: true, mobileNoOverflow: true, noPersistence: true,
    protectedRequests: dataRequests.length, internalModules: internalModules.length, pageErrors: faults.length }));
  }
} finally {
  await context.close();
  await browser.close();
}
