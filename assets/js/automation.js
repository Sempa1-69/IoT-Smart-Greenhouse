/* =========================================================
   automation.js — автоматика, ручное управление, тревоги
   AUTO:   JavaScript сравнивает показания с порогами зоны и
           включает/выключает устройства (с гистерезисом).
   MANUAL: оператор управляет устройствами сам.
   SAFETY: при низком уровне воды насос не включается ни
           автоматически, ни вручную.
   ========================================================= */

const MAX_EVENTS = 400;
const MAX_ALERTS = 150;

const ACTION_CODE = { pump: "PUMP", fan: "FAN", growLight: "GROW_LIGHT", humidifier: "HUMIDIFIER", heater: "HEATER", vent: "VENT" };

/* ---------- Журнал событий ---------- */

function logEvent(state, zoneId, source, action, message, now) {
  state.meta.nextEventId = state.meta.nextEventId || 1;
  state.events.push({
    id: state.meta.nextEventId++,
    zoneId: zoneId, source: source, action: action, message: message,
    timestamp: now || new Date().toISOString(),
    simTime: simClock(state.meta.simMinutes || 0)
  });
  while (state.events.length > MAX_EVENTS) state.events.shift();
}

/* ---------- Датчики ---------- */

function sensorOnline(state, zoneId, type) {
  const sensor = state.sensors.find(function (s) { return s.zoneId === zoneId && s.type === type; });
  return !sensor || sensor.status === "online";
}

// Уровень показателя для подсветки: ok / warning / critical
function metricLevel(zone, type, s) {
  const v = zone[type];
  if (type === "temperature") {
    if (v > s.temperature.max + 5 || v < s.temperature.min - 5) return "critical";
    if (v > s.temperature.max || v < s.temperature.min) return "warning";
  }
  if (type === "humidity" && (v < s.humidity.min || v > s.humidity.max)) return "warning";
  if (type === "soil") {
    if (v < s.soil.min - 15) return "critical";
    if (v < s.soil.min) return "warning";
  }
  if (type === "light" && v < s.light.min) return "warning";
  if (type === "co2") {
    if (v > s.co2.max + 400) return "critical";
    if (v > s.co2.max) return "warning";
  }
  if (type === "waterLevel") {
    if (v <= s.waterLevel.critical) return "critical";
    if (v <= s.waterLevel.critical + 10) return "warning";
  }
  return "ok";
}

/* ---------- Автоматика ---------- */

