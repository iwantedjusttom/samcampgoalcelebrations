// Goal Celebrations — all data lives in this browser's localStorage.
import {
  DIRECTION_FIELDS, FIELD_LABELS, OPTIONS, NO_HISTORY_DEFAULTS, PREFS, PREF_DEFAULTS,
  TREATMENTS, PERSPECTIVES, FILLER_OBJECTS, findOption, isValidOption,
} from "./direction-options.js";

const CATEGORIES = [
  { key: "professional", label: "Professional goal", hint: "What's their professional goal?" },
  { key: "personal", label: "Personal goal", hint: "What's their personal goal?" },
  { key: "contribution", label: "Contribution goal", hint: "What's their contribution goal?" },
  { key: "selfHonor", label: "Self-honor goal", hint: "What's their self-honor goal?" },
  { key: "pmEnrollments", label: "PM enrollments", hint: "Details on their PM enrollments" },
  { key: "greatnessNotes", label: "Greatness notes", hint: "Details on their greatness notes" },
];

// Layer B default: the shared artistic identity. Deliberately says nothing about
// a specific palette, composition, or medium so Creative Direction can vary them.
const DEFAULT_STYLE = `Contemporary editorial illustration with thoughtful shapes and composition, appealing harmonious color, and expressive simplicity. Strong visual storytelling with meaningful details rather than decorative clutter. Polished and human-designed, like a commissioned piece from a great illustrator.`;

const DEFAULT_TEMPLATE = `Create a celebration illustration for {{name}}, who just completed their {{goal_type}}.

GOAL CONTEXT
{{goal_context}}

ARTISTIC IDENTITY
{{artistic_identity}}

CREATIVE DIRECTION
{{creative_direction}}

VARIETY
{{variety}}

OUTPUT REQUIREMENTS
{{output}}`;

// Previous defaults, so saved copies that were never customized get upgraded.
const OLD_DEFAULT_STYLE = `Rich, polished editorial illustration with cinematic lighting and a warm, cohesive color palette. Clean composition with breathing room around the text. Feels like a keepsake poster worth sharing.`;
const OLD_DEFAULT_TEMPLATE = `Create a celebratory square (1:1) image honoring {{name}} for completing their {{goal_type}}.

WHAT THEY ACCOMPLISHED
{{goal}}
{{notes}}

WHO {{name}} IS — in the words of someone who knows and admires them
{{description}}

HOW TO USE THIS
- Make the image unmistakably personal. Draw the symbolism, setting, colors, and mood from who they are and from what this goal meant to them. Avoid generic trophies, medals, and confetti.
- The feeling should be pride, warmth, and momentum — a moment worth remembering.
- Don't attempt a realistic portrait of {{name}} (you don't know what they look like). Use symbolic imagery, a meaningful scene, or a figure seen from behind or in silhouette.
- Include the name "{{name}}" and a short, elegant headline celebrating this {{goal_type}} (for example "Goal Complete"). Keep all text short, spelled exactly right, and clearly legible.

STYLE
{{style}}`;

const LAYERS = ["goal_context", "artistic_identity", "creative_direction", "variety", "output"];
const LAYER_TITLES = {
  goal_context: "GOAL CONTEXT", artistic_identity: "ARTISTIC IDENTITY", creative_direction: "CREATIVE DIRECTION",
  variety: "VARIETY", output: "OUTPUT REQUIREMENTS",
};
const HISTORY_LIMIT = 50;   // stored
const HISTORY_WINDOW = 10;  // considered for variety

const STORE_KEY = "goalCelebrations.v1";
const $ = (id) => document.getElementById(id);

// ---------- state ----------
let state = load();
let previewEdited = false;
let lastImage = null;
let autoCache = {};         // internal resolution of "Auto" fields, stable until reset
let sessionSuggestions = []; // directions already proposed for the current goal
let goalWordingEdited = false;

function blankDirection() {
  return {
    approach: "auto", palette: "auto", composition: "auto", tone: "auto",
    locks: { approach: false, palette: false, composition: false, tone: false },
    customColors: "", concept: "", subject: "", treatment: "", perspective: "", rationale: "",
  };
}

