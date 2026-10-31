// Shared helpers for the API routes. Files starting with "_" are not deployed
// as their own Vercel functions.

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

// Returns the parsed JSON body, or null after sending an error response.
export function guard(req, res, { needsOpenAI = true } = {}) {
  if (req.method !== "POST") { send(res, 405, { error: "Use POST" }); return null; }

  const password = process.env.APP_PASSWORD;
  if (password && req.headers["x-app-password"] !== password) {
    send(res, 401, { error: "Wrong or missing app password" });
    return null;
  }
  if (needsOpenAI && !process.env.OPENAI_API_KEY) {
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

// OpenAI retires model names regularly. Try each candidate in order, moving on
// only when the error says the model itself is unavailable.
const MODEL_GONE = /model.*(does not exist|not found|deprecated|shut ?down|retired|no longer|not supported)|do(es)? not have access to (the )?model|invalid model|unknown model/i;

export function modelList(envValue, defaults) {
  const fromEnv = (envValue || "").split(",").map((m) => m.trim()).filter(Boolean);
  return [...new Set([...fromEnv, ...defaults])];
}

export async function openaiWithFallback(path, models, buildPayload, envName = "OPENAI_IMAGE_MODEL") {
  const tried = [];
  for (const model of models) {
    try {
      const data = await openai(path, buildPayload(model));
      return { data, model };
    } catch (err) {
      const gone = err.status === 404 || MODEL_GONE.test(err.message);
      if (!gone) throw err;
      tried.push(model);
    }
  }
  throw Object.assign(
    new Error(`None of these OpenAI models are available to your account: ${tried.join(", ")}. Set a current model name in the ${envName} environment variable.`),
    { status: 502 },
  );
}
