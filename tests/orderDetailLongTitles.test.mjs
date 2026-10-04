// A product title at Amazon's 200-character limit must still be exported as
// an item. Before 2.2.0 the "under 200 characters" text guard dropped it,
// and an order made only of such items exported with no items at all. Runs
// from a terminal, like ledgerRows.test.mjs:
//
//   node tests/orderDetailLongTitles.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const require = createRequire(path.join(root, 'automation', 'package.json'));
const { chromium } = require('playwright');

const html = fs.readFileSync(path.join(here, 'fixtures', 'orderDetailLongTitles.html'), 'utf8');
const TODDLER = 'Toddler Bath Toys for Kids Ages 1-3 Baby Bath Toys Beach Sand Pool Water Table Toys Mold Free Bathtub Toys for 12+ Months Stacking Cups Showerhead Spoon for 1 2 3 4 5 6 Years Old Girls Boys Gifts 9PCS';
const BULBS = 'Vintage LED Edison Bulbs 60 Watt Equivalent Dimmable 7W ST58 LED Filament Light Bulbs Warm White 3000K Antique Style Lighting High Brightness 800LM E26 Medium Base Clear Glass for Home Office, 12 Pack';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  await page.addScriptTag({ path: path.join(root, 'core', 'constants.js') });
  await page.addScriptTag({ path: path.join(root, 'scrapers', 'orderDetailPage.js') });
  const parse = (orderHtml) => page.evaluate((h) => {
    const parser = new window.AmazonExporterOrderDetailPageParser();
    return parser.parse(h, '113-0000000-0000000', 'https://example.invalid/order', null);
  }, orderHtml);

  assert.equal(TODDLER.length, 200);
  assert.equal(BULBS.length, 200);
  const details = await parse(html);
  assert.equal(details.items, `${TODDLER}; ${BULBS}`);
  assert.equal(details.itemPrices, '$8.99; $24.99');
  assert.equal(details.grandTotal, '$35.99');
  assert.equal(details.refundAmount, '$35.68');

  // Longer than any real title: still rejected, so the guard keeps doing its job.
  const blob = 'Lorem ipsum dolor sit amet '.repeat(30).trim();
  const withBlob = await parse(html.replace(TODDLER, blob));
  assert.equal(withBlob.items, BULBS);
  console.log('ok - 200-character titles are exported as items');
} finally {
  await browser.close();
}
