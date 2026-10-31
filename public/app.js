// Goal Celebrations — data lives in localStorage, mirrored to Neon when configured.
import { COMPOSITIONS, TEXT_MODES, FILLER_OBJECTS, findComposition, isValidComposition } from "./direction-options.js";

const CATEGORIES = [
  { key: "professional", label: "Professional goal", hint: "What's their professional goal?" },
  { key: "personal", label: "Personal goal", hint: "What's their personal goal?" },
  { key: "contribution", label: "Contribution goal", hint: "What's their contribution goal?" },
  { key: "selfHonor", label: "Self-honor goal", hint: "What's their self-honor goal?" },
  { key: "pmEnrollments", label: "PM enrollments", hint: "Details on their PM enrollments" },
  { key: "greatnessNotes", label: "Greatness notes", hint: "Details on their greatness notes" },
];

// The artistic identity every image follows. Composition and subject vary;
// this does not.
const DEFAULT_STYLE = `Rich contemporary editorial illustration built from bold, simplified geometric shapes, with layered compositions and interesting overlapping forms. Sophisticated but vibrant color with subtle paper grain or printmaking-inspired texture. Playful and creative without looking childish. Visually rich, full-frame square artwork that tells its story through recognizable subjects and meaningful details. Polished and intentional, like a piece commissioned from a talented illustrator. Avoid photorealism, generic corporate graphics, sterile minimalism, overly simple icons, and motivational-poster aesthetics.`;

const DEFAULT_TEMPLATE = `Create a celebration illustration for {{name}}, who just completed their {{goal_type}}.

THE ACCOMPLISHMENT
{{goal_context}}

ARTISTIC IDENTITY
{{artistic_identity}}

VISUAL CONCEPT & COMPOSITION
{{visual_concept}}

VARIETY
{{variety}}

OUTPUT REQUIREMENTS
{{output}}`;

// Earlier defaults: saved copies that were never customized get upgraded.
const PREVIOUS_STYLES = [
  `Rich, polished editorial illustration with cinematic lighting and a warm, cohesive color palette. Clean composition with breathing room around the text. Feels like a keepsake poster worth sharing.`,
  `Contemporary editorial illustration with thoughtful shapes and composition, appealing harmonious color, and expressive simplicity. Strong visual storytelling with meaningful details rather than decorative clutter. Polished and human-designed, like a commissioned piece from a great illustrator.`,
];
const PREVIOUS_TEMPLATES = [
  `Create a celebratory square (1:1) image honoring {{name}} for completing their {{goal_type}}.

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
{{style}}`,
  `Create a celebration illustration for {{name}}, who just completed their {{goal_type}}.

GOAL CONTEXT
{{goal_context}}

ARTISTIC IDENTITY
{{artistic_identity}}

CREATIVE DIRECTION
{{creative_direction}}

VARIETY
{{variety}}

OUTPUT REQUIREMENTS
{{output}}`,
];

const LAYERS = ["goal_context", "artistic_identity", "visual_concept", "variety", "output"];
const LAYER_TITLES = {
  goal_context: "THE ACCOMPLISHMENT", artistic_identity: "ARTISTIC IDENTITY",
  visual_concept: "VISUAL CONCEPT & COMPOSITION", variety: "VARIETY", output: "OUTPUT REQUIREMENTS",
};
const HISTORY_LIMIT = 50;  // stored
const HISTORY_WINDOW = 10; // considered for variety

const STORE_KEY = "goalCelebrations.v1";
const $ = (id) => document.getElementById(id);

// ---------- state ----------
let state = load();
let previewEdited = false;
let lastImage = null;
let sessionPlans = [];   // concepts already planned for the current goal
let goalWordingEdited = false;

// composition: the user's choice ("auto" or a type). chosen: the planner's pick when on Auto.
function blankPlan() { return { composition: "auto", chosen: "", concept: "", subjects: "", colors: "" }; }

function normalizeHistory(h) {
  if (!h || typeof h !== "object") return null;
  const composition = isValidComposition(h.composition) ? h.composition : isValidComposition(h.approach) ? h.approach : "";
  return {
    ts: h.ts || 0, person: h.person || "", category: h.category || "", goal: h.goal || "",
    composition, concept: h.concept || "", subjects: h.subjects || h.subject || "", colors: h.colors || h.customColors || "",
  };
}

