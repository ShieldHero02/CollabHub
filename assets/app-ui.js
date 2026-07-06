(function () {
  const CH = window.CH;

  CH.toast = function (text) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add("show");
    clearTimeout(CH.toastTimer);
    CH.toastTimer = setTimeout(() => toast.classList.remove("show"), 1300);
  };

  CH.renderNav = function () {
    const nav = document.getElementById("mainNav");
    if (!nav) return;
    const page = document.body.dataset.page;
    const user = CH.currentUser();
    const items = [
      ["overview", "index.html", "Общее"],
      ["people", "people.html", "Участники"],
      ["events", "events.html", "Ивенты"],
      ["calendar", "calendar.html", "Календарь"],
      ["admin", "admin.html", "Админ"],
      ["data", "data.html", "Данные"]
    ];
    nav.innerHTML = items.map(([id, href, label]) =>
      `<a class="${page === id ? "active" : ""}" href="${href}">${label}</a>`
    ).join("") + `<button class="nav-user" id="logoutBtn">${CH.escape(user?.name || "Гость")} · выйти</button>`;
    document.getElementById("logoutBtn").onclick = CH.logout;
  };

  CH.modal = function (title, body) {
    const modal = document.getElementById("modal");
    if (!modal) return;
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalBody").innerHTML = body;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  };

  CH.closeModal = function () {
    const modal = document.getElementById("modal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  };

  CH.bindModalClose = function () {
    const close = document.getElementById("closeModalBtn");
    if (close) close.onclick = CH.closeModal;
  };

  CH.isMaster = function () {
    return CH.currentUser()?.role === "master";
  };

  CH.canEditParticipant = function (participantId) {
    const user = CH.currentUser();
    return user?.role === "master" || user?.role === "admin" || user?.participantId === participantId;
  };

  CH.canViewParticipant = function (participantId) {
    const user = CH.currentUser();
    if (!user || !CH.person(participantId)) return false;
    if (user.role === "master" || user.role === "admin") return true;
    if (user.participantId === participantId) return true;
    return Boolean(user.canViewOthers);
  };

  CH.canManageEvents = function () {
    const role = CH.currentUser()?.role;
    return role === "master" || role === "admin" || role === "teamlead";
  };

  CH.canEditEventStatus = function (participantId) {
    const user = CH.currentUser();
    return CH.canManageEvents() || user?.participantId === participantId;
  };

  CH.personForm = function (person) {
    const id = person?.id || "";
    return `
      <form class="form-grid" id="personForm" data-id="${CH.escape(id)}">
        <div class="two">
          <div class="form-row">
            <label>Имя</label>
            <input name="name" value="${CH.escape(person?.name || "")}" required>
          </div>
          <div class="form-row">
            <label>Цвет</label>
            <input name="color" type="color" value="${CH.escape(person?.color || "#55dd78")}">
          </div>
        </div>
        <div class="form-row">
          <label>Игры / интересы через запятую</label>
          <input name="interests" value="${CH.escape((person?.interests || []).join(", "))}">
        </div>
        <div class="two">
          <div class="form-row">
            <label>Логин</label>
            <input name="login" value="${CH.escape(CH.state.accounts.find((account) => account.participantId === id)?.login || "")}">
          </div>
          <div class="form-row">
            <label>PIN / пароль</label>
            <div class="password-row"><input name="pin" value=""><button class="btn" type="button" data-generate-password>сгенерировать</button></div>
          </div>
        </div>
        <label class="check-row"><input type="checkbox" name="canViewOthers" ${CH.state.accounts.find((account) => account.participantId === id)?.canViewOthers ? "checked" : ""}> Разрешить просмотр чужих таблиц без редактирования</label>
        <div class="form-actions">
          <button class="btn primary" type="submit">Сохранить</button>
        </div>
      </form>`;
  };

  CH.bindPersonForm = function (onDone) {
    document.querySelectorAll("[data-generate-password]").forEach((button) => {
      button.onclick = () => {
        const input = button.closest(".password-row").querySelector("input");
        input.value = CH.generatePassword();
      };
    });
    document.getElementById("personForm").onsubmit = async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const id = event.currentTarget.dataset.id;
      const previousState = CH.clone(CH.state);
      const payload = {
        name: String(form.get("name")).trim(),
        color: String(form.get("color")),
        interests: String(form.get("interests")).split(",").map((item) => item.trim()).filter(Boolean)
      };
      if (!payload.name) return;
      let participantId = id;
      if (id) {
        Object.assign(CH.person(id), payload);
      } else {
        participantId = CH.id();
        CH.state.participants.push({ id: participantId, ...payload });
        CH.state.schedules[participantId] = CH.blankSchedule("unknown");
        CH.state.dateSchedules[participantId] = {};
        CH.state.comments[participantId] = {};
      }
      let account = CH.state.accounts.find((item) => item.participantId === participantId);
      if (!account) {
        account = { id: `acc_${participantId}`, role: "member", participantId };
        CH.state.accounts.push(account);
      }
      account.name = payload.name;
      account.login = CH.cleanLogin(form.get("login")) || participantId;
      account.canViewOthers = Boolean(form.get("canViewOthers"));
      if (CH.isLoginTaken(account.login, account.id)) {
        alert("Такой логин уже существует. Укажи другой логин.");
        CH.state = previousState;
        CH.persistLocal();
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
      if (pin) await CH.setAccountPassword(account, pin);
      try {
        await CH.saveGlobal();
      } catch (error) {
        CH.state = previousState;
        CH.persistLocal();
        return;
      }
      CH.closeModal();
      onDone?.();
    };
  };

  CH.hourOptions = function (selected, min, max) {
    let html = "";
    for (let hour = min; hour <= max; hour++) {
      html += `<option value="${hour}" ${Number(selected) === hour ? "selected" : ""}>${CH.hourLabel(hour)}</option>`;
    }
    return html;
  };

  CH.eventForm = function (event) {
    const item = event || { title: "", activity: "", date: CH.state.settings.activeDate, start: 20, end: 22, description: "", participantStatus: {} };
    const dateValue = item.date || CH.state.settings.activeDate;
    const suggestions = CH.suggestPeople(dateValue, Number(item.start), Number(item.end));
    const statusRows = CH.state.participants.map((person) => {
      const current = item.participantStatus?.[person.id] || "no";
      return `<div class="participant-status">
        <span><span class="dot" style="background:${CH.escape(person.color)}"></span>${CH.escape(person.name)}</span>
        <select name="ps_${person.id}">
          ${Object.entries(CH.eventStatuses).map(([key, label]) => `<option value="${key}" ${current === key ? "selected" : ""}>${label}</option>`).join("")}
        </select>
      </div>`;
    }).join("");
    return `
      <form class="form-grid" id="eventForm" data-id="${CH.escape(item.id || "")}">
        <div class="two">
          <div class="form-row"><label>Название</label><input name="title" value="${CH.escape(item.title)}" required></div>
          <div class="form-row"><label>Игра / тип</label><input name="activity" value="${CH.escape(item.activity || "")}"></div>
        </div>
        <div class="three">
          <div class="form-row"><label>Дата</label><input name="date" type="date" value="${CH.escape(dateValue)}"></div>
          <div class="form-row"><label>Начало</label><select name="start">${CH.hourOptions(item.start, 0, 23)}</select></div>
          <div class="form-row"><label>Конец</label><select name="end">${CH.hourOptions(item.end, 1, 24)}</select></div>
        </div>
        <div class="suggest-box">
          <strong>Свободные на это время</strong>
          <div class="pill-row" id="suggestList">${CH.suggestionHtml(suggestions)}</div>
        </div>
        <div class="form-row"><label>Описание</label><textarea name="description">${CH.escape(item.description || "")}</textarea></div>
        <div class="form-row"><label>Участники</label>${statusRows}</div>
        <div class="form-actions">
          <button class="btn primary" type="submit">Сохранить</button>
          ${item.id ? `<button class="btn danger" type="button" id="deleteEventBtn">Удалить</button>` : ""}
        </div>
      </form>`;
  };

  CH.bindEventForm = function (onDone) {
    if (!CH.canManageEvents()) return;
    const formElement = document.getElementById("eventForm");
    const refreshSuggestions = () => {
      const form = new FormData(formElement);
      const suggestions = CH.suggestPeople(String(form.get("date")), Number(form.get("start")), Number(form.get("end")));
      document.getElementById("suggestList").innerHTML = CH.suggestionHtml(suggestions);
    };
    formElement.querySelectorAll('[name="date"], [name="start"], [name="end"]').forEach((field) => {
      field.onchange = refreshSuggestions;
    });
    formElement.onsubmit = (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const id = event.currentTarget.dataset.id;
      const start = Number(form.get("start"));
      const end = Number(form.get("end"));
      if (end <= start) {
        alert("Конец должен быть позже начала.");
        return;
      }
      const date = String(form.get("date"));
      const participantStatus = {};
      CH.state.participants.forEach((person) => {
        participantStatus[person.id] = String(form.get(`ps_${person.id}`));
      });
      const payload = {
        id: id || CH.id(),
        title: String(form.get("title")).trim() || "Без названия",
        activity: String(form.get("activity")).trim(),
        date,
        day: (CH.fromDateKey(date).getDay() + 6) % 7,
        start,
        end,
        description: String(form.get("description")).trim(),
        participantStatus
      };
      if (id) {
        const index = CH.state.events.findIndex((item) => item.id === id);
        CH.state.events[index] = payload;
      } else {
        CH.state.events.push(payload);
      }
      CH.save();
      CH.closeModal();
      onDone?.();
    };
    const del = document.getElementById("deleteEventBtn");
    if (del) del.onclick = () => {
      const id = document.getElementById("eventForm").dataset.id;
      const item = CH.state.events.find((event) => event.id === id);
      if (!item || !confirm(`Удалить ивент "${item.title}"?`)) return;
      CH.state.events = CH.state.events.filter((event) => event.id !== id);
      CH.save();
      CH.closeModal();
      onDone?.();
    };
  };

  CH.suggestionHtml = function (suggestions) {
    return suggestions.length
      ? suggestions.map(({ person, score }) => `<span class="pill"><span class="dot" style="background:${CH.escape(person.color)}"></span>${CH.escape(person.name)} · ${score}</span>`).join("")
      : "<small>свободных не найдено</small>";
  };

  CH.getScale = function () {
    return CH.state.settings?.tableScale || "compact";
  };

  CH.setScale = function (scale) {
    CH.state.settings.tableScale = scale;
    localStorage.setItem(CH.storageKey, JSON.stringify(CH.state));
    document.querySelectorAll(".heatmap").forEach((grid) => {
      grid.classList.remove("scale-compact", "scale-normal", "scale-large");
      grid.classList.add(`scale-${scale}`);
    });
    CH.renderScaleSwitches();
  };

  CH.renderScaleSwitches = function () {
    const scale = CH.getScale();
    document.querySelectorAll("#scaleSwitch").forEach((target) => {
      target.innerHTML = ["compact", "normal", "large"].map((value) => {
        const label = value === "compact" ? "плотно" : value === "large" ? "крупно" : "норм";
        return `<button class="scale-btn ${scale === value ? "active" : ""}" data-scale="${value}" type="button">${label}</button>`;
      }).join("");
      target.querySelectorAll("button").forEach((button) => {
        button.onclick = () => CH.setScale(button.dataset.scale);
      });
    });
    document.querySelectorAll(".heatmap").forEach((grid) => {
      grid.classList.remove("scale-compact", "scale-normal", "scale-large");
      grid.classList.add(`scale-${scale}`);
    });
  };

  CH.applyTableSize = function () {
    const size = CH.state.settings?.tableSize;
    document.querySelectorAll(".heatmap-wrap").forEach((wrap) => {
      const surface = wrap.closest(".surface");
      if (surface && size?.width) surface.style.width = `${size.width}px`;
      if (size?.height) wrap.style.height = `${size.height}px`;
      if (surface && !surface.querySelector(".table-resize-handle")) {
        const handle = document.createElement("div");
        handle.className = "table-resize-handle";
        handle.title = "Изменить размер таблицы";
        surface.append(handle);
        let startX = 0;
        let startY = 0;
        let startWidth = 0;
        let startHeight = 0;
        handle.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          startX = event.clientX;
          startY = event.clientY;
          startWidth = surface.offsetWidth;
          startHeight = wrap.offsetHeight;
          handle.classList.add("is-dragging");
          handle.setPointerCapture(event.pointerId);
        });
        handle.addEventListener("pointermove", (event) => {
          if (!handle.classList.contains("is-dragging")) return;
          const width = Math.max(520, startWidth + event.clientX - startX);
          const height = Math.max(260, startHeight + event.clientY - startY);
          surface.style.width = `${width}px`;
          wrap.style.height = `${height}px`;
          CH.state.settings.tableSize = { width: Math.round(width), height: Math.round(height) };
        });
        handle.addEventListener("pointerup", (event) => {
          if (!handle.classList.contains("is-dragging")) return;
          handle.classList.remove("is-dragging");
          handle.releasePointerCapture(event.pointerId);
          localStorage.setItem(CH.storageKey, JSON.stringify(CH.state));
          CH.toast("Размер таблицы сохранен");
        });
      }
      if (!wrap.dataset.resizeBound) {
        wrap.dataset.resizeBound = "1";
        let lastWidth = surface?.offsetWidth || wrap.offsetWidth;
        let lastHeight = wrap.offsetHeight;
        const observer = new ResizeObserver((entries) => {
          const rect = entries[0].contentRect;
          const width = Math.round(surface?.offsetWidth || rect.width);
          const height = Math.round(rect.height);
          if (Math.abs(width - lastWidth) < 4 && Math.abs(height - lastHeight) < 4) return;
          lastWidth = width;
          lastHeight = height;
          CH.state.settings.tableSize = { width, height };
          clearTimeout(CH.tableSizeTimer);
          CH.tableSizeTimer = setTimeout(() => {
            localStorage.setItem(CH.storageKey, JSON.stringify(CH.state));
          }, 250);
        });
        observer.observe(wrap);
      }
    });
  };

  (async function initUi() {
    try {
      await CH.sharedReady;
    } catch (error) {}
    CH.requireAuth();
    CH.renderNav();
    CH.bindModalClose();
    CH.renderScaleSwitches();
    CH.applyTableSize();
  })();
})();
