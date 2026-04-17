// ─── Imports ───────────────────────────────────────────────────────
import { LazyStore } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as dialogOpen, save as dialogSave } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { sampleSprite as coreSample, serialize as coreSerialize, DEFAULT_TRANSFORM } from "@cel/core";
import { exporters as allExporters } from "@cel/export";

const store = new LazyStore("cel.json");

// ─── Store keys ─────────────────────────────────────────────────────
const K = { current: "current", settings: "settings", scenes: "scenes" };

// ─── Helpers ────────────────────────────────────────────────────────
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const fmt = (ms) => (ms / 1000).toFixed(2) + "s";
const lerp = (a, b, t) => a + (b - a) * t;
const KF_DEF = DEFAULT_TRANSFORM;
const _interpOut = { x: 0, y: 0, opacity: 1, fontSize: 18, rotation: 0, color: "" };

// ─── File state ─────────────────────────────────────────────────────
let _openedPath = null;
let _dirty = false;

function markDirty() {
  _dirty = true;
  updateTitle();
}
function markClean() {
  _dirty = false;
  updateTitle();
}
function updateTitle() {
  const name = _openedPath ? _openedPath.split(/[/\\]/).pop() : "Untitled";
  const indicator = _dirty ? " ●" : "";
  getCurrentWindow().setTitle(`${name}${indicator} — Cel`);
}

