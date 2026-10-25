import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {normalizeSocial, normalizeMetaAds} from "../lib/data/meta-social-contract.ts";
import {normalizeAds} from "../lib/data/digital-source-contract.ts";
import * as quality from "../lib/digital-quality.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const {renderToStaticMarkup} = require("react-dom/server");
// Render the actual server pages with only I/O and unrelated shell/chart stubs.
function loadTsx(path, dependencies) {
  const {outputText} = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022}
  });
  const module = {exports: {}};
  new Function("require", "module", "exports", outputText)(
    name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), module, module.exports
  );
  return module.exports;
}
const shell = {
  "@/components/DashboardSidebar": {DashboardSidebar: () => null},
  "@/components/DigitalReportShell": {DigitalTabs: () => null},
  "@/components/DigitalAdsTrendChart": {DigitalAdsTrendChart: () => null},
  "@/lib/digital-quality": quality,
  "@/components/DigitalSourceEvidence": loadTsx("../components/DigitalSourceEvidence.tsx", {"@/lib/digital-quality": quality})
};
const asOf = "2026-10-23";

test("social SSR keeps stale Facebook data, renders IG dashes and makes no null content claims", async () => {
  const data = normalizeSocial({facebook: {from: "2026-09-19", to: "2026-10-18", rows: 30, followers: 1234},
    instagram: {rows: 0, followers: 0, impressions: 0},
    facebookPosts: [{post_id: "p", message: "Unknown metrics post", impressions: null, reach: null, clicks: null, engagements: null}]}, asOf);
  const {default: Page} = loadTsx("../app/digital/social/page.tsx", {...shell,
    "@/lib/data/digital-sources": {loadDigitalSocialData: async () => data}});
  const html = renderToStaticMarkup(await Page());
  assert.match(html, /Facebook Organic · STALE/);
  assert.match(html, /Instagram Organic · WAITING/);
  assert.match(html, /Followers · Instagram<\/span><strong>—<\/strong>/);
  assert.match(html, /Unknown metrics post[\s\S]*?<span>—<\/span><span>—<\/span><span>—<\/span><span>—<\/span>/);
  assert.match(html, new RegExp(quality.formatMetric(1234)));
  assert.doesNotMatch(html, /скоротилася на|очікує OAuth|актуальний snapshot|NaN/);
});

test("paid SSR presents Google and empty Meta independently with null Meta metrics", async () => {
  const google = normalizeAds({meta: {available: true, rows: 1}, summary: {cost: 50, conversionValue: 400}});
  const meta = normalizeMetaAds({meta: {rows: 0}, summary: {spend: 0, purchaseValue: 0}}, asOf);
  const {default: Page} = loadTsx("../app/digital/ads/page.tsx", {...shell,
    "@/lib/data/digital-sources": {loadDigitalAdsData: async () => google, loadDigitalMetaAdsData: async () => meta}});
  const html = renderToStaticMarkup(await Page());
  assert.match(html, /Meta Ads · WAITING/);
  assert.match(html, /Meta spend<\/span><strong>—<\/strong>/);
  assert.match(html, /Meta ROAS<\/span><strong>—<\/strong>/);
  assert.match(html, /ROAS Ads<\/span><strong>8.00x<\/strong>/);
  assert.match(html, /не об’єднуємо ROAS/);
});

test("Meta RPC rejection leaves Google results visible and reports unavailable source", async () => {
  const google = normalizeAds({meta: {available: true, rows: 1}, summary: {cost: 50, conversionValue: 400}});
  const {default: Page} = loadTsx("../app/digital/ads/page.tsx", {...shell,
    "@/lib/data/digital-sources": {loadDigitalAdsData: async () => google, loadDigitalMetaAdsData: async () => {throw Error("RPC failed");}}});
  const html = renderToStaticMarkup(await Page());
  assert.match(html, /ROAS Ads<\/span><strong>8.00x<\/strong>/);
  assert.match(html, /Meta Ads · джерело недоступне/);
  assert.doesNotMatch(html, /Meta Ads · WAITING|Meta Ads · LIVE/);
});

test("paid SSR labels Windsor USD, keeps null purchases and blocks unverified ROAS", async () => {
  const google = normalizeAds({meta: {available: true, rows: 1}, summary: {cost: 50, conversionValue: 400}});
  const meta = normalizeMetaAds({meta: {contractVersion: 3, from: '2026-10-01', to: asOf,
    rows: 110, observedDates: 19, currency: 'USD', attributionVerified: false},
    summary: {spend: 896.92, purchases: null, purchaseValue: null},
    campaigns: [{account_id: 'fixture-account', campaign_id: 'fixture-campaign', account_currency: 'USD', spend: 896.92}]}, asOf);
  const {default: Page} = loadTsx("../app/digital/ads/page.tsx", {...shell,
    "@/lib/data/digital-sources": {loadDigitalAdsData: async () => google, loadDigitalMetaAdsData: async () => meta}});
  const html = renderToStaticMarkup(await Page());
  assert.match(html, /Meta Ads · PARTIAL/);
  assert.match(html, /Meta spend<\/span><strong>[^<]+<\/strong><small>USD<\/small>/);
  assert.match(html, /Meta purchases<\/span><strong>—<\/strong>/);
  assert.match(html, /Meta ROAS<\/span><strong>—<\/strong>/);
  assert.match(html, /fixture-account · USD/);
  assert.match(html, /ROAS Ads<\/span><strong>8.00x<\/strong>/);
});


