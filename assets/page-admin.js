(function () {
  const CH = window.CH;
  const user = CH.currentUser();
  const canAdmin = user?.role === "master" || user?.role === "admin";

  if (!canAdmin) {
    document.querySelector(".workspace").innerHTML = `
      <header class="page-head"><div><h1>Нет доступа</h1><p>Админ-панель доступна только мастеру и администраторам.</p></div></header>
      <a class="btn primary" href="index.html">Вернуться на общее</a>`;
    throw new Error("admin access denied");
  }

  function participantOptions(selected) {
    return `<option value="">без участника</option>` + CH.state.participants.map((person) =>
      `<option value="${person.id}" ${selected === person.id ? "selected" : ""}>${CH.escape(person.name)}</option>`
    ).join("");
  }

  function teamOptions(selected) {
    return `<option value="">без команды</option>` + CH.state.teams.map((team) =>
      `<option value="${team.id}" ${selected === team.id ? "selected" : ""}>${CH.escape(team.name)}</option>`
    ).join("");
  }

  function renderAccounts() {
    document.getElementById("accountList").innerHTML = CH.state.accounts.map((account) => {
      const person = account.participantId ? CH.person(account.participantId) : null;
      const team = account.teamId ? CH.team(account.teamId) : null;
      return `<div class="admin-row">
        <div>
          <strong>${CH.escape(account.name || account.login)}</strong>
          <p>${CH.escape(account.login)} · ${CH.roles[account.role] || account.role}${person ? " · " + CH.escape(person.name) : ""}${team ? " · " + CH.escape(team.name) : ""}</p>
        </div>
        <div class="card-actions">
          <button class="btn" data-edit-account="${account.id}">редактировать</button>
          ${account.role !== "master" ? `<button class="btn danger" data-delete-account="${account.id}">удалить</button>` : ""}
        </div>
      </div>`;
    }).join("");
    document.querySelectorAll("[data-edit-account]").forEach((button) => button.onclick = () => openAccountForm(button.dataset.editAccount));
    document.querySelectorAll("[data-delete-account]").forEach((button) => button.onclick = () => deleteAccount(button.dataset.deleteAccount));
  }

  function renderTeams() {
    document.getElementById("teamList").innerHTML = CH.state.teams.map((team) => {
      const lead = team.leadId ? CH.person(team.leadId) : null;
      const members = team.members.map(CH.person).filter(Boolean);
      return `<div class="admin-row">
        <div>
          <strong><span class="dot" style="background:${CH.escape(team.color)}"></span>${CH.escape(team.name)}</strong>
          <p>Тимлид: ${lead ? CH.escape(lead.name) : "не назначен"} · участников: ${members.length}</p>
          <div class="pill-row">${members.map((person) => `<span class="pill">${CH.escape(person.name)}</span>`).join("")}</div>
        </div>
        <div class="card-actions">
          <button class="btn" data-edit-team="${team.id}">редактировать</button>
          <button class="btn danger" data-delete-team="${team.id}">удалить</button>
        </div>
      </div>`;
    }).join("") || `<p class="muted">Команд пока нет.</p>`;
    document.querySelectorAll("[data-edit-team]").forEach((button) => button.onclick = () => openTeamForm(button.dataset.editTeam));
    document.querySelectorAll("[data-delete-team]").forEach((button) => button.onclick = () => deleteTeam(button.dataset.deleteTeam));
  }

  function render() {
    renderAccounts();
    renderTeams();
  }

  function openAccountForm(id = "") {
    const account = CH.state.accounts.find((item) => item.id === id) || { name: "", login: "", role: "member", participantId: "", teamId: "", canViewOthers: false };
    CH.modal(id ? "Редактировать аккаунт" : "Создать аккаунт", `
      <form class="form-grid" id="accountForm" data-id="${CH.escape(id)}">
        <div class="two">
          <div class="form-row"><label>Имя</label><input name="name" value="${CH.escape(account.name || "")}" required></div>
          <div class="form-row"><label>Логин</label><input name="login" value="${CH.escape(account.login || "")}" required></div>
        </div>
        <div class="three">
          <div class="form-row"><label>Новый пароль</label><div class="password-row"><input name="pin" value=""><button class="btn" type="button" id="generateAccountPasswordBtn">сгенерировать</button></div></div>
          <div class="form-row"><label>Роль</label><select name="role">${Object.entries(CH.roles).map(([key, label]) => `<option value="${key}" ${account.role === key ? "selected" : ""}>${label}</option>`).join("")}</select></div>
          <div class="form-row"><label>Команда</label><select name="teamId">${teamOptions(account.teamId)}</select></div>
        </div>
        <div class="form-row"><label>Участник</label><select name="participantId">${participantOptions(account.participantId)}</select></div>
        <label class="check-row"><input type="checkbox" name="canViewOthers" ${account.canViewOthers ? "checked" : ""}> Разрешить просмотр чужих таблиц без редактирования</label>
        <button class="btn primary" type="submit">Сохранить</button>
      </form>`);
    document.getElementById("generateAccountPasswordBtn").onclick = () => {
      document.querySelector('#accountForm [name="pin"]').value = CH.generatePassword();
    };
    document.getElementById("accountForm").onsubmit = async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const previousState = CH.clone(CH.state);
      const payload = {
        id: id || CH.id(),
        name: String(form.get("name")).trim(),
        login: CH.cleanLogin(form.get("login")),
        role: String(form.get("role")),
        participantId: String(form.get("participantId")) || null,
        teamId: String(form.get("teamId")) || null,
        canViewOthers: Boolean(form.get("canViewOthers"))
      };
      if (CH.isLoginTaken(payload.login, id)) {
        alert("Такой логин уже существует. Укажи другой логин.");
        return;
      }
      const pin = String(form.get("pin")).trim();
      if (!id && !pin) {
        const input = event.currentTarget.querySelector('[name="pin"]');
        input.value = CH.generatePassword();
        input.focus();
        CH.toast("Пароль сгенерирован");
        return;
      }
      if (id) {
        const existing = CH.state.accounts.find((item) => item.id === id);
        Object.assign(existing, payload);
        if (pin) await CH.setAccountPassword(existing, pin);
      } else {
        if (pin) await CH.setAccountPassword(payload, pin);
        CH.state.accounts.push(payload);
      }
      try {
        await CH.saveGlobal();
      } catch (error) {
        CH.state = previousState;
        CH.persistLocal();
        return;
      }
      CH.closeModal();
      render();
    };
  }

  function openTeamForm(id = "") {
    const team = CH.team(id) || { name: "", color: "#9b6cff", leadId: "", members: [] };
    const memberChecks = CH.state.participants.map((person) =>
      `<label class="check-row"><input type="checkbox" name="member_${person.id}" ${team.members.includes(person.id) ? "checked" : ""}> ${CH.escape(person.name)}</label>`
    ).join("");
    CH.modal(id ? "Редактировать команду" : "Создать команду", `
      <form class="form-grid" id="teamForm" data-id="${CH.escape(id)}">
        <div class="two">
          <div class="form-row"><label>Название</label><input name="name" value="${CH.escape(team.name)}" required></div>
          <div class="form-row"><label>Цвет</label><input type="color" name="color" value="${CH.escape(team.color)}"></div>
        </div>
        <div class="form-row"><label>Тимлид</label><select name="leadId">${participantOptions(team.leadId)}</select></div>
        <div class="form-row"><label>Участники команды</label><div class="check-grid">${memberChecks}</div></div>
        <button class="btn primary" type="submit">Сохранить</button>
      </form>`);
    document.getElementById("teamForm").onsubmit = async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const previousState = CH.clone(CH.state);
      const teamId = id || CH.id();
      const members = CH.state.participants.filter((person) => form.get(`member_${person.id}`)).map((person) => person.id);
      const payload = {
        id: teamId,
        name: String(form.get("name")).trim(),
        color: String(form.get("color")),
        leadId: String(form.get("leadId")) || "",
        members
      };
      if (payload.leadId && !payload.members.includes(payload.leadId)) payload.members.push(payload.leadId);
      if (id) Object.assign(CH.team(id), payload);
      else CH.state.teams.push(payload);
      CH.state.accounts.forEach((account) => {
        if (account.participantId && payload.members.includes(account.participantId)) account.teamId = teamId;
        if (account.participantId === payload.leadId && account.role === "member") account.role = "teamlead";
      });
      try {
        await CH.saveGlobal();
      } catch (error) {
        CH.state = previousState;
        CH.persistLocal();
        return;
      }
      CH.closeModal();
      render();
    };
  }

  async function deleteAccount(id) {
    const account = CH.state.accounts.find((item) => item.id === id);
    if (!account || !confirm(`Удалить аккаунт "${account.login}"?`)) return;
    const previousState = CH.clone(CH.state);
    CH.deleteAccount(id);
    try {
      await CH.saveGlobal();
    } catch (error) {
      CH.state = previousState;
      CH.persistLocal();
      return;
    }
    render();
  }

  async function deleteTeam(id) {
    const team = CH.team(id);
    if (!team || !confirm(`Удалить команду "${team.name}"?`)) return;
    const previousState = CH.clone(CH.state);
    CH.state.teams = CH.state.teams.filter((item) => item.id !== id);
    CH.state.accounts.forEach((account) => {
      if (account.teamId === id) account.teamId = null;
    });
    try {
      await CH.saveGlobal();
    } catch (error) {
      CH.state = previousState;
      CH.persistLocal();
      return;
    }
    render();
  }

  document.getElementById("addTeamBtn").onclick = () => openTeamForm();
  document.getElementById("addAccountBtn").onclick = () => openAccountForm();
  render();
})();