// ─── Color resolution (for color interpolation) ─────────────────────
// Cache stores { str: "rgb(...)", rgb: [r,g,b] } to avoid re-parsing
const colorCache = new Map();
const COLOR_OPTS = ["primary", "secondary", "tertiary", "info", "success", "warning", "danger"];
window.matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => colorCache.clear());
const parseRgb = c => (c.match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(Number);
// Persistent off-screen probe element — created once, never removed.
// Setting its color and reading computed style forces browser resolution to rgb() format.
let _probe;
function _getProbe() {
  if (!_probe) {
    _probe = document.createElement("span");
    _probe.style.cssText = "position:fixed;top:-9999px;left:-9999px;pointer-events:none;visibility:hidden";
    document.body.appendChild(_probe);
  }
  return _probe;
}

function resolveColor(c) {
  if (!c) return null;
  if (c.startsWith("rgb") || c.startsWith("#")) return c;
  const cached = colorCache.get(c);
  if (cached) return cached.str;
  const probe = _getProbe();
  probe.style.color = `var(--${c})`;
  const str = getComputedStyle(probe).color;
  colorCache.set(c, { str, rgb: parseRgb(str) });
  return str;
}

function resolveRgb(c) {
  if (!c) return null;
  if (c.startsWith("rgb") || c.startsWith("#")) return parseRgb(c);
  const cached = colorCache.get(c);
  if (cached) return cached.rgb;
  resolveColor(c);
  return colorCache.get(c)?.rgb || null;
}

function lerpColor(a, b, t) {
  if (a === b) return a;
  const pa = resolveRgb(a), pb = resolveRgb(b);
  if (!pa) return b; if (!pb) return a;
  return `rgb(${Math.round(lerp(pa[0], pb[0], t))},${Math.round(lerp(pa[1], pb[1], t))},${Math.round(lerp(pa[2], pb[2], t))})`;
}

// ─── Keyframe interpolation (delegates to @cel/core) ────────
// DOM-based color resolver for named tokens
const _domResolver = {
  resolve(token) {
    const rgb = resolveRgb(token);
    return rgb || [128, 128, 128];
  },
};

const _tmpSprite = { id: "_tmp", text: "", keyframes: [] };
function interpKfs(kfs, t, out) {
  _tmpSprite.keyframes = kfs;
  const sampled = coreSample(_tmpSprite, t, _domResolver);
  const dest = out || {};
  dest.x = sampled.x;
  dest.y = sampled.y;
  dest.opacity = sampled.opacity;
  dest.fontSize = sampled.fontSize;
  dest.rotation = sampled.rotation;
  dest.color = sampled.color;
  return dest;
}

function textAt(sp, t) {
  let last = sp.text;
  for (const kf of sp.keyframes) { if (kf.t > t) break; if (kf.text != null) last = kf.text; }
  return last;
}

// ─── Presets ────────────────────────────────────────────────────────
const PRESETS = {
  sleeping: { duration: 4000, sprites: [
    { id: "face", text: "( -_- )", keyframes: [
      { t: 0, x: 5.5, y: 5, opacity: 1, fontSize: 22, rotation: 0, color: "secondary", easing: "inout" },
      { t: 1500, text: "( -_- )", x: 5.5, y: 5.6, opacity: 1, fontSize: 22, rotation: -1, color: "secondary", easing: "inout" },
      { t: 1600, text: "( ._. )", x: 5.5, y: 5.6, opacity: 1, fontSize: 22, rotation: -1, color: "secondary", easing: "inout" },
      { t: 1700, text: "( -_- )", x: 5.5, y: 5.6, opacity: 1, fontSize: 22, rotation: 0, color: "secondary", easing: "inout" },
      { t: 4000, x: 5.5, y: 5, opacity: 1, fontSize: 22, rotation: 0, color: "secondary", easing: "inout" },
    ]},
    { id: "z1", text: "z", keyframes: [
      { t: 0, x: 16.5, y: 5, opacity: 0, fontSize: 11, color: "tertiary", easing: "linear" },
      { t: 120, x: 16.5, y: 5, opacity: 0.7, fontSize: 13, color: "tertiary", easing: "out" },
      { t: 800, x: 18.5, y: 1.5, opacity: 0, fontSize: 22, color: "tertiary", easing: "in" },
      { t: 4000, x: 16.5, y: 5, opacity: 0, fontSize: 11, color: "tertiary", easing: "linear" },
    ]},
    { id: "z2", text: "z", keyframes: [
      { t: 700, x: 16.5, y: 5, opacity: 0, fontSize: 11, color: "tertiary", easing: "linear" },
      { t: 820, x: 16.5, y: 5, opacity: 0.7, fontSize: 15, color: "tertiary", easing: "out" },
      { t: 1600, x: 19.5, y: 1, opacity: 0, fontSize: 26, color: "tertiary", easing: "in" },
      { t: 4000, x: 16.5, y: 5, opacity: 0, fontSize: 11, color: "tertiary", easing: "linear" },
    ]},
    { id: "Z3", text: "Z", keyframes: [
      { t: 1400, x: 16.5, y: 5, opacity: 0, fontSize: 11, color: "tertiary", easing: "linear" },
      { t: 1520, x: 16.5, y: 5, opacity: 0.7, fontSize: 18, color: "tertiary", easing: "out" },
      { t: 2400, x: 22, y: 0.5, opacity: 0, fontSize: 32, color: "tertiary", easing: "in" },
      { t: 4000, x: 16.5, y: 5, opacity: 0, fontSize: 11, color: "tertiary", easing: "linear" },
    ]},
  ]},
  spinner: { duration: 800, sprites: [
    { id: "spin", text: "|", keyframes: [
      { t: 0, text: "|", x: 12, y: 5, opacity: 1, fontSize: 24, color: "info", easing: "linear" },
      { t: 200, text: "/", x: 12, y: 5, opacity: 1, fontSize: 24, color: "info", easing: "linear" },
      { t: 400, text: "\u2500", x: 12, y: 5, opacity: 1, fontSize: 24, color: "info", easing: "linear" },
      { t: 600, text: "\\", x: 12, y: 5, opacity: 1, fontSize: 24, color: "info", easing: "linear" },
      { t: 800, text: "|", x: 12, y: 5, opacity: 1, fontSize: 24, color: "info", easing: "linear" },
    ]},
  ]},
  heartbeat: { duration: 1200, sprites: [
    { id: "heart", text: "<3", keyframes: [
      { t: 0, x: 12, y: 4.5, opacity: 1, fontSize: 28, color: "danger", easing: "out" },
      { t: 100, x: 12, y: 4.3, opacity: 1, fontSize: 44, color: "danger", easing: "in" },
      { t: 250, x: 12, y: 4.5, opacity: 1, fontSize: 26, color: "danger", easing: "out" },
      { t: 400, x: 12, y: 4.3, opacity: 1, fontSize: 38, color: "danger", easing: "in" },
      { t: 550, x: 12, y: 4.5, opacity: 1, fontSize: 28, color: "danger", easing: "inout" },
      { t: 1200, x: 12, y: 4.5, opacity: 1, fontSize: 28, color: "danger", easing: "inout" },
    ]},
  ]},
  loading: { duration: 1500, sprites: [
    { id: "dot1", text: ".", keyframes: [
      { t: 0, x: 10, y: 5, opacity: 0, fontSize: 32, color: "info", easing: "out" },
      { t: 200, x: 10, y: 5, opacity: 1, fontSize: 32, color: "info", easing: "inout" },
      { t: 1500, x: 10, y: 5, opacity: 1, fontSize: 32, color: "info", easing: "linear" },
    ]},
    { id: "dot2", text: ".", keyframes: [
      { t: 0, x: 12, y: 5, opacity: 0, fontSize: 32, color: "info", easing: "linear" },
      { t: 300, x: 12, y: 5, opacity: 0, fontSize: 32, color: "info", easing: "out" },
      { t: 500, x: 12, y: 5, opacity: 1, fontSize: 32, color: "info", easing: "inout" },
      { t: 1500, x: 12, y: 5, opacity: 1, fontSize: 32, color: "info", easing: "linear" },
    ]},
    { id: "dot3", text: ".", keyframes: [
      { t: 0, x: 14, y: 5, opacity: 0, fontSize: 32, color: "info", easing: "linear" },
      { t: 600, x: 14, y: 5, opacity: 0, fontSize: 32, color: "info", easing: "out" },
      { t: 800, x: 14, y: 5, opacity: 1, fontSize: 32, color: "info", easing: "inout" },
      { t: 1500, x: 14, y: 5, opacity: 1, fontSize: 32, color: "info", easing: "linear" },
    ]},
  ]},
  pulse: { duration: 2000, sprites: [
    { id: "ring", text: "( * )", keyframes: [
      { t: 0, x: 10, y: 5, opacity: 1, fontSize: 18, color: "success", easing: "out" },
      { t: 500, x: 10, y: 5, opacity: 1, fontSize: 32, color: "success", easing: "in" },
      { t: 1000, x: 10, y: 5, opacity: 1, fontSize: 18, color: "success", easing: "out" },
      { t: 1500, x: 10, y: 5, opacity: 1, fontSize: 28, color: "success", easing: "in" },
      { t: 2000, x: 10, y: 5, opacity: 1, fontSize: 18, color: "success", easing: "inout" },
    ]},
  ]},
  blink: { duration: 1000, sprites: [
    { id: "cursor", text: "_", keyframes: [
      { t: 0, x: 12, y: 5, opacity: 1, fontSize: 24, color: "primary", easing: "linear" },
      { t: 490, x: 12, y: 5, opacity: 1, fontSize: 24, color: "primary", easing: "linear" },
      { t: 500, x: 12, y: 5, opacity: 0, fontSize: 24, color: "primary", easing: "linear" },
      { t: 990, x: 12, y: 5, opacity: 0, fontSize: 24, color: "primary", easing: "linear" },
      { t: 1000, x: 12, y: 5, opacity: 1, fontSize: 24, color: "primary", easing: "linear" },
    ]},
  ]},
  bounce: { duration: 2000, sprites: [
    { id: "ball", text: "O", keyframes: [
      { t: 0, x: 12, y: 1, opacity: 1, fontSize: 22, color: "warning", easing: "in" },
      { t: 500, x: 12, y: 9, opacity: 1, fontSize: 22, color: "warning", easing: "out" },
      { t: 1000, x: 12, y: 1, opacity: 1, fontSize: 22, color: "warning", easing: "in" },
      { t: 1500, x: 12, y: 9, opacity: 1, fontSize: 22, color: "warning", easing: "out" },
      { t: 2000, x: 12, y: 1, opacity: 1, fontSize: 22, color: "warning", easing: "inout" },
    ]},
    { id: "shadow", text: "---", keyframes: [
      { t: 0, x: 11.5, y: 10, opacity: 0.15, fontSize: 18, color: "secondary", easing: "in" },
      { t: 500, x: 11.5, y: 10, opacity: 0.4, fontSize: 18, color: "secondary", easing: "out" },
      { t: 1000, x: 11.5, y: 10, opacity: 0.15, fontSize: 18, color: "secondary", easing: "in" },
      { t: 1500, x: 11.5, y: 10, opacity: 0.4, fontSize: 18, color: "secondary", easing: "out" },
      { t: 2000, x: 11.5, y: 10, opacity: 0.15, fontSize: 18, color: "secondary", easing: "inout" },
    ]},
  ]},
  wave: { duration: 2000, sprites: [
    { id: "w1", text: "~", keyframes: [
      { t: 0, x: 5, y: 6, opacity: 0.8, fontSize: 20, color: "info", easing: "inout" },
      { t: 1000, x: 5, y: 4, opacity: 0.8, fontSize: 20, color: "info", easing: "inout" },
      { t: 2000, x: 5, y: 6, opacity: 0.8, fontSize: 20, color: "info", easing: "inout" },
    ]},
    { id: "w2", text: "~", keyframes: [
      { t: 0, x: 9, y: 4.5, opacity: 0.8, fontSize: 20, color: "info", easing: "inout" },
      { t: 1000, x: 9, y: 6.5, opacity: 0.8, fontSize: 20, color: "info", easing: "inout" },
      { t: 2000, x: 9, y: 4.5, opacity: 0.8, fontSize: 20, color: "info", easing: "inout" },
    ]},
    { id: "w3", text: "~", keyframes: [
      { t: 0, x: 13, y: 6, opacity: 0.8, fontSize: 20, color: "info", easing: "inout" },
      { t: 1000, x: 13, y: 4, opacity: 0.8, fontSize: 20, color: "info", easing: "inout" },
      { t: 2000, x: 13, y: 6, opacity: 0.8, fontSize: 20, color: "info", easing: "inout" },
    ]},
    { id: "w4", text: "~", keyframes: [
      { t: 0, x: 17, y: 4.5, opacity: 0.8, fontSize: 20, color: "info", easing: "inout" },
      { t: 1000, x: 17, y: 6.5, opacity: 0.8, fontSize: 20, color: "info", easing: "inout" },
      { t: 2000, x: 17, y: 4.5, opacity: 0.8, fontSize: 20, color: "info", easing: "inout" },
    ]},
    { id: "w5", text: "~", keyframes: [
      { t: 0, x: 21, y: 6, opacity: 0.8, fontSize: 20, color: "info", easing: "inout" },
      { t: 1000, x: 21, y: 4, opacity: 0.8, fontSize: 20, color: "info", easing: "inout" },
      { t: 2000, x: 21, y: 6, opacity: 0.8, fontSize: 20, color: "info", easing: "inout" },
    ]},
  ]},
  matrix: { duration: 3000, sprites: [
    { id: "c1", text: "0", keyframes: [
      { t: 0, x: 3, y: -1, opacity: 0, fontSize: 16, color: "success", easing: "linear" },
      { t: 100, x: 3, y: -1, opacity: 0.8, fontSize: 16, color: "success", easing: "linear" },
      { t: 2000, x: 3, y: 12, opacity: 0.1, fontSize: 16, color: "success", easing: "linear" },
      { t: 3000, x: 3, y: 12, opacity: 0, fontSize: 16, color: "success", easing: "linear" },
    ]},
    { id: "c2", text: "1", keyframes: [
      { t: 400, x: 8, y: -1, opacity: 0, fontSize: 16, color: "success", easing: "linear" },
      { t: 500, x: 8, y: -1, opacity: 0.9, fontSize: 16, color: "success", easing: "linear" },
      { t: 2200, x: 8, y: 12, opacity: 0.1, fontSize: 16, color: "success", easing: "linear" },
      { t: 3000, x: 8, y: 12, opacity: 0, fontSize: 16, color: "success", easing: "linear" },
    ]},
    { id: "c3", text: "0", keyframes: [
      { t: 800, x: 14, y: -1, opacity: 0, fontSize: 16, color: "success", easing: "linear" },
      { t: 900, x: 14, y: -1, opacity: 0.7, fontSize: 16, color: "success", easing: "linear" },
      { t: 2600, x: 14, y: 12, opacity: 0.1, fontSize: 16, color: "success", easing: "linear" },
      { t: 3000, x: 14, y: 12, opacity: 0, fontSize: 16, color: "success", easing: "linear" },
    ]},
    { id: "c4", text: "1", keyframes: [
      { t: 200, x: 19, y: -1, opacity: 0, fontSize: 16, color: "success", easing: "linear" },
      { t: 300, x: 19, y: -1, opacity: 0.85, fontSize: 16, color: "success", easing: "linear" },
      { t: 1800, x: 19, y: 12, opacity: 0.1, fontSize: 16, color: "success", easing: "linear" },
      { t: 3000, x: 19, y: 12, opacity: 0, fontSize: 16, color: "success", easing: "linear" },
    ]},
    { id: "c5", text: "0", keyframes: [
      { t: 1200, x: 24, y: -1, opacity: 0, fontSize: 16, color: "success", easing: "linear" },
      { t: 1300, x: 24, y: -1, opacity: 0.75, fontSize: 16, color: "success", easing: "linear" },
      { t: 2800, x: 24, y: 12, opacity: 0.1, fontSize: 16, color: "success", easing: "linear" },
      { t: 3000, x: 24, y: 12, opacity: 0, fontSize: 16, color: "success", easing: "linear" },
    ]},
  ]},
};

// ─── App state ──────────────────────────────────────────────────────
let CW = 10.2, LH = 22;
const S = {
  sprites: [],
  t: 0,
  playing: false,
  looping: true,
  duration: 4000,
  speed: 1,
  theme: "auto",
  selSprite: null,
  selKf: null,
};
let _raf = null, _last = null;
const $ = id => document.getElementById(id);

// ─── Undo / Redo ───────────────────────────────────────────────────
const undoStack = [];
const redoStack = [];
const MAX_UNDO = 30;
let _clipboard = null;

function pushUndo() {
  undoStack.push(structuredClone({ sprites: S.sprites, duration: S.duration }));
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0;
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(structuredClone({ sprites: S.sprites, duration: S.duration }));
  const snap = undoStack.pop();
  S.sprites = snap.sprites;
  S.duration = snap.duration;
  S.selSprite = S.sprites[0]?.id || null;
  S.selKf = null;
  $("dsl").value = S.duration;
  $("dv").textContent = (S.duration / 1000).toFixed(1) + "s";
  renderAll();
  autosave();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(structuredClone({ sprites: S.sprites, duration: S.duration }));
  const snap = redoStack.pop();
  S.sprites = snap.sprites;
  S.duration = snap.duration;
  S.selSprite = S.sprites[0]?.id || null;
  S.selKf = null;
  $("dsl").value = S.duration;
  $("dv").textContent = (S.duration / 1000).toFixed(1) + "s";
  renderAll();
  autosave();
}

// ─── Store integration ─────────────────────────────────────────────
let saveTimer = null;
let _lastSaveErrTime = 0;
const _state = { current: null, settings: null, scenes: null };
async function autosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      _state.current = normalizeCurrent({ sprites: S.sprites, duration: S.duration })
        || { sprites: S.sprites, duration: S.duration };
      await store.set(K.current, _state.current);
      await store.save();
      markClean();
    } catch (e) {
      console.error("autosave failed:", e);
      const now = Date.now();
      if (now - _lastSaveErrTime > 5000) { toast("autosave failed", "err"); _lastSaveErrTime = now; }
    }
  }, 400);
}

