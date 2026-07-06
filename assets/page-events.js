(function () {
  const CH = window.CH;
  const list = document.getElementById("eventsList");
  const addEventBtn = document.getElementById("addEventBtn");

  function statusPills(event) {
    return CH.state.participants.map((person) => {
      const value = event.participantStatus?.[person.id] || "no";
      return `<div class="status-row"><span>${CH.escape(person.name)}</span><span>${CH.eventStatuses[value] || CH.eventStatuses.no}</span></div>`;
    }).join("");
  }

  function render() {
    const canManage = CH.canManageEvents();
    const sorted = [...CH.state.events].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || Number(a.start) - Number(b.start));
    list.innerHTML = sorted.map((event) => `
      <article class="event-card" id="${CH.escape(event.id)}">
        <div class="event-time">${CH.formatDate(CH.fromDateKey(event.date))} · ${CH.hourLabel(event.start)}–${CH.hourLabel(event.end)}</div>
        <h2>${CH.escape(event.title)}</h2>
        <p>${CH.escape(event.activity || "тип не указан")}</p>
        <p>${CH.escape(event.description || "")}</p>
        <div class="status-grid">${statusPills(event)}</div>
        <div class="card-actions">
          <button class="btn primary" data-edit="${CH.escape(event.id)}">${canManage ? "редактировать" : "мой статус"}</button>
        </div>
      </article>`).join("") || `<p class="muted">Ивентов пока нет.</p>`;
    list.querySelectorAll("[data-edit]").forEach((button) => {
      button.onclick = () => editEvent(button.dataset.edit);
    });
    addEventBtn.classList.toggle("hidden", !canManage);
  }

  function editEvent(id) {
    const event = CH.state.events.find((item) => item.id === id);
    if (!event) return;
    if (CH.canManageEvents()) {
      CH.modal("Редактировать ивент", CH.eventForm(event));
      CH.bindEventForm(render);
      return;
    }
    openOwnStatusForm(event);
  }

  function openOwnStatusForm(event) {
    const user = CH.currentUser();
    const participantId = user?.participantId;
    if (!participantId) return;
    const current = event.participantStatus?.[participantId] || "no";
    CH.modal("Мой статус в ивенте", `
      <form class="form-grid" id="ownEventStatusForm">
        <div class="detail-block">
          <strong>${CH.escape(event.title)}</strong>
          <p>${CH.formatDate(CH.fromDateKey(event.date))} · ${CH.hourLabel(event.start)}–${CH.hourLabel(event.end)}</p>
        </div>
        <div class="form-row">
          <label>Статус участия</label>
          <select name="status">
            ${Object.entries(CH.eventStatuses).map(([key, label]) => `<option value="${key}" ${current === key ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </div>
        <button class="btn primary" type="submit">Сохранить</button>
      </form>`);
    document.getElementById("ownEventStatusForm").onsubmit = (submitEvent) => {
      submitEvent.preventDefault();
      const form = new FormData(submitEvent.currentTarget);
      event.participantStatus = event.participantStatus || {};
      event.participantStatus[participantId] = String(form.get("status"));
      CH.save();
      CH.closeModal();
      render();
    };
  }

  addEventBtn.onclick = () => {
    if (!CH.canManageEvents()) return;
    CH.modal("Создать ивент", CH.eventForm());
    CH.bindEventForm(render);
  };

  render();
})();
