// POST /api/generate  { prompt, quality? }  ->  { image: "data:image/jpeg;base64,..." }
import { send, guard, openaiWithFallback, modelList } from "./_lib.js";

// First available wins. OPENAI_IMAGE_MODEL (comma-separated) is tried before these.
const IMAGE_MODELS = ["gpt-image-2.5-sunburst", "gpt-image-2.5-flare", "gpt-image-2"];

export default async function handler(req, res) {
  const body = guard(req, res);
  if (!body) return;

  const prompt = (body.prompt || "").trim();
  const quality = ["low", "medium", "high"].includes(body.quality) ? body.quality : "high";
  if (!prompt) return send(res, 400, { error: "Prompt is empty" });

  try {
    const { data, model } = await openaiWithFallback("images/generations", modelList(process.env.OPENAI_IMAGE_MODEL, IMAGE_MODELS), (model) => ({
      model,
      prompt,
      size: "1024x1024", // closest supported square; the browser exports it at 1000x1000
      quality,
      n: 1,
      output_format: "jpeg", // keeps the response well under serverless size limits
      output_compression: 95,
    }));
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return send(res, 502, { error: "OpenAI returned no image" });
    return send(res, 200, {
      image: `data:image/jpeg;base64,${b64}`,
      revisedPrompt: data.data[0].revised_prompt || null,
      model,
    });
  } catch (err) {
    return send(res, err.status || 500, { error: err.status ? err.message : `Request to OpenAI failed: ${err.message}` });
  }
}
