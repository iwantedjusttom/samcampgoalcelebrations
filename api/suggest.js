// POST /api/suggest -> { direction }
// Plans a creative direction with an OpenAI text model. Never generates an image.
import { send, guard, openai, clip } from "./_lib.js";
import {
  DIRECTION_FIELDS, OPTIONS, FILLER_OBJECTS, PREFS, PREF_DEFAULTS, isValidOption, findOption,
} from "../public/direction-options.js";

const MODEL = () => process.env.OPENAI_TEXT_MODEL || "gpt-5-mini";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["approach", "palette", "customColors", "composition", "tone", "concept", "subject", "perspective", "treatment", "rationale"],
  properties: {
    approach: { type: "string", enum: OPTIONS.approach.map((o) => o.value) },
    palette: { type: "string", enum: OPTIONS.palette.map((o) => o.value) },
    customColors: { type: "string", description: "3-5 named colors when palette is custom, otherwise empty" },
    composition: { type: "string", enum: OPTIONS.composition.map((o) => o.value) },
    tone: { type: "string", enum: OPTIONS.tone.map((o) => o.value) },
    concept: { type: "string", description: "1-2 sentence visual concept" },
    subject: { type: "string", description: "Primary subject or scene, short phrase" },
    perspective: { type: "string", description: "Viewpoint, short phrase" },
    treatment: { type: "string", description: "Rendering technique / medium, short phrase, or empty for fixed style" },
    rationale: { type: "string", description: "One sentence: why this suits the accomplishment" },
  },
};

const pref = (prefs, key) =>
  PREFS[key].some((o) => o.value === prefs?.[key]) ? prefs[key] : PREF_DEFAULTS[key];

function systemPrompt(prefs) {
  const text = {
    none: "The finished image will contain NO text at all, so the concept must not rely on words, letters, numbers, signs, or labels.",
    name: "The finished image will show only the person's name as text. Don't plan any other words, quotes, slogans, or labels.",
    name_goal: "The finished image will show only the person's name and a short goal phrase supplied separately. Don't plan any other words, quotes, slogans, or labels.",
  }[pref(prefs, "textMode")];

  const flex = {
    fixed: 'Treatment: return an empty string; the configured style is used exactly as written.',
    related: "Treatment: choose a rendering technique within the contemporary editorial-illustration family (e.g. gouache texture, risograph print, cut-paper collage, soft-shaded digital painting, screen print, geometric vector), ideally different from recent pieces.",
    experimental: "Treatment: you may go further afield (e.g. stylized 3D clay, stained glass, ink and watercolor wash, isometric miniature, mid-century modern, textile) as long as the result stays polished and true to the configured style's spirit.",
  }[pref(prefs, "flexibility")];

  const variety = {
    consistent: "Visual variety is CONSISTENT: keep this piece close to the recent series in approach, palette, and treatment, while still choosing a subject specific to this goal.",
    balanced: "Visual variety is BALANCED: don't repeat the subjects or metaphors of the most recent pieces; reusing an approach or palette now and then is fine.",
    high: "Visual variety is HIGH: choose a subject, scene, metaphor, perspective, approach, palette, and composition that clearly differ from the recent pieces, especially the last three.",
  }[pref(prefs, "variety")];

  return `You are the creative director for an ongoing series of celebration illustrations. Each piece honors one person completing one specific goal. Plan the next piece: a cohesive creative direction that (1) clearly connects to this specific accomplishment and person and (2) feels fresh within the series.

The series' shared sensibility: contemporary editorial illustration, thoughtful shapes and composition, appealing harmonious color, expressive simplicity, strong visual storytelling, polished and human-designed, full-frame square artwork, meaningful details instead of decorative clutter. Do not default to flat vector art, one texture, one palette, or one perspective.

Rules:
- Relevance first. The subject and metaphor must be specific to this accomplishment. Example: for "finished three songs", three oversized overlapping vinyl records with colorful geometric sound waves in a rhythmic arrangement. For "helped a teammate finish their tasks", a warm character-driven scene of two people collaborating. Never trade relevance for novelty.
- The subject must be concrete and drawable: describe what is seen.
- Avoid generic filler props (${FILLER_OBJECTS.join(", ")}) unless they are genuinely central to this concept.
- People, if any, are stylized illustrated characters, never a realistic likeness of a real person.
- ${text}
- ${flex}
- ${variety}
- Locked choices must be returned exactly as given.
- customColors: 3-5 named colors if palette is "custom", otherwise "".
- concept: 1-2 sentences. subject: short phrase. perspective: short phrase. rationale: one sentence.`;
}

