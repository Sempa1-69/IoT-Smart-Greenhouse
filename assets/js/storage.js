/* =========================================================
   storage.js — хранение данных в localStorage
   saveData / loadData / resetData + состояние теплицы,
   настройки, тема и сессия оператора.
   Если localStorage недоступен, данные живут в памяти.
   ========================================================= */

const KEYS = {
  zones: "gs_zones",
  settings: "gs_zone_settings",
  sensors: "gs_sensors",
  alerts: "gs_alerts",
  events: "gs_events",
  meta: "gs_meta",
  app: "gs_app",
  session: "gs_session",
  theme: "gs_theme"
};

const STATE_KEYS = ["zones", "settings", "sensors", "alerts", "events", "meta"];
const memoryStore = {};

function saveData(key, value) {
  const raw = JSON.stringify(value);
  try {
    localStorage.setItem(key, raw);
  } catch (e) {
    memoryStore[key] = raw;
  }
}

function loadData(key, fallback) {
  let raw = null;
  try { raw = localStorage.getItem(key); } catch (e) { raw = null; }
  if (raw === null && key in memoryStore) raw = memoryStore[key];
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function removeData(key) {
  try { localStorage.removeItem(key); } catch (e) { /* нет доступа */ }
  delete memoryStore[key];
}

/* ---------- Состояние теплицы ---------- */

function saveState(state) {
  STATE_KEYS.forEach(function (k) { saveData(KEYS[k], state[k]); });
}

function resetData() {
  const seed = createSeedData();
  saveState(seed);
  return seed;
}

function getState() {
  const zones = loadData(KEYS.zones, null);
  if (!Array.isArray(zones) || zones.length === 0) return resetData();
  const state = {};
  STATE_KEYS.forEach(function (k) { state[k] = loadData(KEYS[k], k === "meta" ? {} : []); });
  if (!state.settings || Array.isArray(state.settings)) state.settings = JSON.parse(JSON.stringify(DEFAULT_ZONE_SETTINGS));
  return state;
}

/* ---------- Общие настройки ---------- */

function getAppSettings() {
  return Object.assign({}, DEFAULT_APP_SETTINGS, loadData(KEYS.app, {}));
}

function saveAppSettings(settings) {
  saveData(KEYS.app, settings);
}

/* ---------- Тема ---------- */

function getTheme() {
  return loadData(KEYS.theme, "light") === "dark" ? "dark" : "light";
}

function setTheme(theme) {
  saveData(KEYS.theme, theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/* ---------- Оператор ---------- */

function getSession() { return loadData(KEYS.session, null); }
function setSession(session) { saveData(KEYS.session, session); }

function logout() {
  removeData(KEYS.session);
  window.location.href = "index.html";
}

function storageSize() {
  let bytes = 0;
  Object.keys(KEYS).forEach(function (k) {
    let raw = null;
    try { raw = localStorage.getItem(KEYS[k]); } catch (e) { raw = memoryStore[KEYS[k]]; }
    if (raw) bytes += raw.length * 2;
  });
  return bytes;
}
