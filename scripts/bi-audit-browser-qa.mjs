// Emit execution contracts, never mark browser PASS or perform network requests.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {routeAssertions, routeControls} from './bi-audit-qa-contracts.mjs';
const folder = new URL('../docs/audit/2026-10-24/', import.meta.url);
const audit = JSON.parse(fs.readFileSync(new URL('browser-qa.json', folder), 'utf8'));
const inventory = JSON.parse(fs.readFileSync(new URL('inventory.json', folder), 'utf8'));

export function executionMatrix(origin = audit.preview_url) {
  const base = new URL(origin);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/')
    throw Error('Use a plain authorized preview origin without credentials or tokens');
  return audit.cases.flatMap(item => item.viewport_widths.map(width => {
    const route = inventory.routes.find(route => route.path === item.path);
    const [heading, fixtureRpc, metric] = routeAssertions[item.path];
    const rpc = item.path === '/operating' ? route.rpc : fixtureRpc;
    const sources = [...new Set([...route.warehouse_relations, ...(item.path === '/digital/site' ? ['digital_gbp_daily','digital_pagespeed_snapshot'] : [])])];
    const url = new URL(item.path, base.origin);
    return {
      case_id: `${item.path === '/' ? 'overview' : item.path.slice(1).replaceAll('/', '-')}-${width}`,
      path: item.path, url: url.href, viewport: {width, height: width < 768 ? 844 : 900},
      status: 'NOT_EXECUTED', deployment_sha: 'RECORD_EXACT_DEPLOYED_SHA',
      unauthenticated: {runnable: true, assertion: item.path === '/login'
        ? 'GET 200 login form, no session cookie/data; responsive form and labelled password input'
        : 'GET 307 same-origin /login preserving next; followed GET 200 is login shell, not BI data'},
      mock: {runnable: true, test: 'web/tests/preview-ui-contracts.test.mjs',
        rpc_calls_executed: fixtureRpc,
        scope: 'Real server page/adapters, synthetic RPC; SSR is width-independent; no hydration/chart/layout/role proof',
        states: fixtureRpc.length ? ['partial', 'empty', 'missing', 'zero'] : [item.path === '/operating' ? 'disabled_packet' : 'static_or_login_shell'],
        browser_test: item.path === '/login' ? 'node scripts/bi-audit-login-browser.mjs' : null, viewport_execution: 'NOT_EXECUTED'},
      authenticated: {status: 'NOT_EXECUTED', runnable_without_session: item.path === '/login',
        requirement: item.path === '/login' ? 'Authentication not required for login shell; browser runtime required'
          : 'Already-authorized tester browser session on exact preview SHA; no secret exchange',
        source_to_rpc_to_ui: {source_candidates: sources, rpc, ui: route.page, heading, assertion: metric},
        filters: routeControls[item.path] || 'No route-level period/segment selector; source RPC default window, snapshots retain separate periods; chart-local controls require browser QA', grain: route.grain, timezone: route.timezone,
        expected: item.path === '/login' ? ['No source/RPC/period/segment metrics apply; confirm labelled password input, keyboard focus and viewport fit', 'GET never establishes a session or exposes BI data; do not submit credentials in automated QA'] : ['Match source/raw/curated/RPC/UI for same account, currency, timezone, period, grain and lifecycle cohort',
          'Latest completed 30 dates versus prior 30 and rolling 12 months; record missingness, row caps, gaps, duplicates, refunds and attribution separately',
          'Unknown/null renders —; measured zero stays 0 only with period evidence; no currency conversion or inferred completeness',
          'Exercise actual visible selectors and drilldown; absent controls N/A; record console/404/500 and mobile overflow',
          'Inspect mutation controls only; no sync, manual analysis, task submission or business writes'],
        limitations: item.path === '/operating' ? 'Collector RPCs and persisted run are mocked in SSR; no current-run verification' : null},
      period_urls: item.path === '/digital' ? [['2026-09-24','2026-10-23'],['2026-08-25','2026-09-23']].map(([from,to])=>`${url.href}?from=${from}&to=${to}`) : [],
      steps: item.steps, screenshot: null, observations: null,
      stop_condition: 'Stop on protection/auth failure, unexpected writes or data leak; no bypass/credential attempts'
    };
  }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const matrix = executionMatrix(process.env.BI_AUDIT_BASE_URL || audit.preview_url);
  if (process.argv[2] === '--matrix') for (const row of matrix) process.stdout.write(JSON.stringify(row) + '\n');
  else if (process.argv[2] === '--write') fs.writeFileSync(new URL('qa-execution-matrix.json', folder), JSON.stringify(matrix, null, 2) + '\n');
  else if (process.argv[2] === '--check') {
    if (fs.readFileSync(new URL('qa-execution-matrix.json', folder), 'utf8') !== JSON.stringify(matrix, null, 2) + '\n') throw Error('QA matrix is stale');
    process.stdout.write(`${matrix.length} cases; all real browser results NOT_EXECUTED\n`);
  } else throw Error('Usage: node scripts/bi-audit-browser-qa.mjs --matrix|--write|--check');
}