function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch {}
  if (!s || !Array.isArray(s.people)) {
    s = { people: [], activeId: null, template: DEFAULT_TEMPLATE, style: DEFAULT_STYLE, quality: "high" };
  }
  if (!s.template || PREVIOUS_TEMPLATES.includes(s.template)) s.template = DEFAULT_TEMPLATE;
  if (s.style === undefined || PREVIOUS_STYLES.includes(s.style)) s.style = DEFAULT_STYLE;
  s.prefs = { textMode: TEXT_MODES.some((o) => o.value === s.prefs?.textMode) ? s.prefs.textMode : "none" };
  s.plan = { ...blankPlan(), ...(s.plan || {}) };
  if (s.plan.composition !== "auto" && !isValidComposition(s.plan.composition)) s.plan.composition = "auto";
  delete s.direction; // from the previous Creative Direction system
  s.history = (Array.isArray(s.history) ? s.history : []).map(normalizeHistory).filter(Boolean);
  return s;
}
function saveLocal() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function save() { saveLocal(); scheduleSync(); }
const active = () => state.people.find((p) => p.id === state.activeId);
const currentCategory = () => CATEGORIES.find((c) => c.key === $("goal-select").value) || CATEGORIES[0];
const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const recentHistory = () => state.history.slice(0, HISTORY_WINDOW);
const effectiveComposition = () => (state.plan.composition !== "auto" ? state.plan.composition : state.plan.chosen || "");

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
        renderPlan();
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
  $("pref-textMode").value = state.prefs.textMode;
  renderPlan();
  renderHistory();
  refreshPreview();
}

function render() { renderPeople(); renderProfile(); renderCelebrate(); }