test("Google Ads SSR uses unknown currency for summary, campaign amounts and spend threshold", async () => {
  const google = normalizeAds({meta: {available: true, rows: 1},
    summary: {cost: 600, clicks: 10, conversions: 2, conversionValue: 0},
    campaigns: [
      {campaign_name: "Measured campaign", cost: 600, clicks: 10, conversions: 2, conversion_value: 0},
      {campaign_name: "Missing campaign", cost: null, conversions: null, conversion_value: null},
      {campaign_name: "No conversions campaign", cost: 500, conversions: 0, conversion_value: 0}
    ]});
  const {default: Page} = loadTsx("../app/digital/ads/page.tsx", {...shell,
    "@/lib/data/digital-sources": {loadDigitalAdsData: async () => google, loadDigitalMetaAdsData: async () => normalizeMetaAds({}, asOf)}});
  const html = renderToStaticMarkup(await Page());
  assert.doesNotMatch(html, /₴|UAH|USD/);
  assert.match(html, /Витрати<\/span><strong>600 \(валюта невідома\)<\/strong>/);
  assert.match(html, /CPC<\/span><strong>60 \(валюта невідома\)<\/strong>/);
  assert.match(html, /CPA 300 \(валюта невідома\)/);
  assert.match(html, /Conversion value<\/span><strong>0 \(валюта невідома\)<\/strong>/);
  assert.match(html, /витратами ≥ 500 \(валюта невідома\) і 0 conversions<\/b><span>1 · 500 \(валюта невідома\)/);
  assert.match(html, /Measured campaign<\/b><span>600 \(валюта невідома\)<\/span><span>10<\/span><span>2.0<\/span><span>300 \(валюта невідома\)<\/span><span>0 \(валюта невідома\)<\/span>/);
  assert.match(html, /Missing campaign<\/b><span>—<\/span><span>—<\/span><span>—<\/span><span>—<\/span><span>—<\/span>/);
  assert.match(html, /No conversions campaign<\/b><span>500 \(валюта невідома\)<\/span><span>—<\/span><span>0.0<\/span><span>—<\/span><span>0 \(валюта невідома\)<\/span>/);
});

// Inspect the actual chart's Recharts props: SSR alone does not invoke axis or
// tooltip formatters inside ResponsiveContainer. No browser/network I/O needed.
function chartFor(metric) {
  const React = require("react");
  const recharts = Object.fromEntries(["CartesianGrid", "Line", "LineChart", "ResponsiveContainer", "Tooltip", "XAxis", "YAxis"].map(name => [name, () => null]));
  const {DigitalAdsTrendChart} = loadTsx("../components/DigitalAdsTrendChart.tsx", {
    "@/lib/digital-quality": quality,
    react: {...React, useState: () => [metric, () => {}]},
    recharts
  });
  const tree = DigitalAdsTrendChart({data: [{date: "2026-10-22", cost: 1200, conversionValue: null}]});
  function find(node, type) {
    if (!node || typeof node !== "object") return null;
    if (node.type === type) return node;
    return React.Children.toArray(node.props?.children).map(child => find(child, type)).find(Boolean);
  }
  return {tree, axis: find(tree, recharts.YAxis).props, tooltip: find(tree, recharts.Tooltip).props, line: find(tree, recharts.Line).props};
}

for (const metric of ["cost", "conversionValue"]) {
  test(`Google Ads ${metric} chart labels unknown currency and formats ticks/tooltips without hryvnia`, () => {
    const {tree, axis, tooltip, line} = chartFor(metric);
    const html = renderToStaticMarkup(tree);
    assert.match(html, /валюта невідома/);
    assert.doesNotMatch(html, /₴|UAH|USD/);
    assert.equal(line.dataKey, metric);
    assert.equal(line.connectNulls, false);
    for (const [input, expected] of [[0, "0"], [42.4, "42"], [1200, "1.2K"], [-1200, "-1.2K"]]) {
      assert.equal(axis.tickFormatter(input), expected);
      assert.equal(tooltip.formatter(input), `${expected} (валюта невідома)`);
    }
    for (const input of [null, undefined, "", NaN, Infinity]) {
      assert.equal(axis.tickFormatter(input), "—");
      assert.equal(tooltip.formatter(input), "—");
    }
  });
}

for (const metric of ["clicks", "conversions"]) {
  test(`Google Ads ${metric} chart remains a count without a money unit`, () => {
    const {tree, axis, tooltip} = chartFor(metric);
    assert.doesNotMatch(renderToStaticMarkup(tree), /валюта невідома|₴|UAH|USD/);
    assert.equal(axis.tickFormatter(0), "0");
    assert.equal(tooltip.formatter(12.5), "12,5");
    assert.equal(tooltip.formatter(null), "—");
  });
}
