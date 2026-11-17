import test from "node:test";
import assert from "node:assert/strict";
import { WEBSITE_RELAUNCH, websiteEventPeriod, websiteEventDay } from "../lib/data/business-events.ts";

test("owner relaunch time is Kyiv 09:00, UTC 07:00", () => {
  assert.equal(new Date(WEBSITE_RELAUNCH.at).toISOString(), "2026-11-16T07:00:00.000Z");
  assert.equal(websiteEventPeriod("2026-11-16T06:00:00Z", "2026-11-16T07:00:00Z"), "before");
  assert.equal(websiteEventPeriod("2026-11-16T09:00:00+02:00", "2026-11-16T10:00:00+02:00"), "after");
  assert.equal(websiteEventPeriod("2026-11-16T06:00:00Z", "2026-11-16T08:00:00Z"), "mixed");
});
test("daily/weekly/monthly windows crossing launch are mixed, not old/new site proof", () => {
  assert.equal(websiteEventDay("2026-11-15"), "before");
  assert.equal(websiteEventDay("2026-11-16"), "mixed");
  assert.equal(websiteEventDay("2026-11-17"), "after");
  assert.equal(websiteEventPeriod("2026-11-16T00:00:00+02:00", "2026-11-23T00:00:00+02:00"), "mixed");
  for (const day of ["2026-02-30", "2026-13-01", "", "2026-11-16T07:00Z"]) assert.equal(websiteEventDay(day), "unknown");
  assert.equal(websiteEventPeriod("2026-11-16T08:00:00", "2026-11-16T10:00:00"), "unknown");
  assert.equal(websiteEventPeriod("2026-11-17T08:00:00Z", "2026-11-16T10:00:00Z"), "unknown");
});
