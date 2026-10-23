/* =========================================================
   alerts.js — тревоги Warning/Critical и журнал событий
   ========================================================= */

(function () {
  const tabAlerts = document.getElementById("tabAlerts");
  const tabEvents = document.getElementById("tabEvents");
  const alertsPane = document.getElementById("alertsPane");
  const eventsPane = document.getElementById("eventsPane");

  const aSearch = document.getElementById("alertSearch");
  const aSeverity = document.getElementById("alertSeverity");
  const aStatus = document.getElementById("alertStatus");
  const aZone = document.getElementById("alertZone");
  const eSearch = document.getElementById("eventSearch");
  const eSource = document.getElementById("eventSource");
  const eZone = document.getElementById("eventZone");

  getState().zones.forEach(function (z) {
    const opt = '<option value="' + z.id + '">' + escapeHtml(z.name) + "</option>";
    aZone.insertAdjacentHTML("beforeend", opt);
    eZone.insertAdjacentHTML("beforeend", opt);
  });

  function showTab(name) {
    const isAlerts = name === "alerts";
    tabAlerts.classList.toggle("on", isAlerts);
    tabEvents.classList.toggle("on", !isAlerts);
    tabAlerts.setAttribute("aria-selected", isAlerts);
    tabEvents.setAttribute("aria-selected", !isAlerts);
    alertsPane.classList.toggle("hidden", !isAlerts);
    eventsPane.classList.toggle("hidden", isAlerts);
    history.replaceState(null, "", isAlerts ? "alerts.html" : "alerts.html#events");
  }
  tabAlerts.addEventListener("click", function () { showTab("alerts"); });
  tabEvents.addEventListener("click", function () { showTab("events"); });
  if (location.hash === "#events") showTab("events");

  function kpi(ic, tone, label, value) {
    return '<article class="card kpi"><div class="kpi-top"><span>' + label + '</span><span class="kpi-icon ' + tone + '">' + icon(ic) +
      '</span></div><div class="kpi-value">' + value + "</div></article>";
  }

  function renderAlerts(state) {
    const all = state.alerts;
    const count = function (fn) { return all.filter(fn).length; };
    document.getElementById("alertKpi").innerHTML =
      kpi("alerts", "tone-crit", "Открытые", count(function (a) { return a.status === "open"; })) +
      kpi("bolt", "tone-crit", "Critical активные", count(function (a) { return a.status !== "resolved" && a.severity === "critical"; })) +
      kpi("check", "tone-warn", "Подтверждённые", count(function (a) { return a.status === "acknowledged"; })) +
      kpi("info", "tone-ok", "Закрытые", count(function (a) { return a.status === "resolved"; }));

    const text = aSearch.value.trim().toLowerCase();
    const list = all.filter(function (a) {
      const statusOk = aStatus.value === "active" ? a.status !== "resolved" : (!aStatus.value || a.status === aStatus.value);
      return statusOk &&
        (!aSeverity.value || a.severity === aSeverity.value) &&
        (!aZone.value || a.zoneId === aZone.value) &&
        (!text || (a.id + " " + a.message + " " + zoneName(state, a.zoneId)).toLowerCase().indexOf(text) !== -1);
    }).slice().reverse();

    document.getElementById("alertCount").textContent = "Найдено: " + list.length + " из " + all.length;
    document.getElementById("alertBody").innerHTML = list.length ? list.map(function (a) {
      const ack = a.status === "open" ? '<button class="btn ghost sm" data-ack="' + a.id + '">Подтвердить</button>' : "";
      const close = a.status !== "resolved" ? '<button class="btn ghost sm" data-close="' + a.id + '">Закрыть</button>' : "";
      return "<tr>" +
        '<td class="mono"><b>' + a.id + "</b></td>" +
        '<td class="mono">' + formatDateTime(a.createdAt) + '<br><small class="muted">теплица ' + a.simTime + "</small></td>" +
        "<td>" + escapeHtml(zoneName(state, a.zoneId)) + "</td>" +
        "<td>" + badge(a.severity, SEVERITY_TEXT[a.severity]) + "</td>" +
        "<td>" + escapeHtml(a.message) + "</td>" +
        "<td>" + badge(a.status, STATUS_TEXT[a.status]) + (a.resolvedBy === "auto" ? '<br><small class="muted">авто: показатель в норме</small>' : "") + "</td>" +
        '<td class="actions">' + (ack + close || '<span class="muted">—</span>') + "</td>" +
      "</tr>";
    }).join("") : '<tr><td colspan="7" class="empty">Тревог по выбранным условиям нет</td></tr>';
  }

  function filteredEvents(state) {
    const text = eSearch.value.trim().toLowerCase();
    return state.events.filter(function (e) {
      return (!eSource.value || e.source === eSource.value) &&
        (!eZone.value || e.zoneId === eZone.value) &&
        (!text || (e.action + " " + e.message).toLowerCase().indexOf(text) !== -1);
    }).slice().reverse();
  }

  function renderEvents(state) {
    const list = filteredEvents(state);
    document.getElementById("eventCount").textContent = "Найдено: " + list.length + " из " + state.events.length;
    document.getElementById("eventBody").innerHTML = list.length ? list.slice(0, 200).map(function (e) {
      return "<tr>" +
        '<td class="mono">' + e.id + "</td>" +
        '<td class="mono">' + formatDateTime(e.timestamp) + "</td>" +
        '<td class="mono">' + e.simTime + "</td>" +
        "<td>" + (e.zoneId ? escapeHtml(zoneName(state, e.zoneId)) : '<span class="muted">—</span>') + "</td>" +
        "<td>" + badge(SOURCE_CLASS[e.source], SOURCE_TEXT[e.source]) + "</td>" +
        '<td class="mono">' + e.action + "</td>" +
        "<td>" + escapeHtml(e.message) + "</td>" +
      "</tr>";
    }).join("") : '<tr><td colspan="7" class="empty">Событий нет</td></tr>';
  }

  function render(state) {
    renderAlerts(state);
    renderEvents(state);
  }

  initPage("alerts", render);

  [aSearch, aSeverity, aStatus, aZone, eSearch, eSource, eZone].forEach(function (el) {
    el.addEventListener("input", function () { render(getState()); });
  });

  document.getElementById("alertBody").addEventListener("click", function (e) {
    const ackBtn = e.target.closest("button[data-ack]");
    const closeBtn = e.target.closest("button[data-close]");
    if (!ackBtn && !closeBtn) return;
    const state = getState();
    const id = (ackBtn || closeBtn).dataset.ack || (ackBtn || closeBtn).dataset.close;
    const alert = state.alerts.find(function (a) { return a.id === id; });
    const now = new Date().toISOString();
    if (ackBtn) {
      alert.status = "acknowledged";
      logEvent(state, alert.zoneId, "manual", "ALERT_ACK", "Тревога " + id + " подтверждена оператором", now);
      toast("Тревога " + id + " подтверждена");
    } else {
      alert.status = "resolved";
      alert.resolvedAt = now;
      alert.resolvedBy = "operator";
      logEvent(state, alert.zoneId, "manual", "ALERT_CLOSE", "Тревога " + id + " закрыта оператором", now);
      toast("Тревога " + id + " закрыта. Если проблема не устранена, тревога появится снова.");
    }
    saveState(state);
    refreshAll(state);
  });

  // Экспорт журнала в CSV (откроется в Excel)
  document.getElementById("exportCsv").addEventListener("click", function () {
    const state = getState();
    const rows = [["id", "timestamp", "greenhouse_time", "zone", "source", "action", "message"]];
    filteredEvents(state).forEach(function (e) {
      rows.push([e.id, e.timestamp, e.simTime, e.zoneId ? zoneName(state, e.zoneId) : "", e.source, e.action, e.message]);
    });
    const csv = rows.map(function (r) {
      return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(";");
    }).join("\r\n");
    downloadFile("greenhouse-events.csv", "﻿" + csv, "text/csv;charset=utf-8");
    toast("Журнал выгружен: " + (rows.length - 1) + " событий");
  });

  document.getElementById("clearLog").addEventListener("click", function () {
    confirmDialog("Очистить журнал событий?", "Все записи журнала будут удалены. Тревоги останутся.", "Очистить").then(function (ok) {
      if (!ok) return;
      const state = getState();
      state.events = [];
      logEvent(state, null, "system", "LOG_CLEARED", "Журнал очищен оператором " + getSession().name);
      saveState(state);
      refreshAll(state);
      toast("Журнал очищен");
    });
  });
})();
