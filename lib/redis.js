// lib/redis.js
// Tiny helper for an Upstash Redis database (free, from Vercel's Storage tab).
// It talks to Redis over plain HTTPS, so no extra packages are needed.

const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const hasDatabase = Boolean(URL && TOKEN);

// Send several Redis commands in one request, e.g. [["INCR", "bb:notes"]].
export async function redis(commands) {
  const res = await fetch(`${URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error("Database error " + res.status);
  return res.json(); // one { result } per command
}

// Today's date in Houston time, like "2026-11-04".
export function today(offsetDays = 0) {
  const d = new Date(Date.now() - offsetDays * 86400000);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

// Count one organized note. Only a random device ID is stored: no names, no notes.
export async function countUsage(uid) {
  if (!hasDatabase) return;
  const day = today();
  const commands = [["INCR", "bb:notes"], ["INCR", `bb:notes:${day}`]];
  const id = String(uid || "");
  if (/^[\w-]{8,64}$/.test(id)) {
    commands.push(
      ["SADD", "bb:users", id],
      ["SADD", `bb:users:${day}`, id],
      ["SADD", `bb:days:${id}`, day] // which days this device used the app
    );
  }
  try { await redis(commands); } catch {} // counting must never break the app
}
