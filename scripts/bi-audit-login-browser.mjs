// Optional real Chromium fixture check at all three viewports. It cannot authenticate or submit.
// Browser profiles, HTML and stderr stay in /tmp; never copy them into audit evidence.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {previewHarness} from '../web/tests/support/bi-preview-harness.mjs';
const dir = fs.mkdtempSync(path.join(os.tmpdir(),'issue43-login-browser-'));
const html = await previewHarness().render('/login');
const css = fs.readFileSync(new URL('../web/app/globals.css',import.meta.url),'utf8');
const reports = [];
for (const width of [360,768,1440]) {
  const file = path.join(dir,`login-${width}.html`);
  const script = `
    document.addEventListener('submit', event => event.preventDefault(), true);
    document.addEventListener('click', event => { if(event.target.closest('a')) event.preventDefault(); }, true);
    const input = document.querySelector('#password');
    input.focus();
    const rect = document.querySelector('form').getBoundingClientRect();
    const assertions = {
      viewport: innerWidth === ${width}, labelled: document.querySelector('label').control === input,
      passwordType: input.type === 'password', focus: document.activeElement === input,
      inputFont: parseFloat(getComputedStyle(input).fontSize) >= 16,
      fits: rect.left >= 0 && rect.right <= innerWidth,
      noDocumentOverflow: document.documentElement.scrollWidth <= innerWidth,
      noData: !document.querySelector('table, [data-mock-chart]')
    };
    document.querySelector('#qa-results').textContent = JSON.stringify({width:innerWidth, assertions, pass:Object.values(assertions).every(Boolean)});
  `;
  fs.writeFileSync(file,`<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'none'; connect-src 'none'"><style>${css}</style></head><body>${html}<pre id="qa-results"></pre><script>${script}</script></body></html>`);
  const result = spawnSync('chromium',['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
    '--disable-background-networking','--disable-breakpad','--disable-crash-reporter','--no-first-run',
    `--user-data-dir=${path.join(dir,`profile-${width}`)}`,`--window-size=${width},900`,
    '--force-device-scale-factor=1','--dump-dom',pathToFileURL(file).href],{encoding:'utf8',timeout:20000,maxBuffer:2*1024*1024});
  fs.writeFileSync(path.join(dir,`stderr-${width}.txt`),result.stderr || '');
  const match = result.stdout?.match(/<pre id="qa-results">(.*?)<\/pre>/s);
  reports.push({width,scope:'SYNTHETIC_LOGIN_STATIC_BROWSER_ONLY',result:match ? JSON.parse(match[1]) : 'BLOCKED_BROWSER_STARTUP',
    exit_code:result.status,signal:result.signal,error_code:result.error?.code || null});
}
process.stdout.write(JSON.stringify({artifacts:dir,reports},null,2)+'\n');
if (reports.some(r=>r.result.pass !== true)) process.exitCode = 1;
