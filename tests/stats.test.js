// tests/stats.test.js
// The private stats page: key check, totals, per-day numbers, and returning users.

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fakeRes, fakeRedis, installFakeFetch, claudeReply } from "./helpers.js";

process.env.ACCESS_CODE = "ATX26";
process.env.STATS_KEY = "test-stats-key";
process.env.KV_REST_API_URL = "https://fake-redis";
process.env.KV_REST_API_TOKEN = "test-token";
const { default: stats } = await import("../api/stats.js");
const { default: organize } = await import("../api/organize.js");

const realNow = Date.now;
let redis;
beforeEach(() => {
  redis = fakeRedis();
  installFakeFetch({ redis, aiReply: claudeReply('{"company":"Microsoft"}') });
});
afterEach(() => { Date.now = realNow; });

// Save one note from a device at a given time (Houston days are counted in Central time).
async function noteAt(iso, uid) {
  Date.now = () => Date.parse(iso);
  await organize({ method: "POST", body: { notes: "x", code: "ATX26", uid } }, fakeRes());
}

async function getStats(key) {
  Date.now = () => Date.parse("2026-11-06T18:00:00Z");
  const res = fakeRes();
  await stats({ query: { key } }, res);
  return res;
}

test("blocks requests without the stats key", async () => {
  assert.equal((await getStats(undefined)).statusCode, 401);
  assert.equal((await getStats("wrong")).statusCode, 401);
});

test("reports totals, returning users, and per-day numbers", async () => {
  const A = "aaaaaaaa-0001", B = "bbbbbbbb-0002", C = "cccccccc-0003";
  await noteAt("2026-11-03T15:00:00Z", A);
  await noteAt("2026-11-03T15:05:00Z", B);
  await noteAt("2026-11-03T15:10:00Z", C);
  await noteAt("2026-11-04T15:00:00Z", A);
  await noteAt("2026-11-04T16:00:00Z", A);
  await noteAt("2026-11-05T15:00:00Z", B);

  const res = await getStats("test-stats-key");
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.totalUsers, 3);
  assert.equal(res.body.totalNotes, 6);
  assert.equal(res.body.returningUsers, 2); // A and B came back on another day
  assert.equal(res.body.returningRate, "67%");
  assert.deepEqual(res.body.byDay, [
    { day: "2026-11-05", users: 1, notes: 1 },
    { day: "2026-11-04", users: 1, notes: 2 },
    { day: "2026-11-03", users: 3, notes: 3 },
  ]);
});

test("uses Houston time for days (a 11:30 PM note counts for that day)", async () => {
  await noteAt("2026-11-04T05:30:00Z", "dddddddd-0004"); // Nov 3, 11:30 PM in Houston
  const res = await getStats("test-stats-key");
  assert.deepEqual(res.body.byDay, [{ day: "2026-11-03", users: 1, notes: 1 }]);
});
