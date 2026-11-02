// tests/organize.test.js
// The note-organizing function: access code, input checks, AI reply parsing, and counting.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fakeRes, fakeRedis, installFakeFetch, claudeReply } from "./helpers.js";

// Environment must be set before the code under test is imported.
process.env.ACCESS_CODE = "ATX26";
process.env.KV_REST_API_URL = "https://fake-redis";
process.env.KV_REST_API_TOKEN = "test-token";
const { default: organize } = await import("../api/organize.js");

const GOOD_JSON = '{"name":"Maya","company":"Capital One","role":"Recruiter","points":["Apps open in January"],"next":"Connect on LinkedIn","linkedin":"Hi Maya, great meeting you at AfroTech!"}';
const USER = "aaaaaaaa-1111-2222-3333-444444444444";

let redis;
let calls;
beforeEach(() => {
  redis = fakeRedis();
  calls = installFakeFetch({ redis, aiReply: claudeReply("Here you go:\n" + GOOD_JSON) });
});

async function send(body, method = "POST") {
  const res = fakeRes();
  await organize({ method, body }, res);
  return res;
}

test("only accepts POST", async () => {
  const res = await send({}, "GET");
  assert.equal(res.statusCode, 405);
});

test("rejects a missing access code without calling the AI", async () => {
  const res = await send({ notes: "Met Maya" });
  assert.equal(res.statusCode, 401);
  assert.equal(calls.ai, 0);
});

test("rejects a wrong access code without calling the AI", async () => {
  const res = await send({ notes: "Met Maya", code: "WRONG" });
  assert.equal(res.statusCode, 401);
  assert.equal(calls.ai, 0);
});

test("accepts the access code in any case, with extra spaces", async () => {
  const res = await send({ notes: "Met Maya", code: "  atx26 " });
  assert.equal(res.statusCode, 200);
});

test("rejects empty notes", async () => {
  const res = await send({ notes: "   ", code: "ATX26" });
  assert.equal(res.statusCode, 400);
  assert.equal(calls.ai, 0);
});

test("returns the contact parsed from the AI reply, ignoring text around the JSON", async () => {
  const res = await send({ notes: "Met Maya at Capital One", code: "ATX26" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.company, "Capital One");
  assert.equal(res.body.name, "Maya");
  assert.deepEqual(res.body.points, ["Apps open in January"]);
});

test("returns 502 when the AI reply has no JSON", async () => {
  installFakeFetch({ redis, aiReply: claudeReply("Sorry, I can't help with that.") });
  const res = await send({ notes: "Met Maya", code: "ATX26" });
  assert.equal(res.statusCode, 502);
});

test("returns 502 with the AI's message when the AI request fails", async () => {
  installFakeFetch({ redis, aiStatus: 529, aiReply: { error: { message: "Overloaded" } } });
  const res = await send({ notes: "Met Maya", code: "ATX26" });
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, "Overloaded");
});

test("counts the note and the anonymous user", async () => {
  await send({ notes: "Met Maya", code: "ATX26", uid: USER });
  await send({ notes: "Met Sam", code: "ATX26", uid: USER });
  assert.equal(redis.values["bb:notes"], 2);
  assert.equal(redis.sets["bb:users"].size, 1);
});

test("does not count requests with a wrong access code", async () => {
  await send({ notes: "Met Maya", code: "WRONG", uid: USER });
  assert.equal(redis.values["bb:notes"], undefined);
});

test("counts the note but not the user when the device ID looks wrong", async () => {
  await send({ notes: "Met Maya", code: "ATX26", uid: "<script>" });
  assert.equal(redis.values["bb:notes"], 1);
  assert.equal(redis.sets["bb:users"], undefined);
});
