// Goal Celebrations — data lives in localStorage, mirrored to Neon when configured.

const CATEGORIES = [
  { key: "professional", label: "Professional goal", hint: "What's their professional goal?" },
  { key: "personal", label: "Personal goal", hint: "What's their personal goal?" },
  { key: "contribution", label: "Contribution goal", hint: "What's their contribution goal?" },
  { key: "selfHonor", label: "Self-honor goal", hint: "What's their self-honor goal?" },
  { key: "pmEnrollments", label: "PM enrollments", hint: "Details on their PM enrollments" },
  { key: "greatnessNotes", label: "Greatness notes", hint: "Details on their greatness notes" },
];

// How the image is organized. The artistic treatment never changes.
const COMPOSITIONS = [
  { value: "auto", label: "Automatic", hint: "The generator picks whichever of the three styles best represents the accomplishment." },
  { value: "abstract", label: "Abstract Composition", hint: "Shapes, patterns, movement, and color communicate the accomplishment without relying on literal objects." },
  { value: "object", label: "Object-Focused Artwork", hint: "Recognizable objects related to the accomplishment arranged in an imaginative, cohesive illustration. Avoid rigid grids and isolated object collections." },
  { value: "environment", label: "Illustrated Environment", hint: "A richly composed environment that represents the accomplishment through architecture, landscapes, objects, and atmosphere." },
];

const TEXT_MODES = [
  { value: "none", label: "None" },
  { value: "name", label: "Name only" },
  { value: "name_goal", label: "Name and goal" },
];

const DEFAULT_PALETTE = {
  id: "default",
  name: "Teal & Coral",
  colors: [
    { name: "Deep teal", hex: "#07566A" },
    { name: "Dark navy", hex: "#002B43" },
    { name: "Golden yellow", hex: "#FFB900" },
    { name: "Warm orange", hex: "#F47A38" },
    { name: "Coral", hex: "#FF6752" },
    { name: "Cream", hex: "#FFE6AD" },
  ],
};

const DEFAULT_TEMPLATE = `Create a celebration illustration for {{name}}'s completed {{goal_type}}.

ACCOMPLISHMENT
{{goal}}
{{notes}}

ABOUT {{name}} (context for mood and meaningful details, not someone to depict)
{{description}}

ARTISTIC STYLE
Rich contemporary editorial illustration built from bold, simplified geometric shapes, with layered compositions and interesting overlapping forms. Subtle paper grain or printmaking-inspired texture. Playful and creative without looking childish. Visually rich, full-frame square artwork that tells its story through meaningful details. Polished and intentional, like a piece commissioned from a talented illustrator. Avoid photorealism, generic corporate graphics, sterile minimalism, overly simple icons, and motivational-poster aesthetics.

COMPOSITION
{{composition}}

COLOR PALETTE
{{palette}}`;

// Earlier default templates: saved copies that were never customized get upgraded.
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
  `Create a celebration illustration for {{name}}, who just completed their {{goal_type}}.

THE ACCOMPLISHMENT
{{goal_context}}

ARTISTIC IDENTITY
{{artistic_identity}}

VISUAL CONCEPT & COMPOSITION
{{visual_concept}}

VARIETY
{{variety}}

OUTPUT REQUIREMENTS
{{output}}`,
];

// Always appended, whatever the master prompt says.
const NO_PEOPLE_RULE = "Absolutely no people. Do not include humans or human figures, faces, hands, or any other body parts, human silhouettes, cartoon people or characters, or anthropomorphic objects (no objects with faces, eyes, limbs, or human expressions). Tell the story entirely through objects, shapes, places, patterns, and atmosphere.";

const HEX = /^#[0-9a-f]{6}$/i;
const STORE_KEY = "goalCelebrations.v1";
const $ = (id) => document.getElementById(id);

const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------- state ----------
let state = load();
let previewEdited = false;
let lastImage = null;
let goalWordingEdited = false;


