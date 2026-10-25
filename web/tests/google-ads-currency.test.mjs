import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import * as quality from "../lib/digital-quality.ts";
import * as evidence from "../lib/source-evidence.ts";
import * as presentation from "../lib/ads-presentation.ts";
import {verifiedAdsRoas} from "../lib/ads-roas.ts";
import {normalizeAds, normalizeLocal} from "../lib/data/digital-source-contract.ts";
import {normalizeApp} from "../lib/data/app-contract.ts";
import {normalizeDigital, normalizeDigitalHistory} from "../lib/data/digital-contract.ts";
import {normalizeMetaAds} from "../lib/data/meta-social-contract.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const React = require("react");
const {renderToStaticMarkup} = require("react-dom/server");
function load(path, dependencies = {}) {
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
  "@/lib/digital-quality": quality,
  "@/lib/source-evidence": evidence,
  "@/lib/ads-presentation": presentation,
  "@/components/DashboardSidebar": {DashboardSidebar: () => null},
  "@/components/DigitalReportShell": {DigitalTabs: () => null},
  "@/components/DigitalAdsTrendChart": {DigitalAdsTrendChart: () => null},
  "@/components/DigitalSourceEvidence": load("../components/DigitalSourceEvidence.tsx", {"@/lib/digital-quality": quality})
};
const google = summary => normalizeAds({meta: {available: true, rows: 1, observedDates: 1}, summary,
  campaigns: [{campaign_name: "Below old threshold", cost: 499, clicks: 20, conversions: 0, conversion_value: null},
    {campaign_name: "Above old threshold", cost: 501, conversions: 0},
    {campaign_name: "Measured zero", cost: 0, conversions: 1, conversion_value: 0},
    {campaign_name: "Missing", cost: null, conversions: null},
    {campaign_name: "Unverified ratio", cost: 100, conversions: 2, conversion_value: 50, clicks: 10, impressions: 100},
    {campaign_name: "Unknown value", cost: 100, conversions: 2, conversion_value: null}]});

test("shared money/trend formatter preserves USD, UAH, unknown/mixed and zero versus null without conversion", () => {
  for (const currency of ["USD", "UAH"]) {
    const e = evidence.currencyEvidence({currency});
    for (const value of [0, 25, 1500]) {
      const expected = `${currency} ${quality.formatMetric(value)}`;
      assert.equal(evidence.sourceMoney(value, e), expected);
      for (const metric of ["cost", "conversionValue"])
        assert.equal(presentation.formatAdsTrend(value, metric, e), expected);
    }
    assert.equal(presentation.formatAdsTrend(null, "cost", e), "—");
  }
  for (const raw of [{}, {currency: "UNKNOWN"}, {currencies: ["USD", "UAH"]}]) {
    const e = evidence.currencyEvidence(raw);
    for (const value of [0, 1500]) {
      const expected = e.currencyStatus === "MULTI" ? "— · currencies MULTI" : "— · currency UNKNOWN";
      assert.equal(evidence.sourceMoney(value, e), expected);
      assert.equal(presentation.formatAdsTrend(value, "cost", e), expected);
      assert.equal(presentation.formatAdsTrend(value, "conversionValue", e), expected);
    }
    assert.equal(evidence.sourceMoney(null, e), "—");
  }
  assert.equal(presentation.formatAdsTrend(0, "cost"), "— · currency UNKNOWN");
  assert.equal(presentation.formatAdsTrend(0, "conversions"), quality.formatMetric(0, 1));
  assert.equal(presentation.formatAdsTrend(null, "clicks"), "—");
});

test("campaign notices observe positive spend and measured zero conversions without a 500 threshold", () => {
  for (const cost of [0.01, 499, 500, 501]) {
    const row = {cost, conversions: 0, conversionValue: null, roas: null};
    assert.equal(presentation.hasSpendWithoutConversions(row), true);
    assert.deepEqual(presentation.adsCampaignSignal(row), {label: "Витрати · 0 conversions", cls: ""});
  }
  for (const row of [{cost: 0, conversions: 0}, {cost: null, conversions: 0},
    {cost: 1000, conversions: null}, {cost: 1000, conversions: 1}])
    assert.equal(presentation.hasSpendWithoutConversions(row), false);
});

