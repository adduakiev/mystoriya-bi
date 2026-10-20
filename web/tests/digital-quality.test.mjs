import test from "node:test";
import assert from "node:assert/strict";
import { metricNumber, metricRatio, snapshotDate } from "../lib/digital-quality.ts";

test("undefined acquisition costs stay missing while a measured zero stays zero", () => {
  assert.equal(metricRatio(500, 0), null);
  assert.equal(metricRatio(null, 10), null);
  assert.equal(metricRatio(0, 10), 0);
  assert.equal(metricRatio("500", "10"), 50);
  for (const value of [undefined, "", " ", false, {}, Infinity, "NaN"])
    assert.equal(metricNumber(value), null);
});

test("snapshot selection accepts an older snapshot without leaking future data", () => {
  assert.equal(snapshotDate("2026-10-12", "2026-10-17"), "2026-10-12");
  assert.equal(snapshotDate("2026-10-17", "2026-10-17"), "2026-10-17");
  assert.equal(snapshotDate("2026-10-18", "2026-10-17"), null);
  assert.equal(snapshotDate(undefined, "2026-10-17"), null);
  assert.equal(snapshotDate("2026-02-30", "2026-10-17"), null);
});