async function saveSettings() {
  try {
    await store.set(K.settings, { looping: S.looping, speed: S.speed, duration: S.duration, theme: S.theme });
    await store.save();
  } catch (e) {
    console.error("saveSettings:", e);
    const now = Date.now();
    if (now - _lastSaveErrTime > 5000) { toast("settings save failed", "err"); _lastSaveErrTime = now; }
  }
}

async function saveSceneAs(name) {
  if (!name) return;
  const scenes = (await store.get(K.scenes)) || {};
  const normalized = normalizeCurrent({ sprites: S.sprites, duration: S.duration });
  if (!normalized) return;
  scenes[name] = { ...normalized, saved: Date.now() };
  await store.set(K.scenes, scenes);
  await store.save();
  toast(`saved: ${name}`);
  renderScenesList();
}

async function loadSavedScene(name) {
  const scenes = (await store.get(K.scenes)) || {};
  if (!scenes[name]) return;
  pushUndo();
  S.sprites = structuredClone(scenes[name].sprites);
  S.duration = scenes[name].duration;
  S.selSprite = S.sprites[0]?.id || null;
  S.selKf = null;
  document.getElementById("dsl").value = S.duration;
  document.getElementById("dv").textContent = (S.duration / 1000).toFixed(1) + "s";
  renderAll();
  autosave();
  toast(`loaded: ${name}`);
}

async function deleteSavedScene(name) {
  const scenes = (await store.get(K.scenes)) || {};
  delete scenes[name];
  await store.set(K.scenes, scenes);
  await store.save();
  renderScenesList();
}

// ─── Preview rendering ─────────────────────────────────────────────
let _preview, _stage, _scrub, _tdisp;
const _elMap = new Map();
const _elPrev = new Map();
let _tlW = 250;
let _lastScrubLeft = "", _lastTimeText = "";

function measureChar() {
  if (!_stage) _stage = $("stage");
  const s = document.createElement("span");
  s.style.cssText = "position:absolute;opacity:0;font-family:var(--font-mono);font-size:18px;white-space:pre;pointer-events:none;line-height:1.375";
  s.textContent = "M";
  _stage.appendChild(s);
  const r = s.getBoundingClientRect();
  if (r.width > 0) { CW = r.width; LH = r.height; }
  _stage.removeChild(s);
  if (!_tl) _tl = $("tl");
  _tlW = Math.max(_tl ? _tl.clientWidth - 16 : 200, 200);
}

function syncEls() {
  if (!_stage) _stage = $("stage");
  _stage.querySelectorAll(".sp-el").forEach(el => {
    if (!S.sprites.find(s => s.id === el.dataset.id)) {
      el.remove();
      _elPrev.delete(el.dataset.id);
    }
  });
  S.sprites.forEach(sp => {
    if (!_stage.querySelector(`.sp-el[data-id="${CSS.escape(sp.id)}"]`)) {
      const el = document.createElement("span");
      el.className = "sp-el"; el.dataset.id = sp.id;
      _stage.appendChild(el);
    }
    if (!_elPrev.has(sp.id)) _elPrev.set(sp.id, { tx: "", op: "", fs: "", cl: "", txt: "" });
  });
  _elMap.clear();
  _stage.querySelectorAll(".sp-el").forEach(el => _elMap.set(el.dataset.id, el));
}

