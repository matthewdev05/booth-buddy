// tests/helpers.js
// Shared fakes so tests never call the real AI or the real database.

// A fake Vercel response object that records what the handler sent back.
export function fakeRes() {
  return {
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

// A tiny in-memory Redis that understands the commands Booth Buddy uses.
export function fakeRedis() {
  const sets = {};
  const values = {};
  function run([cmd, key, value]) {
    if (cmd === "INCR") return (values[key] = (values[key] || 0) + 1);
    if (cmd === "GET") return values[key] ?? null;
    if (cmd === "SADD") { (sets[key] ||= new Set()).add(value); return 1; }
    if (cmd === "SCARD") return sets[key]?.size || 0;
    if (cmd === "SMEMBERS") return [...(sets[key] || [])];
    throw new Error("Fake Redis does not support " + cmd);
  }
  return { sets, values, run };
}

// Replace global fetch: Redis calls go to the fake database, AI calls return `aiReply`.
export function installFakeFetch({ redis, aiReply, aiStatus = 200 }) {
  const calls = { ai: 0, redis: 0 };
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("https://fake-redis")) {
      calls.redis++;
      const commands = JSON.parse(options.body);
      return { ok: true, json: async () => commands.map((c) => ({ result: redis.run(c) })) };
    }
    calls.ai++;
    return { ok: aiStatus === 200, json: async () => aiReply };
  };
  return calls;
}

// What the Claude API sends back: a thinking block, then the text answer.
export function claudeReply(text) {
  return { content: [{ type: "thinking", thinking: "..." }, { type: "text", text }] };
}