function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch {}
  if (!s || !Array.isArray(s.people)) s = { people: [], activeId: null, template: DEFAULT_TEMPLATE, quality: "high" };
  if (!s.template || PREVIOUS_TEMPLATES.includes(s.template)) s.template = DEFAULT_TEMPLATE;
  s.prefs = { textMode: TEXT_MODES.some((o) => o.value === s.prefs?.textMode) ? s.prefs.textMode : "none" };
  if (!COMPOSITIONS.some((c) => c.value === s.composition)) s.composition = "auto";
  if (!Array.isArray(s.palettes) || !s.palettes.length) s.palettes = [clone(DEFAULT_PALETTE)];
  if (!s.palettes.some((p) => p.id === s.paletteId)) s.paletteId = s.palettes[0].id;
  if (!Array.isArray(s.history)) s.history = [];
  delete s.direction; delete s.plan; delete s.style; // from earlier versions
  return s;
}
function saveLocal() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function save() { saveLocal(); scheduleSync(); }
const active = () => state.people.find((p) => p.id === state.activeId);
const currentCategory = () => CATEGORIES.find((c) => c.key === $("goal-select").value) || CATEGORIES[0];
const currentPalette = () => state.palettes.find((p) => p.id === state.paletteId) || state.palettes[0];
const validColors = (pal) => (pal?.colors || []).filter((c) => HEX.test(c.hex));

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
  $("quality").value = state.quality;
  $("pref-textMode").value = state.prefs.textMode;
  $("composition").value = state.composition;
  $("composition-hint").textContent = COMPOSITIONS.find((c) => c.value === state.composition).hint;
  renderPalettes();
  renderGoalWording();
  refreshPreview();
}

function render() { renderPeople(); renderProfile(); renderCelebrate(); }