test("paid page suppresses every unverified Google monetary KPI/campaign value and threshold; Meta stays USD", async () => {
  const meta = normalizeMetaAds({meta: {contractVersion: 3, rows: 1, observedDates: 1,
    from: "2026-10-23", to: "2026-10-23", currency: "USD", attributionVerified: false},
    summary: {spend: 25, purchases: null},
    campaigns: [{account_id: "fixture-meta", campaign_id: "fixture", account_currency: "USD", spend: 25}]}, "2026-10-24");
  for (const value of [1500, 0, null]) {
    const data = google({cost: value, clicks: 10, impressions: 100, conversions: 2, conversionValue: value});
    const {default: Page} = load("../app/digital/ads/page.tsx", {...shell,
      "@/lib/data/digital-sources": {loadDigitalAdsData: async () => data, loadDigitalMetaAdsData: async () => meta}});
    const html = renderToStaticMarkup(await Page());
    const expected = value === null ? "—" : "— · currency UNKNOWN";
    for (const label of ["Витрати", "CPC", "Conversion value"])
      assert.ok(html.includes(`<span>${label}</span><strong>${expected}</strong>`), label);
    assert.ok(html.includes(`<em>CPA ${expected}</em>`));
    assert.match(html, /ROAS Ads<\/span><strong>—<\/strong>/);
    assert.match(html, /Середній Google Ads ROAS<\/b><span>—<\/span>/);
    assert.match(html, /CTR 10.00%/);
    assert.match(html, /Кліки<\/span><strong>10<\/strong>/);
    assert.match(html, /Unverified ratio<\/b>(?:(?!<b>).)*<span>—<\/span><span class="">ROAS не визначено<\/span>/);
    assert.doesNotMatch(html, /Value нижче spend|[0-9]+\.[0-9]{2}x/);
    assert.match(html, /Below old threshold<\/b><span>— · currency UNKNOWN<\/span>/);
    assert.match(html, /Measured zero<\/b><span>— · currency UNKNOWN<\/span>/);
    assert.match(html, /Missing<\/b><span>—<\/span>/);
    assert.match(html, /без грошового порогу<\/b><span>2<\/span>/);
    assert.match(html, /Meta spend<\/span><strong>25<\/strong><small>USD<\/small>/);
    assert.match(html, /Meta purchases<\/span><strong>—<\/strong>/);
    assert.doesNotMatch(html, /₴|≥|NaN|Infinity/);
  }
});

test("App campaign rendering reuses the guard for USD, UAH, mixed, unknown, zero and null", async () => {
  const data = normalizeApp({googleAdsApp: [
    {campaign_name: "USD row", currency: "USD", spend: 100, conversions: 4, conversion_value: 0},
    {campaign_name: "UAH row", currency: "UAH", spend: 100, conversions: 4, conversion_value: 0},
    {campaign_name: "Unknown row", spend: 0, conversions: 0},
    {campaign_name: "Mixed row", currencies: ["USD", "UAH"], spend: 100},
    {campaign_name: "Null row", currency: "USD", spend: null}
  ]});
  const {default: Page} = load("../app/digital/app/page.tsx", {...shell,
    "@/lib/data/digital-sources": {loadDigitalAppData: async () => data}});
  const html = renderToStaticMarkup(await Page());
  for (const currency of ["USD", "UAH"])
    for (const value of [100, 25, 0]) assert.ok(html.includes(`<td>${currency} ${value}</td>`));
  assert.match(html, /Unknown row[\s\S]*?<td>— · currency UNKNOWN<\/td>/);
  assert.match(html, /Mixed row[\s\S]*?<td>— · currencies MULTI<\/td>/);
  assert.match(html, /Null row[\s\S]*?<td>—<\/td>/);
  assert.doesNotMatch(html, /₴|NaN|Infinity/);
});

test("actual trend switches suppress unverified monetary series and preserve count axes/tooltips and null gaps", () => {
  const data = [{date: "2026-10-23", cost: 1500, conversionValue: 3000, clicks: 0, conversions: null}];
  for (const metric of ["cost", "conversionValue", "clicks", "conversions"]) {
    const captured = {};
    const chart = Object.fromEntries(["CartesianGrid", "Line", "LineChart", "ResponsiveContainer", "Tooltip", "XAxis", "YAxis"].map(name => [name, props => {
      captured[name] = props;
      return React.createElement("div", null, props.children);
    }]));
    let selected;
    const {DigitalAdsTrendChart} = load("../components/DigitalAdsTrendChart.tsx", {
      "@/lib/ads-presentation": presentation, react: {...React, useState: () => [metric, key => {selected = key;}]}, recharts: chart
    });
    const element = DigitalAdsTrendChart({data});
    const html = renderToStaticMarkup(element);
    // Exercise the actual switcher handlers, with hook state controlled per selection.
    for (const button of element.props.children[0].props.children) {
      button.props.onClick();
      assert.equal(selected, button.key);
    }
    if (["cost", "conversionValue"].includes(metric)) {
      assert.match(html, /currency UNKNOWN/);
      assert.equal(captured.LineChart, undefined, "unknown money must not plot potentially mixed amounts");
    } else {
      assert.deepEqual(captured.LineChart.data, data);
      assert.equal(captured.Line.dataKey, metric);
      assert.equal(captured.Line.connectNulls, false);
      for (const value of [0, null, 1500]) {
        assert.equal(captured.YAxis.tickFormatter(value), quality.formatMetric(value, 1));
        assert.equal(captured.Tooltip.formatter(value), quality.formatMetric(value, 1));
      }
    }
    assert.doesNotMatch(html, /₴|USD|UAH/);
  }
});

