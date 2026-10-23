/* =========================================================
   sensors.js — таблица всех датчиков с фильтрами
   ========================================================= */

(function () {
  const search = document.getElementById("sensorSearch");
  const zoneFilter = document.getElementById("zoneFilter");
  const typeFilter = document.getElementById("typeFilter");
  const statusFilter = document.getElementById("statusFilter");

  getState().zones.forEach(function (z) {
    zoneFilter.insertAdjacentHTML("beforeend", '<option value="' + z.id + '">' + escapeHtml(z.name) + " (" + z.id + ")</option>");
  });
  Object.keys(SENSOR_TYPES).forEach(function (t) {
    typeFilter.insertAdjacentHTML("beforeend", '<option value="' + t + '">' + SENSOR_TYPES[t].en + " — " + SENSOR_TYPES[t].label + "</option>");
  });

  function normText(type, s) {
    if (type === "temperature") return s.temperature.min + "–" + s.temperature.max + " °C";
    if (type === "humidity") return s.humidity.min + "–" + s.humidity.max + " %";
    if (type === "soil") return s.soil.min + "–" + s.soil.max + " %";
    if (type === "light") return "≥ " + s.light.min.toLocaleString("ru-RU") + " lux";
    if (type === "co2") return "≤ " + s.co2.max + " ppm";
    return "> " + s.waterLevel.critical + " %";
  }

  function kpi(ic, tone, label, value) {
    return '<article class="card kpi"><div class="kpi-top"><span>' + label + '</span><span class="kpi-icon ' + tone + '">' + icon(ic) +
      '</span></div><div class="kpi-value">' + value + "</div></article>";
  }

  function render(state) {
    const sensors = state.sensors;
    const online = sensors.filter(function (s) { return s.status === "online"; }).length;
    document.getElementById("sensorKpi").innerHTML =
      kpi("sensors", "tone-accent", "Всего датчиков", sensors.length) +
      kpi("check", "tone-ok", "Online", online) +
      kpi("alerts", sensors.length - online ? "tone-crit" : "tone-ok", "Offline", sensors.length - online) +
      kpi("zones", "tone-water", "Зон / типов", state.zones.length + "<small> / " + Object.keys(SENSOR_TYPES).length + "</small>");

    const text = search.value.trim().toLowerCase();
    const list = sensors.filter(function (s) {
      const t = SENSOR_TYPES[s.type];
      const hay = (s.id + " " + s.type + " " + t.en + " " + t.label + " " + zoneName(state, s.zoneId)).toLowerCase();
      return (!text || hay.indexOf(text) !== -1) &&
        (!zoneFilter.value || s.zoneId === zoneFilter.value) &&
        (!typeFilter.value || s.type === typeFilter.value) &&
        (!statusFilter.value || s.status === statusFilter.value);
    });
    document.getElementById("sensorCount").textContent = "Найдено: " + list.length + " из " + sensors.length;

    document.getElementById("sensorBody").innerHTML = list.length ? list.map(function (s) {
      const zone = state.zones.find(function (z) { return z.id === s.zoneId; });
      const set = state.settings[s.zoneId];
      const level = metricLevel(zone, s.type, set);
      const value = s.status === "online"
        ? '<span class="mono val-' + level + '">' + formatValue(s.type, zone[s.type]) + "</span>"
        : '<span class="muted">нет данных</span>';
      return "<tr>" +
        '<td class="mono"><b>' + s.id + "</b></td>" +
        "<td>" + escapeHtml(zone.name) + '<br><small class="muted">' + s.zoneId + "</small></td>" +
        "<td>" + SENSOR_TYPES[s.type].en + '<br><small class="muted">' + SENSOR_TYPES[s.type].label + "</small></td>" +
        "<td>" + value + "</td>" +
        '<td class="mono muted">' + normText(s.type, set) + "</td>" +
        "<td>" + badge(s.status, s.status === "online" ? "Online" : "Offline") + "</td>" +
        '<td class="mono">' + formatTime(s.updatedAt) + "</td>" +
        '<td class="actions"><button class="btn ghost sm" type="button" data-id="' + s.id + '">' +
          (s.status === "online" ? "Отключить" : "Перезапустить") + "</button></td>" +
      "</tr>";
    }).join("") : '<tr><td colspan="8" class="empty">Датчики не найдены</td></tr>';
  }

  initPage("sensors", render);

  [search, zoneFilter, typeFilter, statusFilter].forEach(function (el) {
    el.addEventListener("input", function () { render(getState()); });
  });

  // Имитация обслуживания: отключить датчик или перезапустить его
  document.getElementById("sensorBody").addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-id]");
    if (!btn) return;
    const state = getState();
    const sensor = state.sensors.find(function (s) { return s.id === btn.dataset.id; });
    const now = new Date().toISOString();
    sensor.status = sensor.status === "online" ? "offline" : "online";
    if (sensor.status === "online") sensor.updatedAt = now;
    logEvent(state, sensor.zoneId, "manual", sensor.status === "online" ? "SENSOR_RESTART" : "SENSOR_OFF",
      "Датчик " + sensor.id + (sensor.status === "online" ? " перезапущен оператором" : " отключён оператором"), now);
    evaluateAlerts(state, now);
    saveState(state);
    refreshAll(state);
    toast(sensor.id + (sensor.status === "online" ? " снова в сети" : " отключён"));
  });
})();
