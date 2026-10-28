import { chromium } from 'file:///C:/Users/Francis Peña/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

const output = process.argv[2];
if (!output) throw new Error('Pass an external output directory.');

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});

const cases = [
  { name: 'pm-ticket-1440', width: 1440, height: 900 },
  { name: 'pm-ticket-1024', width: 1024, height: 768 },
  { name: 'pm-ticket-390', width: 390, height: 844 },
];

const results = [];

for (const item of cases) {
  const context = await browser.newContext({ viewport: { width: item.width, height: item.height } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const faults = [];
  page.on('pageerror', error => faults.push(error.message));
  await page.goto('http://localhost:3000/?ticketing-preview=pm', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'All tickets', exact: true }).waitFor();
  if (item.width < 1280) {
    await page.getByRole('button', { name: /Add CSV export to the monthly sales report/ }).click();
    await page.getByRole('region', { name: 'Ticket detail panel' }).waitFor();
    const chat = page.locator('.pm-tickets__conversation-area--chat');
    const contextPanel = page.locator('.pm-tickets__context-panel');
    assert.equal(await chat.count(), 1);
    assert.equal(await contextPanel.count(), 1);
    const chatBox = await chat.boundingBox();
    assert(chatBox && chatBox.width >= 250, `${item.name} chat should retain a readable width`);
  }
  await page.screenshot({ path: `${output}/${item.name}.png`, fullPage: true, animations: 'disabled' });
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const innerWidth = await page.evaluate(() => window.innerWidth);
  assert.equal(scrollWidth, innerWidth, `${item.name} should not overflow horizontally`);
  await page.getByRole('tab', { name: 'Inquiries' }).click();
  await page.getByRole('heading', { name: 'Shared inquiries', exact: true }).waitFor();
  await page.screenshot({ path: `${output}/pm-inquiries-${item.width}.png`, fullPage: true, animations: 'disabled' });
  const inquiryScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.equal(inquiryScrollWidth, innerWidth, `${item.name} inquiries should not overflow horizontally`);
  results.push({ ...item, faults, scrollWidth, innerWidth, inquiryScrollWidth });
  await context.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