function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch {}
  if (!s || !Array.isArray(s.people)) {
    s = { people: [], activeId: null, template: DEFAULT_TEMPLATE, style: DEFAULT_STYLE, quality: "high" };
  }
  if (!s.template || s.template === OLD_DEFAULT_TEMPLATE) s.template = DEFAULT_TEMPLATE;
  if (s.style === undefined || s.style === OLD_DEFAULT_STYLE) s.style = DEFAULT_STYLE;
  s.prefs = { ...PREF_DEFAULTS, ...(s.prefs || {}) };
  s.direction = { ...blankDirection(), ...(s.direction || {}) };
  s.direction.locks = { ...blankDirection().locks, ...(s.direction.locks || {}) };
  if (!Array.isArray(s.history)) s.history = [];
  return s;
}
function saveLocal() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function save() { saveLocal(); scheduleSync(); }
const active = () => state.people.find((p) => p.id === state.activeId);
const currentCategory = () => CATEGORIES.find((c) => c.key === $("goal-select").value) || CATEGORIES[0];
const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function newPerson() {
  const goals = {};
  for (const c of CATEGORIES) goals[c.key] = { text: "", done: false };
  const p = { id: crypto.randomUUID(), name: "", description: "", goals };
  state.people.push(p);
  state.activeId = p.id;
  save();
  onGoalChanged();
  render();
  $("name").focus();
}

// ---------- rendering ----------
function renderPeople() {
  const ul = $("people-list");
  ul.innerHTML = "";
  for (const p of state.people) {
    const li = document.createElement("li");
    li.textContent = p.name || "(unnamed)";
    if (p.id === state.activeId) li.className = "active";
    li.onclick = () => {
      if (state.activeId === p.id) return;
      state.activeId = p.id;
      save();
      onGoalChanged();
      render();
    };
    ul.appendChild(li);
  }
}

function renderProfile() {
  const p = active();
  $("empty-state").hidden = !!p;
  $("profile").hidden = !p;
  if (!p) return;
  $("name").value = p.name;
  $("description").value = p.description;

  const wrap = $("goals");
  wrap.innerHTML = "";
  for (const c of CATEGORIES) {
    const g = p.goals[c.key] || (p.goals[c.key] = { text: "", done: false });
    const div = document.createElement("div");
    div.className = "goal" + (g.done ? " done" : "");
    div.innerHTML = `
      <div class="goal-head">
        <strong>${c.label}</strong>
        <div class="actions">
          <label><input type="checkbox" ${g.done ? "checked" : ""}/> Complete</label>
          <button class="small">Celebrate →</button>
        </div>
      </div>
      <textarea rows="2" placeholder="${c.hint}"></textarea>`;
    const ta = div.querySelector("textarea");
    ta.value = g.text;
    ta.oninput = () => { g.text = ta.value; save(); refreshPreview(); };
    div.querySelector("input").onchange = (e) => {
      g.done = e.target.checked;
      div.classList.toggle("done", g.done);
      save();
    };
    div.querySelector("button").onclick = () => {
      if ($("goal-select").value !== c.key) {
        $("goal-select").value = c.key;
        state.goalKey = c.key;
        onGoalChanged();
        renderDirection();
      }
      refreshPreview();
      $("celebrate-panel").scrollIntoView({ behavior: "smooth" });
    };
    wrap.appendChild(div);
  }
}

function renderCelebrate() {
  const sel = $("goal-select");
  if (!sel.options.length) {
    for (const c of CATEGORIES) sel.add(new Option(c.label, c.key));
    if (CATEGORIES.some((c) => c.key === state.goalKey)) sel.value = state.goalKey;
  }
  $("template").value = state.template;
  $("style").value = state.style;
  $("quality").value = state.quality;
  for (const key of Object.keys(PREFS)) $(`pref-${key}`).value = state.prefs[key];
  renderDirection();
  renderHistory();
  refreshPreview();
}

function render() { renderPeople(); renderProfile(); renderCelebrate(); }

// ---------- Creative Direction UI ----------
function buildDirectionFields() {
  const wrap = $("direction-fields");
  for (const f of DIRECTION_FIELDS) {
    const label = document.createElement("label");
    label.innerHTML = `${FIELD_LABELS[f]}<div class="field-row"><select id="dir-${f}"></select><button class="lock" id="lock-${f}" type="button">🔒</button></div>`;
    wrap.appendChild(label);
    const sel = label.querySelector("select");
    sel.add(new Option("Auto", "auto"));
    for (const o of OPTIONS[f]) sel.add(new Option(o.label, o.value));
    sel.onchange = () => {
      const d = state.direction;
      d[f] = sel.value;
      d.locks[f] = sel.value !== "auto"; // a manual choice is a locked choice
      delete autoCache[f];
      save();
      renderDirection();
      refreshPreview();
    };
    label.querySelector("button").onclick = () => {
      const d = state.direction;
      if (d[f] === "auto") return;
      d.locks[f] = !d.locks[f];
      save();
      renderDirection();
    };
  }
}

