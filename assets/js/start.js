/* =========================================================
   start.js — стартовый экран: имя оператора и роль
   ========================================================= */

(function () {
  setTheme(getTheme());
  document.getElementById("startLogo").innerHTML = icon("logo");

  const form = document.getElementById("startForm");
  const error = document.getElementById("startError");
  const continueBtn = document.getElementById("continueBtn");
  const session = getSession();

  if (session) {
    continueBtn.textContent = "Продолжить как " + session.name;
    continueBtn.classList.remove("hidden");
    continueBtn.addEventListener("click", function () { window.location.href = "dashboard.html"; });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const name = form.operator.value.trim();
    if (name.length < 2) {
      error.textContent = "Введите имя оператора (минимум 2 символа)";
      form.operator.focus();
      return;
    }
    error.textContent = "";
    setSession({ name: name, role: form.role.value, startedAt: new Date().toISOString() });

    // Отметка о начале смены в журнале
    const state = getState();
    logEvent(state, null, "system", "SHIFT_START", "Начало смены: " + name + " (" + form.role.value + ")");
    saveState(state);

    window.location.href = "dashboard.html";
  });
})();
