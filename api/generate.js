// POST /api/generate  { prompt, quality? }  ->  { image: "data:image/jpeg;base64,..." }
// Works as a Vercel serverless function and is also used by server.js locally.

const OPENAI_URL = "https://api.openai.com/v1/images/generations";

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });

  const password = process.env.APP_PASSWORD;
  if (password && req.headers["x-app-password"] !== password) {
    return send(res, 401, { error: "Wrong or missing app password" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return send(res, 500, { error: "OPENAI_API_KEY is not set on the server" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const prompt = (body?.prompt || "").trim();
  const quality = ["low", "medium", "high"].includes(body?.quality) ? body.quality : "high";
  if (!prompt) return send(res, 400, { error: "Prompt is empty" });

  try {
    const r = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
        prompt,
        size: "1024x1024", // closest supported square; the browser exports it at 1000x1000
        quality,
        n: 1,
        output_format: "jpeg", // keeps the response well under serverless size limits
        output_compression: 95,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return send(res, r.status, { error: data?.error?.message || `OpenAI error (${r.status})` });
    }
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return send(res, 502, { error: "OpenAI returned no image" });
    return send(res, 200, {
      image: `data:image/jpeg;base64,${b64}`,
      revisedPrompt: data.data[0].revised_prompt || null,
    });
  } catch (err) {
    return send(res, 500, { error: `Request to OpenAI failed: ${err.message}` });
  }
}