test("Digital overview agrees with paid page on unknown money and count-only campaign notice", async () => {
  const data = normalizeDigital({meta: {from: "2026-09-24", to: "2026-10-23"}});
  const history = normalizeDigitalHistory({meta: {commonLatest: "2026-10-23", currentYear: 2026, cutoffMonth: 10, cutoffDay: 23}});
  const {default: Page} = load("../app/digital/page.tsx", {...shell,
    "@/components/DigitalTrendChart": {DigitalTrendChart: () => null},
    "@/components/DigitalHistoryChart": {DigitalHistoryChart: () => null},
    "@/lib/digital-reports": {DIGITAL_REPORTS: []},
    "next/link": {default: ({children, ...props}) => React.createElement("a", props, children)},
    "@/lib/data/digital": {loadDigitalData: async () => data, loadDigitalHistory: async () => history},
    "@/lib/data/digital-sources": {loadDigitalAdsData: async () => google({cost: 1500, conversionValue: 3000, conversions: 2}), loadDigitalLocalData: async () => normalizeLocal({})}
  });
  const html = renderToStaticMarkup(await Page({}));
  for (const label of ["Google Ads Spend", "CPA Ads"])
    assert.ok(html.includes(`<span>${label}</span><strong>— · currency UNKNOWN</strong>`));
  assert.match(html, /ROAS Ads<\/span><strong>—<\/strong>/);
  assert.doesNotMatch(html, /[0-9]+\.[0-9]{2}x/);
  assert.match(html, /2 кампаній з витратами і 0 Google Ads conversions/);
  assert.match(html, /без грошового порогу, суми витрат та ранжування бюджету/);
  assert.doesNotMatch(html, /₴|≥ ₴500/);
});


const identity = (accountId, raw) => ({accountId, ...evidence.currencyEvidence(raw)});
const sameCurrency = currency => ({spend: identity("synthetic-account", {currency}), value: identity("synthetic-account", {currency})});

test("ROAS helper requires verified same-account/same-currency operands; null and zero stay distinct", () => {
  // Explicit synthetic evidence, never fields inferred from the current Google RPC.
  for (const currency of ["USD", "UAH"]) {
    const verified = sameCurrency(currency);
    assert.equal(verifiedAdsRoas(400, 50, verified), 8);
    assert.equal(verifiedAdsRoas(0, 50, verified), 0);
    for (const [value, spend] of [[null, 50], [400, null], [0, 0], [400, 0], [Infinity, 50]])
      assert.equal(verifiedAdsRoas(value, spend, verified), null);
  }
  const invalid = [undefined,
    {spend: identity(null, {currency: "USD"}), value: identity(null, {currency: "USD"})},
    {spend: identity(" ", {currency: "USD"}), value: identity(" ", {currency: "USD"})},
    {spend: identity("one", {currency: "USD"}), value: identity("two", {currency: "USD"})},
    {spend: identity("one", {currency: "USD"}), value: identity("one", {currency: "UAH"})}
  ];
  for (const raw of [{}, {currency: "UNKNOWN"}, {currencies: ["USD", "UAH"]}])
    for (const operand of ["spend", "value"])
      invalid.push({...sameCurrency("USD"), [operand]: identity("synthetic-account", raw)});
  for (const unverified of invalid)
    for (const value of [null, 0, 400]) assert.equal(verifiedAdsRoas(value, 50, unverified), null);
});

test("Google normalization with no verified identity blocks aggregate and campaign ROAS despite numeric ratios", () => {
  for (const raw of [{}, {currency: "UNKNOWN"}, {currencies: ["USD", "UAH"]}, {currency: "USD", account_id: "unverified-label"}]) {
    for (const value of [null, 0, 400]) {
      const data = normalizeAds({meta: {available: true, rows: 1, ...raw},
        summary: {cost: 50, conversionValue: value, roas: 8, clicks: 10, impressions: 100},
        campaigns: [{campaign_name: "Synthetic", cost: 50, conversion_value: value, roas: 8, clicks: 10, impressions: 100, ...raw}]});
      assert.equal(data.summary.roas, null);
      assert.equal(data.campaigns[0].roas, null);
      assert.equal(data.summary.conversionValue, value);
      assert.equal(data.campaigns[0].conversionValue, value);
      assert.equal(data.summary.clicks, 10);
      assert.equal(data.summary.ctr, 0.1);
      assert.equal(data.campaigns[0].ctr, 0.1);
    }
  }
});

test("campaign comparisons reject even precomputed ROAS without evidence; count and zero-value observations remain", () => {
  const row = {cost: 100, conversions: 2, conversionValue: 50, roas: 0.5};
  assert.deepEqual(presentation.adsCampaignSignal(row), {label: "ROAS не визначено", cls: ""});
  assert.deepEqual(presentation.adsCampaignSignal(row, sameCurrency("USD")), {label: "Value нижче spend", cls: "negative"});
  for (const raw of [{currency: "UNKNOWN"}, {currencies: ["USD", "UAH"]}])
    assert.deepEqual(presentation.adsCampaignSignal(row, {spend: identity("synthetic-account", raw), value: identity("synthetic-account", raw)}),
      {label: "ROAS не визначено", cls: ""});
  assert.deepEqual(presentation.adsCampaignSignal({...row, conversionValue: 0, roas: 0}), {label: "Value = 0", cls: ""});
  assert.deepEqual(presentation.adsCampaignSignal({...row, conversionValue: null}), {label: "ROAS не визначено", cls: ""});
});
