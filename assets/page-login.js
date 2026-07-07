(function () {
  const CH = window.CH;
  const isSetup = !CH.hasAccounts();
  document.getElementById("loginTitle").textContent = isSetup ? "Первичная настройка" : "Вход";
  document.getElementById("loginHint").textContent = isSetup ? "Создай мастер-аккаунт. Он будет управлять составом, ролями и командами." : "Войди под своим аккаунтом.";
  document.getElementById("loginSubmit").textContent = isSetup ? "Создать мастер-аккаунт" : "Войти";

  document.getElementById("loginForm").onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const login = String(form.get("login")).trim();
    const pin = String(form.get("pin")).trim();
    if (isSetup) {
      const account = { id: "master", role: "master", name: "Master", login, participantId: null, teamId: null, canViewOthers: true };
      await CH.setAccountPassword(account, pin);
      CH.state.accounts.push(account);
      CH.save();
      localStorage.setItem(CH.sessionKey, account.id);
      location.href = "admin.html";
      return;
    }
    const account = await CH.login(login, pin);
    if (!account) {
      CH.toast?.("Неверный логин или PIN");
      const toast = document.getElementById("toast");
      if (toast) {
        toast.textContent = "Неверный логин или PIN";
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 1300);
      }
      return;
    }
    location.href = account.role === "member" ? `member.html?id=${account.participantId}` : "index.html";
  };
})();
