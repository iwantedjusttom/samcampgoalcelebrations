// POST /api/suggest -> { plan: { composition, concept, subjects, colors } }
// Interprets the accomplishment and plans a concrete visual concept and
// composition type. Never generates an image.
import { send, guard, openaiWithFallback, modelList, clip } from "./_lib.js";
import { COMPOSITIONS, FILLER_OBJECTS, isValidComposition, findComposition } from "../public/direction-options.js";

// First available wins. OPENAI_TEXT_MODEL (comma-separated) is tried before these.
const TEXT_MODELS = ["gpt-5.4-mini", "gpt-5.6-terra", "gpt-5-mini", "gpt-4.1-mini"];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["composition", "concept", "subjects", "colors"],
  properties: {
    composition: { type: "string", enum: COMPOSITIONS.map((c) => c.value) },
    concept: { type: "string", description: "1-2 sentence concrete visual concept" },
    subjects: { type: "string", description: "Main subjects/objects, comma-separated" },
    colors: { type: "string", description: "3-5 dominant colors, comma-separated" },
  },
};

const TEXT_RULES = {
  none: "The finished image will contain NO text, so the concept must not rely on words, letters, numbers, signs, or labels.",
  name: "The finished image will show only the person's name as text. Don't plan any other words, quotes, or labels.",
  name_goal: "The finished image will show only the person's name and a short goal phrase supplied separately. Don't plan any other words, quotes, or labels.",
};

function systemPrompt(textMode) {
  return `You plan illustrations for an ongoing collection that celebrates people completing specific goals. Every piece shares one artistic identity (given as the image style). Your job is to decide WHAT this piece shows and HOW it is organized, never to change the art style.

Work in this order:
1. Interpret the accomplishment and any personal context: what was actually achieved, and what makes it meaningful for this person.
2. Choose one concrete, specific visual concept built from recognizable subjects and meaningful details.
3. Choose the composition type that best serves that concept. Composition types describe organization, not style. For example, finishing an album could be object-focused artwork of instruments and recording equipment, an illustrated environment of a recording studio, or an abstract composition of rhythmic musical forms, and all three would belong to the same collection.

Composition types:
${COMPOSITIONS.map((c) => `- ${c.value}: ${c.prompt}`).join("\n")}

Rules:
- Relevance first. Never pick an unsuitable composition or subject just to be different.
- Avoid repeating the props, visual metaphors, scene structures, and dominant colors of recent pieces. When the composition type is up to you, prefer one not used in the last few pieces if it suits the concept.
- Avoid generic filler props (${FILLER_OBJECTS.join(", ")}) unless they are genuinely central to this concept.
- People, if any, are stylized illustrated characters, never a realistic likeness of a real person.
- colors: 3-5 dominant colors that suit this concept and stay sophisticated but vibrant, in keeping with the image style.
- ${TEXT_RULES[textMode] || TEXT_RULES.none}
- If a composition type is fixed, return it exactly and plan the concept within it.`;
}

function describe(h, i) {
  const bits = [
    findComposition(h.composition)?.label,
    h.subjects && `subjects: ${clip(h.subjects, 160)}`,
    h.colors && `colors: ${clip(h.colors, 100)}`,
    h.concept && `concept: ${clip(h.concept, 220)}`,
  ].filter(Boolean);
  return `${i + 1}. [${clip(h.category, 40)}] ${bits.join("; ")}`;
}

function userPrompt(b) {
  const fixed = isValidComposition(b.composition) ? b.composition : null;
  const history = Array.isArray(b.history) ? b.history.slice(0, 10) : [];
  const avoid = Array.isArray(b.avoid) ? b.avoid.slice(0, 8) : [];
  return [
    `Celebration: ${clip(b.category, 60) || "a goal"}`,
    `Accomplishment: ${clip(b.goal, 1500) || "(not described)"}`,
    b.notes && `Details about this win: ${clip(b.notes, 1500)}`,
    b.description && `About ${clip(b.name, 80) || "them"}: ${clip(b.description, 3000)}`,
    b.style && `Image style (the collection's artistic identity): ${clip(b.style, 1500)}`,
    fixed ? `Composition type is fixed: ${fixed}` : "Composition type: your choice.",
    history.length ? `Recent pieces, most recent first:\n${history.map(describe).join("\n")}` : "There are no previous pieces yet.",
    avoid.length && `Already proposed for this goal. Propose something meaningfully different (different subjects and metaphor${fixed ? "" : ", and a different composition type if another one suits"}):\n${avoid.map(describe).join("\n")}`,
  ].filter(Boolean).join("\n\n");
}

export default async function handler(req, res) {
  const body = guard(req, res);
  if (!body) return;

  const messages = [
    { role: "system", content: systemPrompt(body.textMode) },
    { role: "user", content: userPrompt(body) },
  ];
  const buildPayload = (model) => {
    const payload = {
      model,
      messages,
      response_format: { type: "json_schema", json_schema: { name: "visual_plan", strict: true, schema: SCHEMA } },
    };
    if (/^(gpt-5|o\d)/.test(model)) payload.reasoning_effort = "low";
    return payload;
  };

  let raw;
  try {
    const { data } = await openaiWithFallback("chat/completions", modelList(process.env.OPENAI_TEXT_MODEL, TEXT_MODELS), buildPayload);
    const msg = data?.choices?.[0]?.message;
    if (msg?.refusal) return send(res, 502, { error: `The model declined: ${msg.refusal}` });
    raw = JSON.parse(msg?.content || "");
  } catch (err) {
    if (err instanceof SyntaxError) return send(res, 502, { error: "The plan came back malformed. Try again." });
    return send(res, err.status || 500, { error: err.status ? err.message : `Request to OpenAI failed: ${err.message}` });
  }

  const fixed = isValidComposition(body.composition) ? body.composition : null;
  const plan = {
    composition: fixed || (isValidComposition(raw?.composition) ? raw.composition : null),
    concept: clip(raw?.concept, 600),
    subjects: clip(raw?.subjects, 300),
    colors: clip(raw?.colors, 200),
  };
  if (!plan.concept) return send(res, 502, { error: "The plan was missing a concept. Try again." });
  return send(res, 200, { plan });
}
