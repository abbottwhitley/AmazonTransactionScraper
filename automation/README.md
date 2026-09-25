# Automated export (Playwright)

> **⚠️ Do not run this against the real account.** On its second run
> (2026-09-15), Amazon explicitly detected and blocked it: *"Continued access
> by an unauthorized AI agent violates Amazon's Conditions of Use, to which
> our customers have agreed."* That's a named ToS enforcement message about
> AI-agent automation specifically, not a generic CAPTCHA or rate-limit, and
> it showed up even with a real persistent authenticated session and the
> extension running completely unmodified. This code is left here for
> reference, not for reuse -- don't try to route around the block (different
> fingerprints, stealth plugins, timing changes, etc.). Use the manual export
> (see the top-level README) instead.

Runs the extension itself, unmodified, inside a real (headed) Chromium
controlled by [Playwright](https://playwright.dev/), so producing a CSV
doesn't require a human to click through the extension's UI. See the
top-level README for what the extension does and the CSV formats.

## Why headed, not headless

Chromium's support for Manifest V3 extensions (`--load-extension`) in true
headless mode is still unreliable. Running headed sidesteps that entirely.
For an unattended box with no physical display, wrap the same command in
[`xvfb-run`](https://www.x.org/releases/X11R7.6/doc/man/man1/Xvfb.1.xhtml)
(Linux) instead of using `--headless` -- the browser still thinks it's headed,
it just has no real screen to draw to.

Login itself is never automated -- typing a password or solving 2FA/CAPTCHA
programmatically is exactly the kind of thing that draws the hardest
bot-detection scrutiny, and it's unnecessary here: a **persistent browser
profile** (`--profile-dir`, default `~/.config/amazon-automation-profile`)
keeps the session alive across runs after one manual interactive login.

## One-time setup

```bash
cd automation
npm install
npx playwright install chromium
# First-time-only system libraries Chromium needs (Debian/Ubuntu; needs sudo):
#   npx playwright install-deps chromium
```

## First run (headed, do this yourself -- don't script around it)

```bash
node run-export.mjs
```

A real Chromium window opens with the extension loaded. If Amazon asks you to
sign in (including 2FA), do it by hand in that window. Once you land on the
transactions page, the script takes over: clicks the export button, selects
the requested date range and the **Detailed** CSV format (always -- it
ignores whatever format was last remembered), clicks Export, and saves the
resulting file.

The session persists in `--profile-dir`, so subsequent runs (including via
`xvfb-run`) should not need a fresh login.

## Usage

```bash
node run-export.mjs                                   # current month
node run-export.mjs --month 2026-09
node run-export.mjs --start 2026-08-01 --end 2026-09-15
node run-export.mjs --out-dir ~/amazon-exports --profile-dir ~/.config/amazon-automation-profile
node run-export.mjs --timeout-minutes 20                # large exports can take a while
node run-export.mjs --login-timeout-minutes 15           # slow 2FA, give it more time to appear
```

`--login-timeout-minutes` (default 10) governs how long the script waits after
navigating for the extension's button to appear -- that's the window your
sign-in/2FA has to fit in on a fresh or expired session. `--timeout-minutes`
(default 15) is separate: it's how long the export itself is allowed to run
once you've clicked Export.

Output CSVs land in `--out-dir` (default `~/amazon-exports/`, **outside** this
git working tree deliberately -- real order data shouldn't sit inside a repo
directory even gitignored).

## Unattended / scheduled runs

```bash
xvfb-run -a node run-export.mjs --month 2026-09
```

If the session has expired or Amazon shows a challenge page, the script
detects it and exits non-zero with a message telling you to re-run headed to
re-authenticate, rather than silently writing an empty or bogus CSV. No
cron/systemd wiring is set up yet -- once a few `xvfb-run` invocations have
proven reliable, wire this into cron/systemd yourself with the command above.

## What this does not do

- Does not touch the extension's own source files -- the extension runs
  exactly as it does when you load it manually.
- Does not reduce the per-request delay the extension already uses between
  order-detail fetches; running unattended is a reason to stay conservative,
  not to go faster.
- Does not make this an official/supported way to pull your Amazon data --
  it's the same personal, best-effort scraping the manual extension already
  is, just without the click. Amazon can still change its page structure or
  flag automated-looking sessions at any time.