// ---------- composition & concept ----------
function renderPlan() {
  const pl = state.plan;
  $("composition").value = pl.composition;
  $("concept").value = pl.concept;
  const meta = [];
  if (pl.composition === "auto" && pl.chosen && pl.concept) meta.push(`Auto chose: ${findComposition(pl.chosen).label}`);
  if (pl.subjects) meta.push(`Subjects: ${pl.subjects}`);
  if (pl.colors) meta.push(`Colors: ${pl.colors}`);
  $("concept-meta").textContent = meta.join(" · ");
  $("concept-meta").hidden = !meta.length;
  renderGoalWording();
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
  const items = recentHistory();
  $("history-count").textContent = state.history.length ? `(${state.history.length} saved, last ${items.length} shown)` : "(none yet)";
  for (const h of items) {
    const li = document.createElement("li");
    const date = new Date(h.ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    li.innerHTML = `<strong></strong> <span></span><br><em></em>`;
    li.querySelector("strong").textContent = `${date} · ${h.person || "?"} · ${h.category}`;
    li.querySelector("span").textContent = [findComposition(h.composition)?.label, h.colors].filter(Boolean).map((x) => `— ${x}`).join(" ");
    li.querySelector("em").textContent = truncate(h.concept || h.subjects || "(concept chosen by the image model)", 160);
    ol.appendChild(li);
  }
  $("clear-history").hidden = !state.history.length;
}

// The planned concept belongs to one goal and one composition choice.
function clearConcept() {
  Object.assign(state.plan, { chosen: "", concept: "", subjects: "", colors: "" });
  sessionPlans = [];
}

function onGoalChanged() {
  clearConcept();
  goalWordingEdited = false;
  save();
}

// ---------- prompt sections ----------
function layerGoalContext(p, cat, goal, notes) {
  const name = p.name.trim() || "this person";
  return [
    `What they accomplished: ${goal || `their ${cat.label.toLowerCase()} (no further details given)`}`,
    notes && `Details about this win: ${notes}`,
    p.description.trim() && `Who ${name} is, in the words of someone who admires them: ${p.description.trim()}`,
    "Start from what this accomplishment means for this person and let that drive the imagery, so it feels made for them rather than generic.",
  ].filter(Boolean).join("\n");
}

function layerArtisticIdentity(style) {
  return [
    style,
    "This style is the visual authority for the whole collection and stays consistent from image to image. The composition type below changes how the image is organized, never the art style. Let the color palette suit this piece while staying within this sensibility.",
  ].filter(Boolean).join("\n");
}

function layerVisualConcept() {
  const pl = state.plan;
  const comp = findComposition(effectiveComposition());
  return [
    pl.concept.trim()
      ? `Visual concept: ${pl.concept.trim()}`
      : "Visual concept: interpret this accomplishment and build one concrete, specific visual concept around recognizable subjects and meaningful details.",
    pl.subjects.trim() && `Main subjects: ${pl.subjects.trim()}`,
    pl.colors.trim() && `Dominant colors: ${pl.colors.trim()}, rendered within the artistic identity above.`,
    comp
      ? `Composition type: ${comp.prompt}.`
      : `Composition type: choose whichever organization best serves the concept (${COMPOSITIONS.map((c) => c.label.toLowerCase()).join(", ")}).`,
  ].filter(Boolean).join("\n");
}

function layerVariety() {
  const filler = `Avoid generic filler props (${FILLER_OBJECTS.join(", ")}) unless they genuinely contribute to the concept.`;
  const recent = recentHistory();
  if (!recent.length) return `Make this piece specific to this accomplishment. ${filler}`;
  const list = recent.map((h) => {
    const what = h.subjects || (h.concept ? truncate(h.concept, 90) : "");
    const how = [findComposition(h.composition)?.label, h.colors].filter(Boolean).join("; ");
    return `- ${[what, how && `(${how})`].filter(Boolean).join(" ")}`;
  }).filter((l) => l !== "- ").join("\n");
  if (!list) return `Make this piece specific to this accomplishment. ${filler}`;
  return `Recent images in this collection:\n${list}\nKeep this one clearly distinct: don't reuse the same props, visual metaphors, or scene structures. ${filler} The visual concept above takes priority, and relevance to this accomplishment matters more than novelty.`;
}

function layerOutput(p) {
  const name = p.name.trim();
  const lines = [
    "Square 1:1 artwork that fills the full frame edge to edge: no borders, frames, mockups, or device screens.",
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
  const allGoals = CATEGORIES
    .filter((c) => p.goals[c.key]?.text.trim())
    .map((c) => `- ${c.label}${p.goals[c.key].done ? " (complete)" : ""}: ${p.goals[c.key].text.trim()}`)
    .join("\n");

  const visual = layerVisualConcept();
  const values = {
    name: p.name.trim() || "this person",
    description: p.description.trim(),
    goal_type: cat.label.toLowerCase(),
    goal: goal || `(no details written for their ${cat.label.toLowerCase()})`,
    notes: notes ? `Details about this win: ${notes}` : "",
    all_goals: allGoals,
    style,
    goal_context: layerGoalContext(p, cat, goal, notes),
    artistic_identity: layerArtisticIdentity(style),
    visual_concept: visual,
    creative_direction: visual, // older custom templates
    variety: layerVariety(),
    output: layerOutput(p),
  };

  // Custom templates without a section still get it, appended at the end.
  let template = state.template;
  for (const layer of LAYERS) {
    const present = new RegExp(`\\{\\{\\s*${layer}\\s*\\}\\}`).test(template) ||
      (layer === "visual_concept" && /\{\{\s*creative_direction\s*\}\}/.test(template));
    if (!present) template += `\n\n${LAYER_TITLES[layer]}\n{{${layer}}}`;
  }
  return template
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in values ? values[k] : m))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function refreshPreview(force = false) {
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
    return apiPost(path, body, true, keepalive);
  }
  if (!res.ok) throw Object.assign(new Error(data.error || `Server error ${res.status}`), { status: res.status });
  return data;
}

// ---------- planning ----------
let planning = false;

const planRecord = () => ({
  category: currentCategory().label, composition: effectiveComposition(),
  concept: state.plan.concept, subjects: state.plan.subjects, colors: state.plan.colors,
});

// Interpret the goal and plan a concept + composition. Returns true on success.
async function planConcept(another = false) {
  const p = active();
  if (!p) { setStatus("plan-status", "Pick or add a person first.", true); return false; }
  if (planning) return false;
  const cat = currentCategory();
  const pl = state.plan;
  const avoid = another ? [...sessionPlans] : [];
  if (another && pl.concept && !avoid.some((a) => a.concept === pl.concept)) avoid.push(planRecord());

  planning = true;
  $("try-another").disabled = true;
  setStatus("plan-status", another ? "Planning a different composition…" : "Planning the concept…");
  try {
    const { plan } = await apiPost("/api/suggest", {
      name: p.name.trim(),
      category: cat.label,
      goal: p.goals[cat.key]?.text.trim() || "",
      notes: $("notes").value.trim(),
      description: p.description.trim(),
      style: $("style").value.trim(),
      textMode: state.prefs.textMode,
      composition: pl.composition,
      history: recentHistory().map(({ category, composition, concept, subjects, colors }) => ({ category, composition, concept, subjects, colors })),
      avoid,
    });
    if (!plan || typeof plan.concept !== "string" || !plan.concept.trim()) throw new Error("the response didn't include a usable concept");
    const str = (v) => (typeof v === "string" ? v.trim() : "");
    pl.chosen = pl.composition !== "auto" ? pl.composition : isValidComposition(plan.composition) ? plan.composition : "";
    pl.concept = plan.concept.trim();
    pl.subjects = str(plan.subjects);
    pl.colors = str(plan.colors);
    sessionPlans.push(planRecord());
    save();
    renderPlan();
    refreshPreview();
    setStatus("plan-status", "");
    return true;
  } catch (err) {
    // During Generate this is non-fatal, so it's a note rather than an error.
    setStatus("plan-status", another
      ? `Couldn't plan another composition (${err.message}). Your current concept is unchanged.`
      : `Couldn't plan a concept (${err.message}). The image model will interpret the goal itself.`, another);
    return false;
  } finally {
    planning = false;
    $("try-another").disabled = false;
  }
}

