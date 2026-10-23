/* =========================================================
   settings.js — пороги зон, симуляция, тема, сброс данных
   ========================================================= */

(function () {
  const thrZone = document.getElementById("thrZone");
  const thrForm = document.getElementById("thrForm");
  const thrError = document.getElementById("thrError");
  const appForm = document.getElementById("appForm");
  const appError = document.getElementById("appError");

  getState().zones.forEach(function (z) {
    thrZone.insertAdjacentHTML("beforeend", '<option value="' + z.id + '">' + escapeHtml(z.name) + " (" + z.id + ")</option>");
  });

  function fillThresholds() {
    const s = getState().settings[thrZone.value];
    thrForm.tMin.value = s.temperature.min; thrForm.tMax.value = s.temperature.max;
    thrForm.hMin.value = s.humidity.min; thrForm.hMax.value = s.humidity.max;
    thrForm.sMin.value = s.soil.min; thrForm.sMax.value = s.soil.max;
    thrForm.lMin.value = s.light.min; thrForm.cMax.value = s.co2.max; thrForm.wCrit.value = s.waterLevel.critical;
    thrError.textContent = "";
  }

  function fillApp() {
    const app = getAppSettings();
    appForm.greenhouseName.value = app.greenhouseName;
    appForm.autoSimulate.value = String(app.autoSimulate);
    appForm.interval.value = app.interval;
  }

  function markTheme() {
    document.querySelectorAll(".segmented button[data-theme]").forEach(function (b) {
      b.classList.toggle("on", b.dataset.theme === getTheme());
      b.setAttribute("aria-pressed", b.dataset.theme === getTheme());
    });
  }

  function showStorage() {
    document.getElementById("storageInfo").textContent = "localStorage: " + (storageSize() / 1024).toFixed(1) + " КБ";
  }

  // Страница настроек не перерисовывает формы по таймеру, чтобы не мешать вводу
  initPage("settings", function () { showStorage(); });
  fillThresholds();
  fillApp();
  markTheme();

  thrZone.addEventListener("input", fillThresholds);

  thrForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const n = function (name) { return Number(thrForm[name].value); };
    const v = { tMin: n("tMin"), tMax: n("tMax"), hMin: n("hMin"), hMax: n("hMax"), sMin: n("sMin"), sMax: n("sMax"), lMin: n("lMin"), cMax: n("cMax"), wCrit: n("wCrit") };

    const bad = Object.keys(v).some(function (k) { return thrForm[k].value === "" || isNaN(v[k]); });
    let error = "";
    if (bad) error = "Заполните все поля числами";
    else if (v.tMin >= v.tMax) error = "Температура: min должен быть меньше max";
    else if (v.tMin < -10 || v.tMax > 50) error = "Температура: допустимо от −10 до 50 °C";
    else if (v.hMin >= v.hMax || v.hMin < 0 || v.hMax > 100) error = "Влажность воздуха: 0 ≤ min < max ≤ 100";
    else if (v.sMin >= v.sMax || v.sMin < 0 || v.sMax > 100) error = "Влажность почвы: 0 ≤ min < max ≤ 100";
    else if (v.lMin < 0 || v.lMin > 40000) error = "Освещённость: от 0 до 40 000 lux";
    else if (v.cMax < 400 || v.cMax > 3000) error = "CO₂: от 400 до 3000 ppm";
    else if (v.wCrit < 0 || v.wCrit > 50) error = "Уровень воды critical: от 0 до 50 %";
    if (error) { thrError.textContent = error; return; }

    const state = getState();
    state.settings[thrZone.value] = {
      temperature: { min: v.tMin, max: v.tMax }, humidity: { min: v.hMin, max: v.hMax }, soil: { min: v.sMin, max: v.sMax },
      light: { min: v.lMin }, co2: { max: v.cMax }, waterLevel: { critical: v.wCrit }
    };
    const now = new Date().toISOString();
    logEvent(state, thrZone.value, "manual", "SETTINGS_CHANGED", "Изменены пороги зоны " + zoneName(state, thrZone.value), now);
    const zone = state.zones.find(function (z) { return z.id === thrZone.value; });
    if (zone.mode === "auto") runAutomation(zone, state.settings[zone.id], state, now);
    evaluateAlerts(state, now);
    saveState(state);
    refreshAll(state);
    thrError.textContent = "";
    toast("Пороги зоны «" + zone.name + "» сохранены");
  });

  document.getElementById("thrDefault").addEventListener("click", function () {
    const def = DEFAULT_ZONE_SETTINGS[thrZone.value];
    thrForm.tMin.value = def.temperature.min; thrForm.tMax.value = def.temperature.max;
    thrForm.hMin.value = def.humidity.min; thrForm.hMax.value = def.humidity.max;
    thrForm.sMin.value = def.soil.min; thrForm.sMax.value = def.soil.max;
    thrForm.lMin.value = def.light.min; thrForm.cMax.value = def.co2.max; thrForm.wCrit.value = def.waterLevel.critical;
    toast("Подставлены значения по умолчанию — нажмите «Сохранить пороги»");
  });

  appForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const name = appForm.greenhouseName.value.trim();
    const interval = Number(appForm.interval.value);
    if (name.length < 3) { appError.textContent = "Название: минимум 3 символа"; return; }
    if (!Number.isInteger(interval) || interval < 3 || interval > 10) { appError.textContent = "Интервал — целое число от 3 до 10 секунд"; return; }
    appError.textContent = "";
    saveAppSettings({ greenhouseName: name, autoSimulate: appForm.autoSimulate.value === "true", interval: interval });
    const state = getState();
    renderTopbar(state);
    refreshAll(state);
    restartSimulation();
    toast("Настройки сохранены");
  });

  document.querySelectorAll(".segmented button[data-theme]").forEach(function (b) {
    b.addEventListener("click", function () {
      setTheme(b.dataset.theme);
      markTheme();
      document.getElementById("themeButton").innerHTML = icon(b.dataset.theme === "light" ? "moon" : "sun");
    });
  });
  document.addEventListener("themechange", markTheme);

  document.getElementById("resetBtn").addEventListener("click", function () {
    confirmDialog("Сбросить все данные?", "Зоны, датчики, тревоги, журнал событий и пороги вернутся к исходному состоянию.", "Сбросить").then(function (ok) {
      if (!ok) return;
      const state = resetData();
      fillThresholds();
      refreshAll(state);
      toast("Данные сброшены к исходным");
    });
  });

  document.getElementById("settingsLogout").addEventListener("click", logout);
})();
