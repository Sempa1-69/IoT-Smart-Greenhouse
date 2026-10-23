/* =========================================================
   zones.js — зоны теплицы: показатели на шкалах с нормой,
   устройства, Risk Score, рекомендации, переименование
   ========================================================= */

(function () {
  const search = document.getElementById("zoneSearch");
  const riskFilter = document.getElementById("riskFilter");
  const modeFilter = document.getElementById("modeFilter");
  const modal = document.getElementById("zoneModal");
  const form = document.getElementById("zoneForm");
  const formError = document.getElementById("zoneError");
  let editingId = null;

  // Шкала: границы отображения и «зелёный» диапазон нормы
  const SCALE = {
    temperature: [0, 45], humidity: [0, 100], soil: [0, 100],
    light: [0, 40000], co2: [300, 2400], waterLevel: [0, 100]
  };

  function normRange(type, s) {
    if (type === "temperature") return [s.temperature.min, s.temperature.max, s.temperature.min + "–" + s.temperature.max + " °C"];
    if (type === "humidity") return [s.humidity.min, s.humidity.max, s.humidity.min + "–" + s.humidity.max + " %"];
    if (type === "soil") return [s.soil.min, s.soil.max, s.soil.min + "–" + s.soil.max + " %"];
    if (type === "light") return [s.light.min, SCALE.light[1], "≥ " + s.light.min.toLocaleString("ru-RU") + " lux"];
    if (type === "co2") return [SCALE.co2[0], s.co2.max, "≤ " + s.co2.max + " ppm"];
    return [s.waterLevel.critical, 100, "> " + s.waterLevel.critical + " %"];
  }

  function pct(type, v) {
    const sc = SCALE[type];
    return clamp((v - sc[0]) / (sc[1] - sc[0]) * 100, 0, 100);
  }

  function gauge(zone, type, state) {
    const s = state.settings[zone.id];
    const r = normRange(type, s);
    const isOff = !sensorOnline(state, zone.id, type);
    const level = isOff ? "ok" : metricLevel(zone, type, s);
    const tr = trend(zone.history[type], type);
    const arrow = tr.dir === "up" ? " ↑" : tr.dir === "down" ? " ↓" : " →";
    return '<div class="gauge">' +
      '<div class="gauge-head"><span>' + SENSOR_TYPES[type].label + '</span><b class="val-' + level + '">' +
        (isOff ? "нет данных" : formatValue(type, zone[type]) + arrow) + "</b></div>" +
      '<div class="gauge-track"><div class="gauge-range" style="left:' + pct(type, r[0]) + "%;width:" + (pct(type, r[1]) - pct(type, r[0])) + '%"></div>' +
        (isOff ? "" : '<div class="gauge-mark" style="left:' + pct(type, zone[type]) + '%"></div>') + "</div>" +
      '<div class="gauge-foot"><span>норма ' + r[2] + "</span><span>" + SENSOR_TYPES[type].en + "</span></div>" +
    "</div>";
  }

  function zoneHtml(zone, state) {
    const s = state.settings[zone.id];
    const offline = state.sensors.filter(function (x) { return x.zoneId === zone.id && x.status === "offline"; }).length;
    const risk = calculateRisk(zone, s, offline);
    const level = riskLevel(risk.score);
    const rec = getRecommendations(zone, s, state)[0];
    const acts = Object.keys(ACTUATORS).map(function (key) {
      return '<span class="act' + (zone.actuators[key] ? " on" : "") + '">' + icon(ACTUATORS[key].icon) + ACTUATORS[key].label + "</span>";
    }).join("");

    return '<article class="card zone-card">' +
      '<div class="zone-top"><div><h3>' + escapeHtml(zone.name) + "</h3><small>" + zone.id + " · " + escapeHtml(zone.crop) + "</small></div>" +
        '<div class="head-actions">' + badge(zone.mode, zone.mode === "auto" ? "AUTO" : "MANUAL") +
        '<button class="btn ghost sm" data-edit="' + zone.id + '" type="button">' + icon("edit") + "Изменить</button></div></div>" +
      "<div>" + Object.keys(SENSOR_TYPES).map(function (t) { return gauge(zone, t, state); }).join("") + "</div>" +
      '<div class="actuators">' + acts + "</div>" +
      '<div class="risk"><div class="risk-row"><span>Risk Score</span><b class="mono">' + risk.score + " · " + level.label + "</b></div>" +
        '<div class="risk-track"><div class="risk-fill" style="width:' + risk.score + "%;background:" + riskColorVar(risk.score) + '"></div></div>' +
        '<small class="muted">' + (risk.reasons.length ? escapeHtml(risk.reasons.join("; ")) : "отклонений нет") + "</small></div>" +
      '<div class="rec ' + (rec.severity === "ok" ? "" : rec.severity) + '"><h4>' + escapeHtml(rec.what) + "</h4>" +
        "<dl><dt>Почему</dt><dd>" + escapeHtml(rec.why) + "</dd><dt>Что сделать</dt><dd>" + escapeHtml(rec.action) + "</dd></dl></div>" +
      '<a href="control.html#' + zone.id + '" class="btn ghost sm" style="align-self:flex-start">Управление зоной →</a>' +
    "</article>";
  }

  function render(state) {
    const text = search.value.trim().toLowerCase();
    const list = state.zones.filter(function (z) {
      const s = state.settings[z.id];
      const offline = state.sensors.filter(function (x) { return x.zoneId === z.id && x.status === "offline"; }).length;
      const level = riskLevel(calculateRisk(z, s, offline).score).key;
      const hay = (z.name + " " + z.crop + " " + z.id).toLowerCase();
      return (!text || hay.indexOf(text) !== -1) &&
        (!riskFilter.value || level === riskFilter.value) &&
        (!modeFilter.value || z.mode === modeFilter.value);
    });
    document.getElementById("zoneCount").textContent = "Найдено: " + list.length + " из " + state.zones.length;
    document.getElementById("zoneList").innerHTML = list.length
      ? list.map(function (z) { return zoneHtml(z, state); }).join("")
      : '<div class="card empty" style="grid-column:1/-1">Зоны не найдены. Измените условия поиска.</div>';
  }

  initPage("zones", render);

  [search, riskFilter, modeFilter].forEach(function (el) {
    el.addEventListener("input", function () { render(getState()); });
  });

  // Переименование зоны
  document.getElementById("zoneList").addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-edit]");
    if (!btn) return;
    const zone = getState().zones.find(function (z) { return z.id === btn.dataset.edit; });
    editingId = zone.id;
    form.zoneName.value = zone.name;
    form.crop.value = zone.crop;
    formError.textContent = "";
    document.getElementById("zoneModalTitle").textContent = "Редактировать " + zone.id;
    modal.showModal();
  });

  document.getElementById("zoneCancel").addEventListener("click", function () { modal.close(); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const name = form.zoneName.value.trim();
    const crop = form.crop.value.trim();
    if (name.length < 2 || crop.length < 2) {
      formError.textContent = "Название и культура — минимум 2 символа";
      return;
    }
    const state = getState();
    const zone = state.zones.find(function (z) { return z.id === editingId; });
    if (zone.name !== name || zone.crop !== crop) {
      logEvent(state, zone.id, "manual", "ZONE_RENAMED", "Зона «" + zone.name + "» переименована в «" + name + "»");
      zone.name = name;
      zone.crop = crop;
      saveState(state);
    }
    modal.close();
    refreshAll(state);
    toast("Зона " + editingId + " сохранена");
  });
})();
