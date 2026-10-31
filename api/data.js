// POST /api/data { action, ... } — cloud storage for people, settings, and
// generation history in Neon Postgres. Without DATABASE_URL it answers 501 and
// the app keeps working from localStorage only.
import { neon } from "@neondatabase/serverless";
import { send, guard } from "./_lib.js";

const MAX_JSON = 200_000; // bytes per record
const HISTORY_LIMIT = 50;

let sqlClient = null;
let schemaReady = null;

// Exposed so tests can inject a fake client.
export function setSqlForTests(fake) { sqlClient = fake; schemaReady = null; }

function getSql() {
  if (sqlClient) return sqlClient;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return null;
  sqlClient = neon(url);
  return sqlClient;
}

function ensureSchema(sql) {
  schemaReady ??= sql.transaction([
    sql`CREATE TABLE IF NOT EXISTS people (
      seq BIGSERIAL, id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    sql`CREATE TABLE IF NOT EXISTS settings (
      id INT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    sql`CREATE TABLE IF NOT EXISTS history (
      id BIGSERIAL PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  ]).catch((err) => { schemaReady = null; throw err; });
  return schemaReady;
}

const json = (v) => {
  const s = JSON.stringify(v);
  if (s.length > MAX_JSON) throw Object.assign(new Error("Record too large"), { status: 413 });
  return s;
};
const validPerson = (p) => p && typeof p === "object" && typeof p.id === "string" && p.id.length > 0 && p.id.length <= 100;
const validSettings = (s) => s && typeof s === "object" && !Array.isArray(s);

function upsertPerson(sql, p) {
  return sql`INSERT INTO people (id, data) VALUES (${p.id}, ${json(p)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
}
function saveSettings(sql, s) {
  return sql`INSERT INTO settings (id, data) VALUES (1, ${json(s)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
}
function insertHistory(sql, h) {
  return sql`INSERT INTO history (data) VALUES (${json(h)}::jsonb)`;
}
const trimHistory = (sql) =>
  sql`DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY id DESC LIMIT ${HISTORY_LIMIT})`;

async function load(sql) {
  const [people, settings, history] = await Promise.all([
    sql`SELECT data FROM people ORDER BY seq`,
    sql`SELECT data FROM settings WHERE id = 1`,
    sql`SELECT data FROM history ORDER BY id DESC LIMIT ${HISTORY_LIMIT}`,
  ]);
  return {
    people: people.map((r) => r.data),
    settings: settings[0]?.data || null,
    history: history.map((r) => r.data),
  };
}

// Replace everything (used by "Import backup" and the first upload from a browser).
function replaceAll(sql, body, { onlyIfEmpty = false } = {}) {
  const people = (Array.isArray(body.people) ? body.people : []).filter(validPerson);
  const history = (Array.isArray(body.history) ? body.history : []).slice(0, HISTORY_LIMIT).reverse(); // oldest first
  const queries = [
    sql`DELETE FROM people`,
    sql`DELETE FROM history`,
    ...people.map((p) => upsertPerson(sql, p)),
    ...history.filter((h) => h && typeof h === "object").map((h) => insertHistory(sql, h)),
  ];
  if (validSettings(body.settings)) queries.push(saveSettings(sql, body.settings));
  if (!onlyIfEmpty) return sql.transaction(queries);
  // Seeding must never clobber data another device already uploaded.
  return sql`SELECT count(*)::int AS n FROM people`.then(([{ n }]) => (n > 0 ? "skipped" : sql.transaction(queries)));
}

export default async function handler(req, res) {
  const body = guard(req, res, { needsOpenAI: false });
  if (!body) return;
  const sql = getSql();
  if (!sql) return send(res, 501, { error: "No database configured", configured: false });

  try {
    await ensureSchema(sql);
    switch (body.action) {
      case "load":
        return send(res, 200, await load(sql));

      case "sync": {
        const queries = [];
        for (const p of Array.isArray(body.upsertPeople) ? body.upsertPeople : []) {
          if (!validPerson(p)) return send(res, 400, { error: "Invalid person record" });
          queries.push(upsertPerson(sql, p));
        }
        for (const id of Array.isArray(body.deletePeople) ? body.deletePeople : []) {
          if (typeof id === "string") queries.push(sql`DELETE FROM people WHERE id = ${id}`);
        }
        if (body.settings !== undefined) {
          if (!validSettings(body.settings)) return send(res, 400, { error: "Invalid settings" });
          queries.push(saveSettings(sql, body.settings));
        }
        if (queries.length) await sql.transaction(queries);
        return send(res, 200, { ok: true });
      }

      case "addHistory":
        if (!body.entry || typeof body.entry !== "object") return send(res, 400, { error: "Invalid history entry" });
        await sql.transaction([insertHistory(sql, body.entry), trimHistory(sql)]);
        return send(res, 200, { ok: true });

      case "clearHistory":
        await sql`DELETE FROM history`;
        return send(res, 200, { ok: true });

      case "seed": {
        const result = await replaceAll(sql, body, { onlyIfEmpty: true });
        return send(res, 200, { ok: true, skipped: result === "skipped" });
      }

      case "replace":
        await replaceAll(sql, body);
        return send(res, 200, { ok: true });

      default:
        return send(res, 400, { error: "Unknown action" });
    }
  } catch (err) {
    return send(res, err.status || 500, { error: `Database error: ${err.message}` });
  }
}
