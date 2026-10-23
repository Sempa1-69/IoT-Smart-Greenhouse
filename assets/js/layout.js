/* =========================================================
   layout.js — общие элементы всех страниц панели
   Sidebar, Topbar (теплица, AUTO/MANUAL, время симуляции,
   уведомления, профиль), тема, тосты, окно подтверждения,
   помощники Chart.js и запуск симулятора.
   ========================================================= */

const ICONS = {
  logo: '<path d="M3 21V10l9-6 9 6v11"/><path d="M3 21h18"/><path d="M12 21v-6"/><path d="M12 15c0-2.5 2-4 4-4 0 2.5-2 4-4 4z"/><path d="M12 17c0-2-1.6-3.2-3.2-3.2 0 2 1.6 3.2 3.2 3.2z"/>',
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  zones: '<path d="M7 20h10"/><path d="M12 20V10"/><path d="M12 10c0-3.3 2.7-6 6-6 0 3.3-2.7 6-6 6z"/><path d="M12 13c0-2.8-2.2-5-5-5 0 2.8 2.2 5 5 5z"/>',
  sensors: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  control: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/>',
  alerts: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  analytics: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  thermo: '<path d="M14 14.8V4a2 2 0 1 0-4 0v10.8a4 4 0 1 0 4 0z"/>',
  droplets: '<path d="M7 16.3c2.2 0 4-1.8 4-4 0-1.2-.6-2.3-1.7-3.2S7.4 7 7 5.3c-.3 1.7-1.2 3-2.3 3.9S3 11.1 3 12.3c0 2.2 1.8 4 4 4z"/><path d="M12.6 6.6A11 11 0 0 0 14 3c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a7 7 0 0 1-11.9 4.9"/>',
  sprout: '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  wind: '<path d="M3 8h10a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/>',
  tank: '<path d="M5 5h14v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M5 12c2.3-1 4.7 1 7 0s4.7-1 7 0"/><path d="M9 2h6v3H9z"/>',
  pump: '<path d="M12 22a6 6 0 0 0 6-6c0-4-6-11-6-11S6 12 6 16a6 6 0 0 0 6 6z"/><path d="M9.5 16.5a2.5 2.5 0 0 0 2.5 2.5"/>',
  fan: '<circle cx="12" cy="12" r="2"/><path d="M12 10c-1-3-1-6 1.5-7 2.2-.9 3.5 1.5 2.5 3.5S12 10 12 10z"/><path d="M14 12c3-1 6-1 7 1.5.9 2.2-1.5 3.5-3.5 2.5S14 12 14 12z"/><path d="M12 14c1 3 1 6-1.5 7-2.2.9-3.5-1.5-2.5-3.5S12 14 12 14z"/><path d="M10 12c-3 1-6 1-7-1.5-.9-2.2 1.5-3.5 3.5-2.5S10 12 10 12z"/>',
  bulb: '<path d="M9 18h6M10 22h4"/><path d="M15.1 14c.2-1 .7-1.7 1.4-2.5A4.6 4.6 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.2.3 1.6 1.4 2.7 2.5 2.7z"/>',
  vent: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 14h8M8 17h8"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  pause: '<path d="M8 4v16M16 4v16"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'
};

function icon(name, cls) {
  return '<svg class="i' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || ICONS.info) + "</svg>";
}

// Защита от XSS: пользовательский текст всегда экранируется
function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const NAV_ITEMS = [
  ["dashboard", "Обзор", "dashboard.html"],
  ["zones", "Зоны", "zones.html"],
  ["sensors", "Датчики", "sensors.html"],
  ["control", "Управление", "control.html"],
  ["alerts", "Тревоги", "alerts.html"],
  ["analytics", "Аналитика", "analytics.html"],
  ["settings", "Настройки", "settings.html"]
];

const ALERT_ICON = { temperature: "thermo", humidity: "droplets", soil: "sprout", waterLevel: "tank", pumpBlocked: "pump", co2: "wind" };

let currentPage = "";
let pageRender = null;

function zoneName(state, zoneId) {
  const z = state.zones.find(function (x) { return x.id === zoneId; });
  return z ? z.name : "Система";
}

/* ---------- Верхняя панель навигации ---------- */