function onGoalChanged() {
  goalWordingEdited = false;
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

// ---------- palettes (user-managed, never AI-generated) ----------
function renderPalettes() {
  const sel = $("palette");
  sel.innerHTML = "";
  for (const p of state.palettes) sel.add(new Option(p.name || "(unnamed palette)", p.id));
  sel.value = state.paletteId;

  const pal = currentPalette();
  renderSwatches();

  $("pm-name").value = pal.name;
  $("pm-delete").disabled = state.palettes.length <= 1;
  const list = $("pm-colors");
  list.innerHTML = "";
  pal.colors.forEach((c, i) => {
    const row = document.createElement("div");
    row.className = "pm-color";
    row.innerHTML = `<input type="color" /><input type="text" class="hex" maxlength="7" /><input type="text" class="cname" placeholder="Name (optional)" /><button class="small" title="Remove color">×</button>`;
    const [picker, hex, cname] = row.querySelectorAll("input");
    picker.value = HEX.test(c.hex) ? c.hex : "#000000";
    hex.value = c.hex;
    hex.classList.toggle("bad", !HEX.test(c.hex));
    cname.value = c.name || "";
    picker.oninput = () => { c.hex = picker.value.toUpperCase(); hex.value = c.hex; hex.classList.remove("bad"); paletteChanged(false); };
    hex.oninput = () => {
      let v = hex.value.trim();
      if (v && !v.startsWith("#")) v = "#" + v;
      c.hex = v.toUpperCase();
      const ok = HEX.test(c.hex);
      hex.classList.toggle("bad", !ok);
      if (ok) picker.value = c.hex;
      paletteChanged(false);
    };
    cname.oninput = () => { c.name = cname.value; paletteChanged(false); };
    row.querySelector("button").onclick = () => { pal.colors.splice(i, 1); paletteChanged(true); };
    list.appendChild(row);
  });
}

function renderSwatches() {
  const colors = validColors(currentPalette());
  const sw = $("palette-swatches");
  sw.innerHTML = "";
  for (const c of colors) {
    const span = document.createElement("span");
    span.style.background = c.hex;
    span.title = `${c.name ? c.name + " " : ""}${c.hex.toUpperCase()}`;
    sw.appendChild(span);
  }
  sw.hidden = !colors.length;
}

// Re-render the editor only for structural changes, so typing isn't interrupted.
function paletteChanged(rerenderEditor) {
  save();
  if (rerenderEditor) renderPalettes();
  else {
    $("palette").selectedOptions[0].textContent = currentPalette().name || "(unnamed palette)";
    renderSwatches();
  }
  refreshPreview();
}

function addPalette(fromCurrent) {
  const base = fromCurrent ? clone(currentPalette()) : { name: "New palette", colors: [{ name: "", hex: "#07566A" }, { name: "", hex: "#FFE6AD" }] };
  const pal = { ...base, id: crypto.randomUUID(), name: fromCurrent ? `${base.name} copy` : base.name };
  state.palettes.push(pal);
  state.paletteId = pal.id;
  paletteChanged(true);
  $("palette-manager").open = true;
  $("pm-name").select();
}

// ---------- prompt ----------
function compositionText() {
  const pick = COMPOSITIONS.find((c) => c.value === state.composition);
  const styles = COMPOSITIONS.filter((c) => c.value !== "auto");
  const lines = state.composition === "auto"
    ? [`Choose whichever one of these composition styles best represents this accomplishment:`, ...styles.map((c) => `- ${c.label}: ${c.hint}`)]
    : [`${pick.label}: ${pick.hint}`];
  lines.push("The composition style changes only how the image is organized; keep the artistic style exactly as described.");
  return lines.join("\n");
}

function paletteText() {
  const colors = validColors(currentPalette());
  if (!colors.length) return "Use a cohesive palette that suits the artistic style.";
  return [
    "Use this color palette for the entire image:",
    ...colors.map((c) => `- ${c.hex.toUpperCase()}${c.name?.trim() ? ` (${c.name.trim()})` : ""}`),
    "Tints and shades of these colors are fine; do not introduce other hues.",
  ].join("\n");
}

function requirementsText(p) {
  const name = p.name.trim();
  const mode = state.prefs.textMode;
  const wording = ($("goal-wording").value.trim() || defaultGoalWording()).replace(/"/g, "'");
  const text = mode === "none" || !name
    ? "Do not include any text: no lettering, words, letters, numbers, labels, signage, logos, slogans, or captions anywhere in the image."
    : mode === "name"
      ? `The only text in the image is the name "${name}", shown once, spelled exactly, and clearly legible. No other words, numbers, labels, quotes, taglines, or slogans.`
      : `The only text in the image is the name "${name}" and the phrase "${wording}", each shown once, spelled exactly, and clearly legible. No other words, numbers, labels, quotes, taglines, or slogans.`;
  return [
    "REQUIREMENTS",
    `- ${NO_PEOPLE_RULE}`,
    "- Square 1:1 artwork that fills the full frame edge to edge: no borders, frames, or mockups.",
    `- ${text}`,
  ].join("\n");
}

function buildPrompt() {
  const p = active();
  if (!p) return "";
  const cat = currentCategory();
  const goal = p.goals[cat.key]?.text.trim() || `(no details written for their ${cat.label.toLowerCase()})`;
  const notes = $("notes").value.trim();
  const description = p.description.trim();
  const values = {
    name: p.name.trim() || "this person",
    goal_type: cat.label.toLowerCase(),
    goal,
    notes: notes ? `Details about this win: ${notes}` : "",
    description,
    composition: compositionText(),
    palette: paletteText(),
  };
  // Names used in the master prompt.
  Object.assign(values, {
    personal_description: description,
    composition_style: values.composition,
    selected_palette: values.palette,
  });
  // Placeholders from earlier versions of the template.
  Object.assign(values, {
    goal_context: [goal, values.notes, description].filter(Boolean).join("\n"),
    visual_concept: `${values.composition}\n\n${values.palette}`,
    creative_direction: `${values.composition}\n\n${values.palette}`,
    artistic_identity: "", style: "", variety: "", output: "", all_goals: "",
  });

  let template = state.template;
  const used = placeholdersIn(template);
  const has = (...keys) => keys.some((k) => used.includes(k));
  // Only add a section when the master prompt has no placeholder for it at all.
  if (!has("goal", "goal_context")) template += "\n\nACCOMPLISHMENT\n{{goal}}\n{{notes}}";
  if (description && !has("description", "personal_description", "goal_context")) template += "\n\nABOUT {{name}}\n{{description}}";
  if (!has("composition", "composition_style", "visual_concept", "creative_direction")) template += "\n\nCOMPOSITION\n{{composition}}";
  if (!has("palette", "selected_palette", "visual_concept", "creative_direction")) template += "\n\nCOLOR PALETTE\n{{palette}}";

  // Anything that looks like a placeholder but isn't a known name stays unresolved.
  lastUnresolved = placeholdersIn(template).filter((k) => !(k in values));
  const body = template
    .replace(PLACEHOLDER, (m, k2, k1) => {
      const k = k2 || k1;
      return k in values ? values[k] : m;
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return `${body}\n\n${requirementsText(p)}`;
}

// Matches {{name}} and {name}.
const PLACEHOLDER = /\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}|\{\s*([a-z_][a-z0-9_]*)\s*\}/gi;
let lastUnresolved = [];
function placeholdersIn(text) {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1] || m[2]))];
}

