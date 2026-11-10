import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {previewHarness} from './support/bi-preview-harness.mjs';
import {shellCases, shellWidths, shellFixture, baselineShellCss} from './support/shared-shell-fixture.mjs';

const css = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

// Bounded source contracts, NOT a CSS layout engine or viewport PASS.
function assertContainment(styles) {
  assert.match(styles, /\.shell\s*\{[^}]*grid-template-columns:\s*230px minmax\(0,\s*1fr\);/);
  assert.match(styles, /@media\s*\(max-width:\s*1100px\)\s*\{\s*\.shell\s*\{\s*grid-template-columns:\s*74px minmax\(0,\s*1fr\);/);
  assert.match(styles, /\.workspace\s*\{[^}]*min-width:\s*0;/);
}

test('shared shell: shrinkable tracks and grid item, with independent failure controls', () => {
  assertContainment(css);
  const baseline = baselineShellCss(css);
  assert.throws(() => assertContainment(baseline), {code: 'ERR_ASSERTION'});
  for (const [fixed, old] of [
    ['230px minmax(0, 1fr)', '230px 1fr'],
    ['74px minmax(0, 1fr)', '74px 1fr'],
    ['.workspace { min-width: 0; ', '.workspace { '],
  ]) assert.throws(() => assertContainment(css.replace(fixed, old)), {code: 'ERR_ASSERTION'});
  assert.throws(() => baselineShellCss(baseline), /Expected exactly one/);
});

test('containment preserves workspace bounds, mobile sidebar and internal scroll (no page clipping mask)', () => {
  const workspace = css.match(/\.workspace\s*\{([^}]+)\}/)[1];
  for (const rule of ['padding: 28px 32px 42px;', 'max-width: 1650px;', 'width: 100%;', 'margin: 0 auto;'])
    assert.ok(workspace.includes(rule), rule);
  assert.match(css, /@media \(max-width: 720px\)\s*\{\s*\.shell \{ display: block; \}\s*\.sidebar \{ display: none; \}\s*\.workspace \{ padding: 20px 14px; \}/);
  for (const {wrapper, table} of shellCases) {
    assert.match(css, new RegExp(`\\.${wrapper}\\s*\\{[^}]*overflow-x: auto;`));
    assert.match(css, new RegExp(`\\.${table}\\s*\\{[^}]*min-width: ${table === 'delivery-table' ? 1220 : 1050}px;`));
  }
  for (const match of css.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
    if (/(?:^|[\s,])(?:html|body|\.shell|\.workspace)(?:\s|,|$)/.test(match[1]))
      assert.doesNotMatch(match[2], /overflow(?:-x)?:\s*(?:hidden|clip)/, match[1]);
  }
});

test('actual Overview and Delivery SSR retain the fixture ancestor chain and internal table wrappers', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Offline shell contracts cannot use network'));
  for (const item of shellCases) {
    const html = await previewHarness().render(item.route);
    assert.match(html, /<main class="shell">/);
    assert.match(html, /<section class="workspace">/);
    assert.match(html, new RegExp(`<section class="panel[^"<>]*">(?:(?!</section>)[\\s\\S])*<div class="${item.wrapper}"><div class="${item.table}">`));
    assert.ok(html.indexOf('class="shell"') < html.indexOf('class="workspace"'));
    assert.ok(html.indexOf('class="workspace"') < html.indexOf(`class="${item.wrapper}"`));
  }
});

test('offline fixture covers 360/768/1440 with original CSS, real scroller DOM and measurable failure controls', () => {
  assert.deepEqual(shellWidths, [360, 768, 1440]);
  for (const item of shellCases) {
    for (const styles of [baselineShellCss(css), css]) {
      const html = shellFixture(styles, item);
      assert.ok(html.includes(`<style>${styles}</style>`), 'no rewritten fixture CSS');
      assert.ok(html.includes(`<div class="${item.wrapper}"><div class="${item.table}">`));
      assert.ok(html.includes("default-src 'none'"));
      assert.ok(html.includes("connect-src 'none'"));
      assert.match(html, /wrapper\.scrollLeft = wrapper\.scrollWidth/);
      assert.match(html, /document\.documentElement\.scrollWidth/);
      assert.match(html, /finalColumnReachable/);
      assert.doesNotMatch(html, /https?:\/\/|<iframe|<form|fetch\(/);
    }
  }
});