function renderSidebar(state) {
  const el = document.getElementById("sidebar");
  const active = activeAlerts(state).length;
  const navHtml = NAV_ITEMS.map(function (item) {
    const count = item[0] === "alerts" && active ? '<span class="count">' + active + "</span>" : "";
    return '<a href="' + item[2] + '"' + (item[0] === currentPage ? ' class="active" aria-current="page"' : "") + ">" +
      icon(item[0]) + "<span>" + item[1] + "</span>" + count + "</a>";
  }).join("");

  // Навигация строится один раз, дальше обновляется только счётчик тревог
  if (!el.dataset.ready) {
    el.innerHTML =
      '<div class="navbar-inner">' +
        '<a class="brand" href="dashboard.html"><span class="brand-logo">' + icon("logo") + "</span>" +
          "<span><b>GrowLab</b><small>IoT Smart Greenhouse</small></span></a>" +
        '<nav class="nav" id="mainNav" aria-label="Основное меню">' + navHtml + "</nav>" +
        '<button class="icon-btn burger" id="burgerBtn" aria-label="Открыть меню">' + icon("menu") + "</button>" +
      "</div>";
    el.dataset.ready = "1";
    document.getElementById("burgerBtn").addEventListener("click", function () { document.body.classList.toggle("menu-open"); });
  } else {
    document.getElementById("mainNav").innerHTML = navHtml;
  }
  renderFooter(state);
}

function renderFooter(state) {
  const main = document.querySelector(".main");
  if (!main) return;
  let foot = document.getElementById("appFoot");
  if (!foot) {
    foot = document.createElement("footer");
    foot.className = "app-foot";
    foot.id = "appFoot";
    main.appendChild(foot);
  }
  foot.innerHTML = "<span><b>" + escapeHtml(getAppSettings().greenhouseName) + "</b> · " + state.zones.length + " зоны · " +
    state.sensors.length + " датчиков</span><span>Учебный проект · Раимжанов Я. · 2026</span>";
}

/* ---------- Topbar ---------- */

function modeChip(state) {
  const auto = state.zones.filter(function (z) { return z.mode === "auto"; }).length;
  const total = state.zones.length;
  if (auto === total) return '<span class="chip auto" title="Все зоны в автоматическом режиме"><span class="dot"></span><span class="chip-text">AUTO</span> ' + auto + "/" + total + "</span>";
  if (auto === 0) return '<span class="chip manual" title="Все зоны в ручном режиме"><span class="dot"></span><span class="chip-text">MANUAL</span> ' + total + "/" + total + "</span>";
  return '<span class="chip mixed" title="Часть зон в ручном режиме"><span class="dot"></span><span class="chip-text">AUTO</span> ' + auto + "/" + total + "</span>";
}

function renderTopbar(state) {
  const el = document.getElementById("topbar");
  const session = getSession();
  const app = getAppSettings();
  const theme = getTheme();
  el.innerHTML =
    '<div class="topbar-title"><b id="ghName">' + escapeHtml(app.greenhouseName) + '</b><small>Оператор смены: ' + escapeHtml(session.name) + "</small></div>" +
    '<div class="top-actions">' +
      '<span id="modeChip">' + modeChip(state) + "</span>" +
      '<span class="chip" id="simClock" title="Время в симуляции (1 шаг = 15 минут)">' + icon("clock") + '<span class="mono" id="simClockValue">' + simClock(state.meta.simMinutes) + "</span></span>" +
      '<button class="icon-btn" id="simToggle" aria-label="Пауза или запуск симуляции" title="' + (app.autoSimulate ? "Поставить симуляцию на паузу" : "Запустить симуляцию") + '">' + icon(app.autoSimulate ? "pause" : "play") + "</button>" +
      '<button class="icon-btn" id="themeButton" aria-label="Сменить тему" title="Сменить тему">' + icon(theme === "light" ? "moon" : "sun") + "</button>" +
      '<div class="dropdown" id="notifyDropdown">' +
        '<button class="icon-btn" id="notifyBtn" aria-label="Активные тревоги" title="Активные тревоги">' + icon("bell") + '<span class="dot-count hidden" id="notifyCount"></span></button>' +
        '<div class="dropdown-panel" id="notifyPanel"></div>' +
      "</div>" +
      '<div class="profile"><span class="avatar">' + escapeHtml(initials(session.name)) + '</span>' +
        '<span class="profile-text"><b>' + escapeHtml(session.name) + "</b><small>" + escapeHtml(session.role) + "</small></span>" +
        '<button class="icon-btn" id="logoutBtn" style="width:30px;height:30px;border:0" aria-label="Выйти" title="Выйти">' + icon("logout") + "</button></div>" +
    "</div>";

  document.getElementById("notifyBtn").addEventListener("click", function () { document.getElementById("notifyDropdown").classList.toggle("open"); });
  document.getElementById("logoutBtn").addEventListener("click", logout);

  document.getElementById("themeButton").addEventListener("click", function () {
    const next = getTheme() === "light" ? "dark" : "light";
    setTheme(next);
    this.innerHTML = icon(next === "light" ? "moon" : "sun");
    document.dispatchEvent(new CustomEvent("themechange"));
    if (pageRender) pageRender(getState());
  });

  document.getElementById("simToggle").addEventListener("click", function () {
    const appNow = getAppSettings();
    appNow.autoSimulate = !appNow.autoSimulate;
    saveAppSettings(appNow);
    this.innerHTML = icon(appNow.autoSimulate ? "pause" : "play");
    this.title = appNow.autoSimulate ? "Поставить симуляцию на паузу" : "Запустить симуляцию";
    restartSimulation();
    toast(appNow.autoSimulate ? "Симуляция запущена" : "Симуляция на паузе");
  });

  document.addEventListener("click", function (e) {
    if (document.body.classList.contains("menu-open") && !e.target.closest("#sidebar") && !e.target.closest("#burgerBtn")) {
      document.body.classList.remove("menu-open");
    }
    if (!e.target.closest("#notifyDropdown")) document.getElementById("notifyDropdown").classList.remove("open");
  });
}