function describeEntry(h, i) {
  const parts = DIRECTION_FIELDS.map((f) => findOption(f, h[f])?.label).filter(Boolean).join(" / ");
  const bits = [
    h.subject && `subject: ${clip(h.subject, 120)}`,
    h.concept && `concept: ${clip(h.concept, 220)}`,
    h.treatment && `treatment: ${clip(h.treatment, 80)}`,
    h.perspective && `perspective: ${clip(h.perspective, 60)}`,
  ].filter(Boolean).join("; ");
  return `${i + 1}. [${clip(h.category, 40)}] ${parts}${bits ? ` — ${bits}` : ""}`;
}

function userPrompt(b) {
  const locked = DIRECTION_FIELDS
    .filter((f) => isValidOption(f, b.locked?.[f]))
    .map((f) => `${f}=${b.locked[f]}${f === "palette" && b.locked[f] === "custom" ? ` (colors: ${clip(b.locked.customColors, 200)})` : ""}`);
  const history = Array.isArray(b.history) ? b.history.slice(0, 10) : [];
  const avoid = Array.isArray(b.avoid) ? b.avoid.slice(0, 8) : [];
  const options = DIRECTION_FIELDS
    .map((f) => `${f}: ${OPTIONS[f].map((o) => `${o.value} (${o.label})`).join(", ")}`)
    .join("\n");

  return [
    `Celebration: ${clip(b.category, 60) || "a goal"}`,
    `Goal: ${clip(b.goal, 1500) || "(not described)"}`,
    b.notes && `Details about this win: ${clip(b.notes, 1500)}`,
    b.description && `About ${clip(b.name, 80) || "them"}: ${clip(b.description, 3000)}`,
    b.style && `Configured image style: ${clip(b.style, 1500)}`,
    `Locked choices (use exactly): ${locked.length ? locked.join(", ") : "none"}`,
    history.length
      ? `Recent pieces in the series, most recent first:\n${history.map(describeEntry).join("\n")}`
      : "There are no previous pieces yet.",
    avoid.length &&
      `Already proposed for this goal. Propose something meaningfully different: a different subject and metaphor, and different unlocked choices:\n${avoid.map(describeEntry).join("\n")}`,
    `Available options:\n${options}`,
  ].filter(Boolean).join("\n\n");
}

export default async function handler(req, res) {
  const body = guard(req, res);
  if (!body) return;

  const model = MODEL();
  const payload = {
    model,
    messages: [
      { role: "system", content: systemPrompt(body.prefs) },
      { role: "user", content: userPrompt(body) },
    ],
    response_format: { type: "json_schema", json_schema: { name: "creative_direction", strict: true, schema: SCHEMA } },
  };
  if (/^(gpt-5|o\d)/.test(model)) payload.reasoning_effort = "low";

  let raw;
  try {
    const data = await openai("chat/completions", payload);
    const msg = data?.choices?.[0]?.message;
    if (msg?.refusal) return send(res, 502, { error: `The model declined: ${msg.refusal}` });
    raw = JSON.parse(msg?.content || "");
  } catch (err) {
    if (err instanceof SyntaxError) return send(res, 502, { error: "The suggestion came back malformed. Try again." });
    return send(res, err.status || 500, { error: err.status ? err.message : `Request to OpenAI failed: ${err.message}` });
  }

  // Validate everything; anything invalid becomes null so the client keeps its current value.
  const direction = {};
  for (const f of DIRECTION_FIELDS) {
    direction[f] = isValidOption(f, body.locked?.[f]) ? body.locked[f] : isValidOption(f, raw?.[f]) ? raw[f] : null;
  }
  direction.customColors = direction.palette === "custom"
    ? clip(body.locked?.palette === "custom" ? body.locked.customColors : raw?.customColors, 200)
    : "";
  if (direction.palette === "custom" && !direction.customColors) direction.palette = null;
  direction.concept = clip(raw?.concept, 600);
  direction.subject = clip(raw?.subject, 200);
  direction.perspective = clip(raw?.perspective, 80);
  direction.treatment = pref(body.prefs, "flexibility") === "fixed" ? "" : clip(raw?.treatment, 120);
  direction.rationale = clip(raw?.rationale, 400);

  if (!direction.concept) return send(res, 502, { error: "The suggestion was missing a concept. Try again." });
  return send(res, 200, { direction });
}
