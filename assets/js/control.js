/* =========================================================
   control.js — управление: AUTO/MANUAL, переключатели
   устройств, бак с водой, тестовые сценарии
   ========================================================= */

(function () {
  const grid = document.getElementById("controlGrid");
  const scenarioZone = document.getElementById("scenarioZone");
  const scenarioName = document.getElementById("scenarioName");

  getState().zones.forEach(function (z) {
    scenarioZone.insertAdjacentHTML("beforeend", '<option value="' + z.id + '">' + escapeHtml(z.name) + " (" + z.id + ")</option>");
  });
  Object.keys(SCENARIOS).forEach(function (key) {
    scenarioName.insertAdjacentHTML("beforeend", '<option value="' + key + '">' + SCENARIOS[key].label + " — " + SCENARIOS[key].hint + "</option>");
  });
  if (location.hash) scenarioZone.value = location.hash.slice(1);

  function zonePanel(zone, state) {
    const s = state.settings[zone.id];
    const isAuto = zone.mode === "auto";
    const low = zone.waterLevel <= s.waterLevel.critical;

    const toggles = Object.keys(ACTUATORS).map(function (key) {
      const on = zone.actuators[key];
      const blocked = key === "pump" && low && !on;
      return '<div class="toggle-row">' +
        '<div class="toggle-label">' + '<span class="kpi-icon ' + (on ? "tone-accent" : "tone-water") + '">' + icon(ACTUATORS[key].icon) + "</span>" +
          "<span>" + ACTUATORS[key].label + "<small>" + ACTUATORS[key].en + " · " + (on ? "ON" : "OFF") +
          (isAuto ? " · AUTO" : "") + (blocked ? " · заблокирован: мало воды" : "") + "</small></span></div>" +
        '<label class="switch" title="' + (isAuto ? "В режиме AUTO устройством управляет автоматика" : "Включить / выключить") + '">' +
          '<input type="checkbox" data-zone="' + zone.id + '" data-act="' + key + '"' + (on ? " checked" : "") + (isAuto ? " disabled" : "") +
          ' aria-label="' + ACTUATORS[key].label + " — " + escapeHtml(zone.name) + '">' +
          '<span class="slider"></span></label>' +
      "</div>";
    }).join("");

    return '<article class="card" id="' + zone.id + '">' +
      '<div class="zone-top" style="margin-bottom:12px"><div><h3 style="font-size:17px">' + escapeHtml(zone.name) + '</h3><small class="mono muted">' + zone.id + "</small></div>" +
        '<div class="segmented" role="group" aria-label="Режим зоны ' + escapeHtml(zone.name) + '">' +
          '<button type="button" data-mode="auto" data-zone="' + zone.id + '" class="' + (isAuto ? "on" : "") + '">AUTO</button>' +
          '<button type="button" data-mode="manual" data-zone="' + zone.id + '" class="' + (!isAuto ? "on manual" : "") + '">MANUAL</button>' +
        "</div></div>" +
      '<div style="display:flex;gap:14px;align-items:center;margin-bottom:6px">' +
        '<div class="tank" title="Уровень воды в баке"><div class="tank-fill' + (low ? " low" : "") + '" style="height:' + zone.waterLevel + '%"></div><div class="tank-label">' + Math.round(zone.waterLevel) + "%</div></div>" +
        '<div style="display:grid;gap:6px"><b>Бак с водой</b><small class="muted">critical ≤ ' + s.waterLevel.critical + "% — насос блокируется</small>" +
          '<button class="btn water sm" type="button" data-refill="' + zone.id + '">' + icon("tank") + "Пополнить бак</button></div>" +
      "</div>" +
      (isAuto ? '<p class="muted" style="font-size:13px;margin:4px 0 0">Режим AUTO: переключатели заблокированы, устройствами управляет автоматика.</p>' : '<p style="font-size:13px;margin:4px 0 0;color:var(--warn)">Режим MANUAL: автоматика отключена, управляйте устройствами вручную.</p>') +
      "<div>" + toggles + "</div>" +
    "</article>";
  }

  function render(state) {
    grid.innerHTML = state.zones.map(function (z) { return zonePanel(z, state); }).join("");
  }

  initPage("control", render);

  grid.addEventListener("click", function (e) {
    const modeBtn = e.target.closest("button[data-mode]");
    const refillBtn = e.target.closest("button[data-refill]");
    if (modeBtn) {
      const state = getState();
      setMode(state, modeBtn.dataset.zone, modeBtn.dataset.mode);
      saveState(state);
      refreshAll(state);
      toast(zoneName(state, modeBtn.dataset.zone) + ": режим " + modeBtn.dataset.mode.toUpperCase());
    }
    if (refillBtn) {
      const state = getState();
      refillTank(state, refillBtn.dataset.refill);
      saveState(state);
      refreshAll(state);
      toast(zoneName(state, refillBtn.dataset.refill) + ": бак пополнен до 100%");
    }
  });

  grid.addEventListener("change", function (e) {
    const input = e.target.closest("input[data-act]");
    if (!input) return;
    const state = getState();
    const result = setActuatorManual(state, input.dataset.zone, input.dataset.act, input.checked);
    saveState(state);
    if (!result.ok) toast(result.reason, "error");
    else toast(ACTUATORS[input.dataset.act].label + (input.checked ? " включён" : " выключен"));
    refreshAll(state);
  });

  function setAll(mode) {
    const state = getState();
    state.zones.forEach(function (z) { setMode(state, z.id, mode); });
    saveState(state);
    refreshAll(state);
    toast("Все зоны переведены в " + mode.toUpperCase());
  }
  document.getElementById("allAuto").addEventListener("click", function () { setAll("auto"); });
  document.getElementById("allManual").addEventListener("click", function () { setAll("manual"); });

  document.getElementById("scenarioRun").addEventListener("click", function () {
    const state = getState();
    applyScenario(state, scenarioZone.value, scenarioName.value);
    saveState(state);
    refreshAll(state);
    const zone = state.zones.find(function (z) { return z.id === scenarioZone.value; });
    toast("Сценарий «" + SCENARIOS[scenarioName.value].label + "» применён к зоне " + zone.name +
      (zone.mode === "manual" ? " (MANUAL: автоматика не вмешается)" : ""));
    document.getElementById(zone.id).scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();