function initials(name) {
  return String(name).split(/\s+/).map(function (p) { return p[0] || ""; }).join("").slice(0, 2).toUpperCase();
}

function alertItemHtml(alert, state) {
  const tone = alert.severity === "critical" ? "tone-crit" : "tone-warn";
  const ic = alert.type.indexOf("sensor:") === 0 ? "sensors" : (ALERT_ICON[alert.type] || "alerts");
  return '<div class="item"><span class="item-icon ' + tone + '">' + icon(ic) + "</span>" +
    "<div><b>" + escapeHtml(zoneName(state, alert.zoneId)) + " · " + (alert.severity === "critical" ? "Critical" : "Warning") + "</b>" +
    "<p>" + escapeHtml(alert.message) + "</p></div></div>";
}

function updateTopbar(state) {
  const list = activeAlerts(state).sort(function (a, b) { return (b.severity === "critical") - (a.severity === "critical"); });
  const count = document.getElementById("notifyCount");
  const panel = document.getElementById("notifyPanel");
  if (count) {
    count.textContent = list.length;
    count.classList.toggle("hidden", list.length === 0);
  }
  if (panel) {
    panel.innerHTML = '<div class="dropdown-head"><span>Активные тревоги</span><a href="alerts.html" style="font-size:13px">Все →</a></div>' +
      (list.length ? '<div class="list">' + list.slice(0, 8).map(function (a) { return alertItemHtml(a, state); }).join("") + "</div>"
        : '<div class="empty">Тревог нет — теплица в норме.</div>');
  }
  const chip = document.getElementById("modeChip");
  if (chip) chip.innerHTML = modeChip(state);
  const clock = document.getElementById("simClockValue");
  if (clock) clock.textContent = simClock(state.meta.simMinutes);
}

/* ---------- Инициализация страницы ---------- */

function initPage(page, render) {
  const session = getSession();
  if (!session) {
    window.location.replace("index.html");
    return null;
  }
  currentPage = page;
  pageRender = render;
  setTheme(getTheme());

  const state = getState();
  renderSidebar(state);
  renderTopbar(state);
  updateTopbar(state);

  if (!document.querySelector(".toast-zone")) {
    const zone = document.createElement("div");
    zone.className = "toast-zone";
    zone.setAttribute("aria-live", "polite");
    document.body.appendChild(zone);
  }

  render(state);
  restartSimulation();
  return state;
}

// Перерисовать страницу и общие элементы после изменения данных
function refreshAll(state) {
  const s = state || getState();
  renderSidebar(s);
  updateTopbar(s);
  if (pageRender) pageRender(s);
}

function restartSimulation() {
  startSimulation(function () { refreshAll(getState()); }) || stopSimulation();
}

