(function () {
  const CH = window.CH;
  const list = document.getElementById("eventsList");

  function statusPills(event) {
    return CH.state.participants.map((person) => {
      const value = event.participantStatus?.[person.id] || "no";
      return `<div class="status-row"><span>${CH.escape(person.name)}</span><span>${CH.eventStatuses[value]}</span></div>`;
    }).join("");
  }

  function render() {
    const sorted = [...CH.state.events].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
    list.innerHTML = sorted.map((event) => `
      <article class="event-card" id="${event.id}">
        <div class="event-time">${CH.formatDate(CH.fromDateKey(event.date))} · ${CH.hourLabel(event.start)}–${CH.hourLabel(event.end)}</div>
        <h2>${CH.escape(event.title)}</h2>
        <p>${CH.escape(event.activity || "тип не указан")}</p>
        <p>${CH.escape(event.description || "")}</p>
        <div class="status-grid">${statusPills(event)}</div>
        <div class="card-actions">
          <button class="btn primary" data-edit="${event.id}">редактировать</button>
        </div>
      </article>`).join("") || `<p class="muted">Ивентов пока нет.</p>`;
    list.querySelectorAll("[data-edit]").forEach((button) => button.onclick = () => editEvent(button.dataset.edit));
  }

  function editEvent(id) {
    CH.modal("Редактировать ивент", CH.eventForm(CH.state.events.find((event) => event.id === id)));
    CH.bindEventForm(render);
  }

  document.getElementById("addEventBtn").onclick = () => {
    CH.modal("Создать ивент", CH.eventForm());
    CH.bindEventForm(render);
  };

  render();
})();
