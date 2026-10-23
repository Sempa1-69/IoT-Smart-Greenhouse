/* =========================================================
   simulator.js — программный симулятор IoT-датчиков
   Физических датчиков нет, поэтому JavaScript рассчитывает
   правдоподобные показания. Модель учитывает время суток
   (солнце), работу устройств (насос, вентилятор, обогрев…)
   и случайный «шум». Один шаг = 15 минут жизни теплицы.
   ========================================================= */

function noise(rnd, amplitude) {
  return (rnd() * 2 - 1) * amplitude;
}

// Солнце: 0 ночью, 1 в полдень
function sunFactor(simMinutes) {
  const hour = ((simMinutes / 60) % 24 + 24) % 24;
  return Math.max(0, Math.sin(Math.PI * (hour - 6) / 12));
}

function pushHistory(list, value) {
  list.push(value);
  while (list.length > HISTORY_LENGTH) list.shift();
}

// Пересчёт показаний одной зоны с учётом работающих устройств
function simulateZone(zone, simMinutes, rnd) {
  const a = zone.actuators;
  const sun = sunFactor(simMinutes);

  // Освещённость: солнце (с учётом затенения и облаков) + фитолампа
  let natural = sun * 30000 * zone.shade * (0.85 + rnd() * 0.3);
  if (zone.cloudTicks > 0) {
    natural *= 0.15;
    zone.cloudTicks--;
  }
  zone.naturalLight = Math.round(natural);
  zone.light = Math.round(natural + (a.growLight ? LAMP_LUX : 0));

  // Температура стремится к «тепличной» (днём жарче) + влияние устройств
  const outside = 14 + 10 * sun;
  const target = outside + 6 * sun + 4;
  let t = zone.temperature;
  t += (target - t) * 0.25;
  if (a.heater) t += 1.6;
  if (a.fan) t -= 1.4;
  if (a.vent) t -= 0.9;
  zone.temperature = round(clamp(t + noise(rnd, 0.3), -5, 50), 1);

  // Влажность воздуха
  const humTarget = 60 + (zone.soil - 50) * 0.2 - (zone.temperature - 24) * 1.5;
  let h = zone.humidity + (humTarget - zone.humidity) * 0.2;
  if (a.humidifier) h += 4;
  if (a.vent) h -= 2.5;
  if (a.fan) h -= 1.2;
  zone.humidity = round(clamp(h + noise(rnd, 1.5), 20, 98), 0);

  // Почва высыхает (быстрее в жару и на солнце), насос её увлажняет
  let s = zone.soil - (0.7 + Math.max(0, zone.temperature - 22) * 0.07 + sun * 0.4);
  if (a.pump) s += 5;
  zone.soil = round(clamp(s + noise(rnd, 0.3), 0, 100), 0);

  // Бак расходуется только при работе насоса
  if (a.pump) zone.waterLevel = round(clamp(zone.waterLevel - 1.2, 0, 100), 1);

  // CO2: ночью растения выделяют, днём поглощают; проветривание снижает
  let c = zone.co2 + 18 - sun * 45;
  if (a.vent) c -= 70;
  if (a.fan) c -= 20;
  zone.co2 = Math.round(clamp(c + noise(rnd, 15), 380, 2400));

  return zone;
}

// Один шаг всей системы: время → датчики → автоматика → тревоги
function simulateStep(state, rnd, iso) {
  const now = iso || new Date().toISOString();
  state.meta.simMinutes = (state.meta.simMinutes || 0) + TICK_MINUTES;

  state.zones.forEach(function (zone) {
    simulateZone(zone, state.meta.simMinutes, rnd);
    Object.keys(SENSOR_TYPES).forEach(function (type) {
      pushHistory(zone.history[type], zone[type]);
    });
  });

  // Датчики иногда теряют связь и восстанавливаются
  state.sensors.forEach(function (sensor) {
    if (sensor.status === "online" && rnd() < 0.002) sensor.status = "offline";
    else if (sensor.status === "offline" && rnd() < 0.15) sensor.status = "online";
    if (sensor.status === "online") sensor.updatedAt = now;
  });

  state.zones.forEach(function (zone) {
    if (zone.mode === "auto") {
      runAutomation(zone, state.settings[zone.id], state, now);
    }
  });

  evaluateAlerts(state, now);
  pushHistory(state.meta.ticks, simClock(state.meta.simMinutes));
  return state;
}

// Шаг симуляции «вживую»: загрузить → посчитать → сохранить
function simulateTick() {
  const state = getState();
  simulateStep(state, Math.random);
  saveState(state);
  return state;
}

/* ---------- Таймер ---------- */

let simulationTimer = null;

function startSimulation(onTick) {
  stopSimulation();
  const app = getAppSettings();
  if (!app.autoSimulate) return false;
  const ms = clamp(Number(app.interval) || 5, 3, 10) * 1000;
  simulationTimer = setInterval(function () {
    simulateTick();
    if (onTick) onTick();
  }, ms);
  return true;
}

function stopSimulation() {
  if (simulationTimer) clearInterval(simulationTimer);
  simulationTimer = null;
}

/* ---------- Тестовые сценарии (для проверки автоматики) ---------- */

const SCENARIOS = {
  drySoil: { label: "Сухая почва", hint: "Soil ниже min, вода есть" },
  emptyTank: { label: "Пустой бак", hint: "Soil ниже min, вода ≤ critical" },
  heat: { label: "Перегрев", hint: "Temperature выше max" },
  cold: { label: "Холод", hint: "Temperature ниже min" },
  dark: { label: "Темно", hint: "Light ниже min (облачность)" },
  co2: { label: "Высокий CO₂", hint: "CO₂ выше max" }
};

function applyScenario(state, zoneId, name) {
  const zone = state.zones.find(function (z) { return z.id === zoneId; });
  const s = state.settings[zoneId];
  const now = new Date().toISOString();
  if (!zone) return;

  if (name === "drySoil") {
    zone.soil = s.soil.min - 8;
    if (zone.waterLevel <= s.waterLevel.critical + 10) zone.waterLevel = 60;
  }
  if (name === "emptyTank") {
    zone.soil = s.soil.min - 8;
    zone.waterLevel = Math.max(0, s.waterLevel.critical - 5);
  }
  if (name === "heat") zone.temperature = s.temperature.max + 4;
  if (name === "cold") zone.temperature = s.temperature.min - 4;
  if (name === "dark") {
    zone.cloudTicks = 8;
    zone.naturalLight = Math.round(s.light.min * 0.3);
    zone.light = zone.naturalLight + (zone.actuators.growLight ? LAMP_LUX : 0);
  }
  if (name === "co2") zone.co2 = s.co2.max + 300;

  logEvent(state, zone.id, "system", "TEST_SCENARIO", "Тестовый сценарий: " + SCENARIOS[name].label, now);

  if (zone.mode === "auto") runAutomation(zone, s, state, now);
  evaluateAlerts(state, now);
}

// Пополнение бака (ручное действие оператора)
function refillTank(state, zoneId) {
  const zone = state.zones.find(function (z) { return z.id === zoneId; });
  if (!zone) return;
  zone.waterLevel = 100;
  zone.pumpBlocked = false;
  const now = new Date().toISOString();
  logEvent(state, zoneId, "manual", "TANK_REFILL", "Бак пополнен до 100%", now);
  if (zone.mode === "auto") runAutomation(zone, state.settings[zoneId], state, now);
  evaluateAlerts(state, now);
}
