// Shared by the browser (public/app.js) and the server (api/suggest.js) so the
// planner's answers are validated against the same list.

// Composition types describe how an image is ORGANIZED. They never change the
// art style, which always comes from the Image Style field.
export const COMPOSITIONS = [
  { value: "abstract", label: "Abstract composition", prompt: "an abstract composition: the accomplishment distilled into rhythmic, overlapping shapes and forms drawn from its subject matter, still recognizably about it" },
  { value: "character", label: "Character-driven illustration", prompt: "a character-driven illustration: stylized illustrated characters whose actions tell the story" },
  { value: "object", label: "Object-focused artwork", prompt: "object-focused artwork: a rich, layered arrangement of meaningful objects connected to the accomplishment" },
  { value: "environment", label: "Illustrated environment", prompt: "an illustrated environment: an immersive place or scene where the accomplishment lives" },
  { value: "conceptual", label: "Conceptual storytelling", prompt: "conceptual storytelling: one clever visual metaphor that tells the story of the accomplishment" },
];

export const TEXT_MODES = [
  { value: "none", label: "None" },
  { value: "name", label: "Name only" },
  { value: "name_goal", label: "Name and goal" },
];

export const FILLER_OBJECTS = [
  "coffee cups", "notebooks", "pencils", "desks", "potted plants",
  "mountains", "trophies", "medals", "confetti", "balloons",
];

export const findComposition = (value) => COMPOSITIONS.find((c) => c.value === value) || null;
export const isValidComposition = (value) => !!findComposition(value);