function renderPreview(t) {
  if (!_preview) _preview = $("preview");
  if (!_scrub) _scrub = $("scrub");
  if (!_tdisp) _tdisp = $("tdisp");
  for (let i = 0, n = S.sprites.length; i < n; i++) {
    const sp = S.sprites[i];
    const el = _elMap.get(sp.id);
    if (!el) continue;
    const p = interpKfs(sp.keyframes, t, _interpOut);
    const prev = _elPrev.get(sp.id);

    // Only update text when it changes (avoids text layout recalc)
    const txt = textAt(sp, t);
    if (prev.txt !== txt) { el.textContent = txt; prev.txt = txt; }

    // Transform — round to 1 decimal to reduce string churn and sub-pixel jitter
    const tx = `translate(${(p.x * CW).toFixed(1)}px,${(p.y * LH).toFixed(1)}px) rotate(${p.rotation.toFixed(1)}deg)`;
    if (prev.tx !== tx) { el.style.transform = tx; prev.tx = tx; }

    // Opacity — round to 2 decimals, compare as string
    const op = p.opacity.toFixed(2);
    if (prev.op !== op) { el.style.opacity = op; prev.op = op; }

    // Font size — round to nearest px (sub-pixel font sizes cause extra layout work)
    const fs = Math.round(p.fontSize) + "px";
    if (prev.fs !== fs) { el.style.fontSize = fs; prev.fs = fs; }

    // Color
    const cl = p.color && p.color.startsWith("rgb") ? p.color : `var(--${p.color || "secondary"})`;
    if (prev.cl !== cl) { el.style.color = cl; prev.cl = cl; }
  }
  const scrubLeft = (((t / S.duration) * _tlW) + 8).toFixed(1) + "px";
  if (_lastScrubLeft !== scrubLeft) { _scrub.style.left = scrubLeft; _lastScrubLeft = scrubLeft; }
  const timeText = fmt(t) + " / " + fmt(S.duration);
  if (_lastTimeText !== timeText) { _tdisp.textContent = timeText; _lastTimeText = timeText; }
}

// ─── Playback ──────────────────────────────────────────────────────
function tick(now) {
  if (!S.playing) return;
  if (_last === null) _last = now;
  const dt = Math.min(now - _last, 100) * S.speed;
  S.t += dt;
  _last = now;
  if (S.t >= S.duration) {
    if (S.looping) S.t %= S.duration;
    else { S.t = S.duration; stopPlay(); }
  }
  renderPreview(S.t);
  if (S.playing) _raf = requestAnimationFrame(tick);
}

let _bplay;
function startPlay() {
  S.playing = true; _last = null;
  if (!_bplay) _bplay = $("bplay");
  _bplay.textContent = "pause";
  _raf = requestAnimationFrame(tick);
}

function stopPlay() {
  S.playing = false; cancelAnimationFrame(_raf); _raf = null; _last = null;
  if (!_bplay) _bplay = $("bplay");
  _bplay.textContent = "play";
}

// ─── Timeline ──────────────────────────────────────────────────────
let _tl, _ruler, _tracks, _slist;
function tlWidth() {
  if (!_tl) _tl = $("tl");
  _tlW = Math.max(_tl.clientWidth - 16, 200); // subtract horizontal padding (8px each side)
  return _tlW;
}

function renderRuler() {
  if (!_ruler) _ruler = $("ruler");
  const tw = tlWidth();
  _ruler.innerHTML = "";
  const step = S.duration <= 1500 ? 200 : S.duration <= 5000 ? 500 : 1000;
  for (let t = 0; t <= S.duration; t += step) {
    const tk = document.createElement("div");
    tk.className = "rtick";
    tk.style.left = ((t / S.duration) * tw) + "px";
    tk.textContent = t < 1000 ? t + "ms" : (t / 1000).toFixed(t % 1000 ? 1 : 0) + "s";
    _ruler.appendChild(tk);
  }
}

function renderTracks() {
  if (!_tracks) _tracks = $("tracks");
  const tw = tlWidth();
  _tracks.innerHTML = "";
  for (let si = 0, sn = S.sprites.length; si < sn; si++) {
    const sp = S.sprites[si];
    const track = document.createElement("div");
    track.className = "track";
    track.dataset.si = si;
    for (let ki = 0, kn = sp.keyframes.length; ki < kn; ki++) {
      const kf = sp.keyframes[ki];
      const isSel = S.selKf && S.selKf.si === si && S.selKf.ki === ki;
      const dot = document.createElement("div");
      dot.className = "kf" + (isSel ? " on" : "") + (kf.text != null ? " has-text" : "");
      dot.style.left = ((kf.t / S.duration) * tw) + "px";
      dot.dataset.si = si;
      dot.dataset.ki = ki;
      dot.dataset.spid = sp.id;
      track.appendChild(dot);
    }
    _tracks.appendChild(track);
  }
}

function renderSpriteList() {
  if (!_slist) _slist = $("slist");
  _slist.innerHTML = "";
  for (let si = 0, sn = S.sprites.length; si < sn; si++) {
    const sp = S.sprites[si];
    const row = document.createElement("div");
    row.className = "sr" + (sp.id === S.selSprite ? " on" : "");
    row.draggable = true;
    row.dataset.si = String(si);
    row.innerHTML = `<span class="snm">${escapeHtml(sp.id)}</span><span class="sdel" title="delete">×</span>`;
    // Drag-and-drop for z-order reordering
    row.addEventListener("dragstart", e => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(si));
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      _slist.querySelectorAll(".sr").forEach(r => r.classList.remove("drag-over"));
    });
    row.addEventListener("dragover", e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; row.classList.add("drag-over"); });
    row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
    row.addEventListener("drop", e => {
      e.preventDefault();
      const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
      const toIdx = parseInt(row.dataset.si, 10);
      if (fromIdx === toIdx || isNaN(fromIdx)) return;
      pushUndo();
      const [moved] = S.sprites.splice(fromIdx, 1);
      S.sprites.splice(toIdx, 0, moved);
      S.selKf = null;
      renderAll(); autosave();
    });
    const si_f = si;
    row.querySelector(".sdel").onclick = e => {
      e.stopPropagation();
      pushUndo();
      S.sprites.splice(si_f, 1);
      if (S.sprites.length === 0) S.selSprite = null;
      else if (!S.sprites.find(s => s.id === S.selSprite)) S.selSprite = S.sprites[0].id;
      S.selKf = null;
      renderAll(); autosave();
    };
    row.onclick = () => { S.selSprite = sp.id; S.selKf = null; renderAll(); };
    _slist.appendChild(row);
  }
}