function refreshPreview(force = false) {
  if (previewEdited && !force) return;
  previewEdited = false;
  $("edited-flag").hidden = true;
  $("preview").value = buildPrompt();
  const warn = $("unresolved-warning");
  warn.hidden = !lastUnresolved.length;
  warn.textContent = lastUnresolved.length
    ? `Unknown placeholder${lastUnresolved.length > 1 ? "s" : ""} in the master prompt: ${lastUnresolved.map((k) => `{${k}}`).join(", ")}`
    : "";
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

// ---------- generation ----------
let generating = false;

async function generate() {
  const p = active();
  if (!p) return setStatus("status", "Pick or add a person first.", true);
  if (generating) return;
  if (!previewEdited) refreshPreview();
  const prompt = $("preview").value.trim();
  if (!prompt) return setStatus("status", "The prompt is empty.", true);
  // A hand-edited prompt is checked as typed; otherwise use what buildPrompt couldn't resolve.
  const unresolved = previewEdited ? placeholdersIn(prompt) : lastUnresolved;
  if (unresolved.length) {
    $("preview-details").open = true;
    return setStatus("status", `Not sent: the prompt still contains ${unresolved.map((k) => `{${k}}`).join(", ")}. Fix the master prompt (see Final prompt).`, true);
  }
  console.info("[Goal Celebrations] Final prompt sent to the image model:\n" + prompt);

  generating = true;
  $("generate").disabled = true;
  $("regenerate").disabled = true;
  const started = Date.now();
  const tick = setInterval(() => {
    setStatus("status", `Generating… ${Math.round((Date.now() - started) / 1000)}s (usually 30–90s)`);
  }, 1000);
  setStatus("status", "Generating…");

  try {
    const data = await apiPost("/api/generate", { prompt, quality: $("quality").value });
    if (!data.image) throw new Error("No image came back");
    lastImage = data.image;
    $("result-img").src = data.image;
    $("result").hidden = false;
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
// Per-device UI state (selected person/goal, composition choice) stays local.
const cloud = { enabled: false, timer: null, syncedPeople: new Map(), syncedSettings: null, inFlight: false };

const settingsPayload = () => ({ template: state.template, quality: state.quality, prefs: state.prefs, palettes: state.palettes, paletteId: state.paletteId });
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

// Fire-and-forget calls that shouldn't block the UI.
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
    const { template, quality, prefs, palettes, paletteId } = remote.settings;
    if (typeof template === "string") state.template = template;
    if (Array.isArray(palettes)) state.palettes = palettes;
    if (typeof paletteId === "string") state.paletteId = paletteId;
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
$("goal-select").onchange = () => { state.goalKey = $("goal-select").value; onGoalChanged(); saveLocal(); renderGoalWording(); refreshPreview(); };
$("notes").oninput = () => refreshPreview();
$("composition").onchange = (e) => {
  state.composition = e.target.value;
  $("composition-hint").textContent = COMPOSITIONS.find((c) => c.value === state.composition).hint;
  saveLocal();
  refreshPreview();
};
$("palette").onchange = (e) => { state.paletteId = e.target.value; save(); renderPalettes(); refreshPreview(); };
$("pm-name").oninput = (e) => { currentPalette().name = e.target.value; paletteChanged(false); };
$("pm-add-color").onclick = () => { currentPalette().colors.push({ name: "", hex: "#FFFFFF" }); paletteChanged(true); };
$("pm-new").onclick = () => addPalette(false);
$("pm-duplicate").onclick = () => addPalette(true);
$("pm-delete").onclick = () => {
  const pal = currentPalette();
  if (state.palettes.length <= 1 || !confirm(`Delete the palette "${pal.name}"?`)) return;
  state.palettes = state.palettes.filter((p) => p.id !== pal.id);
  state.paletteId = state.palettes[0].id;
  paletteChanged(true);
};
$("template").oninput = (e) => { state.template = e.target.value; save(); refreshPreview(); };
$("quality").onchange = (e) => { state.quality = e.target.value; save(); };
$("pref-textMode").onchange = (e) => { state.prefs.textMode = e.target.value; save(); renderGoalWording(); refreshPreview(); };
$("goal-wording").oninput = () => { goalWordingEdited = true; refreshPreview(); };
$("reset-template").onclick = () => {
  if (!confirm("Reset the master prompt to the default?")) return;
  state.template = DEFAULT_TEMPLATE;
  save();
  renderCelebrate();
};
$("preview").oninput = () => { previewEdited = true; $("edited-flag").hidden = false; };
$("rebuild").onclick = () => refreshPreview(true);
$("generate").onclick = generate;
$("regenerate").onclick = generate;
$("download").onclick = download;

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
    render();
  } catch {
    alert("That file doesn't look like a Goal Celebrations backup.");
  }
  e.target.value = "";
};

render();
initCloud();