function renderDirection() {
  const d = state.direction;
  for (const f of DIRECTION_FIELDS) {
    $(`dir-${f}`).value = d[f];
    const lock = $(`lock-${f}`);
    lock.disabled = d[f] === "auto";
    lock.classList.toggle("on", !!d.locks[f] && d[f] !== "auto");
    lock.title = d[f] === "auto" ? "Auto settings can't be locked" : d.locks[f] ? "Locked: suggestions won't change this. Click to unlock." : "Unlocked: suggestions may change this. Click to lock.";
  }
  $("custom-colors-wrap").hidden = d.palette !== "custom";
  $("custom-colors").value = d.customColors;
  $("concept").value = d.concept;
  $("subject").value = d.subject;
  $("treatment").value = d.treatment;
  $("perspective").value = d.perspective;
  $("treatment").placeholder = state.prefs.flexibility === "fixed" ? "Fixed: uses Image style" : "Auto";
  $("treatment").disabled = state.prefs.flexibility === "fixed";
  $("rationale").hidden = !d.rationale;
  $("rationale").textContent = d.rationale ? `Why it fits: ${d.rationale}` : "";
  $("try-another").disabled = false;
  renderSummary();
  renderGoalWording();
}

function renderSummary() {
  const d = state.direction;
  const allAuto = DIRECTION_FIELDS.every((f) => d[f] === "auto") && !d.concept;
  if (allAuto) { $("direction-summary").textContent = "· All Auto"; return; }
  const parts = DIRECTION_FIELDS.map((f) => (d[f] === "auto" ? "Auto" : findOption(f, d[f]).label) + (d.locks[f] && d[f] !== "auto" ? " 🔒" : ""));
  $("direction-summary").textContent = `· ${d.concept ? `“${truncate(d.concept, 70)}” · ` : ""}${parts.join(" · ")}`;
}

function renderGoalWording() {
  const show = state.prefs.textMode === "name_goal";
  $("goal-wording-wrap").hidden = !show;
  if (show && !goalWordingEdited) $("goal-wording").value = defaultGoalWording();
}

