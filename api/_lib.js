// Shared helpers for the API routes. Files starting with "_" are not deployed
// as their own Vercel functions.

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

// Returns the parsed JSON body, or null after sending an error response.
export function guard(req, res) {
  if (req.method !== "POST") { send(res, 405, { error: "Use POST" }); return null; }

  const password = process.env.APP_PASSWORD;
  if (password && req.headers["x-app-password"] !== password) {
    send(res, 401, { error: "Wrong or missing app password" });
    return null;
  }
  if (!process.env.OPENAI_API_KEY) {
    send(res, 500, { error: "OPENAI_API_KEY is not set on the server" });
    return null;
  }
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  return body && typeof body === "object" ? body : {};
}

export async function openai(path, payload) {
  const r = await fetch(`https://api.openai.com/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data?.error?.message || `OpenAI error (${r.status})`);
    err.status = r.status;
    throw err;
  }
  return data;
}

export const clip = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