// ---------- generation ----------
let generating = false;

async function generate() {
  const p = active();
  if (!p) return setStatus("status", "Pick or add a person first.", true);
  if (generating) return;
  generating = true;
  $("generate").disabled = true;
  $("regenerate").disabled = true;
  const started = Date.now();
  let tick = null;

  try {
    // Interpret the goal first, unless there's already a concept or a hand-edited prompt.
    if (!previewEdited && !state.plan.concept.trim()) {
      setStatus("status", "Planning the concept…");
      await planConcept(false);
    }
    if (!previewEdited) refreshPreview();
    const prompt = $("preview").value.trim();
    if (!prompt) throw new Error("The prompt is empty.");

    const cat = currentCategory();
    const record = {
      ts: 0,
      person: p.name.trim(),
      category: cat.label,
      goal: truncate(p.goals[cat.key]?.text.trim() || "", 200),
      composition: effectiveComposition(),
      concept: state.plan.concept.trim(),
      subjects: state.plan.subjects.trim(),
      colors: state.plan.colors.trim(),
      promptEdited: previewEdited,
    };

    const genStart = Date.now();
    tick = setInterval(() => {
      setStatus("status", `Generating… ${Math.round((Date.now() - genStart) / 1000)}s (usually 30–90s)`);
    }, 1000);
    setStatus("status", "Generating…");

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
// Per-device UI state (selected person/goal, composition choice, current concept) stays local.
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
  // Push this device's settings if the cloud has none, or if migrations upgraded them.
  if (remote.settings) cloud.syncedSettings = JSON.stringify(remote.settings);
  scheduleSync();
  render();
  setSync("✓ Synced", "ok");
}

window.addEventListener("pagehide", () => { if (cloud.enabled && pendingChanges().any) flushSync(true); });

// ---------- wiring ----------
$("composition").add(new Option("Auto", "auto"));
for (const c of COMPOSITIONS) $("composition").add(new Option(c.label, c.value));
for (const o of TEXT_MODES) $("pref-textMode").add(new Option(o.label, o.value));

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
$("goal-select").onchange = () => { state.goalKey = $("goal-select").value; onGoalChanged(); renderPlan(); refreshPreview(); };
$("notes").oninput = () => refreshPreview();
$("style").oninput = (e) => { state.style = e.target.value; save(); refreshPreview(); };
$("template").oninput = (e) => { state.template = e.target.value; save(); refreshPreview(); };
$("quality").onchange = (e) => { state.quality = e.target.value; save(); };
$("pref-textMode").onchange = (e) => { state.prefs.textMode = e.target.value; save(); refreshPreview(); };
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

$("composition").onchange = (e) => {
  state.plan.composition = e.target.value;
  clearConcept(); // the old concept was planned for a different composition
  save();
  renderPlan();
  refreshPreview();
};
$("try-another").onclick = () => planConcept(true);
$("concept").oninput = (e) => {
  state.plan.concept = e.target.value;
  if (!e.target.value.trim()) clearConcept();
  save();
  if (!e.target.value.trim()) renderPlan();
  refreshPreview();
};
$("goal-wording").oninput = () => { goalWordingEdited = true; refreshPreview(); };
$("clear-history").onclick = () => {
  if (!confirm("Clear the record of recent images? (Downloaded images aren't affected.)")) return;
  state.history = [];
  cloudCall({ action: "clearHistory" });
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
    sessionPlans = [];
    render();
  } catch {
    alert("That file doesn't look like a Goal Celebrations backup.");
  }
  e.target.value = "";
};

render();
initCloud();