function defaultGoalWording() {
  const p = active();
  const cat = currentCategory();
  const goal = (p?.goals[cat.key]?.text || "").trim();
  if (goal && goal.length <= 48 && !goal.includes("\n")) return goal;
  return `${cat.label} complete`.replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderHistory() {
  const ol = $("history-list");
  ol.innerHTML = "";
  const items = state.history.slice(0, HISTORY_WINDOW);
  $("history-count").textContent = state.history.length ? `(${state.history.length} saved, last ${items.length} shown)` : "(none yet)";
  for (const h of items) {
    const li = document.createElement("li");
    const date = new Date(h.ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const settings = DIRECTION_FIELDS.map((f) => findOption(f, h[f])?.label).filter(Boolean).join(" · ");
    const what = h.concept || h.subject || "(concept chosen by the image model)";
    li.innerHTML = `<strong></strong> <span></span><br><em></em>`;
    li.querySelector("strong").textContent = `${date} · ${h.person || "?"} · ${h.category}`;
    li.querySelector("span").textContent = `— ${settings}${h.treatment ? ` · ${h.treatment}` : ""}`;
    li.querySelector("em").textContent = truncate(what, 160);
    ol.appendChild(li);
  }
  $("clear-history").hidden = !state.history.length;
}

// Called when the person or the goal being celebrated changes: the old concept
// no longer applies, but locked (manual) settings are kept.
function onGoalChanged() {
  const d = state.direction;
  for (const f of DIRECTION_FIELDS) if (!d.locks[f]) d[f] = "auto";
  if (!d.locks.palette) d.customColors = "";
  Object.assign(d, { concept: "", subject: "", treatment: "", perspective: "", rationale: "" });
  autoCache = {};
  sessionSuggestions = [];
  goalWordingEdited = false;
  save();
}

// ---------- Auto resolution & variety ----------
const recentHistory = () => state.history.slice(0, HISTORY_WINDOW);
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Choose a value for an Auto field, steering away from recent choices based on the variety preference.
function pickVaried(candidates, recent, fallback, variety = state.prefs.variety) {
  if (!candidates.length) return "";
  recent = recent.filter((v) => candidates.includes(v));
  if (variety === "consistent") {
    if (!recent.length) return candidates.includes(fallback) ? fallback : rand(candidates);
    const counts = {};
    for (const v of recent) counts[v] = (counts[v] || 0) + 1;
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  }
  const window = variety === "high" ? Math.max(1, candidates.length - 2) : 1;
  const avoid = new Set(recent.slice(0, window));
  const pool = candidates.filter((c) => !avoid.has(c));
  return rand(pool.length ? pool : candidates);
}

function treatmentCandidates() {
  if (state.prefs.flexibility === "fixed") return [];
  return state.prefs.flexibility === "experimental" ? [...TREATMENTS.related, ...TREATMENTS.experimental] : TREATMENTS.related;
}

// The direction actually used for the prompt: manual/suggested values win, Auto values are resolved once and cached.
function effectiveDirection() {
  const d = state.direction;
  const recent = recentHistory();
  const out = { auto: {} };
  for (const f of DIRECTION_FIELDS) {
    let v = d[f];
    if (v === "custom" && !d.customColors.trim()) v = "auto";
    if (v === "auto") {
      const candidates = OPTIONS[f].map((o) => o.value).filter((x) => x !== "custom");
      autoCache[f] ??= pickVaried(candidates, recent.map((h) => h[f]), NO_HISTORY_DEFAULTS[f]);
      v = autoCache[f];
      out.auto[f] = true;
    }
    out[f] = v;
  }
  out.customColors = out.palette === "custom" ? d.customColors.trim() : "";
  out.concept = d.concept.trim();
  out.subject = d.subject.trim();
  out.rationale = d.rationale.trim();
  if (state.prefs.flexibility === "fixed") out.treatment = "";
  else out.treatment = d.treatment.trim() || (autoCache.treatment ??= pickVaried(treatmentCandidates(), recent.map((h) => h.treatment), ""));
  out.perspective = d.perspective.trim() || (autoCache.perspective ??= pickVaried(PERSPECTIVES, recent.map((h) => h.perspective), "eye level"));
  return out;
}

// ---------- prompt layers ----------
function layerGoalContext(p, cat, goal, notes) {
  const name = p.name.trim() || "this person";
  return [
    `What they accomplished: ${goal || `their ${cat.label.toLowerCase()} (no further details given)`}`,
    notes && `Details about this win: ${notes}`,
    p.description.trim() && `Who ${name} is, in the words of someone who admires them: ${p.description.trim()}`,
    "Let the specifics of this accomplishment and this person shape the imagery, so it feels made for them rather than generic.",
  ].filter(Boolean).join("\n");
}

function layerArtisticIdentity(style, eff) {
  const lines = [];
  if (style) lines.push(style);
  const flex = state.prefs.flexibility;
  if (flex === "fixed") lines.push("Stay faithful to this style; do not switch medium or rendering technique.");
  else if (eff.treatment) {
    lines.push(flex === "experimental"
      ? `Rendering for this piece: ${eff.treatment}. An experimental departure, with the same care for composition and color.`
      : `Rendering for this piece: ${eff.treatment}. A variation within the same overall sensibility.`);
  }
  if (style) lines.push("Where the style above mentions specific colors, composition, or mood, the creative direction below takes precedence.");
  return lines.join("\n");
}

function layerCreativeDirection(eff) {
  const palette = eff.palette === "custom"
    ? `a custom palette built from ${eff.customColors}`
    : findOption("palette", eff.palette).prompt;
  return [
    eff.concept
      ? `Visual concept: ${eff.concept}`
      : "Visual concept: invent one clear, original visual idea that expresses this specific accomplishment.",
    eff.subject && `Main subject / scene: ${eff.subject}`,
    `Illustration approach: ${findOption("approach", eff.approach).prompt}.`,
    `Color palette: ${palette}.`,
    `Composition: ${findOption("composition", eff.composition).prompt}.`,
    eff.perspective && `Perspective: ${eff.perspective}.`,
    `Emotional tone: ${findOption("tone", eff.tone).prompt}.`,
  ].filter(Boolean).join("\n");
}

function layerVariety() {
  const filler = `Avoid generic filler props (${FILLER_OBJECTS.join(", ")}) unless they genuinely contribute to the concept.`;
  const recent = recentHistory();
  const variety = state.prefs.variety;
  if (!recent.length) return `Make this piece distinctive and specific to this achievement. ${filler}`;
  if (variety === "consistent") return `This piece belongs to an ongoing series; keep it visually consistent with recent pieces while making the subject specific to this achievement. ${filler}`;

  const list = recent.slice(0, variety === "high" ? HISTORY_WINDOW : 3)
    .map((h) => {
      const what = h.subject || (h.concept ? truncate(h.concept, 90) : null);
      const how = [findOption("approach", h.approach)?.label, findOption("palette", h.palette)?.label, findOption("composition", h.composition)?.label, h.perspective].filter(Boolean).join(", ");
      return `- ${what ? `${what} (${how})` : how}`;
    }).join("\n");
  const ask = variety === "high"
    ? "Choose subjects, scene, perspective, and visual metaphor that clearly differ from these."
    : "Don't repeat those subjects or scenes.";
  return `Recent pieces in this series:\n${list}\n${ask} ${filler} The creative direction above takes priority over these notes, and relevance to this achievement matters more than novelty.`;
}

function layerOutput(p) {
  const name = p.name.trim();
  const lines = [
    "Square 1:1 artwork that fills the full frame edge to edge: no borders, frames, mockups, or device screens.",
    "Polished and human-designed, with purposeful detail and no clutter.",
    "Any people are stylized illustrated characters. Do not attempt a realistic likeness of a real person.",
  ];
  const mode = state.prefs.textMode;
  const wording = ($("goal-wording").value.trim() || defaultGoalWording()).replace(/"/g, "'");
  if (mode === "none" || !name) {
    lines.push("Do not include any text: no lettering, words, letters, numbers, labels, signage, logos, slogans, or captions anywhere in the image, including on objects in the scene.");
  } else if (mode === "name") {
    lines.push(`The only text in the image is the name "${name}", shown once, spelled exactly, and clearly legible. No other words, numbers, labels, quotes, taglines, or slogans anywhere.`);
  } else {
    lines.push(`The only text in the image is the name "${name}" and the phrase "${wording}", each shown once, spelled exactly, and clearly legible. Do not add any other words, numbers, labels, quotes, taglines, or slogans.`);
  }
  return lines.map((l) => `- ${l}`).join("\n");
}

function buildPrompt() {
  const p = active();
  if (!p) return "";
  const cat = currentCategory();
  const goal = p.goals[cat.key]?.text.trim() || "";
  const notes = $("notes").value.trim();
  const style = $("style").value.trim();
  const eff = effectiveDirection();
  const allGoals = CATEGORIES
    .filter((c) => p.goals[c.key]?.text.trim())
    .map((c) => `- ${c.label}${p.goals[c.key].done ? " (complete)" : ""}: ${p.goals[c.key].text.trim()}`)
    .join("\n");

  const values = {
    name: p.name.trim() || "this person",
    description: p.description.trim(),
    goal_type: cat.label.toLowerCase(),
    goal: goal || `(no details written for their ${cat.label.toLowerCase()})`,
    notes: notes ? `Details about this win: ${notes}` : "",
    all_goals: allGoals,
    style,
    goal_context: layerGoalContext(p, cat, goal, notes),
    artistic_identity: layerArtisticIdentity(style, eff),
    creative_direction: layerCreativeDirection(eff),
    variety: layerVariety(),
    output: layerOutput(p),
  };

  // Custom templates that predate the layer system still get every layer.
  let template = state.template;
  for (const layer of LAYERS) {
    if (!new RegExp(`\\{\\{\\s*${layer}\\s*\\}\\}`).test(template)) {
      template += `\n\n${LAYER_TITLES[layer]}\n{{${layer}}}`;
    }
  }
  return template
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in values ? values[k] : m))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function refreshPreview(force = false) {
  renderSummary();
  renderGoalWording();
  if (previewEdited && !force) return;
  previewEdited = false;
  $("edited-flag").hidden = true;
  $("preview").value = buildPrompt();
}

// ---------- API ----------
async function apiPost(path, body, retried = false, keepalive = false) {
  const res = await fetch(path, {
    keepalive,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-password": localStorage.getItem("goalCelebrations.password") || "",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !retried) {
    const pw = window.prompt("This app is password protected. Enter the password:");
    if (pw === null) throw new Error("Password required");
    localStorage.setItem("goalCelebrations.password", pw);
    return apiPost(path, body, true);
  }
  if (!res.ok) throw Object.assign(new Error(data.error || `Server error ${res.status}`), { status: res.status });
  return data;
}

function compactHistory() {
  return recentHistory().map(({ category, approach, palette, composition, tone, subject, concept, treatment, perspective }) =>
    ({ category, approach, palette, composition, tone, subject, concept, treatment, perspective }));
}

// ---------- suggestions ----------
let suggesting = false;

async function suggest(another = false) {
  const p = active();
  if (!p) return setStatus("suggest-status", "Pick or add a person first.", true);
  if (suggesting) return;
  const d = state.direction;
  const cat = currentCategory();

  const locked = {};
  for (const f of DIRECTION_FIELDS) if (d.locks[f] && d[f] !== "auto") locked[f] = d[f];
  if (locked.palette === "custom") locked.customColors = d.customColors;

  const avoid = another ? [...sessionSuggestions] : [];
  if (another && d.concept && !avoid.some((a) => a.concept === d.concept)) {
    avoid.push({ category: cat.label, ...pickDirectionFields(d), concept: d.concept, subject: d.subject });
  }

  suggesting = true;
  setSuggestBusy(true);
  $("direction-details").open = true;
  setStatus("suggest-status", another ? "Looking for a different direction…" : "Thinking up a direction…");
  try {
    const { direction: s } = await apiPost("/api/suggest", {
      name: p.name.trim(),
      category: cat.label,
      goal: p.goals[cat.key]?.text.trim() || "",
      notes: $("notes").value.trim(),
      description: p.description.trim(),
      style: $("style").value.trim(),
      prefs: state.prefs,
      locked,
      history: compactHistory(),
      avoid,
    });
    applySuggestion(s);
    sessionSuggestions.push({ category: cat.label, ...pickDirectionFields(state.direction), concept: state.direction.concept, subject: state.direction.subject });
    setStatus("suggest-status", "Direction ready. Edit anything you like, then generate.");
  } catch (err) {
    setStatus("suggest-status", `Couldn't get a suggestion: ${err.message}. Your current settings are unchanged.`, true);
  } finally {
    suggesting = false;
    setSuggestBusy(false);
  }
}

const pickDirectionFields = (d) => Object.fromEntries(DIRECTION_FIELDS.map((f) => [f, d[f]]));

// Validate again on the client and never overwrite locked choices.
function applySuggestion(s) {
  if (!s || typeof s !== "object" || typeof s.concept !== "string" || !s.concept.trim()) {
    throw new Error("the response didn't include a usable concept");
  }
  const d = state.direction;
  for (const f of DIRECTION_FIELDS) {
    if (d.locks[f] && d[f] !== "auto") continue;
    if (isValidOption(f, s[f])) d[f] = s[f];
  }
  if (d.palette === "custom" && !d.locks.palette) {
    if (typeof s.customColors === "string" && s.customColors.trim()) d.customColors = s.customColors.trim();
    else d.palette = "auto";
  }
  const str = (v) => (typeof v === "string" ? v.trim() : "");
  d.concept = str(s.concept);
  d.subject = str(s.subject);
  d.perspective = str(s.perspective);
  d.treatment = state.prefs.flexibility === "fixed" ? "" : str(s.treatment);
  d.rationale = str(s.rationale);
  autoCache = {};
  save();
  renderDirection();
  refreshPreview();
}

function randomizeDirection() {
  const d = state.direction;
  const recent = recentHistory();
  const variety = state.prefs.variety === "consistent" ? "balanced" : state.prefs.variety;
  for (const f of DIRECTION_FIELDS) {
    if (d.locks[f] && d[f] !== "auto") continue;
    const candidates = OPTIONS[f].map((o) => o.value).filter((v) => v !== "custom" && v !== d[f]);
    d[f] = pickVaried(candidates, recent.map((h) => h[f]), "", variety);
  }
  if (!d.locks.palette) d.customColors = "";
  const treatments = treatmentCandidates().filter((t) => t !== d.treatment);
  d.treatment = treatments.length ? pickVaried(treatments, recent.map((h) => h.treatment), "", variety) : "";
  d.perspective = pickVaried(PERSPECTIVES.filter((x) => x !== d.perspective), recent.map((h) => h.perspective), "", variety);
  Object.assign(d, { concept: "", subject: "", rationale: "" });
  autoCache = {};
  save();
  renderDirection();
  refreshPreview();
  setStatus("suggest-status", "Shuffled the unlocked settings. Use Try Another Direction for a fresh AI concept.");
}

function resetDirection() {
  state.direction = blankDirection();
  autoCache = {};
  sessionSuggestions = [];
  save();
  renderDirection();
  refreshPreview();
  setStatus("suggest-status", "");
}

function setSuggestBusy(busy) {
  for (const id of ["suggest", "try-another", "randomize", "reset-direction"]) $(id).disabled = busy;
}

// ---------- generation ----------
let generating = false;

async function generate() {
  const p = active();
  if (!p) return setStatus("status", "Pick or add a person first.", true);
  if (generating) return;
  if (!previewEdited) refreshPreview();
  const prompt = $("preview").value.trim();
  if (!prompt) return setStatus("status", "The prompt is empty.", true);

  // Snapshot exactly what this image is being generated with.
  const cat = currentCategory();
  const eff = effectiveDirection();
  const record = {
    ts: 0,
    person: p.name.trim(),
    category: cat.label,
    goal: truncate(p.goals[cat.key]?.text.trim() || "", 200),
    approach: eff.approach, palette: eff.palette, customColors: eff.customColors,
    composition: eff.composition, tone: eff.tone,
    concept: eff.concept, subject: eff.subject,
    treatment: eff.treatment || (state.prefs.flexibility === "fixed" ? "fixed style" : ""),
    perspective: eff.perspective,
    textMode: state.prefs.textMode,
    promptEdited: previewEdited,
  };

  generating = true;
  $("generate").disabled = true;
  $("regenerate").disabled = true;
  const started = Date.now();
  const tick = setInterval(() => {
    setStatus("status", `Generating… ${Math.round((Date.now() - started) / 1000)}s (usually 20–60s)`);
  }, 1000);
  setStatus("status", "Generating…");

  try {
    const data = await apiPost("/api/generate", { prompt, quality: $("quality").value });
    if (!data.image) throw new Error("No image came back");
    lastImage = data.image;
    $("result-img").src = data.image;
    $("result").hidden = false;
    // Only successful generations become history.
    record.ts = Date.now();
    state.history.unshift(record);
    cloudCall({ action: "addHistory", entry: record });
    state.history = state.history.slice(0, HISTORY_LIMIT);
    save();
    renderHistory();
    setStatus("status", `Done in ${Math.round((Date.now() - started) / 1000)}s${data.model ? ` with ${data.model}` : ""}.`);
  } catch (err) {
    setStatus("status", err.message, true);
  } finally {
    clearInterval(tick);
    generating = false;
    $("generate").disabled = false;
    $("regenerate").disabled = false;
  }
}

function setStatus(id, msg, isError = false) {
  const s = $(id);
  s.textContent = msg;
  s.classList.toggle("error", isError);
}

function download() {
  if (!lastImage) return;
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1000;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, 1000, 1000);
    canvas.toBlob((blob) => {
      const p = active();
      const slug = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${slug(p?.name) || "celebration"}-${slug($("goal-select").selectedOptions[0].text)}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, "image/png");
  };
  img.src = lastImage;
}


// ---------- cloud sync (Neon via /api/data) ----------
// localStorage stays the instant cache; when a database is configured, people,
// shared settings, and history are mirrored to it so every device sees the same data.
// Per-device UI state (selected person/goal, current creative direction) stays local.
const cloud = { enabled: false, timer: null, syncedPeople: new Map(), syncedSettings: null, inFlight: false };

const settingsPayload = () => ({ template: state.template, style: state.style, quality: state.quality, prefs: state.prefs });
const cloudPayload = () => ({ people: state.people, settings: settingsPayload(), history: state.history });

function markSynced() {
  cloud.syncedPeople = new Map(state.people.map((p) => [p.id, JSON.stringify(p)]));
  cloud.syncedSettings = JSON.stringify(settingsPayload());
}

function setSync(text, kind = "") {
  const el = $("sync-status");
  el.textContent = text;
  el.className = `sync ${kind}`;
}

function scheduleSync() {
  if (!cloud.enabled) return;
  clearTimeout(cloud.timer);
  cloud.timer = setTimeout(flushSync, 700);
}

function pendingChanges() {
  const upsertPeople = state.people.filter((p) => cloud.syncedPeople.get(p.id) !== JSON.stringify(p));
  const ids = new Set(state.people.map((p) => p.id));
  const deletePeople = [...cloud.syncedPeople.keys()].filter((id) => !ids.has(id));
  const settings = JSON.stringify(settingsPayload()) !== cloud.syncedSettings ? settingsPayload() : undefined;
  return { upsertPeople, deletePeople, settings, any: upsertPeople.length || deletePeople.length || settings };
}

async function flushSync(keepalive = false) {
  clearTimeout(cloud.timer);
  if (!cloud.enabled) return;
  if (cloud.inFlight && !keepalive) { scheduleSync(); return; }
  const changes = pendingChanges();
  if (!changes.any) return;
  // Snapshot what we're sending so edits made mid-request are caught next time.
  const sentPeople = changes.upsertPeople.map((p) => [p.id, JSON.stringify(p)]);
  const sentSettings = changes.settings ? JSON.stringify(changes.settings) : null;
  cloud.inFlight = true;
  setSync("Saving…");
  try {
    await apiPost("/api/data", { action: "sync", upsertPeople: changes.upsertPeople, deletePeople: changes.deletePeople, settings: changes.settings }, false, keepalive);
    for (const [id, j] of sentPeople) cloud.syncedPeople.set(id, j);
    for (const id of changes.deletePeople) cloud.syncedPeople.delete(id);
    if (sentSettings) cloud.syncedSettings = sentSettings;
    setSync("✓ Synced", "ok");
  } catch (err) {
    setSync("Not synced — saved on this device, retrying…", "error");
    console.warn("Sync failed:", err.message);
    cloud.timer = setTimeout(flushSync, 5000);
  } finally {
    cloud.inFlight = false;
  }
}

// Fire-and-forget calls (history) that shouldn't block the UI.
async function cloudCall(body) {
  if (!cloud.enabled) return;
  try { await apiPost("/api/data", body); }
  catch (err) { setSync(`Cloud save failed: ${err.message}`, "error"); }
}

async function initCloud() {
  setSync("Connecting…");
  let remote;
  try {
    remote = await apiPost("/api/data", { action: "load" });
  } catch (err) {
    if (err.status === 501) setSync("Saved on this device only (no database configured)");
    else setSync(`Offline — saved on this device only (${err.message})`, "error");
    return;
  }
  cloud.enabled = true;

  if (!remote.people.length && state.people.length) {
    // First connection: upload what this browser already has.
    const r = await apiPost("/api/data", { action: "seed", ...cloudPayload() }).catch(() => null);
    if (!r) {
      cloud.enabled = false; // never replace local data with an empty cloud copy
      setSync("Couldn't upload to the cloud — still saved on this device. Reload to retry.", "error");
      return;
    }
    if (!r.skipped) { markSynced(); setSync("✓ Uploaded this device's data to the cloud", "ok"); return; }
    if (r?.skipped) remote = await apiPost("/api/data", { action: "load" });
  }

  // Cloud is the source of truth.
  state.people = remote.people;
  if (remote.settings) {
    const { template, style, quality, prefs } = remote.settings;
    if (typeof template === "string") state.template = template;
    if (typeof style === "string") state.style = style;
    if (["low", "medium", "high"].includes(quality)) state.quality = quality;
    if (prefs && typeof prefs === "object") state.prefs = { ...state.prefs, ...prefs };
  }
  state.history = remote.history;
  if (!state.people.some((p) => p.id === state.activeId)) state.activeId = state.people[0]?.id || null;
  state = (saveLocal(), load()); // re-run migrations/defaults on cloud data
  markSynced();
  if (!remote.settings) scheduleSync(); // push this device's settings up once
  autoCache = {};
  render();
  setSync("✓ Synced", "ok");
}

window.addEventListener("pagehide", () => { if (cloud.enabled && pendingChanges().any) flushSync(true); });

// ---------- wiring ----------
buildDirectionFields();
for (const [key, opts] of Object.entries(PREFS)) {
  const sel = $(`pref-${key}`);
  for (const o of opts) sel.add(new Option(o.label, o.value));
  sel.onchange = () => {
    state.prefs[key] = sel.value;
    if (key === "flexibility" && sel.value === "fixed") state.direction.treatment = "";
    autoCache = {};
    save();
    renderDirection();
    refreshPreview();
  };
}

$("new-person").onclick = newPerson;
$("delete-person").onclick = () => {
  const p = active();
  if (!p || !confirm(`Delete ${p.name || "this person"}?`)) return;
  state.people = state.people.filter((x) => x.id !== p.id);
  state.activeId = state.people[0]?.id || null;
  save();
  onGoalChanged();
  render();
};
$("name").oninput = (e) => { active().name = e.target.value; save(); renderPeople(); refreshPreview(); };
$("description").oninput = (e) => { active().description = e.target.value; save(); refreshPreview(); };
$("goal-select").onchange = () => { state.goalKey = $("goal-select").value; onGoalChanged(); renderDirection(); refreshPreview(); };
$("notes").oninput = () => refreshPreview();
$("style").oninput = (e) => { state.style = e.target.value; save(); refreshPreview(); };
$("template").oninput = (e) => { state.template = e.target.value; save(); refreshPreview(); };
$("quality").onchange = (e) => { state.quality = e.target.value; save(); };
$("reset-template").onclick = () => {
  if (!confirm("Reset the template and style to the defaults?")) return;
  state.template = DEFAULT_TEMPLATE;
  state.style = DEFAULT_STYLE;
  save();
  renderCelebrate();
};
$("preview").oninput = () => { previewEdited = true; $("edited-flag").hidden = false; };
$("rebuild").onclick = () => refreshPreview(true);
$("generate").onclick = generate;
$("regenerate").onclick = generate;
$("download").onclick = download;

$("suggest").onclick = () => suggest(false);
$("try-another").onclick = () => suggest(true);
$("randomize").onclick = randomizeDirection;
$("reset-direction").onclick = resetDirection;
for (const id of ["concept", "subject", "treatment", "perspective"]) {
  $(id).oninput = (e) => {
    state.direction[id] = e.target.value;
    if (id === "treatment" || id === "perspective") delete autoCache[id];
    save();
    refreshPreview();
  };
}
$("custom-colors").oninput = (e) => { state.direction.customColors = e.target.value; save(); refreshPreview(); };
$("goal-wording").oninput = () => { goalWordingEdited = true; refreshPreview(); };
$("clear-history").onclick = () => {
  if (!confirm("Clear the record of recent creative directions? (Images aren't affected.)")) return;
  state.history = [];
  cloudCall({ action: "clearHistory" });
  autoCache = {};
  save();
  renderHistory();
  refreshPreview();
};

$("export").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
  a.download = `goal-celebrations-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
};
$("import").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.people)) throw new Error();
    if (!confirm(`Replace current data with ${data.people.length} people from the backup?`)) return;
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...state, ...data }));
    state = load();
    if (cloud.enabled) {
      await cloudCall({ action: "replace", ...cloudPayload() });
      markSynced();
    }
    autoCache = {};
    sessionSuggestions = [];
    render();
  } catch {
    alert("That file doesn't look like a Goal Celebrations backup.");
  }
  e.target.value = "";
};

render();
initCloud();
