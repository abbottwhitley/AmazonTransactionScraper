// Order-summary labels ("Rewards Points:", "Promotion Applied:") must never
// be exported as an order's items. Runs from a terminal, like
// ledgerRows.test.mjs:
//
//   node tests/orderDetailLabels.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const require = createRequire(path.join(root, 'automation', 'package.json'));
const { chromium } = require('playwright');

const html = fs.readFileSync(path.join(here, 'fixtures', 'orderDetailPoints.html'), 'utf8');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  await page.addScriptTag({ path: path.join(root, 'core', 'constants.js') });
  await page.addScriptTag({ path: path.join(root, 'scrapers', 'orderDetailPage.js') });
  const details = await page.evaluate((orderHtml) => {
    const parser = new window.AmazonExporterOrderDetailPageParser();
    return parser.parse(orderHtml, '113-0000000-0000000', 'https://example.invalid/order', null);
  }, html);

  assert.equal(
    details.items,
    'Purina ONE Chicken and Rice Formula Dry Dog Food - 31.1 lb. Bag; Amazon.com Gift Card in a Greeting Card'
  );
  assert.equal(details.itemPrices, '$51.43; $25.00');
  assert.equal(details.grandTotal, '$0.28');
  console.log('ok - summary labels are not items:', details.items);
} finally {
  await browser.close();
}
