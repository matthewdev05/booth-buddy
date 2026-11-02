// tests/page.test.js
// Checks on the web page and the company list that catch broken edits before they ship.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");

test("the page's own script has no syntax errors", () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length > 0, "expected an inline <script>");
  for (const code of scripts) new vm.Script(code); // throws on a syntax error
});

test("the page loads the company list and sends the access code and device ID", () => {
  assert.match(html, /<script src="companies\.js"><\/script>/);
  assert.match(html, /JSON\.stringify\(\{ notes, code, uid: getUserId\(\) \}\)/);
});

test("the page never contains a real access code or API key", () => {
  assert.doesNotMatch(html, /sk-ant-/);
  assert.doesNotMatch(html, /\bATX26\b/);
});

test("the server code never contains a real access code or API key", () => {
  for (const file of ["api/organize.js", "api/stats.js", "lib/redis.js"]) {
    const code = readFileSync(new URL(file, root), "utf8");
    assert.doesNotMatch(code, /sk-ant-/, file);
    assert.doesNotMatch(code, /\bATX26\b/, file);
  }
});

test("every company has the fields the page needs", () => {
  const sandbox = { window: {} };
  vm.runInNewContext(readFileSync(new URL("companies.js", root), "utf8"), sandbox);
  const companies = sandbox.window.COMPANIES;

  assert.equal(companies.length, 64);
  assert.equal(new Set(companies.map((c) => c.name)).size, companies.length, "duplicate company names");
  for (const c of companies) {
    assert.ok(c.name && c.industry && c.about, c.name);
    assert.equal(c.topics.length, 5, `${c.name} should have 5 topics`);
    if (c.booth) assert.match(c.booth, /^[A-Z]?\d+[A-Z]?$/, `${c.name} has an odd booth number`);
  }
});