function renderProps() {
  const panel = $("props");
  if (!S.selKf) {
    const sp = S.sprites.find(s => s.id === S.selSprite);
    if (!sp) { panel.innerHTML = '<span class="hint">no sprite selected</span>'; return; }
    panel.innerHTML = `
      <label>id <input class="pt" id="pid" value="${escapeHtml(sp.id)}" maxlength="40" /></label>
      <label>default text <input class="pt" id="ptxt" value="${escapeHtml(sp.text)}" /></label>
      <span class="hint">click a keyframe to edit</span>`;
    $("pid").onchange = e => {
      const n = e.target.value.trim() || sp.id;
      if (!/^[a-zA-Z0-9_-]+$/.test(n)) { toast("ID must be alphanumeric (a-z, 0-9, _, -)", "err"); e.target.value = sp.id; return; }
      if (n !== sp.id && !S.sprites.find(s => s.id === n)) {
        pushUndo();
        const old = sp.id; sp.id = n;
        if (S.selSprite === old) S.selSprite = n;
        autosave(); renderAll();
      }
    };
    $("ptxt").oninput = e => { sp.text = e.target.value; renderPreview(S.t); };
    $("ptxt").onchange = autosave;
    return;
  }
  const sp = S.sprites[S.selKf.si];
  const kf = sp?.keyframes[S.selKf.ki];
  if (!kf) { panel.innerHTML = ""; return; }
  const field = (lbl, key, min, max, step) =>
    `<label>${lbl} <input class="pi" type="number" value="${round(kf[key] ?? 0, 2)}" min="${min}" max="${max}" step="${step}" data-key="${key}" /></label>`;
  const colorOpts = COLOR_OPTS.map(c => `<option value="${c}"${(kf.color || "secondary") === c ? " selected" : ""}>${c}</option>`).join("");
  panel.innerHTML = `
    ${field("t", "t", 0, S.duration, 10)}
    ${field("x", "x", -5, 60, 0.5)}${field("y", "y", -3, 20, 0.5)}
    ${field("op", "opacity", 0, 1, 0.05)}${field("size", "fontSize", 6, 64, 1)}${field("rot", "rotation", -360, 360, 5)}
    <label>color <select class="ps" data-key="color">${colorOpts}</select></label>
    <label>ease <select class="ps" data-key="easing">${["linear", "in", "out", "inout", "custom"].map(e => `<option value="${e}"${(typeof kf.easing === "object" ? "custom" : (kf.easing || "linear")) === e ? " selected" : ""}>${e}</option>`).join("")}</select></label>
    <div id="bezier-wrap"></div>
    <label>text <input class="pt" value="${kf.text != null ? escapeHtml(kf.text) : ""}" data-key="text" placeholder="(inherit)" /></label>
    <button class="b" id="kfclose">done</button>
    <button class="b danger" id="kfdel">delete keyframe</button>`;
  $("kfclose").onclick = () => { S.selKf = null; renderAll(); };
  $("kfdel").onclick = () => {
    if (sp.keyframes.length <= 1) return;
    pushUndo();
    sp.keyframes.splice(S.selKf.ki, 1);
    S.selKf = null; renderAll(); autosave();
  };
  panel.querySelectorAll("[data-key]").forEach(el => {
    const key = el.dataset.key;
    const update = (commit) => {
      let val;
      if (el.tagName === "SELECT") val = el.value;
      else if (key === "text") val = el.value;
      else { val = parseFloat(el.value); if (isNaN(val)) return; }
      if (commit) pushUndo();
      if (key === "easing") {
        if (val === "custom") {
          kf.easing = typeof kf.easing === "object" ? kf.easing : { cubic: [0.25, 0.1, 0.25, 1.0] };
          renderBezierEditor($("bezier-wrap"), kf, sp);
        } else {
          kf.easing = val;
          $("bezier-wrap").innerHTML = "";
        }
      } else if (key === "text" && val === "") delete kf.text;
      else kf[key] = val;
      if (key === "t") { sp.keyframes.sort((a, b) => a.t - b.t); S.selKf.ki = sp.keyframes.indexOf(kf); }
      renderPreview(S.t);
      if (commit) { renderTracks(); autosave(); }
    };
    el.addEventListener("change", () => update(true));
    if (el.tagName !== "SELECT") el.addEventListener("input", () => update(false));
  });
  // Show bezier editor if easing is already cubic
  if (typeof kf.easing === "object" && kf.easing.cubic) {
    renderBezierEditor($("bezier-wrap"), kf, sp);
  }
}

