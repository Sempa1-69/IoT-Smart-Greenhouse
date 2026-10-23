/* =========================================================
   dashboard.js — главная панель: KPI, зоны, графики,
   последние тревоги и события
   ========================================================= */

function kpiCard(ic, tone, label, value, note) {
  return '<article class="card kpi"><div class="kpi-top"><span>' + label + '</span><span class="kpi-icon ' + tone + '">' + icon(ic) + "</span></div>" +
    '<div class="kpi-value">' + value + '</div><div class="kpi-note">' + note + "</div></article>";
}

function avg(list, fn) {
  return list.reduce(function (a, x) { return a + fn(x); }, 0) / list.length;
}

// Карточка зоны (используется и на других страницах)
function zoneCardHtml(zone, state, opts) {
  const s = state.settings[zone.id];
  const offline = state.sensors.filter(function (x) { return x.zoneId === zone.id && x.status === "offline"; });
  const risk = calculateRisk(zone, s, offline.length);
  const level = riskLevel(risk.score);

  const metric = function (type) {
    const isOff = !sensorOnline(state, zone.id, type);
    const cls = isOff ? "offline" : metricLevel(zone, type, s);
    return '<div class="metric ' + cls + '"><span>' + SENSOR_TYPES[type].label + "</span><b>" +
      (isOff ? "offline" : formatValue(type, zone[type])) + "</b></div>";
  };

  const acts = Object.keys(ACTUATORS).map(function (key) {
    const on = zone.actuators[key];
    return '<span class="act' + (on ? " on" : "") + '" title="' + ACTUATORS[key].en + (on ? ": ON" : ": OFF") + '">' +
      icon(ACTUATORS[key].icon) + ACTUATORS[key].label + "</span>";
  }).join("");

  return '<article class="card zone-card">' +
    '<div class="zone-top"><div><h3>' + escapeHtml(zone.name) + "</h3><small>" + zone.id + " · " + escapeHtml(zone.crop) + "</small></div>" +
      badge(zone.mode, zone.mode === "auto" ? "AUTO" : "MANUAL") + "</div>" +
    '<div class="metrics">' + Object.keys(SENSOR_TYPES).map(metric).join("") + "</div>" +
    '<div class="actuators">' + acts + "</div>" +
    (zone.pumpBlocked ? '<div class="item" style="padding:8px 10px"><span class="item-icon tone-crit">' + icon("pump") + '</span><div><b>Полив заблокирован</b><p>' + escapeHtml(zone.pumpBlockReason || "мало воды в баке") + "</p></div></div>" : "") +
    '<div class="risk"><div class="risk-row"><span>Risk Score</span><b class="mono">' + risk.score + " · " + level.label + "</b></div>" +
      '<div class="risk-track"><div class="risk-fill" style="width:' + risk.score + "%;background:" + riskColorVar(risk.score) + '"></div></div></div>' +
    (opts && opts.footer ? opts.footer : "") +
  "</article>";
}

function eventItemHtml(e, state) {
  const tone = e.source === "automation" ? "tone-accent" : e.source === "manual" ? "tone-water" : "tone-violet";
  const ic = e.action.indexOf("PUMP") === 0 ? "pump" : e.action.indexOf("FAN") === 0 ? "fan" : e.action.indexOf("HEATER") === 0 ? "flame"
    : e.action.indexOf("GROW") === 0 ? "bulb" : e.action.indexOf("VENT") === 0 ? "vent" : e.action.indexOf("HUMID") === 0 ? "droplets" : "info";
  return '<div class="item"><span class="item-icon ' + tone + '">' + icon(ic) + "</span><div><b>" +
    escapeHtml(e.message) + "</b><p>" + (e.zoneId ? escapeHtml(zoneName(state, e.zoneId)) + " · " : "") +
    SOURCE_TEXT[e.source] + " · " + e.action + " · " + e.simTime + "</p></div></div>";
}

