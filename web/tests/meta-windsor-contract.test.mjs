import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMetaAds} from '../lib/data/meta-social-contract.ts';

const asOf = '2026-10-23';
const meta = {contractVersion: 3, from: '2026-10-01', to: asOf, rows: 110,
  observedDates: 19, currency: 'USD', attributionVerified: false};

test('issue evidence: USD spend survives while all-null Meta purchases and ROAS stay unknown', () => {
  const data = normalizeMetaAds({meta, summary: {spend: 896.92, impressions: 1249264,
    clicks: 8623, linkClicks: 5869, purchases: null, purchaseValue: null, conversions: null}}, asOf);
  assert.equal(data.meta.currency, 'USD');
  assert.equal(data.meta.status, 'PARTIAL');
  assert.equal(data.meta.observedDates, 19);
  assert.equal(data.summary.spend, 896.92);
  assert.equal(data.summary.linkClicks, 5869);
  for (const key of ['purchases', 'purchaseValue', 'conversions', 'roas']) assert.equal(data.summary[key], null);
});

test('v3 suppresses monetary totals without a single valid currency; accounts retain their currency', () => {
  const data = normalizeMetaAds({meta: {...meta, currency: null},
    summary: {spend: 1000, purchaseValue: 2000, clicks: 100, impressions: 10000}, campaigns: [
      {account_id: 'usd', campaign_id: 'shared', account_currency: 'USD', spend: 10, purchase_value: 20},
      {account_id: 'uah', campaign_id: 'shared', account_currency: 'UAH', spend: 990, purchase_value: 1980}
    ]}, asOf);
  for (const key of ['spend', 'purchaseValue', 'cpc', 'cpm', 'roas']) assert.equal(data.summary[key], null);
  assert.equal(data.summary.clicks, 100);
  assert.deepEqual(data.campaigns.map(r => [r.accountId, r.currency, r.spend, r.roas]),
    [['usd', 'USD', 10, null], ['uah', 'UAH', 990, null]]);
});

test('v3 measured purchase zero is preserved, but unverified attribution cannot produce ROAS', () => {
  const data = normalizeMetaAds({meta, summary: {spend: 10, purchases: 0, purchaseValue: 0}}, asOf);
  assert.equal(data.summary.purchases, 0);
  assert.equal(data.summary.purchaseValue, 0);
  assert.equal(data.summary.roas, null);
  assert.equal(data.meta.attributionVerified, false);
});

test('v3 empty evidence overrides metrics and invalid currency blocks money', () => {
  const empty = normalizeMetaAds({meta: {...meta, rows: 0}, summary: {spend: 10}}, asOf);
  assert.equal(empty.meta.currency, null);
  assert.equal(empty.summary.spend, null);
  assert.equal(empty.meta.status, 'WAITING');
  for (const currency of ['', 'usd', 'USD/UAH', null]) {
    assert.equal(normalizeMetaAds({meta: {...meta, currency}, summary: {spend: 10}}, asOf).summary.spend, null);
  }
});
