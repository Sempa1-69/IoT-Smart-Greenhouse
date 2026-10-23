/* =========================================================
   analytics.js — страница Smart Analytics
   Risk Score и рекомендации по зонам, тренды, резкие
   изменения и графики (Risk, CO₂, свет, тревоги)
   ========================================================= */

(function () {
  const ARROW = { up: "↑ растёт", down: "↓ падает", stable: "→ стабильно" };

  function offlineCount(state, zoneId) {
    return state.sensors.filter(function (x) { return x.zoneId === zoneId && x.status === "offline"; }).length;
  }

  function kpi(ic, tone, label, value, note) {
    return '<article class="card kpi"><div class="kpi-top"><span>' + label + '</span><span class="kpi-icon ' + tone + '">' + icon(ic) +
      '</span></div><div class="kpi-value">' + value + '</div><div class="kpi-note">' + note + "</div></article>";
  }

  function recHtml(r) {
    return '<div class="rec ' + (r.severity === "ok" ? "" : r.severity) + '"><h4>' + escapeHtml(r.what) + "</h4>" +
      "<dl><dt>Почему важно</dt><dd>" + escapeHtml(r.why) + "</dd><dt>Что сделать</dt><dd>" + escapeHtml(r.action) + "</dd></dl></div>";
  }

  function render(state) {
    const p = palette();
    const data = state.zones.map(function (z) {
      const s = state.settings[z.id];
      const risk = calculateRisk(z, s, offlineCount(state, z.id));
      return { zone: z, s: s, risk: risk, recs: getRecommendations(z, s, state), sudden: suddenChanges(z) };
    });

    const avgRisk = Math.round(data.reduce(function (a, d) { return a + d.risk.score; }, 0) / data.length);
    const worst = data.reduce(function (m, d) { return d.risk.score > m.risk.score ? d : m; }, data[0]);
    const actionRecs = data.reduce(function (a, d) { return a + d.recs.filter(function (r) { return r.severity !== "ok"; }).length; }, 0);
    const suddenCount = data.reduce(function (a, d) { return a + d.sudden.length; }, 0);

    document.getElementById("anaKpi").innerHTML =
      kpi("analytics", avgRisk >= 60 ? "tone-crit" : avgRisk >= 30 ? "tone-warn" : "tone-ok", "Средний Risk Score", avgRisk, riskLevel(avgRisk).label + " риск по теплице") +
      kpi("alerts", worst.risk.score >= 30 ? "tone-crit" : "tone-ok", "Зона с макс. риском", escapeHtml(worst.zone.name), "Risk Score " + worst.risk.score) +
      kpi("info", "tone-water", "Рекомендации", actionRecs, "требуют действий оператора") +
      kpi("bolt", suddenCount ? "tone-warn" : "tone-ok", "Резкие изменения", suddenCount, "за последний замер (≥ 30%)");

    document.getElementById("riskCards").innerHTML = data.map(function (d) {
      const level = riskLevel(d.risk.score);
      return '<article class="card zone-card">' +
        '<div class="zone-top"><div><h3>' + escapeHtml(d.zone.name) + "</h3><small>" + d.zone.id + "</small></div>" +
          badge(level.key, "Риск: " + level.label) + "</div>" +
        '<div class="risk"><div class="risk-row"><span>Risk Score</span><b class="mono" style="font-size:20px">' + d.risk.score + "/100</b></div>" +
          '<div class="risk-track"><div class="risk-fill" style="width:' + d.risk.score + "%;background:" + riskColorVar(d.risk.score) + '"></div></div>' +
          '<small class="muted">' + (d.risk.reasons.length ? "Факторы: " + escapeHtml(d.risk.reasons.join("; ")) : "Факторов риска нет") + "</small></div>" +
        '<div class="stack" style="gap:8px">' + d.recs.map(recHtml).join("") + "</div>" +
      "</article>";
    }).join("");

    makeChart("riskChart", {
      type: "bar",
      data: {
        labels: data.map(function (d) { return d.zone.name; }),
        datasets: [{
          label: "Risk Score", data: data.map(function (d) { return d.risk.score; }), borderRadius: 8, maxBarThickness: 60,
          backgroundColor: data.map(function (d) { return d.risk.score >= 60 ? p.crit : d.risk.score >= 30 ? p.warn : p.ok; })
        }]
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, grid: { color: p.grid } }, x: { grid: { display: false } } } }
    });

    historyChart("co2Chart", state, "co2");
    historyChart("lightChart", state, "light");

    const typeLabels = { temperature: "Температура", humidity: "Влажность", soil: "Почва", waterLevel: "Вода", pumpBlocked: "Блок насоса", co2: "CO₂", sensor: "Датчики offline" };
    const counts = {};
    state.alerts.forEach(function (a) {
      const key = a.type.indexOf("sensor:") === 0 ? "sensor" : a.type;
      counts[key] = (counts[key] || 0) + 1;
    });
    const keys = Object.keys(counts);
    const colors = [p.warn, p.water, p.accent, p.crit, p.violet, p.ok, p.text];
    makeChart("alertTypeChart", {
      type: "doughnut",
      data: {
        labels: keys.length ? keys.map(function (k) { return typeLabels[k] || k; }) : ["Тревог нет"],
        datasets: [{
          data: keys.length ? keys.map(function (k) { return counts[k]; }) : [1],
          backgroundColor: keys.length ? keys.map(function (k, i) { return colors[i % colors.length]; }) : [p.grid],
          borderColor: p.surface, borderWidth: 3
        }]
      },
      options: { cutout: "62%", plugins: { legend: { position: "right", labels: { boxWidth: 12 } } } }
    });

    document.getElementById("trendBody").innerHTML = data.map(function (d) {
      const cell = function (type) {
        const t = trend(d.zone.history[type], type);
        const color = t.dir === "stable" ? "var(--muted)" : "var(--text)";
        return '<td style="color:' + color + '">' + ARROW[t.dir] + "</td>";
      };
      return "<tr><td><b>" + escapeHtml(d.zone.name) + "</b></td>" + cell("temperature") + cell("humidity") + cell("soil") + cell("co2") + cell("waterLevel") + "</tr>";
    }).join("");

    const sudden = [];
    data.forEach(function (d) {
      d.sudden.forEach(function (x) {
        sudden.push('<div class="item"><span class="item-icon tone-warn">' + icon(SENSOR_TYPES[x.type].icon) + "</span><div><b>" +
          escapeHtml(d.zone.name) + " · " + SENSOR_TYPES[x.type].label + ": " + x.change + "%</b><p>" +
          formatValue(x.type, x.previous) + " → " + formatValue(x.type, x.current) + " за один замер. Проверьте датчик и устройства зоны.</p></div></div>");
      });
    });
    document.getElementById("suddenList").innerHTML = sudden.length ? sudden.join("")
      : '<div class="empty">Резких скачков нет: изменения за последний замер меньше 30%</div>';
  }

  initPage("analytics", render);
})();
