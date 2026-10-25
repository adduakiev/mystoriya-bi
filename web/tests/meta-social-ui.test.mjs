import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {normalizeSocial, normalizeMetaAds} from "../lib/data/meta-social-contract.ts";
import {normalizeAds} from "../lib/data/digital-source-contract.ts";
import * as quality from "../lib/digital-quality.ts";
import * as evidence from "../lib/source-evidence.ts";
import * as presentation from "../lib/ads-presentation.ts";

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
  "@/lib/source-evidence": evidence,
  "@/lib/ads-presentation": presentation,
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
