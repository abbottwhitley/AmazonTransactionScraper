// Runs TransactionPageScraper.extractLedgerRows() against a fixture page in
// headless Chromium. Not part of the in-extension test suite (tests/*.js,
// loaded by the manifest) -- this one runs from a terminal:
//
//   node tests/ledgerRows.test.mjs
//
// Needs Playwright, already installed under automation/ (npm install there).
// It only opens a local file and never touches amazon.com.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const require = createRequire(path.join(root, 'automation', 'package.json'));
const { chromium } = require('playwright');

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.join(here, 'fixtures', 'transactionsPage.html')).href);
  await page.addScriptTag({ path: path.join(root, 'core', 'constants.js') });
  await page.addScriptTag({ path: path.join(root, 'scrapers', 'transactionPage.js') });

  const { rows, links } = await page.evaluate(() => {
    const scraper = new window.AmazonExporterTransactionPageScraper();
    const fmt = d => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null);
    return {
      rows: scraper.extractLedgerRows().map(r => ({ ...r, transactionDate: fmt(r.transactionDate) })),
      links: scraper.extractOrderLinks().map(l => l.orderId).sort()
    };
  });

  const expected = [
    // A return: positive, typed refund, dated by its own header.
    { orderId: '113-1111111-1111111', kind: 'refund', amount: 21.00, card: 'Visa ****5678', transactionDate: '2026-09-20' },
    { orderId: '113-2222222-2222222', kind: 'charge', amount: -1234.56, card: 'Visa ****5678', transactionDate: '2026-09-20' },
    // The same order's original charge is a separate row, not collapsed.
    { orderId: '113-1111111-1111111', kind: 'charge', amount: -40.00, card: 'Visa ****5678', transactionDate: '2026-09-14' },
    // Digital order: link text runs straight into the repeated bare ID.
    { orderId: 'D01-1234567-7654321', kind: 'charge', amount: -15.70, card: 'Mastercard ****1234', transactionDate: '2026-09-02' },
    { orderId: '113-3333333-3333333', kind: 'refund', amount: 8.39, card: 'Gift Card', transactionDate: '2026-09-02' },
    // Flat variant: a second charge for an order already seen above,
    // unsigned amounts signed from the "Refund:" label.
    { orderId: '113-2222222-2222222', kind: 'charge', amount: -17.25, card: 'Visa ****5678', transactionDate: '2026-08-30' },
    { orderId: '113-4444444-4444444', kind: 'refund', amount: 5.76, card: 'Visa ****5678', transactionDate: '2026-08-30' },
    // No amount in its own row: reported with amount null, never given a
    // neighbouring row's amount.
    { orderId: '113-5555555-5555555', kind: 'charge', amount: null, card: '', transactionDate: '2026-08-30' }
  ];
  assert.deepEqual(rows, expected);

  // The "Rewards Points" row and the footer price have no order and must
  // not appear; extractOrderLinks() still returns one link per order.
  assert.deepEqual(links, [
    '113-1111111-1111111', '113-2222222-2222222', '113-3333333-3333333',
    '113-4444444-4444444', '113-5555555-5555555', 'D01-1234567-7654321'
  ]);
  console.log(`ok - ${rows.length} ledger rows, ${links.length} order links`);
} finally {
  await browser.close();
}
