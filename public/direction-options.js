// Creative Direction vocabulary. Shared by the browser (public/app.js) and the
// server (api/suggest.js) so AI suggestions are validated against the same list.

export const DIRECTION_FIELDS = ["approach", "palette", "composition", "tone"];

export const FIELD_LABELS = {
  approach: "Illustration approach",
  palette: "Color palette",
  composition: "Composition",
  tone: "Emotional tone",
};

// `prompt` is the phrasing used inside the image prompt.
export const OPTIONS = {
  approach: [
    { value: "abstract", label: "Abstract / geometric", prompt: "abstract and geometric — express the achievement through shape, rhythm, and color rather than a literal scene" },
    { value: "character", label: "Character-driven", prompt: "character-driven — stylized illustrated figures whose actions tell the story" },
    { value: "object", label: "Object-focused", prompt: "object-focused — one or a few meaningful, symbolic objects staged with care" },
    { value: "environment", label: "Illustrated environment", prompt: "an illustrated environment — an immersive place or world that embodies the achievement" },
    { value: "conceptual", label: "Conceptual / metaphorical", prompt: "conceptual and metaphorical — a single clever visual idea that stands for the achievement" },
    { value: "poster", label: "Graphic poster", prompt: "a graphic poster — bold simplified shapes, flat color fields, and a strong silhouette" },
  ],
  palette: [
    { value: "warm", label: "Warm and vibrant", prompt: "warm and vibrant — saturated oranges, corals, golds, and magentas" },
    { value: "cool", label: "Cool and sophisticated", prompt: "cool and sophisticated — deep blues, teals, and slate with one refined accent" },
    { value: "earthy", label: "Earthy and muted", prompt: "earthy and muted — ochre, terracotta, olive, sand, and clay" },
    { value: "bold", label: "Bold and contrasting", prompt: "bold and contrasting — strong complementary pairs with high value contrast" },
    { value: "soft", label: "Soft and playful", prompt: "soft and playful — pastels and candy tones on light, airy grounds" },
    { value: "custom", label: "Custom colors", prompt: "" },
  ],
  composition: [
    { value: "fullframe", label: "Full-frame immersive", prompt: "full-frame and immersive, filling the square edge to edge" },
    { value: "dynamic", label: "Dynamic / diagonal", prompt: "dynamic, built on strong diagonals and movement across the frame" },
    { value: "centered", label: "Centered focal point", prompt: "a clear centered focal point with generous surrounding space" },
    { value: "asymmetric", label: "Asymmetrical", prompt: "asymmetrical, with deliberate balance and purposeful negative space" },
    { value: "pattern", label: "Pattern / repeating elements", prompt: "a pattern of repeating elements, with one meaningful variation that draws the eye" },
    { value: "collage", label: "Layered / collage", prompt: "layered like a collage, with overlapping planes that create depth" },
  ],
  tone: [
    { value: "joyful", label: "Joyful and energetic", prompt: "joyful and energetic" },
    { value: "warm", label: "Warm and meaningful", prompt: "warm and meaningful" },
    { value: "calm", label: "Calm and accomplished", prompt: "calm and quietly accomplished" },
    { value: "playful", label: "Playful and whimsical", prompt: "playful and whimsical" },
    { value: "triumphant", label: "Bold and triumphant", prompt: "bold and triumphant" },
    { value: "elegant", label: "Elegant and refined", prompt: "elegant and refined" },
  ],
};

// Used when "Consistent" variety has no history to stay consistent with.
export const NO_HISTORY_DEFAULTS = { approach: "conceptual", palette: "warm", composition: "centered", tone: "warm" };

export const PREFS = {
  variety: [
    { value: "consistent", label: "Consistent" },
    { value: "balanced", label: "Balanced" },
    { value: "high", label: "High" },
  ],
  flexibility: [
    { value: "fixed", label: "Fixed style" },
    { value: "related", label: "Related styles" },
    { value: "experimental", label: "Experimental" },
  ],
  textMode: [
    { value: "none", label: "None" },
    { value: "name", label: "Name only" },
    { value: "name_goal", label: "Name and goal" },
  ],
};
export const PREF_DEFAULTS = { variety: "high", flexibility: "related", textMode: "none" };

// Artistic treatments (rendering technique) for "Related" and "Experimental" flexibility.
export const TREATMENTS = {
  related: [
    "flat vector shapes with subtle paper grain",
    "gouache-textured editorial illustration",
    "risograph-style print with limited inks and slight misregistration",
    "cut-paper collage with soft cast shadows",
    "soft-shaded digital painting with gentle gradients",
    "screen-print style with crisp overlapping color layers",
    "colored pencil and marker texture",
    "linocut-inspired with carved texture",
  ],
  experimental: [
    "stylized 3D clay render",
    "stained-glass mosaic",
    "loose ink and watercolor wash",
    "isometric miniature world",
    "mid-century modern illustration",
    "embroidered textile look",
    "Bauhaus-inspired shape construction",
    "low-poly faceted 3D",
  ],
};

export const PERSPECTIVES = [
  "eye level",
  "bird's-eye view",
  "low angle looking up",
  "intimate close-up",
  "wide establishing view",
  "flat frontal view",
  "over-the-shoulder view",
];

export const FILLER_OBJECTS = [
  "coffee cups", "notebooks", "pencils", "desks", "potted plants",
  "mountains", "trophies", "medals", "confetti", "balloons",
];

export function findOption(field, value) {
  return OPTIONS[field]?.find((o) => o.value === value) || null;
}

export function isValidOption(field, value) {
  return !!findOption(field, value);
}
