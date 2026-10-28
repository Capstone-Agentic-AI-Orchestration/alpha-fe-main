import { chromium } from 'file:///C:/Users/Francis Peña/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

const output = process.argv[2];
if (!output) throw new Error('Pass an external output directory.');

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});

const cases = [
  { name: 'client-ticket-1440', width: 1440, height: 900 },
  { name: 'client-ticket-1024', width: 1024, height: 768 },
  { name: 'client-ticket-390', width: 390, height: 844 },
];

const results = [];

for (const item of cases) {
  const context = await browser.newContext({ viewport: { width: item.width, height: item.height } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const faults = [];
  page.on('pageerror', error => faults.push(error.message));
  await page.goto('http://localhost:3000/?ticketing-preview=client', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Your requests', exact: true }).waitFor();
  if (item.width < 1280) {
    await page.getByRole('button', { name: /Add CSV export to the monthly sales report/ }).click();
  }
  await page.locator('.client-ticket-detail').waitFor();
  await page.screenshot({ path: `${output}/${item.name}.png`, fullPage: true, animations: 'disabled' });
  const toggle = page.locator('.client-detail-status-toggle');
  assert.equal(await toggle.count(), 1);
  await toggle.click();
  assert.equal(await page.locator('#client-request-progress').count(), 1);
  assert.equal(await page.locator('#client-request-progress').isHidden(), true);
  await toggle.click();
  assert.equal(await page.locator('#client-request-progress').isVisible(), true);
  const logo = await page.locator('.client-portal-brand img').boundingBox();
  if (item.width <= 640) assert(logo && logo.width >= 30, 'mobile client logo remains visible');
  results.push({ ...item, faults, scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth), innerWidth: await page.evaluate(() => window.innerWidth), logoVisible: Boolean(logo) });
  await context.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
