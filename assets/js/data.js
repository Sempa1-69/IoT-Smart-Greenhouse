/* =========================================================
   data.js — справочники и стартовые данные теплицы
   Зоны, датчики, исполнительные устройства (actuators),
   пороговые настройки. Стартовая история генерируется
   тем же симулятором, что работает дальше (simulator.js).
   ========================================================= */

// Типы датчиков: поле в объекте зоны, единица, подпись
const SENSOR_TYPES = {
  temperature: { label: "Температура", en: "Temperature", code: "TEMP", unit: "°C", icon: "thermo", digits: 1 },
  humidity: { label: "Влажность воздуха", en: "Air Humidity", code: "RH", unit: "%", icon: "droplets", digits: 0 },
  soil: { label: "Влажность почвы", en: "Soil Moisture", code: "SOIL", unit: "%", icon: "sprout", digits: 0 },
  light: { label: "Освещённость", en: "Light Sensor", code: "LUX", unit: "lux", icon: "sun", digits: 0 },
  co2: { label: "CO₂", en: "CO₂ Sensor", code: "CO2", unit: "ppm", icon: "wind", digits: 0 },
  waterLevel: { label: "Уровень воды", en: "Water Level", code: "WTR", unit: "%", icon: "tank", digits: 0 }
};

// Исполнительные устройства
const ACTUATORS = {
  pump: { label: "Насос полива", en: "Irrigation Pump", icon: "pump" },
  fan: { label: "Вентилятор", en: "Fan", icon: "fan" },
  growLight: { label: "Фитолампа", en: "Grow Light", icon: "bulb" },
  humidifier: { label: "Увлажнитель", en: "Humidifier", icon: "droplets" },
  heater: { label: "Обогреватель", en: "Heater", icon: "flame" },
  vent: { label: "Форточка", en: "Vent", icon: "vent" }
};

const HISTORY_LENGTH = 30;   // сколько последних замеров хранить
const TICK_MINUTES = 15;     // один шаг симуляции = 15 минут «теплицы»
const LAMP_LUX = 9000;       // сколько люкс добавляет фитолампа

// Учебные пороги по умолчанию (не агрономические нормы!)
const DEFAULT_ZONE_SETTINGS = {
  "ZONE-01": {
    temperature: { min: 20, max: 28 }, humidity: { min: 50, max: 80 }, soil: { min: 35, max: 75 },
    light: { min: 12000 }, co2: { max: 1200 }, waterLevel: { critical: 15 }
  },
  "ZONE-02": {
    temperature: { min: 22, max: 30 }, humidity: { min: 60, max: 85 }, soil: { min: 40, max: 80 },
    light: { min: 10000 }, co2: { max: 1200 }, waterLevel: { critical: 15 }
  },
  "ZONE-03": {
    temperature: { min: 16, max: 24 }, humidity: { min: 50, max: 75 }, soil: { min: 30, max: 70 },
    light: { min: 8000 }, co2: { max: 1200 }, waterLevel: { critical: 15 }
  }
};

// Гистерезис: насколько показатель должен вернуться, прежде чем устройство выключится
const HYSTERESIS = { temperature: 1, humidity: 5, co2: 150, light: 0.1 };

const DEFAULT_APP_SETTINGS = {
  greenhouseName: "Агротеплица «Ала-Тоо» · стенд Б",
  autoSimulate: true,
  interval: 5          // секунд между обновлениями показаний (3–10)
};

/* ---------- Помощники ---------- */

// Генератор случайных чисел с «зерном»: стартовые данные всегда одинаковые
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function round(value, digits) {
  const k = Math.pow(10, digits || 0);
  return Math.round(value * k) / k;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pad2(n) { return (n < 10 ? "0" : "") + n; }

// Время симуляции (минуты от начала суток) → «ЧЧ:ММ»
function simClock(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return pad2(Math.floor(m / 60)) + ":" + pad2(m % 60);
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU") + " " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatValue(type, value) {
  if (value === null || value === undefined) return "—";
  const t = SENSOR_TYPES[type];
  const v = type === "light" ? Math.round(value).toLocaleString("ru-RU") : round(value, t.digits);
  return v + " " + t.unit;
}

function emptyActuators() {
  return { pump: false, fan: false, growLight: false, humidifier: false, heater: false, vent: false };
}

function makeZone(id, name, crop, shade, start) {
  return {
    id: id, name: name, crop: crop, shade: shade,
    mode: "auto",
    temperature: start.temperature, humidity: start.humidity, soil: start.soil,
    light: 0, co2: start.co2, waterLevel: start.waterLevel,
    actuators: emptyActuators(),
    pumpBlocked: false,
    history: { temperature: [], humidity: [], soil: [], light: [], co2: [], waterLevel: [] }
  };
}

function makeSensors(zones, iso) {
  const list = [];
  zones.forEach(function (zone, index) {
    Object.keys(SENSOR_TYPES).forEach(function (type) {
      list.push({
        id: SENSOR_TYPES[type].code + "-Z" + (index + 1),
        zoneId: zone.id, type: type, status: "online", updatedAt: iso
      });
    });
  });
  return list;
}

/* ---------- Стартовые данные ---------- */

function createSeedData() {
  const zones = [
    makeZone("ZONE-01", "Перец", "Bell pepper", 1.0, { temperature: 21, humidity: 66, soil: 44, co2: 760, waterLevel: 88 }),
    makeZone("ZONE-02", "Клубника", "Strawberry", 0.9, { temperature: 23, humidity: 72, soil: 52, co2: 780, waterLevel: 52 }),
    makeZone("ZONE-03", "Салат", "Lettuce", 0.75, { temperature: 18, humidity: 61, soil: 41, co2: 740, waterLevel: 74 })
  ];

  const settings = JSON.parse(JSON.stringify(DEFAULT_ZONE_SETTINGS));
  const startIso = new Date(Date.now() - HISTORY_LENGTH * 5000).toISOString();

  const state = {
    zones: zones,
    settings: settings,
    sensors: makeSensors(zones, startIso),
    alerts: [],
    events: [],
    meta: { simMinutes: 9 * 60 - HISTORY_LENGTH * TICK_MINUTES, ticks: [], nextAlertId: 1, nextEventId: 1 }
  };

  state.events.push({
    id: state.meta.nextEventId++, zoneId: null, source: "system", action: "SYSTEM_START",
    message: "Система запущена, все зоны в режиме AUTO", timestamp: startIso, simTime: simClock(state.meta.simMinutes)
  });

  // «Прокручиваем» симуляцию, чтобы появилась история для графиков
  const rnd = seededRandom(2026);
  for (let i = 0; i < HISTORY_LENGTH; i++) {
    const iso = new Date(Date.now() - (HISTORY_LENGTH - i) * 5000).toISOString();
    simulateStep(state, rnd, iso);
  }
  return state;
}
