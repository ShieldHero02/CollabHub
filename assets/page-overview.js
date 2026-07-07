(function () {
  const CH = window.CH;
  let showEvents = true;
  let mode = "week";
  let urlDateSynced = false;
  let monthCursor = CH.fromDateKey(CH.state.settings.activeDate);
  monthCursor.setDate(1);

  const weekGrid = document.getElementById("overviewGrid");
  const monthGrid = document.getElementById("inlineMonthGrid");
  const stage = document.getElementById("calendarStage");
  const panel = document.getElementById("detailPanel");

  function render() {
    syncDateFromUrl();
    renderAnswers();
    renderModeSwitch();
    renderWeekGrid();
    renderMonthGrid();
    applyMode();
    CH.renderScaleSwitches();
    CH.applyTableSize();
  }

  function syncDateFromUrl() {
    if (urlDateSynced) return;
    urlDateSynced = true;
    const params = new URLSearchParams(location.search);
    const date = params.get("date");
    if (date) {
      CH.state.settings.activeDate = date;
      monthCursor = CH.fromDateKey(date);
      monthCursor.setDate(1);
      CH.persist();
    }
  }

  function setActiveDate(date) {
    CH.state.settings.activeDate = CH.toDateKey(date);
    monthCursor = new Date(date);
    monthCursor.setDate(1);
    CH.persist();
  }

  function renderModeSwitch() {
    document.getElementById("calendarModeSwitch").innerHTML = `
      <button class="scale-btn ${mode === "month" ? "active" : ""}" data-mode="month">месяц</button>
      <button class="scale-btn ${mode === "week" ? "active" : ""}" data-mode="week">неделя</button>`;
    document.querySelectorAll("#calendarModeSwitch button").forEach((button) => {
      button.onclick = () => {
        mode = button.dataset.mode;
        applyMode();
        renderModeSwitch();
      };
    });
  }

  function applyMode() {
    stage.classList.toggle("show-month", mode === "month");
    weekGrid.classList.toggle("is-active", mode === "week");
    monthGrid.classList.toggle("is-active", mode === "month");
    document.getElementById("scaleSwitch").classList.toggle("hidden", mode === "month");
    document.getElementById("calendarYearSelect").classList.toggle("hidden", mode !== "month");
    updateModeCopy();
  }

  function updateModeCopy() {
    if (mode === "month") {
      document.getElementById("weekTitle").textContent = monthCursor.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
      document.getElementById("weekSubtitle").textContent = "Календарь выбирает день, стрелки листают месяцы, неделя открывает подробное расписание.";
      document.getElementById("calendarModeHint").textContent = "Клик по дню выбирает дату и открывает расписание этой недели. Число в углу = вечерний шанс собрать людей.";
    } else {
      const weekStart = CH.startOfWeek(CH.fromDateKey(CH.state.settings.activeDate));
      const weekEnd = CH.addDays(weekStart, 6);
      document.getElementById("weekTitle").textContent = `Карта недели ${CH.formatDate(weekStart)} — ${CH.formatDate(weekEnd)}`;
      document.getElementById("weekSubtitle").textContent = "Один календарный блок: месяц выбирает дату, неделя показывает подробное расписание.";
      document.getElementById("calendarModeHint").textContent = "Цвет = сколько людей доступно. Фиолетовая линия = ивент поверх.";
    }
  }

  function renderAnswers() {
    const { hour } = CH.nowCell();
    const todayKey = CH.toDateKey(CH.today());
    const now = CH.aggregate(todayKey, hour);
    const eveningIds = new Set();
    [18, 19, 20, 21, 22, 23].forEach((h) => {
      const groups = CH.aggregate(todayKey, h);
      [...groups.free, ...groups.stream, ...groups.maybe].forEach((person) => eveningIds.add(person.id));
    });
    const todayEvents = CH.state.events.filter((event) => event.date === todayKey);
    document.getElementById("answerGrid").innerHTML = [
      card("Сейчас свободны", now.free.length + now.stream.length, [...now.free, ...now.stream]),
      card("Возможно сейчас", now.maybe.length, now.maybe),
      card("Свободны вечером", eveningIds.size, [...eveningIds].map(CH.person).filter(Boolean)),
      card("Ивенты сегодня", todayEvents.length, todayEvents.map((event) => ({ name: event.title, color: "#9b6cff" })))
    ].join("");
  }

  function card(label, value, dots) {
    return `<article class="answer-card">
      <small>${CH.escape(label)}</small>
      <strong>${value}</strong>
      <div class="dot-row">${dots.slice(0, 12).map((item) => `<span class="dot" title="${CH.escape(item.name)}" style="background:${CH.escape(item.color)}"></span>`).join("")}</div>
    </article>`;
  }

  function renderWeekGrid() {
    const now = CH.nowCell();
    const weekStart = CH.startOfWeek(CH.fromDateKey(CH.state.settings.activeDate));
    const weekEnd = CH.addDays(weekStart, 6);
    document.getElementById("weekTitle").textContent = `Карта недели ${CH.formatDate(weekStart)} — ${CH.formatDate(weekEnd)}`;
    document.getElementById("weekSubtitle").textContent = `Один календарный блок: месяц выбирает дату, неделя показывает подробное расписание.`;
    document.getElementById("calendarModeHint").textContent = "Цвет = сколько людей доступно. Фиолетовая линия = ивент поверх.";
    weekGrid.innerHTML = `<div class="cell head corner"></div>${CH.days.map((day, index) => `<div class="cell head">${CH.formatDate(CH.addDays(weekStart, index))}</div>`).join("")}`;
    for (let hour = 0; hour < 24; hour++) {
      weekGrid.insertAdjacentHTML("beforeend", `<div class="cell time">${CH.hourLabel(hour)}</div>`);
      for (let day = 0; day < 7; day++) {
        const dateKey = CH.toDateKey(CH.addDays(weekStart, day));
        const groups = CH.aggregate(dateKey, hour);
        const comments = commentsAt(dateKey, hour);
        const cell = document.createElement("button");
        cell.className = `cell slot ${CH.availabilityClass(groups)}`;
        if (dateKey === CH.toDateKey(CH.today()) && hour === now.hour) cell.classList.add("now");
        if (comments.length) cell.classList.add("has-comment");
        cell.title = `${CH.formatDate(CH.fromDateKey(dateKey))} ${CH.hourLabel(hour)}\nСвободны: ${groups.free.length + groups.stream.length}\nВозможно: ${groups.maybe.length}${comments.length ? "\n" + comments[0].text : ""}`;
        if (showEvents) eventLines(dateKey, hour).forEach((line) => cell.insertAdjacentHTML("beforeend", line));
        if (comments.length) cell.insertAdjacentHTML("beforeend", `<span class="cell-comment">${CH.escape(comments[0].text)}</span>`);
        cell.onclick = () => openDetails(dateKey, hour);
        weekGrid.append(cell);
      }
    }
  }

  function eveningScore(dateKey) {
    let score = 0;
    for (let hour = 18; hour < 24; hour++) {
      const groups = CH.aggregate(dateKey, hour);
      score += groups.free.length + groups.stream.length + groups.maybe.length * .5;
    }
    return score;
  }

  function eventLines(dateKey, hour) {
    return CH.eventsAt(dateKey, hour).slice(0, 3).map((event, index) => {
      const start = Number(event.start);
      const end = Number(event.end);
      const edge = `${hour === start ? " event-start" : ""}${hour === end - 1 ? " event-end" : ""}`;
      return `<span class="event-line lane-${index}${edge}" title="${CH.escape(CH.hourLabel(start))} ${CH.escape(event.title)}"></span>`;
    });
  }

  function monthEventHtml(dateKey) {
    const events = CH.state.events
      .filter((event) => event.date === dateKey)
      .sort((a, b) => Number(a.start) - Number(b.start))
      .slice(0, 3);
    const extra = CH.state.events.filter((event) => event.date === dateKey).length - events.length;
    if (!events.length) return "";
    return `<div class="month-events">${events.map((event) => `<span class="month-event"><b>${CH.hourLabel(Number(event.start))}</b> ${CH.escape(event.title)}</span>`).join("")}${extra > 0 ? `<span class="month-event more">+${extra}</span>` : ""}</div>`;
  }

  function renderMonthGrid() {
    const yearSelect = document.getElementById("calendarYearSelect");
    yearSelect.value = String(monthCursor.getFullYear());
    const start = new Date(monthCursor);
    const offset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - offset);
    const todayKey = CH.toDateKey(CH.today());
    const activeKey = CH.state.settings.activeDate;
    let html = CH.days.map((day) => `<div class="month-head">${day}</div>`).join("");
    for (let i = 0; i < 42; i++) {
      const date = CH.addDays(start, i);
      const key = CH.toDateKey(date);
      const score = eveningScore(key);
      const level = score > 16 ? "high" : score > 8 ? "mid" : score > 0 ? "low" : "none";
      html += `<button class="month-day ${level} ${date.getMonth() !== monthCursor.getMonth() ? "muted-day" : ""} ${key === todayKey ? "today" : ""} ${key === activeKey ? "active" : ""}" data-date="${key}">
        <span>${date.getDate()}</span>
        <small>${Math.round(score)}</small>
        ${showEvents ? monthEventHtml(key) : ""}
      </button>`;
    }
    monthGrid.innerHTML = html;
    monthGrid.querySelectorAll(".month-day").forEach((button) => {
      button.onclick = () => {
        CH.state.settings.activeDate = button.dataset.date;
        monthCursor = CH.fromDateKey(button.dataset.date);
        monthCursor.setDate(1);
        CH.persist();
        renderWeekGrid();
        renderMonthGrid();
        mode = "week";
        renderModeSwitch();
        applyMode();
      };
    });
  }

  function groupBlock(label, people) {
    return `<div class="detail-block">
      <strong>${label}</strong>
      <div class="pill-row">${people.length ? people.map((person) => `<span class="pill"><span class="dot" style="background:${CH.escape(person.color)}"></span>${CH.escape(person.name)}</span>`).join("") : `<small>никого</small>`}</div>
    </div>`;
  }

  function commentsAt(dateKey, hour) {
    return CH.state.participants.map((person) => ({
      person,
      text: CH.getComment(person.id, dateKey, hour)
    })).filter((item) => item.text);
  }

  function openDetails(dateKey, hour) {
    const groups = CH.aggregate(dateKey, hour);
    const events = CH.eventsAt(dateKey, hour);
    const comments = commentsAt(dateKey, hour);
    document.getElementById("detailTitle").textContent = `${CH.formatDate(CH.fromDateKey(dateKey))} ${CH.hourLabel(hour)}`;
    document.getElementById("detailBody").innerHTML = `
      ${groupBlock("Свободны", [...groups.free, ...groups.stream])}
      ${groupBlock("Возможно", groups.maybe)}
      ${groupBlock("Заняты", [...groups.busy, ...groups.work, ...groups.study])}
      ${groupBlock("Нет данных", groups.unknown)}
      <div class="detail-block">
        <strong>Ивенты</strong>
        <div class="pill-row">${events.length ? events.map((event) => `<a class="pill" href="events.html#${event.id}">◆ ${CH.escape(event.title)}</a>`).join("") : `<small>нет ивентов</small>`}</div>
      </div>
      <div class="detail-block">
        <strong>Комментарии</strong>
        <div class="pill-row">${comments.length ? comments.map((item) => `<span class="pill"><span class="dot" style="background:${CH.escape(item.person.color)}"></span>${CH.escape(item.person.name)}: ${CH.escape(item.text)}</span>`).join("") : `<small>нет комментариев</small>`}</div>
      </div>`;
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
  }

  document.getElementById("closeDetailBtn").onclick = () => {
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
  };
  document.getElementById("toggleEventsBtn").onclick = () => {
    showEvents = !showEvents;
    document.getElementById("toggleEventsBtn").classList.toggle("is-off", !showEvents);
    renderWeekGrid();
    renderMonthGrid();
  };
  document.getElementById("prevWeekBtn").onclick = () => {
    if (mode === "month") {
      const next = new Date(monthCursor);
      next.setMonth(next.getMonth() - 1);
      setActiveDate(next);
    } else {
      setActiveDate(CH.addDays(CH.fromDateKey(CH.state.settings.activeDate), -7));
    }
    render();
  };
  document.getElementById("nextWeekBtn").onclick = () => {
    if (mode === "month") {
      const next = new Date(monthCursor);
      next.setMonth(next.getMonth() + 1);
      setActiveDate(next);
    } else {
      setActiveDate(CH.addDays(CH.fromDateKey(CH.state.settings.activeDate), 7));
    }
    render();
  };
  document.getElementById("todayWeekBtn").onclick = () => {
    setActiveDate(CH.today());
    render();
  };
  document.getElementById("calendarYearSelect").onchange = (event) => {
    const year = Math.max(1, Math.min(9999, Number(event.currentTarget.value) || new Date().getFullYear()));
    monthCursor.setFullYear(year);
    setActiveDate(monthCursor);
    mode = "month";
    render();
  };
  document.getElementById("createEventBtn").onclick = () => {
    CH.modal("Создать ивент", CH.eventForm());
    CH.bindEventForm(render);
  };

  render();
})();