/* ---------- Сообщения ---------- */

function toast(message, type) {
  const zone = document.querySelector(".toast-zone");
  if (!zone) return;
  const el = document.createElement("div");
  el.className = "toast" + (type === "error" ? " error" : "");
  el.textContent = message;
  zone.appendChild(el);
  setTimeout(function () { el.remove(); }, 3500);
}

function confirmDialog(title, text, okText) {
  return new Promise(function (resolve) {
    const dlg = document.createElement("dialog");
    dlg.className = "modal";
    dlg.innerHTML =
      '<div class="modal-head"><h2>' + escapeHtml(title) + "</h2></div>" +
      '<div class="modal-body"><p style="margin:0">' + escapeHtml(text) + "</p></div>" +
      '<div class="modal-foot"><button class="btn ghost" value="cancel">Отмена</button>' +
      '<button class="btn danger" value="ok">' + escapeHtml(okText || "Подтвердить") + "</button></div>";
    document.body.appendChild(dlg);
    dlg.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () { dlg.close(b.value); });
    });
    dlg.addEventListener("close", function () {
      resolve(dlg.returnValue === "ok");
      dlg.remove();
    });
    dlg.showModal();
  });
}

/* ---------- Chart.js ---------- */

const chartRegistry = {};

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function palette() {
  return {
    text: cssVar("--muted"), grid: cssVar("--border"), surface: cssVar("--surface"),
    accent: cssVar("--accent"), ok: cssVar("--ok"), warn: cssVar("--warn"), crit: cssVar("--crit"),
    water: cssVar("--water"), violet: cssVar("--violet"),
    zones: [cssVar("--accent"), cssVar("--water"), cssVar("--violet")]
  };
}

function makeChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  if (typeof Chart === "undefined") {
    if (!canvas.parentNode.querySelector(".chart-fallback")) {
      const note = document.createElement("div");
      note.className = "chart-fallback";
      note.textContent = "График не загрузился: Chart.js подключается из интернета (CDN). Проверьте подключение.";
      canvas.parentNode.appendChild(note);
    }
    return null;
  }
  const p = palette();
  Chart.defaults.color = p.text;
  Chart.defaults.borderColor = p.grid;
  Chart.defaults.font.family = cssVar("--font") || "sans-serif";

  // Если график уже есть — обновляем данные без пересоздания (без мигания)
  const existing = chartRegistry[canvasId];
  if (existing && existing.$type === config.type && existing.$theme === getTheme()) {
    existing.data.labels = config.data.labels;
    existing.data.datasets.forEach(function (ds, i) {
      const next = config.data.datasets[i];
      if (next) Object.assign(ds, next);
    });
    existing.update("none");
    return existing;
  }
  if (existing) existing.destroy();
  config.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: { duration: 300 } }, config.options || {});
  const chart = new Chart(canvas, config);
  chart.$theme = getTheme();
  chart.$type = config.type;
  chartRegistry[canvasId] = chart;
  return chart;
}

// Линейный график истории показателя по всем зонам
function historyChart(canvasId, state, type, extra) {
  const p = palette();
  const labels = state.meta.ticks.slice(-HISTORY_LENGTH);
  return makeChart(canvasId, {
    type: "line",
    data: {
      labels: labels,
      datasets: state.zones.map(function (z, i) {
        const h = z.history[type];
        return {
          label: z.name, data: h.slice(-labels.length),
          borderColor: p.zones[i % 3], backgroundColor: p.zones[i % 3],
          tension: .35, pointRadius: 0, borderWidth: 2
        };
      })
    },
    options: Object.assign({
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } },
        y: { grid: { color: p.grid }, title: { display: true, text: SENSOR_TYPES[type].unit } }
      }
    }, extra || {})
  });
}

/* ---------- Мелочи ---------- */

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function badge(cls, text) {
  return '<span class="badge ' + escapeHtml(cls) + '">' + escapeHtml(text) + "</span>";
}

const SEVERITY_TEXT = { warning: "Warning", critical: "Critical" };
const STATUS_TEXT = { open: "Открыта", acknowledged: "Подтверждена", resolved: "Закрыта" };
const SOURCE_TEXT = { automation: "Автоматика", manual: "Оператор", system: "Система" };
const SOURCE_CLASS = { automation: "automation", manual: "manual-src", system: "system" };

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type: type || "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}
