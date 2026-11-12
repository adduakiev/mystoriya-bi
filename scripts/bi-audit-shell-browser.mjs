// Offline synthetic browser gate. No auth, network, server, or production data.
// Run before the fix with --baseline-only, then without it for failure controls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {shellCases, shellWidths, shellFixture, baselineShellCss} from '../web/tests/support/shared-shell-fixture.mjs';

const baselineOnly = process.argv.includes('--baseline-only');
assert.ok(process.argv.slice(2).every(arg => arg === '--baseline-only'), 'Unknown argument');
const css = fs.readFileSync(new URL('../web/app/globals.css', import.meta.url), 'utf8');
const variants = baselineOnly ? [['baseline', css]] : [['baseline', baselineShellCss(css)], ['corrected', css]];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'issue43-shell-browser-'));
const reports = [];
for (const [variant, styles] of variants) {
  for (const item of shellCases) {
    for (const width of shellWidths) {
      const id = `${variant}-${item.table}-${width}`;
      const file = path.join(dir, `${id}.html`);
      fs.writeFileSync(file, shellFixture(styles, item));
      // Same bounded launch configuration as the existing offline login check.
      const run = spawnSync('chromium', ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
        '--disable-background-networking', '--disable-breakpad', '--disable-crash-reporter', '--no-first-run',
        `--user-data-dir=${path.join(dir, `${id}-profile`)}`, `--window-size=${width},900`,
        '--force-device-scale-factor=1', '--dump-dom', pathToFileURL(file).href],
      {encoding: 'utf8', timeout: 15000, maxBuffer: 2 * 1024 * 1024});
      fs.writeFileSync(path.join(dir, `${id}.stderr`), run.stderr || '');
      const match = run.stdout?.match(/<script id="shell-metrics" type="application\/json">(.*?)<\/script>/s);
      if (!match || run.status !== 0) {
        console.log(JSON.stringify({scope: 'OFFLINE_SIMPLIFIED_SYNTHETIC_DOM', status: 'BLOCKED_BROWSER_STARTUP',
          variant, route: item.route, width, exit: run.status, signal: run.signal,
          error: run.error?.code ?? null, artifacts: dir, reports}, null, 2));
        process.exit(1); // No silent skip/pass; do not retry sandbox restrictions.
      }
      const metrics = JSON.parse(match[1]);
      reports.push({variant, route: item.route, width, metrics});
      assert.equal(metrics.viewport, width, `${id}: actual viewport`);
      const overflowExpected = variant === 'baseline' && width > 720 && (width === 768 || item.route === '/delivery');
      assert.equal(metrics.document > width, overflowExpected, `${id}: document overflow failure control`);
      assert.equal(metrics.overflowX, 'auto', `${id}: intended scroller`);
      const scrollExpected = !overflowExpected && (width !== 1440 || item.route === '/delivery');
      assert.equal(metrics.scroll > metrics.client, scrollExpected, `${id}: inner overflow`);
      assert.equal(metrics.scrollLeft > 0, scrollExpected, `${id}: measurable inner scroll`);
      assert.equal(metrics.finalColumnReachable, true, `${id}: final column reachable`);
    }
  }
}
console.log(JSON.stringify({scope: 'OFFLINE_SIMPLIFIED_SYNTHETIC_DOM', status: 'PASS', artifacts: dir, reports}, null, 2));
