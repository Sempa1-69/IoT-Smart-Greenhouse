/* =========================================================
   insights.js — Smart Analytics (локально, без AI API)
   Risk Score 0–100, резкие изменения, тренды и
   рекомендации в формате «что произошло → почему важно →
   что сделать». Это объяснимые правила, а не нейросеть.
   ========================================================= */

const RISK_WEIGHTS = [
  { test: function (z, s) { return z.temperature > s.temperature.max; }, points: 25, text: "температура выше max" },
  { test: function (z, s) { return z.temperature < s.temperature.min; }, points: 20, text: "температура ниже min" },
  { test: function (z, s) { return z.soil < s.soil.min; }, points: 25, text: "почва сухая" },
  { test: function (z, s) { return z.waterLevel <= s.waterLevel.critical; }, points: 30, text: "критически мало воды" },
  { test: function (z, s) { return z.co2 > 1500; }, points: 15, text: "CO₂ выше 1500 ppm" },
  { test: function (z, s) { return z.humidity < s.humidity.min || z.humidity > s.humidity.max; }, points: 10, text: "влажность вне диапазона" }
];

function calculateRisk(zone, s, offlineCount) {
  let score = 0;
  const reasons = [];
  RISK_WEIGHTS.forEach(function (w) {
    if (w.test(zone, s)) {
      score += w.points;
      reasons.push(w.text + " (+" + w.points + ")");
    }
  });
  if (offlineCount > 0) {
    score += 10 * offlineCount;
    reasons.push("датчиков offline: " + offlineCount + " (+" + 10 * offlineCount + ")");
  }
  return { score: Math.min(score, 100), reasons: reasons };
}

function riskLevel(score) {
  if (score >= 60) return { key: "high", label: "Высокий" };
  if (score >= 30) return { key: "medium", label: "Средний" };
  return { key: "low", label: "Низкий" };
}

function riskColorVar(score) {
  const level = riskLevel(score).key;
  return level === "high" ? "var(--crit)" : level === "medium" ? "var(--warn)" : "var(--ok)";
}

/* ---------- Резкие изменения ---------- */

function percentChange(previous, current) {
  if (previous === 0) return 0;
  return Math.abs(((current - previous) / previous) * 100);
}

function detectSuddenChange(previous, current) {
  return percentChange(previous, current) >= 30;
}

// Освещённость не проверяем: на рассвете и закате она меняется естественно
const SUDDEN_TYPES = ["temperature", "humidity", "soil", "co2", "waterLevel"];

function suddenChanges(zone) {
  const list = [];
  SUDDEN_TYPES.forEach(function (type) {
    const h = zone.history[type];
    if (h.length < 2) return;
    const prev = h[h.length - 2], cur = h[h.length - 1];
    if (detectSuddenChange(prev, cur)) {
      list.push({ type: type, previous: prev, current: cur, change: round(percentChange(prev, cur), 0) });
    }
  });
  return list;
}

/* ---------- Тренды ---------- */

// Сравниваем среднее последних 4 замеров с предыдущими 4
function trend(history, type) {
  if (history.length < 8) return { dir: "stable", delta: 0 };
  const avg = function (arr) { return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length; };
  const recent = avg(history.slice(-4));
  const before = avg(history.slice(-8, -4));
  const delta = recent - before;
  const scale = { temperature: 0.5, humidity: 3, soil: 2, light: 1500, co2: 40, waterLevel: 2 }[type] || 1;
  if (delta > scale) return { dir: "up", delta: delta };
  if (delta < -scale) return { dir: "down", delta: delta };
  return { dir: "stable", delta: delta };
}

/* ---------- Recommendation Engine ---------- */

function getRecommendations(zone, s, state) {
  const recs = [];
  const add = function (severity, what, why, action) {
    recs.push({ severity: severity, what: what, why: why, action: action });
  };
  const soilTrend = trend(zone.history.soil, "soil");
  const waterTrend = trend(zone.history.waterLevel, "waterLevel");

  if (zone.waterLevel <= s.waterLevel.critical) {
    add("critical", "Низкий уровень воды: " + round(zone.waterLevel, 0) + "%",
      "Насос не может поливать — растения останутся без воды.",
      "Заполнить резервуар (Control → «Пополнить бак»).");
  } else if (zone.waterLevel <= s.waterLevel.critical + 10 && waterTrend.dir === "down") {
    add("warning", "Вода в баке быстро расходуется: " + round(zone.waterLevel, 0) + "%",
      "Скоро уровень дойдёт до критического и полив заблокируется.",
      "Запланировать пополнение бака.");
  }
  if (zone.soil < s.soil.min) {
    add(zone.soil < s.soil.min - 15 ? "critical" : "warning", "Почва сухая: " + zone.soil + "% (min " + s.soil.min + "%)",
      "Недостаток влаги замедляет рост и вызывает увядание.",
      zone.mode === "auto" ? "Автоматика включит полив, проверьте, что насос работает." : "Проверить необходимость полива и включить насос.");
  } else if (soilTrend.dir === "down" && zone.soil < s.soil.min + 5) {
    add("warning", "Почва высыхает, скоро будет ниже порога",
      "Тренд за последний час — снижение влажности.",
      "Убедиться, что в баке достаточно воды для полива.");
  }
  if (zone.temperature > s.temperature.max) {
    add(zone.temperature > s.temperature.max + 5 ? "critical" : "warning", "Температура выше диапазона: " + zone.temperature + "°C",
      "Перегрев вызывает стресс растений и потерю влаги.",
      "Проверить вентиляцию, открыть форточку, включить вентилятор.");
  }
  if (zone.temperature < s.temperature.min) {
    add(zone.temperature < s.temperature.min - 5 ? "critical" : "warning", "Температура ниже диапазона: " + zone.temperature + "°C",
      "Холод замедляет рост, возможны болезни корней.",
      "Проверить обогреватель и закрыть форточку.");
  }
  if (zone.humidity < s.humidity.min || zone.humidity > s.humidity.max) {
    const low = zone.humidity < s.humidity.min;
    add("warning", (low ? "Сухой воздух: " : "Повышенная влажность: ") + zone.humidity + "%",
      low ? "Растения теряют больше влаги через листья." : "Высокая влажность повышает риск грибковых болезней.",
      low ? "Включить увлажнитель." : "Проветрить теплицу, открыть форточку.");
  }
  if (zone.light < s.light.min) {
    add("warning", "Низкая освещённость: " + Math.round(zone.light) + " lx (min " + s.light.min + ")",
      "Недостаток света замедляет фотосинтез.",
      "Рассмотреть включение досветки (фитолампы).");
  }
  if (zone.co2 > s.co2.max) {
    add(zone.co2 > s.co2.max + 400 ? "critical" : "warning", "Высокий CO₂: " + zone.co2 + " ppm",
      "Плохой воздухообмен, некомфортно для персонала.",
      "Проветрить: открыть форточку или включить вентилятор.");
  }
  const offline = state.sensors.filter(function (x) { return x.zoneId === zone.id && x.status === "offline"; });
  if (offline.length) {
    add("warning", "Нет данных с датчиков: " + offline.map(function (x) { return x.id; }).join(", "),
      "Автоматика не может управлять тем, чего не видит.",
      "Проверить питание и связь датчиков (Sensors → «Перезапустить»).");
  }
  if (recs.length === 0) {
    add("ok", "Состояние зоны стабильно", "Все показатели в заданных диапазонах.", "Действий не требуется.");
  }
  return recs;
}
