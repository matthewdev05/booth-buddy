// api/stats.js
// Private usage numbers for Booth Buddy.
// Open: https://YOUR-APP.vercel.app/api/stats?key=YOUR_STATS_KEY

import { hasDatabase, redis, today } from "../lib/redis.js";

export default async function handler(req, res) {
  if (!process.env.STATS_KEY || req.query?.key !== process.env.STATS_KEY) {
    return res.status(401).json({ error: "Not allowed" });
  }
  if (!hasDatabase) {
    return res.status(503).json({ error: "Database not connected yet" });
  }

  const days = Array.from({ length: 14 }, (_, i) => today(i)); // last 14 days
  const commands = [["SCARD", "bb:users"], ["GET", "bb:notes"]];
  for (const day of days) {
    commands.push(["SCARD", `bb:users:${day}`], ["GET", `bb:notes:${day}`]);
  }
  const results = (await redis(commands)).map((r) => Number(r.result || 0));

  const byDay = days
    .map((day, i) => ({ day, users: results[2 + i * 2], notes: results[3 + i * 2] }))
    .filter((d) => d.users || d.notes);

  return res.status(200).json({
    totalUsers: results[0],
    totalNotes: results[1],
    byDay,
  });
}