function runAutomation(zone, s, state, now) {
  const a = zone.actuators;
  const online = function (type) { return sensorOnline(state, zone.id, type); };

  function set(name, value, reason) {
    if (a[name] === value) return;
    a[name] = value;
    logEvent(state, zone.id, "automation", ACTION_CODE[name] + (value ? "_ON" : "_OFF"), reason, now);
  }

  // 1. Полив с защитой по уровню воды
  if (online("soil")) {
    const target = (s.soil.min + s.soil.max) / 2;
    const waterOk = online("waterLevel") && zone.waterLevel > s.waterLevel.critical;

    if (zone.soil < s.soil.min) {
      if (waterOk) {
        zone.pumpBlocked = false;
        set("pump", true, "Насос включён: влажность почвы " + zone.soil + "% < min " + s.soil.min + "%");
      } else {
        const why = online("waterLevel")
          ? "в баке " + round(zone.waterLevel, 0) + "% воды (критично ≤ " + s.waterLevel.critical + "%)"
          : "нет данных датчика уровня воды";
        zone.pumpBlockReason = why;
        set("pump", false, "Насос остановлен: " + why);
        if (!zone.pumpBlocked) {
          zone.pumpBlocked = true;
          logEvent(state, zone.id, "automation", "PUMP_BLOCKED",
            "Полив заблокирован: почва сухая (" + zone.soil + "%), " + why, now);
        }
      }
    } else {
      zone.pumpBlocked = false;
      if (a.pump && zone.soil >= target) {
        set("pump", false, "Насос выключен: почва увлажнена до " + zone.soil + "% (цель " + target + "%)");
      }
      if (a.pump && !waterOk) {
        set("pump", false, "Насос остановлен: закончилась вода в баке");
      }
    }
  }

  // 2. Температура: вентилятор и обогреватель (гистерезис 1 °C)
  if (online("temperature")) {
    const t = zone.temperature, H = HYSTERESIS.temperature;
    if (t > s.temperature.max) set("fan", true, "Вентилятор включён: " + t + "°C > max " + s.temperature.max + "°C");
    else if (t <= s.temperature.max - H) set("fan", false, "Вентилятор выключен: температура снизилась до " + t + "°C");

    if (t < s.temperature.min) set("heater", true, "Обогрев включён: " + t + "°C < min " + s.temperature.min + "°C");
    else if (t >= s.temperature.min + H) set("heater", false, "Обогрев выключен: температура " + t + "°C");
  }

  // 3. Форточка: жара, CO2 или избыточная влажность
  if (online("temperature") && online("co2") && online("humidity")) {
    const needVent = zone.temperature > s.temperature.max + 2 || zone.co2 > s.co2.max || zone.humidity > s.humidity.max;
    const canClose = zone.temperature <= s.temperature.max && zone.co2 <= s.co2.max - HYSTERESIS.co2 && zone.humidity <= s.humidity.max - HYSTERESIS.humidity;
    if (needVent) {
      const why = zone.co2 > s.co2.max ? "CO₂ " + zone.co2 + " ppm > " + s.co2.max
        : zone.humidity > s.humidity.max ? "влажность " + zone.humidity + "% > " + s.humidity.max + "%"
          : "температура " + zone.temperature + "°C";
      set("vent", true, "Форточка открыта: " + why);
    } else if (canClose) {
      set("vent", false, "Форточка закрыта: климат в норме");
    }
  }

  // 4. Увлажнитель
  if (online("humidity")) {
    const h = zone.humidity;
    if (h < s.humidity.min) set("humidifier", true, "Увлажнитель включён: " + h + "% < min " + s.humidity.min + "%");
    else if (h >= s.humidity.min + HYSTERESIS.humidity || h > s.humidity.max) set("humidifier", false, "Увлажнитель выключен: влажность " + h + "%");
  }

  // 5. Досветка: сравниваем естественный свет без лампы
  if (online("light")) {
    const natural = zone.naturalLight !== undefined ? zone.naturalLight : zone.light - (a.growLight ? LAMP_LUX : 0);
    if (natural < s.light.min) set("growLight", true, "Фитолампа включена: освещённость " + natural + " lx < min " + s.light.min + " lx");
    else if (natural >= s.light.min * (1 + HYSTERESIS.light)) set("growLight", false, "Фитолампа выключена: достаточно света (" + natural + " lx)");
  }
}

/* ---------- Ручное управление ---------- */

function setMode(state, zoneId, mode) {
  const zone = state.zones.find(function (z) { return z.id === zoneId; });
  if (!zone || zone.mode === mode) return;
  const now = new Date().toISOString();
  zone.mode = mode;
  logEvent(state, zoneId, "manual", mode === "auto" ? "MODE_AUTO" : "MODE_MANUAL",
    mode === "auto" ? "Зона переведена в AUTO: управляет автоматика" : "Зона переведена в MANUAL: управляет оператор", now);
  if (mode === "auto") runAutomation(zone, state.settings[zoneId], state, now);
  evaluateAlerts(state, now);
}

function setActuatorManual(state, zoneId, name, value) {
  const zone = state.zones.find(function (z) { return z.id === zoneId; });
  const s = state.settings[zoneId];
  const now = new Date().toISOString();
  if (!zone) return { ok: false, reason: "Зона не найдена" };
  if (zone.mode === "auto") return { ok: false, reason: "Зона в режиме AUTO — переключите в MANUAL" };

  if (name === "pump" && value && zone.waterLevel <= s.waterLevel.critical) {
    logEvent(state, zoneId, "manual", "PUMP_BLOCKED", "Ручное включение насоса заблокировано: в баке " + round(zone.waterLevel, 0) + "% воды", now);
    return { ok: false, reason: "Насос заблокирован: мало воды в баке. Сначала пополните бак." };
  }

  zone.actuators[name] = value;
  logEvent(state, zoneId, "manual", ACTION_CODE[name] + (value ? "_ON" : "_OFF"),
    ACTUATORS[name].label + (value ? " включён" : " выключен") + " вручную", now);
  evaluateAlerts(state, now);
  return { ok: true };
}

/* ---------- Тревоги (Alerts) ---------- */

