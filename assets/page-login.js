(async function () {
  const CH = window.CH;
  const title = document.getElementById("loginTitle");
  const hint = document.getElementById("loginHint");
  const submit = document.getElementById("loginSubmit");
  const formElement = document.getElementById("loginForm");

  function showToast(text) {
    CH.toast?.(text);
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1800);
  }

  title.textContent = "Загрузка";
  hint.textContent = "Подтягиваем общие аккаунты сообщества...";
  submit.disabled = true;

  try {
    await CH.sharedReady;
  } catch (error) {}

  const isSetup = !CH.hasAccounts();
  title.textContent = isSetup ? "Первичная настройка" : "Вход";
  hint.textContent = isSetup
    ? "Создай мастер-аккаунт. Он будет управлять составом, ролями и командами."
    : "Войди под своим аккаунтом.";
  submit.textContent = isSetup ? "Создать мастер-аккаунт" : "Войти";
  submit.disabled = false;

  formElement.onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const login = String(form.get("login")).trim();
    const pin = String(form.get("pin")).trim();
    if (!login || !pin) return;

    try {
      submit.disabled = true;

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
        showToast("Неверный логин или PIN");
        return;
      }
      location.href = account.role === "member" ? `member.html?id=${account.participantId}` : "index.html";
    } catch (error) {
      showToast("Не удалось выполнить вход. Обнови страницу и попробуй ещё раз.");
    } finally {
      submit.disabled = false;
    }
  };
})();
