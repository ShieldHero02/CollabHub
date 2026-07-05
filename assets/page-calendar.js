(function () {
  const CH = window.CH;
  let cursor = CH.fromDateKey(CH.state.settings.activeDate);
  cursor.setDate(1);

  function setCalendarMonth(date) {
    cursor = new Date(date);
    cursor.setDate(1);
    CH.state.settings.activeDate = CH.toDateKey(cursor);
    localStorage.setItem(CH.storageKey, JSON.stringify(CH.state));
  }

  function eveningScore(dateKey) {
    let score = 0;
    for (let hour = 18; hour < 24; hour++) {
      const groups = CH.aggregate(dateKey, hour);
      score += groups.free.length + groups.stream.length + groups.maybe.length * .5;
    }
    return score;
  }

  function monthEventHtml(dateKey) {
    const all = CH.state.events.filter((event) => event.date === dateKey);
    const events = all.sort((a, b) => Number(a.start) - Number(b.start)).slice(0, 3);
    const extra = all.length - events.length;
    if (!events.length) return "";
    return `<div class="month-events">${events.map((event) => `<span class="month-event"><b>${CH.hourLabel(Number(event.start))}</b> ${CH.escape(event.title)}</span>`).join("")}${extra > 0 ? `<span class="month-event more">+${extra}</span>` : ""}</div>`;
  }

  function render() {
    document.getElementById("openWeekBtn").href = `index.html?date=${CH.state.settings.activeDate}`;
    document.getElementById("monthTitle").textContent = cursor.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
    document.getElementById("yearSelect").value = String(cursor.getFullYear());
    const start = new Date(cursor);
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
      html += `<button class="month-day ${level} ${date.getMonth() !== cursor.getMonth() ? "muted-day" : ""} ${key === todayKey ? "today" : ""} ${key === activeKey ? "active" : ""}" data-date="${key}">
        <span>${date.getDate()}</span>
        <small>${Math.round(score)}</small>
        ${monthEventHtml(key)}
      </button>`;
    }
    document.getElementById("monthGrid").innerHTML = html;
    document.querySelectorAll(".month-day").forEach((button) => {
      button.onclick = () => {
        CH.state.settings.activeDate = button.dataset.date;
        CH.save();
        location.href = `index.html?date=${button.dataset.date}`;
      };
    });
  }

  document.getElementById("prevMonthBtn").onclick = () => {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() - 1);
    setCalendarMonth(next);
    render();
  };
  document.getElementById("nextMonthBtn").onclick = () => {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + 1);
    setCalendarMonth(next);
    render();
  };
  document.getElementById("todayBtn").onclick = () => {
    cursor = CH.today();
    cursor.setDate(1);
    CH.state.settings.activeDate = CH.toDateKey(CH.today());
    localStorage.setItem(CH.storageKey, JSON.stringify(CH.state));
    render();
  };
  document.getElementById("yearSelect").onchange = (event) => {
    const year = Math.max(1, Math.min(9999, Number(event.currentTarget.value) || new Date().getFullYear()));
    const next = new Date(cursor);
    next.setFullYear(year);
    setCalendarMonth(next);
    render();
  };
  render();
})();
