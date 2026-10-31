// Local dev server: serves ./public and routes POST /api/* to the same
// handlers Vercel uses. Run with:  OPENAI_API_KEY=sk-... npm run dev
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import generate from "./api/generate.js";
import data from "./api/data.js";
import explain from "./api/explain.js";

const routes = { "/api/generate": generate, "/api/data": data, "/api/explain": explain };

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const PORT = process.env.PORT || 3000;

// Minimal .env loader so you can keep your key in a .env file locally.
try {
  for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

http.createServer(async (req, res) => {
  const urlPath = req.url.split("?")[0];
  if (routes[urlPath]) {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    req.body = raw;
    return routes[urlPath](req, res);
  }
  const file = path.join(root, urlPath === "/" ? "index.html" : urlPath);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.statusCode = 404;
    return res.end("Not found");
  }
  res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Goal Celebrations running at http://localhost:${PORT}`));
