// tests/no-database.test.js
// With no database connected, the app must keep working and simply skip counting.

import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeRes, fakeRedis, installFakeFetch, claudeReply } from "./helpers.js";

process.env.ACCESS_CODE = "ATX26";
process.env.STATS_KEY = "test-stats-key";
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
const { default: organize } = await import("../api/organize.js");
const { default: stats } = await import("../api/stats.js");

test("organizing notes still works and never touches a database", async () => {
  const calls = installFakeFetch({ redis: fakeRedis(), aiReply: claudeReply('{"company":"NVIDIA"}') });
  const res = fakeRes();
  await organize({ method: "POST", body: { notes: "Met someone", code: "ATX26", uid: "aaaaaaaa-0001" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.company, "NVIDIA");
  assert.equal(calls.redis, 0);
});

test("the stats page says the database is not connected", async () => {
  const res = fakeRes();
  await stats({ query: { key: "test-stats-key" } }, res);
  assert.equal(res.statusCode, 503);
});
