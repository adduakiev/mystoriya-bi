import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMerchant, merchantPresence } from '../lib/data/merchant-contract.ts';
import { formatMetric } from '../lib/digital-quality.ts';

test('Merchant positive rows preserve null fields independently across performance/catalog/products/health', () => {
  for (const missing of [null, undefined, '', ' ', false, {}, Infinity, 'bad']) {
    const data = normalizeMerchant({meta:{performanceRows:3,catalogRows:2,healthRows:1},
      performance:{impressions:missing,clicks:0,conversions:missing,ctr:missing,products:1},
      catalog:{rows:2,inStock:0,outOfStock:missing,withPrice:missing},
      topProducts:[{product_id:'fixture',impressions:missing,clicks:0,conversions:missing,ctr:missing}],
      health:[{active_count:missing,disapproved_count:0,pending_count:missing,expiring_count:missing}]});
    assert.equal(merchantPresence(data.meta),'PARTIAL');
    for (const value of [data.performance.impressions,data.performance.conversions,data.performance.ctr,
      data.catalog.outOfStock,data.catalog.withPrice,data.topProducts[0].impressions,
      data.topProducts[0].conversions,data.topProducts[0].ctr,data.health[0].activeCount,
      data.health[0].pendingCount,data.health[0].expiringCount]) {
      assert.equal(value,null); assert.equal(formatMetric(value),'—');
    }
    for (const value of [data.performance.clicks,data.catalog.inStock,data.topProducts[0].clicks,
      data.health[0].disapprovedCount]) { assert.equal(value,0); assert.equal(formatMetric(value),'0'); }
  }
});

test('Merchant measured zero in every numeric field survives positive source counts', () => {
  const data=normalizeMerchant({meta:{performanceRows:1,catalogRows:1,healthRows:1},
    performance:{impressions:0,clicks:'0',conversions:0,ctr:0,products:0},
    catalog:{rows:0,inStock:0,outOfStock:0,withPrice:0},
    topProducts:[{impressions:0,clicks:0,conversions:0,ctr:0}],
    health:[{active_count:0,disapproved_count:0,pending_count:0,expiring_count:0}]});
  for(const value of [...Object.values(data.performance),...Object.values(data.catalog),
    ...['impressions','clicks','conversions','ctr'].map(k=>data.topProducts[0][k]),
    ...['activeCount','disapprovedCount','pendingCount','expiringCount'].map(k=>data.health[0][k])]) {
    assert.equal(value,0); assert.equal(formatMetric(value),'0');
  }
});

test('Merchant missing source row counts differ from confirmed zero and partial counts', () => {
  const empty=normalizeMerchant({meta:{performanceRows:0,catalogRows:'0',healthRows:0}});
  assert.equal(merchantPresence(empty.meta),'WAITING');
  assert.equal(empty.meta.performanceRows,0);
  for(const count of [null,undefined,-1,0.5,'bad',false]) {
    const data=normalizeMerchant({meta:{performanceRows:count,catalogRows:0,healthRows:0}});
    assert.equal(data.meta.performanceRows,null);
    assert.equal(merchantPresence(data.meta),'UNKNOWN');
  }
  assert.equal(merchantPresence(normalizeMerchant({}).meta),'UNKNOWN');
  assert.equal(merchantPresence(normalizeMerchant({meta:{catalogRows:2}}).meta),'PARTIAL');
  assert.equal(normalizeMerchant({}).catalog.rows,null);
});
