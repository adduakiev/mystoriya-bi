// Emit a manual browser execution matrix, never a browser PASS or a network request.
// No dependencies, credentials, protection bypass, form submission or business writes.
import fs from 'node:fs';

const audit = JSON.parse(fs.readFileSync(new URL('../docs/audit/2026-10-24/browser-qa.json', import.meta.url), 'utf8'));
if (process.argv[2] !== '--matrix') throw Error('Usage: node scripts/bi-audit-browser-qa.mjs --matrix');
const base = new URL(process.env.BI_AUDIT_BASE_URL || audit.preview_url);
if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash)
  throw Error('Use a plain authorized preview origin without credentials or tokens');
for (const item of audit.cases) {
  for (const width of item.viewport_widths) {
    const url = new URL(item.path, base.origin);
    const periodUrls = [];
    if (item.path === '/digital') {
      for (const [from, to] of [['2026-09-24', '2026-10-23'], ['2026-08-25', '2026-09-23']]) {
        const selected = new URL(url);
        selected.searchParams.set('from', from); selected.searchParams.set('to', to);
        periodUrls.push(selected.href);
      }
    }
    process.stdout.write(JSON.stringify({
      url: url.href, viewport: {width, height: width < 768 ? 844 : 900},
      status: 'NOT_EXECUTED', deployment_sha: 'RECORD_EXACT_SHA',
      period_urls: periodUrls, segment_changes: 'Exercise each visible selector; N/A if absent',
      steps: item.steps, screenshot: null, observations: null,
      stop_condition: 'Protected 403 or auth unavailable: BLOCKED; do not bypass protection'
    }) + '\n');
  }
}