(function () {
  if (typeof initPage === "undefined" || document.body.dataset.page !== "dashboard") return;

  function render(state) {
    const zones = state.zones;
    const active = activeAlerts(state);
    const critical = active.filter(function (a) { return a.severity === "critical"; }).length;
    const online = state.sensors.filter(function (s) { return s.status === "online"; }).length;
    const minWater = zones.reduce(function (m, z) { return z.waterLevel < m.waterLevel ? z : m; }, zones[0]);
    const app = getAppSettings();

    document.getElementById("dashLine").textContent = app.autoSimulate
      ? "Обновление каждые " + app.interval + " с · время теплицы " + simClock(state.meta.simMinutes)
      : "Симуляция на паузе · время теплицы " + simClock(state.meta.simMinutes);

    document.getElementById("kpiGrid").innerHTML =
      kpiCard("thermo", "tone-warn", "Temperature", round(avg(zones, function (z) { return z.temperature; }), 1) + "<small> °C</small>", "среднее по " + zones.length + " зонам") +
      kpiCard("droplets", "tone-water", "Humidity", Math.round(avg(zones, function (z) { return z.humidity; })) + "<small> %</small>", "влажность воздуха") +
      kpiCard("sprout", "tone-accent", "Soil", Math.round(avg(zones, function (z) { return z.soil; })) + "<small> %</small>", "влажность почвы") +
      kpiCard("tank", minWater.waterLevel <= state.settings[minWater.id].waterLevel.critical ? "tone-crit" : "tone-water", "Water", Math.round(minWater.waterLevel) + "<small> %</small>", "минимум: " + escapeHtml(minWater.name)) +
      kpiCard("alerts", active.length ? "tone-crit" : "tone-ok", "Active Alerts", active.length, "из них critical: " + critical) +
      kpiCard("sensors", online === state.sensors.length ? "tone-ok" : "tone-warn", "Devices Online", online + "<small>/" + state.sensors.length + "</small>", (state.sensors.length - online) + " offline");

    document.getElementById("zoneCards").innerHTML = zones.map(function (z) { return zoneCardHtml(z, state); }).join("");

    historyChart("tempChart", state, "temperature");
    historyChart("humChart", state, "humidity");
    historyChart("soilChart", state, "soil");

    const p = palette();
    makeChart("waterChart", {
      type: "bar",
      data: {
        labels: zones.map(function (z) { return z.name; }),
        datasets: [
          { label: "Уровень воды, %", data: zones.map(function (z) { return round(z.waterLevel, 0); }), backgroundColor: p.water, borderRadius: 6, maxBarThickness: 40 },
          {
            label: "Risk Score", borderRadius: 6, maxBarThickness: 40,
            data: zones.map(function (z) {
              const off = state.sensors.filter(function (x) { return x.zoneId === z.id && x.status === "offline"; }).length;
              return calculateRisk(z, state.settings[z.id], off).score;
            }),
            backgroundColor: zones.map(function (z) {
              const off = state.sensors.filter(function (x) { return x.zoneId === z.id && x.status === "offline"; }).length;
              const sc = calculateRisk(z, state.settings[z.id], off).score;
              return sc >= 60 ? p.crit : sc >= 30 ? p.warn : p.ok;
            })
          }
        ]
      },
      options: {
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } },
        scales: { y: { min: 0, max: 100, grid: { color: p.grid } }, x: { grid: { display: false } } }
      }
    });

    const sorted = active.slice().sort(function (a, b) { return (b.severity === "critical") - (a.severity === "critical"); });
    document.getElementById("alertList").innerHTML = sorted.length
      ? sorted.slice(0, 5).map(function (a) { return alertItemHtml(a, state); }).join("")
      : '<div class="empty">Активных тревог нет</div>';

    document.getElementById("eventList").innerHTML = state.events.slice(-6).reverse().map(function (e) {
      return eventItemHtml(e, state);
    }).join("") || '<div class="empty">Событий пока нет</div>';
  }

  initPage("dashboard", render);

  document.getElementById("stepBtn").addEventListener("click", function () {
    refreshAll(simulateTick());
    toast("Выполнен шаг симуляции (+15 минут)");
  });
})();
