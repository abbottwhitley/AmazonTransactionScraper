#!/usr/bin/env node
/**
 * Drives the existing (unmodified) Chrome extension inside a real,
 * persistent-profile Chromium to produce a transaction export CSV without a
 * human clicking through the UI.
 *
 * Login is never automated. Run once without --profile-dir pointed at a
 * throwaway location (or just run this script at all, the first time) and
 * log into Amazon by hand in the window that opens -- that session persists
 * in the profile directory for every later run, including under `xvfb-run`
 * for unattended/headless-box use.
 *
 * Usage:
 *   node run-export.mjs                          # current month, Detailed format
 *   node run-export.mjs --month 2026-09
 *   node run-export.mjs --start 2026-08-01 --end 2026-09-15
 *   node run-export.mjs --out-dir ~/amazon-exports --profile-dir ~/.config/amazon-automation-profile
 *   node run-export.mjs --login-timeout-minutes 15   # slow 2FA, give it more time
 *
 * Unattended (no physical display): xvfb-run -a node run-export.mjs --month 2026-09
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '..');

const DEFAULT_PROFILE_DIR = path.join(os.homedir(), '.config', 'amazon-automation-profile');
const DEFAULT_OUT_DIR = path.join(os.homedir(), 'amazon-exports');
const DEFAULT_TIMEOUT_MINUTES = 15;
const DEFAULT_LOGIN_TIMEOUT_MINUTES = 10;

const BLOCKED_PAGE_PATTERNS = [
  /enter the characters you see/i,
  /sorry, we just need to make sure/i,
  /type the characters you see/i,
  /to discuss automated access to amazon data/i,
];

function parseArgs(argv) {
  const args = {
    month: null,
    start: null,
    end: null,
    outDir: DEFAULT_OUT_DIR,
    profileDir: DEFAULT_PROFILE_DIR,
    timeoutMinutes: DEFAULT_TIMEOUT_MINUTES,
    loginTimeoutMinutes: DEFAULT_LOGIN_TIMEOUT_MINUTES,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case '--month':
        args.month = next();
        break;
      case '--start':
        args.start = next();
        break;
      case '--end':
        args.end = next();
        break;
      case '--out-dir':
        args.outDir = path.resolve(next());
        break;
      case '--profile-dir':
        args.profileDir = path.resolve(next());
        break;
      case '--timeout-minutes':
        args.timeoutMinutes = Number(next());
        break;
      case '--login-timeout-minutes':
        args.loginTimeoutMinutes = Number(next());
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (args.month && (args.start || args.end)) {
    throw new Error('Pass either --month or --start/--end, not both.');
  }
  if ((args.start && !args.end) || (args.end && !args.start)) {
    throw new Error('--start and --end must be passed together.');
  }
  return args;
}

/** Resolve requested range into { kind: 'current-month' } or { kind: 'custom', month, year } | { kind: 'custom-range', start, end }. */
function resolveRange(args) {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  if (args.start && args.end) {
    return { kind: 'custom-range', start: args.start, end: args.end };
  }
  if (args.month) {
    if (args.month === currentMonthStr) {
      return { kind: 'current-month' };
    }
    const [year, month] = args.month.split('-').map(Number);
    if (!year || !month || month < 1 || month > 12) {
      throw new Error(`Invalid --month value: ${args.month} (expected YYYY-MM)`);
    }
    return { kind: 'custom-month', year, month };
  }
  return { kind: 'current-month' };
}

async function detectBlockedState(page) {
  const url = page.url();
  if (/\/ap\/signin/.test(url) || /\/ap\/cvf/.test(url)) {
    return `Redirected to a sign-in/verification page (${url}). Session is not authenticated -- re-run this script without a display filter (i.e. not under xvfb-run) so you can log in by hand.`;
  }
  const bodyText = await page.locator('body').innerText().catch(() => '');
  for (const pattern of BLOCKED_PAGE_PATTERNS) {
    if (pattern.test(bodyText)) {
      return `Amazon showed a bot-check/challenge page matching ${pattern}. Re-run headed (no xvfb-run) and resolve it manually.`;
    }
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const range = resolveRange(args);
  const timeoutMs = args.timeoutMinutes * 60 * 1000;

  fs.mkdirSync(args.outDir, { recursive: true });
  fs.mkdirSync(args.profileDir, { recursive: true });

  console.log(`Extension path: ${EXTENSION_PATH}`);
  console.log(`Profile dir:    ${args.profileDir}`);
  console.log(`Output dir:     ${args.outDir}`);
  console.log(`Range:          ${JSON.stringify(range)}`);

  const context = await chromium.launchPersistentContext(args.profileDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto('https://www.amazon.com/cpe/yourpayments/transactions', {
      waitUntil: 'domcontentloaded',
    });

    const loginTimeoutMs = args.loginTimeoutMinutes * 60 * 1000;
    console.log(
      `Waiting up to ${args.loginTimeoutMinutes} minute(s) for the transactions page to load (complete any sign-in/2FA now)...`
    );
    try {
      await page.waitForSelector('#amazon-export-btn', { timeout: loginTimeoutMs });
    } catch {
      const reason = await detectBlockedState(page);
      throw new Error(
        reason ??
          `Export button never appeared at ${page.url()} within ${args.loginTimeoutMinutes} minute(s). Amazon's page structure may have changed, the extension failed to load, or login/2FA wasn't completed in time (pass --login-timeout-minutes to allow longer).`
      );
    }

    await page.click('#amazon-export-btn');
    await page.waitForSelector('#confirm-export', { timeout: 10000 });

    if (range.kind === 'current-month') {
      await page.check('#export-current-month');
    } else if (range.kind === 'custom-month') {
      await page.check('#export-custom');
      await page.selectOption('#quick-month', String(range.month));
      await page.selectOption('#quick-year', String(range.year));
    } else {
      await page.check('#export-custom');
      await page.fill('#start-date', range.start);
      await page.fill('#end-date', range.end);
    }

    // Always select Detailed explicitly -- never rely on a remembered
    // preference from a previous run's chrome.storage state.
    await page.check('#csv-format-detailed');

    const downloadPromise = page.waitForEvent('download', { timeout: timeoutMs });
    await page.click('#confirm-export');

    console.log(`Waiting up to ${args.timeoutMinutes} minute(s) for the export to finish...`);
    const download = await downloadPromise;

    const suggested = download.suggestedFilename();
    const destPath = path.join(args.outDir, suggested);
    await download.saveAs(destPath);

    console.log(`Saved: ${destPath}`);
  } finally {
    await context.close();
  }
}

main().catch((err) => {
  console.error(`Export failed: ${err.message}`);
  process.exit(1);
});
