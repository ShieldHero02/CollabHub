(function () {
  const CH = window.CH;
  const params = new URLSearchParams(location.search);
  let personId = params.get("id") || CH.state.participants[0]?.id;
  let person = CH.person(personId);
  let selected = "free";
  let showEvents = true;
  let painting = false;
  let dragPainted = false;
  let paintAnchor = null;
  let toolCursor = "brush";
  let weekStart = CH.startOfWeek(CH.fromDateKey(CH.state.settings.activeDate));

  if (!person) location.href = "people.html";
  if (CH.currentUser() && !CH.canViewParticipant(personId)) location.href = "people.html";

  const grid = document.getElementById("memberGrid");
  const panel = document.getElementById("detailPanel");

  function render() {
    person = CH.person(personId);
    document.getElementById("memberTitle").textContent = person.name;
    document.getElementById("memberMeta").textContent = (person.interests || []).join(", ") || "интересы не указаны";
    setupEditorBar();
    renderPalette();
    renderLegend();
    renderRangeControls();
    renderPresetSelect();
    bindToolActions();
    renderGrid();
    CH.renderScaleSwitches();
    const canEdit = CH.canEditParticipant(personId);
    document.getElementById("editPersonBtn").classList.toggle("hidden", !canEdit);
    document.querySelector(".editor-bar").classList.toggle("hidden", !canEdit);
    document.querySelector(".editor-bar").classList.toggle("readonly-tools", !canEdit);
  }

  function setupEditorBar() {
    const bar = document.querySelector(".editor-bar");
    if (!bar) return;
    if (bar.dataset.compact === "range") return;
    bar.dataset.compact = "range";
    bar.innerHTML = `
      <div class="ribbon-tool">
        <details class="tool-dropdown" id="brushDropdown">
          <summary class="tool-button"><span class="tool-icon brush-icon"></span><span><b>Кисть</b><small id="brushLabel"></small></span></summary>
          <div class="tool-menu">
            <div class="tool-menu-title">Статус для рисования</div>
            <div class="palette" id="palette"></div>
          </div>
        </details>
      </div>
      <div class="ribbon-tool fill-inline">
        <span class="tool-icon fill-icon"></span>
        <select id="daySelect" title="День заливки"></select>
        <select id="fillStatusSelect" title="Статус заливки"></select>
        <select id="startHourSelect" title="Начало"></select>
        <select id="endHourSelect" title="Конец"></select>
        <button class="btn primary" id="applyRangeBtn">залить</button>
      </div>
      <div class="ribbon-tool preset-inline">
        <select id="presetSelect" title="Пресет"></select>
        <button class="btn" id="applyPresetBtn">применить</button>
        <button class="btn" id="addPresetBtn">+</button>
        <button class="btn danger" id="deletePresetBtn">удалить</button>
      </div>
      <div class="ribbon-spacer"></div>
      <div class="ribbon-tool scale-tool">
        <span class="tool-caption">Масштаб</span>
        <div class="scale-switch" id="scaleSwitch"></div>
      </div>`;
    return;
    if (!bar || bar.dataset.compact === "true") return;
    bar.dataset.compact = "true";
    bar.innerHTML = `
      <div class="ribbon-tool">
        <details class="tool-dropdown" id="brushDropdown">
          <summary class="tool-button"><span class="tool-icon brush-icon"></span><span><b>Кисть</b><small id="brushLabel"></small></span></summary>
          <div class="tool-menu">
            <div class="tool-menu-title">Статус для рисования</div>
            <div class="palette" id="palette"></div>
          </div>
        </details>
      </div>
      <div class="ribbon-tool">
        <details class="tool-dropdown" id="fillDropdown">
          <summary class="tool-button"><span class="tool-icon fill-icon"></span><span><b>Заливка</b><small>по выбранному дню</small></span></summary>
          <div class="tool-menu wide-menu">
            <div class="tool-menu-title">День и статус</div>
            <div class="range-tools compact-range">
              <select id="daySelect"></select>
              <select id="fillStatusSelect"></select>
              <button class="btn primary" id="applyRangeBtn">залить день</button>
            </div>
            <div class="tool-menu-title">Пресеты дня</div>
            <div class="preset-grid">
              <button class="btn" id="eveningFreeBtn">вечер свободен</button>
              <button class="btn" id="workBusyBtn">9-18 занят</button>
              <button class="btn" id="dayFreeBtn">день свободен</button>
              <button class="btn" id="dayClearBtn">очистить день</button>
            </div>
            <div class="preset-list" id="customPresets"></div>
          </div>
        </details>
      </div>
      <div class="ribbon-spacer"></div>
      <div class="ribbon-tool scale-tool">
        <span class="tool-caption">Масштаб</span>
        <div class="scale-switch" id="scaleSwitch"></div>
      </div>`;
    bar.querySelectorAll(".tool-dropdown").forEach((dropdown) => {
      dropdown.addEventListener("toggle", () => {
        if (!dropdown.open) return;
        bar.querySelectorAll(".tool-dropdown").forEach((other) => {
          if (other !== dropdown) other.removeAttribute("open");
        });
      });
    });
  }

  function renderPalette() {
    document.getElementById("palette").innerHTML = Object.entries(CH.statuses).map(([key, status]) =>
      `<button class="${selected === key ? "active" : ""}" data-status="${key}" title="${CH.escape(status.label)}" aria-label="${CH.escape(status.label)}" style="background:${CH.escape(status.color)}"><span>${CH.escape(shortStatusLabel(key, status.label))}</span></button>`
    ).join("");
    document.querySelectorAll("#palette button").forEach((button) => {
      button.onclick = () => {
        selected = button.dataset.status;
        setToolCursor("brush");
        renderPalette();
        syncFillStatus();
        document.getElementById("brushDropdown")?.removeAttribute("open");
      };
    });
    const label = document.getElementById("brushLabel");
    if (label) label.textContent = CH.statuses[selected]?.label || "";
    syncFillStatus();
  }

  function syncFillStatus() {
    const fillStatus = document.getElementById("fillStatusSelect");
    if (fillStatus) fillStatus.value = selected;
  }

  function shortStatusLabel(key, label) {
    return ({ free: "Св", busy: "Зн", maybe: "?", stream: "Ст", work: "Рб", study: "Уч", unknown: "—" })[key] || label.slice(0, 2);
  }

  function renderLegend() {
    document.getElementById("memberLegend").innerHTML = Object.entries(CH.statuses).map(([key, status]) =>
      `<span><i class="key ${key === "free" ? "mid" : key}" style="background:${CH.escape(status.color)}"></i>${CH.escape(status.label)}</span>`
    ).join("") + `<span><i class="key event"></i>ивент</span>`;
  }

  function renderRangeControls() {
    document.getElementById("daySelect").innerHTML = CH.days.map((day, index) => `<option value="${index}">${day}</option>`).join("");
    document.getElementById("fillStatusSelect").innerHTML = Object.entries(CH.statuses).map(([key, status]) =>
      `<option value="${key}" ${selected === key ? "selected" : ""}>${CH.escape(status.label)}</option>`
    ).join("");
    document.getElementById("startHourSelect").innerHTML = CH.hourOptions(18, 0, 23);
    document.getElementById("endHourSelect").innerHTML = CH.hourOptions(23, 1, 24);
  }

  function renderPresets() {
    const target = document.getElementById("customPresets");
    if (!target) return;
    target.innerHTML = CH.state.presets.map((preset) => `<button class="btn compact-preset" data-preset="${preset.id}" title="${CH.escape(preset.name)}">${CH.escape(preset.name)}</button>`).join("") + `<button class="btn compact-preset add-preset" id="addPresetBtn">+ пресет</button>`;
    target.querySelectorAll("[data-preset]").forEach((button) => {
      button.onclick = () => {
        const preset = CH.state.presets.find((item) => item.id === button.dataset.preset);
        const day = Number(document.getElementById("daySelect").value);
        setToolCursor("fill");
        applyDayPreset(day, preset);
      };
    });
    document.getElementById("addPresetBtn").onclick = openPresetModal;
  }

  function renderPresetSelect() {
    const target = document.getElementById("presetSelect");
    if (!target) return;
    target.innerHTML = presetsForPerson().map((preset) => `<option value="${preset.id}">${CH.escape(preset.name)}</option>`).join("");
    syncPresetControls();
  }

  function presetsForPerson() {
    CH.state.memberPresets = CH.state.memberPresets || {};
    if (!CH.state.memberPresets[personId]) {
      CH.state.memberPresets[personId] = (CH.state.presets || []).map((preset) => ({ ...preset, id: CH.id() }));
    }
    return CH.state.memberPresets[personId];
  }

  function bindToolActions() {
    const dayFreeBtn = document.getElementById("dayFreeBtn");
    const dayClearBtn = document.getElementById("dayClearBtn");
    const eveningFreeBtn = document.getElementById("eveningFreeBtn");
    const workBusyBtn = document.getElementById("workBusyBtn");
    const applyRangeBtn = document.getElementById("applyRangeBtn");
    const fillStatusSelect = document.getElementById("fillStatusSelect");
    const presetSelect = document.getElementById("presetSelect");
    const applyPresetBtn = document.getElementById("applyPresetBtn");
    const addPresetBtn = document.getElementById("addPresetBtn");
    const deletePresetBtn = document.getElementById("deletePresetBtn");

    if (fillStatusSelect) fillStatusSelect.onchange = () => {
      selected = fillStatusSelect.value;
      setToolCursor("fill");
      renderPalette();
      syncFillStatus();
    };
    if (presetSelect) presetSelect.onchange = syncPresetControls;

    if (dayFreeBtn) dayFreeBtn.onclick = () => markDay("free");
    if (dayClearBtn) dayClearBtn.onclick = () => markDay("unknown");
    if (eveningFreeBtn) eveningFreeBtn.onclick = () => {
      const day = Number(document.getElementById("daySelect").value);
      setToolCursor("fill");
      applyDayPreset(day, { start: 18, end: 24, status: "free" });
    };
    if (workBusyBtn) workBusyBtn.onclick = () => {
      const day = Number(document.getElementById("daySelect").value);
      setToolCursor("fill");
      applyDayPreset(day, { start: 9, end: 18, status: "busy" });
    };
    if (applyRangeBtn) applyRangeBtn.onclick = () => {
      const day = Number(document.getElementById("daySelect").value);
      const start = Number(document.getElementById("startHourSelect").value);
      const end = Number(document.getElementById("endHourSelect").value);
      if (end <= start) {
        alert("Конец диапазона должен быть позже начала.");
        return;
      }
      setToolCursor("fill");
      const status = document.getElementById("fillStatusSelect")?.value || selected;
      selected = status;
      if (end <= start) {
        alert("Конец диапазона должен быть позже начала.");
        return;
      }
      fillRange(day, start, end, status);
    };
    if (applyPresetBtn) applyPresetBtn.onclick = () => {
      const preset = presetsForPerson().find((item) => item.id === presetSelect?.value);
      const day = Number(document.getElementById("daySelect").value);
      setToolCursor("fill");
      if (preset) {
        syncPresetControls();
        fillRange(day, preset.start, preset.end, preset.status);
      }
    };
    if (addPresetBtn) addPresetBtn.onclick = openPresetModal;
    if (deletePresetBtn) deletePresetBtn.onclick = () => {
      const presets = presetsForPerson();
      const id = presetSelect?.value;
      const preset = presets.find((item) => item.id === id);
      if (!preset || !confirm(`Удалить пресет "${preset.name}"?`)) return;
      CH.state.memberPresets[personId] = presets.filter((item) => item.id !== id);
      CH.save();
      renderPresetSelect();
    };
  }

  function syncPresetControls() {
    const preset = presetsForPerson().find((item) => item.id === document.getElementById("presetSelect")?.value);
    if (!preset) return;
    const status = document.getElementById("fillStatusSelect");
    const start = document.getElementById("startHourSelect");
    const end = document.getElementById("endHourSelect");
    if (status) status.value = preset.status;
    if (start) start.value = String(preset.start);
    if (end) end.value = String(preset.end);
  }

  function renderGrid() {
    const now = CH.nowCell();
    grid.innerHTML = `<div class="cell head corner"></div>${CH.days.map((day, index) => `<button class="cell head day-head" data-day="${index}" title="Выбрать ${day}">${CH.formatDate(CH.addDays(weekStart, index))}</button>`).join("")}`;
    grid.querySelectorAll(".day-head").forEach((button) => {
      button.onclick = () => {
        document.getElementById("daySelect").value = button.dataset.day;
      };
    });
    for (let hour = 0; hour < 24; hour++) {
      grid.insertAdjacentHTML("beforeend", `<div class="cell time">${CH.hourLabel(hour)}</div>`);
      for (let day = 0; day < 7; day++) {
        const dateKey = CH.toDateKey(CH.addDays(weekStart, day));
        const status = CH.getStatus(personId, dateKey, hour);
        const comment = CH.getComment(personId, dateKey, hour);
        const cell = document.createElement("button");
        cell.className = `cell slot ${status}`;
        if (dateKey === CH.toDateKey(CH.today()) && hour === now.hour) cell.classList.add("now");
        cell.title = `${CH.formatDate(CH.fromDateKey(dateKey))} ${CH.hourLabel(hour)}\n${CH.statuses[status].label}${comment ? "\n" + comment : ""}`;
        if (comment) cell.classList.add("has-comment");
        if (showEvents) eventLines(dateKey, hour).forEach((line) => cell.insertAdjacentHTML("beforeend", line));
        if (comment) cell.insertAdjacentHTML("beforeend", `<span class="cell-comment">${CH.escape(comment)}</span>`);
        cell.onpointerdown = (event) => {
          if (!CH.canEditParticipant(personId)) return;
          event.preventDefault();
          painting = true;
          dragPainted = false;
          paintAnchor = { dateKey, hour, cell };
        };
        cell.onpointerenter = () => {
          if (!painting) return;
          if (!CH.canEditParticipant(personId)) return;
          if (!dragPainted && paintAnchor) paint(paintAnchor.dateKey, paintAnchor.hour, paintAnchor.cell);
          dragPainted = true;
          paint(dateKey, hour, cell);
        };
        cell.oncontextmenu = (event) => {
          event.preventDefault();
          if (CH.canEditParticipant(personId)) openCommentModal(dateKey, hour);
        };
        cell.onclick = () => {
          if (!dragPainted) openCellPanel(dateKey, hour);
        };
        grid.append(cell);
      }
    }
    CH.renderScaleSwitches();
    CH.applyTableSize();
    grid.classList.toggle("cursor-fill", toolCursor === "fill");
    grid.classList.toggle("cursor-brush", toolCursor !== "fill");
  }

  function setToolCursor(mode) {
    toolCursor = mode;
    grid.classList.toggle("cursor-fill", mode === "fill");
    grid.classList.toggle("cursor-brush", mode !== "fill");
  }

  function eventLines(dateKey, hour) {
    return CH.eventsAt(dateKey, hour).slice(0, 3).map((event, index) => {
      const start = Number(event.start);
      const end = Number(event.end);
      const edge = `${hour === start ? " event-start" : ""}${hour === end - 1 ? " event-end" : ""}`;
      return `<span class="event-line lane-${index}${edge}" title="${CH.escape(CH.hourLabel(start))} ${CH.escape(event.title)}"></span>`;
    });
  }

  function paint(dateKey, hour, cell) {
    CH.setStatus(personId, dateKey, hour, selected);
    Object.keys(CH.statuses).forEach((key) => cell.classList.remove(key));
    cell.classList.add(selected);
    cell.title = `${CH.formatDate(CH.fromDateKey(dateKey))} ${CH.hourLabel(hour)}\n${CH.statuses[selected].label}`;
    const comment = CH.getComment(personId, dateKey, hour);
    if (comment && !cell.querySelector(".cell-comment")) {
      cell.insertAdjacentHTML("beforeend", `<span class="cell-comment">${CH.escape(comment)}</span>`);
    }
  }

  function fillRange(day, start, end, status) {
    if (!CH.canEditParticipant(personId)) return;
    const dateKey = CH.toDateKey(CH.addDays(weekStart, day));
    for (let hour = start; hour < end; hour++) {
      CH.setStatus(personId, dateKey, hour, status);
    }
    CH.save();
    renderGrid();
  }

  function applyDayPreset(day, preset) {
    if (!preset || !CH.canEditParticipant(personId)) return;
    const dateKey = CH.toDateKey(CH.addDays(weekStart, day));
    for (let hour = 0; hour < 24; hour++) CH.setStatus(personId, dateKey, hour, "unknown");
    for (let hour = Number(preset.start); hour < Number(preset.end); hour++) {
      CH.setStatus(personId, dateKey, hour, preset.status);
    }
    CH.save();
    renderGrid();
  }

  function openCommentModal(dateKey, hour) {
    CH.modal("Комментарий к ячейке", `
      <form class="form-grid" id="commentForm">
        <div class="form-row">
          <label>${CH.formatDate(CH.fromDateKey(dateKey))} · ${CH.hourLabel(hour)}</label>
          <textarea name="comment">${CH.escape(CH.getComment(personId, dateKey, hour))}</textarea>
        </div>
        <button class="btn primary" type="submit">Сохранить</button>
      </form>`);
    document.getElementById("commentForm").onsubmit = (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      CH.setComment(personId, dateKey, hour, String(form.get("comment")));
      CH.save();
      CH.closeModal();
      renderGrid();
    };
  }

  function openCellPanel(dateKey, hour) {
    const status = CH.getStatus(personId, dateKey, hour);
    const comment = CH.getComment(personId, dateKey, hour);
    const events = CH.eventsAt(dateKey, hour);
    document.getElementById("detailTitle").textContent = `${CH.formatDate(CH.fromDateKey(dateKey))} · ${CH.hourLabel(hour)}`;
    document.getElementById("detailBody").innerHTML = `
      <div class="detail-block">
        <strong>Статус</strong>
        <div class="pill-row"><span class="pill">${CH.statuses[status].label}</span></div>
      </div>
      ${CH.canEditParticipant(personId) ? `<form class="form-grid" id="sideStatusForm">
        <div class="form-row">
          <label>Изменить статус ячейки</label>
          <select name="status">${Object.entries(CH.statuses).map(([key, item]) => `<option value="${key}" ${status === key ? "selected" : ""}>${item.label}</option>`).join("")}</select>
        </div>
        <button class="btn" type="submit">Применить статус</button>
      </form>` : ""}
      ${CH.canEditParticipant(personId) ? `<form class="form-grid" id="sideCellForm">
        <div class="form-row">
          <label>Комментарий</label>
          <textarea name="comment" placeholder="Коротко: что важно знать в это время">${CH.escape(comment)}</textarea>
        </div>
        <div class="form-actions">
          <button class="btn primary" type="submit">Сохранить комментарий</button>
          <button class="btn" type="button" id="clearCommentBtn">Очистить</button>
        </div>
      </form>` : `<div class="detail-block"><strong>Комментарий</strong><p>${comment ? CH.escape(comment) : "нет комментария"}</p></div>`}
      <div class="detail-block">
        <strong>Ивенты</strong>
        <div class="pill-row">${events.length ? events.map((event) => `<span class="pill">◆ ${CH.escape(event.title)}</span>`).join("") : "<small>нет ивентов</small>"}</div>
      </div>`;
    const statusForm = document.getElementById("sideStatusForm");
    if (statusForm) statusForm.onsubmit = (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      CH.setStatus(personId, dateKey, hour, String(form.get("status")));
      CH.save();
      renderGrid();
      openCellPanel(dateKey, hour);
    };
    const cellForm = document.getElementById("sideCellForm");
    if (cellForm) cellForm.onsubmit = (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      CH.setComment(personId, dateKey, hour, String(form.get("comment")));
      CH.save();
      renderGrid();
      openCellPanel(dateKey, hour);
    };
    const clearBtn = document.getElementById("clearCommentBtn");
    if (clearBtn) clearBtn.onclick = () => {
      CH.setComment(personId, dateKey, hour, "");
      CH.save();
      renderGrid();
      openCellPanel(dateKey, hour);
    };
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
  }

  function openPresetModal() {
    if (!CH.canEditParticipant(personId)) return;
    CH.modal("Новый пресет", `
      <form class="form-grid" id="presetForm">
        <div class="form-row"><label>Название</label><input name="name" required></div>
        <div class="three">
          <div class="form-row"><label>Начало</label><select name="start">${CH.hourOptions(18, 0, 23)}</select></div>
          <div class="form-row"><label>Конец</label><select name="end">${CH.hourOptions(23, 1, 24)}</select></div>
          <div class="form-row"><label>Статус</label><select name="status">${Object.entries(CH.statuses).map(([key, item]) => `<option value="${key}">${item.label}</option>`).join("")}</select></div>
        </div>
        <button class="btn primary" type="submit">Добавить</button>
      </form>`);
    document.getElementById("presetForm").onsubmit = (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const start = Number(form.get("start"));
      const end = Number(form.get("end"));
      if (end <= start) return alert("Конец должен быть позже начала.");
      presetsForPerson().push({ id: CH.id(), name: String(form.get("name")).trim(), start, end, status: String(form.get("status")) });
      CH.save();
      CH.closeModal();
      renderPresetSelect();
    };
  }

  function markDay(status) {
    const day = Number(document.getElementById("daySelect").value);
    setToolCursor("fill");
    fillRange(day, 0, 24, status);
  }

  document.addEventListener("pointerup", () => {
    if (painting && dragPainted) CH.save();
    painting = false;
    paintAnchor = null;
  });
  document.getElementById("closeDetailBtn").onclick = () => {
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
  };
  document.getElementById("toggleEventsBtn").onclick = () => {
    showEvents = !showEvents;
    document.getElementById("toggleEventsBtn").classList.toggle("is-off", !showEvents);
    renderGrid();
  };
  document.getElementById("prevWeekBtn").onclick = () => {
    weekStart = CH.addDays(weekStart, -7);
    CH.state.settings.activeDate = CH.toDateKey(weekStart);
    CH.save();
    renderGrid();
  };
  document.getElementById("nextWeekBtn").onclick = () => {
    weekStart = CH.addDays(weekStart, 7);
    CH.state.settings.activeDate = CH.toDateKey(weekStart);
    CH.save();
    renderGrid();
  };
  document.getElementById("todayWeekBtn").onclick = () => {
    weekStart = CH.startOfWeek(CH.today());
    CH.state.settings.activeDate = CH.toDateKey(CH.today());
    CH.save();
    renderGrid();
  };
  document.getElementById("dayFreeBtn").onclick = () => markDay("free");
  document.getElementById("dayClearBtn").onclick = () => markDay("unknown");
  document.getElementById("eveningFreeBtn").onclick = () => {
    const day = Number(document.getElementById("daySelect").value);
    setToolCursor("fill");
    applyDayPreset(day, { start: 18, end: 24, status: "free" });
  };
  document.getElementById("workBusyBtn").onclick = () => {
    const day = Number(document.getElementById("daySelect").value);
    setToolCursor("fill");
    applyDayPreset(day, { start: 9, end: 18, status: "busy" });
  };
  document.getElementById("applyRangeBtn").onclick = () => {
    const day = Number(document.getElementById("daySelect").value);
    if (end <= start) {
      alert("Конец диапазона должен быть позже начала.");
      return;
    }
    setToolCursor("fill");
    fillRange(day, 0, 24, selected);
  };
  document.getElementById("editPersonBtn").onclick = () => {
    if (!CH.canEditParticipant(personId)) return;
    CH.modal("Редактировать участника", CH.personForm(person));
    CH.bindPersonForm(render);
  };

  render();
})();
