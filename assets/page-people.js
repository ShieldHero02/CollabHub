(function () {
  const CH = window.CH;
  const list = document.getElementById("peopleList");

  function freeHours(id) {
    let count = 0;
    const schedule = CH.state.schedules[id];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) if (schedule?.[day]?.[hour] === "free" || schedule?.[day]?.[hour] === "stream") count++;
    }
    return count;
  }

  function render() {
    const isMaster = CH.isMaster();
    list.innerHTML = CH.state.participants.map((person) => `
      <article class="person-card">
        <div class="person-head">
          <span class="avatar" style="background:${CH.escape(person.color)}"></span>
          <div><h2>${CH.escape(person.name)}</h2><small>${freeHours(person.id)} свободных часов в неделю</small></div>
        </div>
        <div class="interests">${(person.interests || []).map((item) => `<span class="interest">${CH.escape(item)}</span>`).join("") || `<span class="interest">без интересов</span>`}</div>
        <div class="card-actions">
          <a class="btn primary" href="member.html?id=${person.id}">таблица</a>
          ${isMaster ? `<button class="btn" data-edit="${person.id}">редактировать</button><button class="btn danger" data-delete="${person.id}">удалить</button>` : ""}
        </div>
      </article>`).join("");
    list.querySelectorAll("[data-edit]").forEach((button) => button.onclick = () => editPerson(button.dataset.edit));
    list.querySelectorAll("[data-delete]").forEach((button) => button.onclick = () => deletePerson(button.dataset.delete));
  }

  function editPerson(id) {
    CH.modal("Редактировать участника", CH.personForm(CH.person(id)));
    CH.bindPersonForm(render);
  }

  async function deletePerson(id) {
    const person = CH.person(id);
    if (!person || !confirm(`Удалить участника "${person.name}"?`)) return;
    const previousState = CH.clone(CH.state);
    CH.deleteParticipant(id);
    try {
      await CH.saveGlobal({ allowLocalOnly: true });
    } catch (error) {
      CH.state = previousState;
      CH.persistLocal();
      return;
    }
    render();
  }

  document.getElementById("addPersonBtn").classList.toggle("hidden", !CH.isMaster());
  document.getElementById("addPersonBtn").onclick = () => {
    if (!CH.isMaster()) return;
    CH.modal("Добавить участника", CH.personForm());
    CH.bindPersonForm(render);
  };

  render();
})();
