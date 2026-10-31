// POST /api/explain { prompt, image, recent? } -> { explanation }
// A vision model looks at the finished image next to the exact prompt that was
// sent and explains which instructions most likely drove the visual choices.
// The image model itself doesn't report its reasoning, so this is an analysis
// after the fact, not a transcript of the image model's thinking.
import { send, guard, openaiWithFallback, modelList, clip } from "./_lib.js";

// First available wins. OPENAI_TEXT_MODEL (comma-separated) is tried before these.
const VISION_MODELS = ["gpt-5.4-mini", "gpt-5.6-terra", "gpt-5-mini", "gpt-4.1-mini"];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "composition", "drivers", "repetition", "adjustments"],
  properties: {
    summary: { type: "string", description: "1-2 sentences: what the image shows" },
    composition: { type: "string", description: "Which composition style it ended up using, and why that fits the prompt" },
    drivers: {
      type: "array",
      description: "2-4 notes, each linking a visible choice to the prompt wording that most likely caused it",
      items: { type: "string" },
    },
    repetition: { type: "string", description: "Which prompt wording is most likely to keep producing similar images, comparing with recent images if given" },
    adjustments: {
      type: "array",
      description: "2-3 concrete edits to the master prompt or inputs that would change the result",
      items: { type: "string" },
    },
  },
};

const SYSTEM = `You review illustrations made by an image model from a text prompt. You did not make the image, and the image model does not report its reasoning, so infer: look at the image and the exact prompt, and explain which parts of the prompt most likely drove the visible choices (subject matter, metaphors, layout, composition style, use of color).

Be brief, concrete, and specific. Quote short phrases from the prompt when linking a choice to it. If something in the image isn't explained by the prompt, say it is the model's own default. When describing repetition, focus on prompt wording that strongly suggests one obvious reading (for example, a literal goal phrase that maps to the same objects every time). Suggested adjustments must be edits the user can make to the master prompt, goal wording, description, composition style, or palette. Never suggest adding people; the app forbids them.`;

export default async function handler(req, res) {
  const body = guard(req, res);
  if (!body) return;

  const prompt = clip(body.prompt, 12000);
  const image = typeof body.image === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(body.image) ? body.image : "";
  if (!prompt || !image) return send(res, 400, { error: "Need both the prompt and the image" });
  const recent = (Array.isArray(body.recent) ? body.recent : []).map((r) => clip(r, 300)).filter(Boolean).slice(0, 5);

  const userText = [
    "PROMPT SENT TO THE IMAGE MODEL:",
    prompt,
    recent.length ? `\nSHORT DESCRIPTIONS OF THE PREVIOUS IMAGES (most recent first):\n${recent.map((r, i) => `${i + 1}. ${r}`).join("\n")}` : "",
    "\nExplain this image (attached).",
  ].join("\n");

  const buildPayload = (model) => {
    const payload = {
      model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: image, detail: "low" } },
        ] },
      ],
      response_format: { type: "json_schema", json_schema: { name: "image_explanation", strict: true, schema: SCHEMA } },
    };
    if (/^(gpt-5|o\d)/.test(model)) payload.reasoning_effort = "low";
    return payload;
  };

  try {
    const { data, model } = await openaiWithFallback("chat/completions", modelList(process.env.OPENAI_TEXT_MODEL, VISION_MODELS), buildPayload, "OPENAI_TEXT_MODEL");
    const msg = data?.choices?.[0]?.message;
    if (msg?.refusal) return send(res, 502, { error: `The model declined: ${msg.refusal}` });
    const raw = JSON.parse(msg?.content || "");
    const list = (v) => (Array.isArray(v) ? v.map((x) => clip(x, 400)).filter(Boolean).slice(0, 4) : []);
    const explanation = {
      summary: clip(raw.summary, 500),
      composition: clip(raw.composition, 400),
      drivers: list(raw.drivers),
      repetition: clip(raw.repetition, 500),
      adjustments: list(raw.adjustments),
      model,
    };
    if (!explanation.summary) return send(res, 502, { error: "The explanation came back empty. Try again." });
    return send(res, 200, { explanation });
  } catch (err) {
    if (err instanceof SyntaxError) return send(res, 502, { error: "The explanation came back malformed." });
    return send(res, err.status || 500, { error: err.status ? err.message : `Request to OpenAI failed: ${err.message}` });
  }
}