function renderBezierEditor(wrap, kf, sp) {
  const S_ = 180, PAD = 20, INNER = S_ - 2 * PAD;
  const pts = kf.easing && kf.easing.cubic ? [...kf.easing.cubic] : [0.25, 0.1, 0.25, 1.0];
  const sx = v => PAD + v * INNER;
  const sy = v => PAD + (1 - v) * INNER;

  function buildSVG() {
    const x1 = pts[0], y1 = pts[1], x2 = pts[2], y2 = pts[3];
    return `<svg class="bezier-svg" viewBox="0 0 ${S_} ${S_}" width="${S_}" height="${S_}">
      <line x1="${PAD}" y1="${PAD}" x2="${PAD}" y2="${PAD + INNER}" stroke="var(--border)" stroke-width="0.5"/>
      <line x1="${PAD}" y1="${PAD + INNER}" x2="${PAD + INNER}" y2="${PAD + INNER}" stroke="var(--border)" stroke-width="0.5"/>
      <line x1="${PAD}" y1="${PAD + INNER}" x2="${PAD + INNER}" y2="${PAD}" stroke="var(--fg-4)" stroke-width="0.5" stroke-dasharray="4"/>
      <line class="bezier-handle" x1="${sx(0)}" y1="${sy(0)}" x2="${sx(x1)}" y2="${sy(y1)}"/>
      <line class="bezier-handle" x1="${sx(1)}" y1="${sy(1)}" x2="${sx(x2)}" y2="${sy(y2)}"/>
      <path class="bezier-curve" d="M ${sx(0)},${sy(0)} C ${sx(x1)},${sy(y1)} ${sx(x2)},${sy(y2)} ${sx(1)},${sy(1)}"/>
      <circle class="bezier-point" data-pt="1" cx="${sx(x1)}" cy="${sy(y1)}" r="6"/>
      <circle class="bezier-point" data-pt="2" cx="${sx(x2)}" cy="${sy(y2)}" r="6"/>
    </svg>`;
  }

  const PRESETS = [
    { name: "ease", v: [0.25, 0.1, 0.25, 1.0] },
    { name: "ease-in", v: [0.42, 0, 1, 1] },
    { name: "ease-out", v: [0, 0, 0.58, 1] },
    { name: "ease-in-out", v: [0.42, 0, 0.58, 1] },
  ];

  function refresh() {
    kf.easing = { cubic: pts.map(v => Math.round(v * 1000) / 1000) };
    wrap.querySelector(".bezier-svg-wrap").innerHTML = buildSVG();
    attachDrag();
    wrap.querySelectorAll(".bezier-val").forEach((inp, i) => { inp.value = pts[i].toFixed(2); });
    renderPreview(S.t);
  }

  function attachDrag() {
    wrap.querySelectorAll(".bezier-point").forEach(circle => {
      circle.addEventListener("mousedown", e => {
        e.preventDefault();
        const ptIdx = circle.dataset.pt === "1" ? 0 : 2;
        const svg = wrap.querySelector(".bezier-svg");
        const rect = svg.getBoundingClientRect();
        const scale = S_ / rect.width;
        let moved = false;
        const onMove = ev => {
          moved = true;
          const mx = (ev.clientX - rect.left) * scale;
          const my = (ev.clientY - rect.top) * scale;
          pts[ptIdx] = clamp((mx - PAD) / INNER, 0, 1);
          pts[ptIdx + 1] = clamp(1 - (my - PAD) / INNER, 0, 1);
          refresh();
        };
        const onUp = () => {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
          if (moved) { pushUndo(); autosave(); }
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    });
  }

  wrap.innerHTML = `
    <div class="bezier-editor">
      <div class="bezier-svg-wrap">${buildSVG()}</div>
      <div class="bezier-presets">${PRESETS.map(p => `<button class="b" data-bpre="${p.name}">${p.name}</button>`).join("")}</div>
      <div class="bezier-inputs">
        ${pts.map((v, i) => `<input class="pi bezier-val" type="number" min="0" max="1" step="0.05" value="${v.toFixed(2)}" data-bi="${i}"/>`).join("")}
      </div>
    </div>`;
  attachDrag();

  // Preset buttons
  wrap.querySelectorAll("[data-bpre]").forEach(btn => {
    btn.onclick = () => {
      const pre = PRESETS.find(p => p.name === btn.dataset.bpre);
      if (pre) { pushUndo(); pts[0] = pre.v[0]; pts[1] = pre.v[1]; pts[2] = pre.v[2]; pts[3] = pre.v[3]; refresh(); autosave(); }
    };
  });

  // Numeric inputs
  wrap.querySelectorAll(".bezier-val").forEach(inp => {
    inp.addEventListener("change", () => {
      const i = parseInt(inp.dataset.bi, 10);
      const v = parseFloat(inp.value);
      if (!isNaN(v)) { pushUndo(); pts[i] = clamp(v, 0, 1); refresh(); autosave(); }
    });
  });
}

let _scenesSel, _bdelscene;
async function renderScenesList() {
  if (!_scenesSel) _scenesSel = $("scenes-sel");
  if (!_bdelscene) _bdelscene = $("bdelscene");
  const scenes = (await store.get(K.scenes)) || {};
  const names = Object.keys(scenes).sort((a, b) => scenes[b].saved - scenes[a].saved);
  _scenesSel.innerHTML = `<option value="">— saved scenes —</option>` +
    names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
  _bdelscene.disabled = names.length === 0;
}

function renderAll() {
  syncEls(); renderSpriteList(); renderRuler(); renderTracks(); renderProps(); renderPreview(S.t);
}

// ─── Actions ───────────────────────────────────────────────────────
function loadPreset(name) {
  const p = PRESETS[name]; if (!p) return;
  pushUndo();
  S.sprites = structuredClone(p.sprites);
  S.duration = p.duration;
  S.selSprite = S.sprites[0]?.id || null;
  S.selKf = null; S.t = 0;
  document.getElementById("dsl").value = S.duration;
  document.getElementById("dv").textContent = (S.duration / 1000).toFixed(1) + "s";
  renderAll(); autosave();
}

function addSprite() {
  pushUndo();
  let n = 1; while (S.sprites.find(s => s.id === "sprite" + n)) n++;
  const id = "sprite" + n;
  S.sprites.push({ id, text: "✦", keyframes: [
    { t: 0, x: 5, y: 5, opacity: 0, fontSize: 16, rotation: 0, color: "secondary", easing: "out" },
    { t: S.duration * 0.5, x: 5, y: 4, opacity: 1, fontSize: 22, rotation: 360, color: "info", easing: "inout" },
    { t: S.duration, x: 5, y: 5, opacity: 0, fontSize: 16, rotation: 720, color: "secondary", easing: "in" },
  ]});
  S.selSprite = id; S.selKf = null;
  renderAll(); autosave();
}

function toast(msg, type = "ok") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.dataset.type = type;
  t.classList.add("on");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("on"), 1800);
}

function normalizeEasing(e) {
  if (typeof e === "string" && ["linear", "in", "out", "inout"].includes(e)) return e;
  if (e && typeof e === "object" && Array.isArray(e.cubic) && e.cubic.length === 4
      && e.cubic.every(v => typeof v === "number")) {
    return { cubic: e.cubic.map(v => Math.round(v * 1000) / 1000) };
  }
  return "linear";
}

function safeString(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function safeNumber(v, fallback, min = -Infinity, max = Infinity) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return clamp(n, min, max);
}

function normalizeKeyframe(raw, duration) {
  const kf = raw && typeof raw === "object" ? raw : {};
  const t = safeNumber(kf.t, 0, 0, duration);
  return {
    t,
    x: safeNumber(kf.x, 5, -100, 100),
    y: safeNumber(kf.y, 5, -100, 100),
    opacity: safeNumber(kf.opacity, 1, 0, 1),
    fontSize: safeNumber(kf.fontSize, 18, 6, 120),
    rotation: safeNumber(kf.rotation, 0, -3600, 3600),
    color: typeof kf.color === "string" ? kf.color : "secondary",
    easing: normalizeEasing(kf.easing),
    ...(typeof kf.text === "string" ? { text: kf.text } : {}),
  };
}

function normalizeSprite(raw, duration, idx) {
  const sp = raw && typeof raw === "object" ? raw : {};
  const id = safeString(sp.id, `sprite${idx + 1}`) || `sprite${idx + 1}`;
  const text = safeString(sp.text, "•");
  const keyframesSrc = Array.isArray(sp.keyframes) ? sp.keyframes : [];
  const keyframes = keyframesSrc.map(kf => normalizeKeyframe(kf, duration)).sort((a, b) => a.t - b.t);
  if (!keyframes.length) {
    keyframes.push(normalizeKeyframe({ t: 0, x: 5, y: 5, opacity: 1, fontSize: 18, rotation: 0, color: "secondary", easing: "linear" }, duration));
  }
  return { id, text, keyframes };
}

function normalizeCurrent(cur) {
  if (!cur || typeof cur !== "object") return null;
  const duration = safeNumber(cur.duration, 4000, 500, 10000);
  const sprites = Array.isArray(cur.sprites) ? cur.sprites.map((sp, i) => normalizeSprite(sp, duration, i)) : [];
  if (!sprites.length) return null;
  return { duration, sprites };
}

function normalizeSettings(settings) {
  if (!settings || typeof settings !== "object") return null;
  return {
    looping: typeof settings.looping === "boolean" ? settings.looping : true,
    speed: [0.25, 0.5, 1, 2].includes(Number(settings.speed)) ? Number(settings.speed) : 1,
    duration: safeNumber(settings.duration, 4000, 500, 10000),
    theme: ["light", "dark", "auto"].includes(settings.theme) ? settings.theme : "auto",
  };
}

// ─── Theme ─────────────────────────────────────────────────────────
function getEffectiveTheme(pref) {
  if (pref === "light" || pref === "dark") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(pref) {
  S.theme = pref;
  const effective = getEffectiveTheme(pref);
  if (pref === "auto") {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
  } else {
    document.documentElement.setAttribute("data-theme", effective);
    document.documentElement.style.colorScheme = effective;
  }
  colorCache.clear();
  _elPrev.forEach(p => { p.cl = ""; });
  const btn = $("btheme");
  if (btn) {
    btn.textContent = effective === "dark" ? "\u25D1" : "\u25D0";
  }
}

function toggleTheme() {
  const effective = getEffectiveTheme(S.theme);
  applyTheme(effective === "dark" ? "light" : "dark");
  saveSettings();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── Native File I/O ───────────────────────────────────────────────
function buildScene() {
  return { version: 1, duration: S.duration, sprites: S.sprites };
}

async function saveFile() {
  if (!_openedPath) return saveFileAs();
  const content = coreSerialize(buildScene());
  try {
    await invoke("save_scene_atomic", { path: _openedPath, content });
    markClean();
    toast("saved");
  } catch (e) { toast("save failed: " + e.message, "err"); }
}

async function saveFileAs() {
  const path = await dialogSave({
    title: "Save Scene As",
    filters: [{ name: "Cel", extensions: ["aanim", "json"] }],
  });
  if (!path) return;
  _openedPath = path;
  const content = coreSerialize(buildScene());
  try {
    await invoke("save_scene_atomic", { path, content });
    markClean();
    toast("saved: " + path.split(/[/\\]/).pop());
  } catch (e) { toast("save failed: " + e.message, "err"); }
}

async function openFile() {
  const path = await dialogOpen({
    title: "Open Scene",
    filters: [{ name: "Cel", extensions: ["aanim", "json"] }],
    multiple: false,
  });
  if (!path) return;
  try {
    const text = await readTextFile(path);
    const raw = JSON.parse(text);
    const cur = normalizeCurrent(raw);
    if (!cur) { toast("invalid scene file", "err"); return; }
    pushUndo();
    S.sprites = cur.sprites;
    S.duration = cur.duration;
    S.selSprite = S.sprites[0]?.id || null;
    S.selKf = null;
    _openedPath = path;
    $("dsl").value = S.duration;
    $("dv").textContent = (S.duration / 1000).toFixed(1) + "s";
    renderAll(); autosave(); markClean();
    toast("opened: " + path.split(/[/\\]/).pop());
  } catch (e) { toast("open failed: " + e.message, "err"); }
}

function newScene() {
  pushUndo();
  S.sprites = [];
  S.duration = 4000;
  S.selSprite = null;
  S.selKf = null;
  _openedPath = null;
  $("dsl").value = S.duration;
  $("dv").textContent = (S.duration / 1000).toFixed(1) + "s";
  renderAll(); autosave(); markClean();
  loadPreset("sleeping");
}

// ─── Export pipeline ───────────────────────────────────────────────
async function showExportDialog() {
  const scene = buildScene();
  const exporterList = allExporters.filter(e => e.id !== "gif");
  openModal({
    title: "Export scene",
    placeholder: "filename",
    confirmText: "export",
    initialValue: (_openedPath || "animation").split(/[/\\]/).pop().replace(/\.\w+$/, ""),
    onConfirm: async (filename) => {
      const exporterId = $("export-format")?.value || "html";
      const exporter = exporterList.find(e => e.id === exporterId) || exporterList[0];
      const result = await exporter.run(scene, exporter.defaultOpts);
      const path = await dialogSave({
        title: "Export As",
        defaultPath: filename + exporter.extension,
        filters: [{ name: exporter.name, extensions: [exporter.extension.slice(1)] }],
      });
      if (!path) return;
      await writeTextFile(path, typeof result.content === "string" ? result.content : "");
      if (result.warnings.length) toast(result.warnings[0], "err");
      else toast("exported: " + path.split(/[/\\]/).pop());
    },
  });
  // Inject format selector after modal renders
  setTimeout(() => {
    const input = document.getElementById("modal-input");
    if (!input) return;
    const sel = document.createElement("select");
    sel.id = "export-format";
    sel.className = "ps";
    sel.innerHTML = exporterList.map(e => `<option value="${e.id}">${e.name} (${e.extension})</option>`).join("");
    input.parentNode.insertBefore(sel, input);
  }, 10);
}

function exportScene() {
  const data = buildScene();
  const blob = new Blob([coreSerialize(data)], { type: "application/vnd.cel+json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "scene.aanim";
  a.click();
  URL.revokeObjectURL(url);
  toast("exported .aanim");
}

function importScene() {
  openFile();
}

function openModal({ title, placeholder = "", confirmText = "confirm", initialValue = "", onConfirm }) {
  const root = document.getElementById("modal-root");
  root.innerHTML = `
    <div class="modal-backdrop" data-close="1"></div>
    <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="modal-title">${escapeHtml(title)}</div>
      <input id="modal-input" class="pt modal-input" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(initialValue)}" />
      <div class="modal-actions">
        <button class="b" id="modal-cancel">cancel</button>
        <button class="b" id="modal-confirm">${escapeHtml(confirmText)}</button>
      </div>
    </div>`;
  root.classList.add("on");

  const input = document.getElementById("modal-input");
  const close = () => { window.removeEventListener("keydown", keyHandler); root.classList.remove("on"); root.innerHTML = ""; };
  const submit = async () => {
    const value = input.value.trim();
    if (!value) return;
    try { await onConfirm(value); close(); } catch (e) { toast("action failed", "err"); console.error(e); }
  };

  input.focus();
  document.getElementById("modal-cancel").onclick = close;
  document.getElementById("modal-confirm").onclick = submit;
  root.querySelector(".modal-backdrop").onclick = close;
  const keyHandler = e => {
    if (!root.classList.contains("on")) return;
    if (e.key === "Escape") close();
    if (e.key === "Enter") submit();
  };
  window.addEventListener("keydown", keyHandler);
}

// ─── Bootstrap UI ──────────────────────────────────────────────────
document.getElementById("app").innerHTML = `
  <div id="topbar" role="toolbar" aria-label="Animation controls">
    <select id="preset-sel" title="Load preset">
      <option value="">presets</option>
      ${Object.keys(PRESETS).map(n => `<option value="${n}">${n}</option>`).join("")}
    </select>
    <div class="sep"></div>
    <button class="b" id="badd">+ sprite</button>
    <div class="sep"></div>
    <select id="scenes-sel"></select>
    <button class="b" id="bsavescene">save</button>
    <button class="b" id="bdelscene" disabled title="Delete saved scene">del</button>
    <div class="toolbar-spacer"></div>
    <button class="b" id="bexport" title="Export (Ctrl+E)">export</button>
    <button class="b" id="bexportjson" title="Quick export .aanim">.aanim</button>
    <button class="b" id="bimport" title="Open file (Ctrl+O)">open</button>
    <div class="sep"></div>
    <button class="b icon-btn" id="btheme" title="Toggle theme"></button>
    <span id="toast" role="status" aria-live="polite"></span>
  </div>
  <div id="preview"><div id="stage"></div></div>
  <div id="transport">
    <button class="b" id="bplay">play</button>
    <button class="b" id="bloop">loop</button>
    <span class="time" id="tdisp">0.00s / 4.00s</span>
    <div class="toolbar-spacer"></div>
    <label>speed
      <select id="spd">
        <option value="0.25">0.25x</option>
        <option value="0.5">0.5x</option>
        <option value="1" selected>1x</option>
        <option value="2">2x</option>
      </select>
    </label>
    <label>duration
      <input type="range" id="dsl" min="500" max="10000" value="4000" step="100" />
      <span id="dv">4.0s</span>
    </label>
  </div>
  <div id="main">
    <div id="lp">
      <div class="lph">layers</div>
      <div id="slist"></div>
    </div>
    <div id="tl">
      <div class="ruler" id="ruler"></div>
      <div id="tracks"></div>
      <div id="scrub"></div>
    </div>
  </div>
  <div id="props" aria-label="Properties panel"></div>
  <div id="modal-root"></div>`;

// ─── Delegated timeline handlers ────────────────────────────────────
$("tracks").addEventListener("click", e => {
  const dot = e.target.closest(".kf");
  if (dot) {
    e.stopPropagation();
    S.selSprite = dot.dataset.spid;
    S.selKf = { si: +dot.dataset.si, ki: +dot.dataset.ki };
    renderAll();
    return;
  }
  const track = e.target.closest(".track");
  if (track && e.target === track) {
    const si = +track.dataset.si;
    const sp = S.sprites[si];
    if (!sp) return;
    pushUndo();
    const rect = track.getBoundingClientRect();
    const tw = tlWidth();
    const t = clamp(Math.round(((e.clientX - rect.left) / tw * S.duration) / 10) * 10, 0, S.duration);
    const props = interpKfs(sp.keyframes, t);
    const newKf = {
      t, x: round(props.x, 2), y: round(props.y, 2),
      opacity: round(props.opacity, 2), fontSize: Math.round(props.fontSize),
      rotation: round(props.rotation, 1),
      color: typeof props.color === "string" && !props.color.startsWith("rgb") ? props.color : "secondary",
      easing: "linear",
    };
    sp.keyframes.push(newKf);
    sp.keyframes.sort((a, b) => a.t - b.t);
    S.selSprite = sp.id;
    S.selKf = { si, ki: sp.keyframes.indexOf(newKf) };
    renderAll(); autosave();
  }
});

$("tracks").addEventListener("mousedown", e => {
  const dot = e.target.closest(".kf");
  if (!dot) return;
  e.stopPropagation(); e.preventDefault();
  const si = +dot.dataset.si, ki = +dot.dataset.ki, spid = dot.dataset.spid;
  const sp = S.sprites[si];
  if (!sp) return;
  const kf = sp.keyframes[ki];
  if (!kf) return;
  pushUndo();
  const sx = e.clientX, st = kf.t;
  const tw = tlWidth();
  let moved = false;
  S.selSprite = spid;
  S.selKf = { si, ki };
  const onMove = ev => {
    moved = true;
    const dt = ((ev.clientX - sx) / tw) * S.duration;
    kf.t = clamp(Math.round((st + dt) / 10) * 10, 0, S.duration);
    sp.keyframes.sort((a, b) => a.t - b.t);
    S.selKf = { si, ki: sp.keyframes.indexOf(kf) };
    renderTracks(); renderPreview(S.t);
  };
  const onUp = () => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    if (moved) autosave();
  };
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
});

// ─── Timeline scrubbing (click ruler to seek) ──────────────────────
$("ruler").addEventListener("click", e => {
  const rect = $("ruler").getBoundingClientRect();
  const tw = tlWidth();
  S.t = clamp(Math.round(((e.clientX - rect.left) / tw * S.duration) / 10) * 10, 0, S.duration);
  if (S.playing) stopPlay();
  renderPreview(S.t);
});

document.getElementById("preset-sel").onchange = e => { if (e.target.value) loadPreset(e.target.value); e.target.value = ""; };
document.getElementById("badd").onclick = addSprite;
document.getElementById("bexport").onclick = showExportDialog;
document.getElementById("bexportjson").onclick = exportScene;
document.getElementById("bimport").onclick = openFile;
document.getElementById("btheme").onclick = toggleTheme;
document.getElementById("bplay").onclick = () => S.playing ? stopPlay() : startPlay();
document.getElementById("bloop").onclick = e => {
  S.looping = !S.looping;
  e.target.textContent = S.looping ? "loop on" : "loop off";
  saveSettings();
};
document.getElementById("spd").onchange = e => { S.speed = +e.target.value; saveSettings(); };
document.getElementById("dsl").oninput = e => {
  S.duration = +e.target.value;
  document.getElementById("dv").textContent = (S.duration / 1000).toFixed(1) + "s";
  renderAll();
};
document.getElementById("dsl").onchange = () => { autosave(); saveSettings(); };
document.getElementById("bsavescene").onclick = async () => {
  openModal({
    title: "Save scene as",
    placeholder: "scene name",
    confirmText: "save",
    onConfirm: saveSceneAs,
  });
};
document.getElementById("scenes-sel").onchange = async e => {
  if (e.target.value) { await loadSavedScene(e.target.value); e.target.value = ""; }
};
document.getElementById("bdelscene").onclick = async () => {
  const scenes = (await store.get(K.scenes)) || {};
  const names = Object.keys(scenes);
  if (!names.length) return;
  openModal({
    title: "Delete scene",
    placeholder: names.join(", "),
    confirmText: "delete",
    onConfirm: async (name) => {
      if (!scenes[name]) { toast("scene not found", "err"); return; }
      await deleteSavedScene(name);
      toast(`deleted: ${name}`);
    },
  });
};

document.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  if (e.code === "Space") { e.preventDefault(); S.playing ? stopPlay() : startPlay(); return; }
  // Undo / Redo
  if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
  // Copy / Paste keyframe
  if ((e.ctrlKey || e.metaKey) && e.key === "c" && S.selKf) {
    e.preventDefault();
    const sp = S.sprites[S.selKf.si];
    if (sp) { _clipboard = { type: "kf", data: structuredClone(sp.keyframes[S.selKf.ki]) }; toast("copied keyframe"); }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "v" && _clipboard?.type === "kf") {
    e.preventDefault();
    const sp = S.sprites.find(s => s.id === S.selSprite);
    if (!sp) return;
    pushUndo();
    const kf = structuredClone(_clipboard.data);
    kf.t = Math.round(S.t / 10) * 10;
    sp.keyframes.push(kf);
    sp.keyframes.sort((a, b) => a.t - b.t);
    S.selKf = { si: S.sprites.indexOf(sp), ki: sp.keyframes.indexOf(kf) };
    renderAll(); autosave();
    toast("pasted keyframe");
    return;
  }
  // Duplicate sprite
  if ((e.ctrlKey || e.metaKey) && e.key === "d") {
    const sp = S.sprites.find(s => s.id === S.selSprite);
    if (!sp) return;
    e.preventDefault();
    pushUndo();
    const clone = structuredClone(sp);
    let n = 1; while (S.sprites.find(s => s.id === clone.id + "_" + n)) n++;
    clone.id = clone.id + "_" + n;
    S.sprites.push(clone);
    S.selSprite = clone.id;
    S.selKf = null;
    renderAll(); autosave();
    toast("duplicated sprite");
    return;
  }
  // Delete keyframe
  if (e.key === "Delete" && S.selKf) {
    e.preventDefault();
    const sp = S.sprites[S.selKf.si];
    if (sp && sp.keyframes.length > 1) {
      pushUndo();
      sp.keyframes.splice(S.selKf.ki, 1);
      S.selKf = null; renderAll(); autosave();
    }
  }
});

// ─── Native menu event handler ─────────────────────────────────────
listen("menu-action", ({ payload }) => {
  switch (payload) {
    case "new": newScene(); break;
    case "open": openFile(); break;
    case "save": saveFile(); break;
    case "save_as": saveFileAs(); break;
    case "export": showExportDialog(); break;
    case "quit": getCurrentWindow().close(); break;
    case "undo": undo(); break;
    case "redo": redo(); break;
    case "delete":
      if (S.selKf) {
        const sp = S.sprites[S.selKf.si];
        if (sp && sp.keyframes.length > 1) {
          pushUndo(); sp.keyframes.splice(S.selKf.ki, 1);
          S.selKf = null; renderAll(); autosave();
        }
      }
      break;
    case "toggle_loop":
      S.looping = !S.looping;
      $("bloop").textContent = S.looping ? "loop on" : "loop off";
      saveSettings();
      break;
    case "shortcuts": toast("Space=play [/]=kf ←→=seek Ctrl+Z=undo"); break;
    case "about": toast("Cel v0.1.0"); break;
  }
});

// ─── Init: restore from store or load default preset ──────────────
async function init() {
  measureChar();

  // Restore settings
  try {
    const settings = normalizeSettings(await store.get(K.settings));
    if (settings) {
      S.looping = settings.looping;
      S.speed = settings.speed;
      document.getElementById("bloop").textContent = S.looping ? "loop on" : "loop off";
      document.getElementById("spd").value = String(S.speed);
      applyTheme(settings.theme);
    } else {
      applyTheme("auto");
    }
  } catch (e) { console.error("load settings:", e); toast("failed to load settings", "err"); }

  // Restore last-edited scene, or load sleeping preset as default
  try {
    const cur = normalizeCurrent(await store.get(K.current));
    if (cur && cur.sprites) {
      S.sprites = cur.sprites;
      S.duration = cur.duration;
      S.selSprite = S.sprites[0]?.id || null;
      document.getElementById("dsl").value = S.duration;
      document.getElementById("dv").textContent = (S.duration / 1000).toFixed(1) + "s";
    } else {
      loadPreset("sleeping");
    }
  } catch (e) {
    console.error("load current:", e);
    toast("restore failed, loaded preset", "err");
    loadPreset("sleeping");
  }

  renderAll();
  renderScenesList();
  startPlay();
}

window.addEventListener("resize", () => { measureChar(); renderAll(); });
init();