function activeConditions(state) {
  const list = [];
  state.zones.forEach(function (zone) {
    const s = state.settings[zone.id];
    const online = function (type) { return sensorOnline(state, zone.id, type); };
    const add = function (type, severity, message, value) {
      list.push({ zoneId: zone.id, type: type, severity: severity, message: message, value: value });
    };

    if (online("temperature")) {
      const t = zone.temperature;
      if (t > s.temperature.max + 5) add("temperature", "critical", "Сильный перегрев: " + t + "°C (max " + s.temperature.max + ")", t);
      else if (t > s.temperature.max) add("temperature", "warning", "Температура выше нормы: " + t + "°C (max " + s.temperature.max + ")", t);
      else if (t < s.temperature.min - 5) add("temperature", "critical", "Сильное переохлаждение: " + t + "°C (min " + s.temperature.min + ")", t);
      else if (t < s.temperature.min) add("temperature", "warning", "Температура ниже нормы: " + t + "°C (min " + s.temperature.min + ")", t);
    }
    if (online("humidity")) {
      const h = zone.humidity;
      if (h < s.humidity.min) add("humidity", "warning", "Сухой воздух: " + h + "% (min " + s.humidity.min + ")", h);
      else if (h > s.humidity.max) add("humidity", "warning", "Повышенная влажность: " + h + "% (max " + s.humidity.max + ")", h);
    }
    if (online("soil")) {
      const p = zone.soil;
      if (p < s.soil.min - 15) add("soil", "critical", "Почва пересохла: " + p + "% (min " + s.soil.min + ")", p);
      else if (p < s.soil.min) add("soil", "warning", "Влажность почвы ниже порога: " + p + "% (min " + s.soil.min + ")", p);
    }
    if (online("waterLevel")) {
      const w = round(zone.waterLevel, 0);
      if (w <= s.waterLevel.critical) add("waterLevel", "critical", "Критически низкий уровень воды: " + w + "%", w);
      else if (w <= s.waterLevel.critical + 10) add("waterLevel", "warning", "Уровень воды снижается: " + w + "%", w);
    }
    if (zone.pumpBlocked) add("pumpBlocked", "critical", "Насос заблокирован: почва сухая, " + (zone.pumpBlockReason || "воды в баке недостаточно"), round(zone.waterLevel, 0));
    if (online("co2")) {
      const c = zone.co2;
      if (c > s.co2.max + 400) add("co2", "critical", "Очень высокий CO₂: " + c + " ppm", c);
      else if (c > s.co2.max) add("co2", "warning", "CO₂ выше нормы: " + c + " ppm (max " + s.co2.max + ")", c);
    }
    state.sensors.forEach(function (sensor) {
      if (sensor.zoneId === zone.id && sensor.status === "offline") {
        add("sensor:" + sensor.type, "warning", "Датчик " + sensor.id + " (" + SENSOR_TYPES[sensor.type].en + ") не передаёт данные", null);
      }
    });
  });
  return list;
}

function evaluateAlerts(state, now) {
  const conditions = activeConditions(state);
  const at = now || new Date().toISOString();
  state.meta.nextAlertId = state.meta.nextAlertId || 1;

  conditions.forEach(function (c) {
    const existing = state.alerts.find(function (a) {
      return a.zoneId === c.zoneId && a.type === c.type && a.status !== "resolved";
    });
    if (existing) {
      if (existing.severity === "warning" && c.severity === "critical") existing.status = "open";
      existing.severity = c.severity;
      existing.message = c.message;
      existing.value = c.value;
      existing.updatedAt = at;
    } else {
      state.alerts.push({
        id: "ALERT-" + String(state.meta.nextAlertId++).padStart(3, "0"),
        zoneId: c.zoneId, type: c.type, severity: c.severity, message: c.message, value: c.value,
        status: "open", createdAt: at, updatedAt: at, simTime: simClock(state.meta.simMinutes || 0)
      });
    }
  });

  // Условие исчезло → тревога закрывается автоматически
  state.alerts.forEach(function (a) {
    if (a.status === "resolved") return;
    const still = conditions.some(function (c) { return c.zoneId === a.zoneId && c.type === a.type; });
    if (!still) {
      a.status = "resolved";
      a.resolvedAt = at;
      a.resolvedBy = "auto";
    }
  });

  // Ограничиваем размер: сначала удаляем старые закрытые
  while (state.alerts.length > MAX_ALERTS) {
    const idx = state.alerts.findIndex(function (a) { return a.status === "resolved"; });
    state.alerts.splice(idx === -1 ? 0 : idx, 1);
  }
}

function activeAlerts(state) {
  return state.alerts.filter(function (a) { return a.status !== "resolved"; });
}
