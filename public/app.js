// Goal Celebrations — all data lives in this browser's localStorage.

const CATEGORIES = [
  { key: "professional", label: "Professional goal", hint: "What's their professional goal?" },
  { key: "personal", label: "Personal goal", hint: "What's their personal goal?" },
  { key: "contribution", label: "Contribution goal", hint: "What's their contribution goal?" },
  { key: "selfHonor", label: "Self-honor goal", hint: "What's their self-honor goal?" },
  { key: "pmEnrollments", label: "PM enrollments", hint: "Details on their PM enrollments" },
  { key: "greatnessNotes", label: "Greatness notes", hint: "Details on their greatness notes" },
];

const DEFAULT_STYLE = `Rich, polished editorial illustration with cinematic lighting and a warm, cohesive color palette. Clean composition with breathing room around the text. Feels like a keepsake poster worth sharing.`;

const DEFAULT_TEMPLATE = `Create a celebratory square (1:1) image honoring {{name}} for completing their {{goal_type}}.

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

const STORE_KEY = "goalCelebrations.v1";
const $ = (id) => document.getElementById(id);

// ---------- state ----------
let state = load();
let previewEdited = false;
let lastImage = null;

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && Array.isArray(s.people)) return s;
  } catch {}
  return { people: [], activeId: null, template: DEFAULT_TEMPLATE, style: DEFAULT_STYLE, quality: "high" };
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
const active = () => state.people.find((p) => p.id === state.activeId);

function newPerson() {
  const goals = {};
  for (const c of CATEGORIES) goals[c.key] = { text: "", done: false };
  const p = { id: crypto.randomUUID(), name: "", description: "", goals };
  state.people.push(p);
  state.activeId = p.id;
  save();
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
    li.onclick = () => { state.activeId = p.id; save(); render(); };
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
      $("goal-select").value = c.key;
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
  }
  $("template").value = state.template;
  $("style").value = state.style;
  $("quality").value = state.quality;
  refreshPreview();
}

function render() { renderPeople(); renderProfile(); renderCelebrate(); }

// ---------- prompt building ----------
function buildPrompt() {
  const p = active();
  if (!p) return "";
  const key = $("goal-select").value;
  const cat = CATEGORIES.find((c) => c.key === key);
  const goal = p.goals[key]?.text.trim() || "";
  const notes = $("notes").value.trim();
  const allGoals = CATEGORIES
    .filter((c) => p.goals[c.key]?.text.trim())
    .map((c) => `- ${c.label}${p.goals[c.key].done ? " (complete)" : ""}: ${p.goals[c.key].text.trim()}`)
    .join("\n");

  const values = {
    name: p.name.trim() || "this person",
    description: p.description.trim(),
    goal_type: cat.label.toLowerCase(),
    goal: goal || `(no details written for their ${cat.label.toLowerCase()})`,
    notes: notes ? `Extra context on this win: ${notes}` : "",
    all_goals: allGoals,
    style: $("style").value.trim(),
  };
  return state.template
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in values ? values[k] : m))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function refreshPreview(force = false) {
  if (previewEdited && !force) return;
  previewEdited = false;
  $("edited-flag").hidden = true;
  $("preview").value = buildPrompt();
}

// ---------- generation ----------
async function generate() {
  const p = active();
  const status = $("status");
  if (!p) return setStatus("Pick or add a person first.", true);
  const prompt = $("preview").value.trim();
  if (!prompt) return setStatus("The prompt is empty.", true);

  const btn = $("generate");
  btn.disabled = true;
  $("regenerate").disabled = true;
  const started = Date.now();
  const tick = setInterval(() => {
    setStatus(`Generating… ${Math.round((Date.now() - started) / 1000)}s (usually 20–60s)`);
  }, 1000);
  setStatus("Generating…");

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-password": localStorage.getItem("goalCelebrations.password") || "",
      },
      body: JSON.stringify({ prompt, quality: $("quality").value }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      const pw = window.prompt("This app is password protected. Enter the password:");
      if (pw !== null) {
        localStorage.setItem("goalCelebrations.password", pw);
        clearInterval(tick);
        btn.disabled = false;
        return generate();
      }
      throw new Error("Password required");
    }
    if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
    lastImage = data.image;
    $("result-img").src = data.image;
    $("result").hidden = false;
    setStatus(`Done in ${Math.round((Date.now() - started) / 1000)}s.`);
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    clearInterval(tick);
    btn.disabled = false;
    $("regenerate").disabled = false;
  }
}

function setStatus(msg, isError = false) {
  const s = $("status");
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

// ---------- wiring ----------
$("new-person").onclick = newPerson;
$("delete-person").onclick = () => {
  const p = active();
  if (!p || !confirm(`Delete ${p.name || "this person"}?`)) return;
  state.people = state.people.filter((x) => x.id !== p.id);
  state.activeId = state.people[0]?.id || null;
  save();
  render();
};
$("name").oninput = (e) => { active().name = e.target.value; save(); renderPeople(); refreshPreview(); };
$("description").oninput = (e) => { active().description = e.target.value; save(); refreshPreview(); };
$("goal-select").onchange = () => refreshPreview();
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
    state = { ...load(), ...data };
    save();
    render();
  } catch {
    alert("That file doesn't look like a Goal Celebrations backup.");
  }
  e.target.value = "";
};

render();
