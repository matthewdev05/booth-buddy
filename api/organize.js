// api/organize.js
// A Vercel serverless function. It runs on Vercel's servers, not in the browser,
// so your API key stays secret. The web page sends your notes here, this file
// asks Claude to organize them, and sends back clean JSON.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  const notes = (req.body?.notes || "").trim();
  if (!notes) {
    return res.status(400).json({ error: "No notes sent" });
  }

  const prompt = `You help a college student organize quick voice notes taken right after talking to a recruiter at AfroTech 2026, a tech conference in Houston. The notes may be messy dictated speech.


Notes:
"""${notes.slice(0, 4000)}"""

Reply with ONLY a JSON object, no other text, in exactly this shape.
Use "" for anything the notes don't say. Never invent names or facts.
{
  "name": "person's name",
  "company": "company",
  "role": "their job or team",
  "points": ["2-4 short key points they said"],
  "next": "the one next step",
  "linkedin": "a friendly LinkedIn connection note under 280 characters. It must say we met at AfroTech and mention one specific detail from the notes"
}`;

  try {
    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY, // set this in Vercel, never in code
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-5-5", // fast and cheap: a few cents covers hundreds of notes
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await apiRes.json();
    if (!apiRes.ok) {
      return res.status(502).json({ error: data?.error?.message || "AI request failed" });
    }

    // The reply can contain several blocks (for example, thinking). Keep only the text.
    const text = (data.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    // Pull out the JSON object, even if there's stray text around it.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      return res.status(502).json({ error: "AI reply had no JSON" });
    }
    const contact = JSON.parse(text.slice(start, end + 1));
    return res.status(200).json(contact);
  } catch (err) {
    return res.status(500).json({ error: "Something went wrong: " + err.message });
  }
}
