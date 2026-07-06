(function () {
  const CH = window.CH;

  document.getElementById("exportBtn").onclick = () => {
    const blob = new Blob([JSON.stringify(CH.state, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "collabhub-data.json";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  document.getElementById("importBtn").onclick = () => {
    if (!CH.isMaster()) return alert("Импорт доступен только мастер-аккаунту.");
    document.getElementById("importInput").click();
  };
  document.getElementById("importInput").onchange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.participants || !parsed.schedules || !parsed.events) throw new Error("bad shape");
        CH.state = parsed;
        CH.normalize();
        CH.save();
        CH.toast("Импортировано");
      } catch (error) {
        alert("Не удалось импортировать JSON.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  document.getElementById("resetBtn").onclick = () => {
    if (!CH.isMaster()) return alert("Сброс доступен только мастер-аккаунту.");
    if (!confirm("Сбросить данные к демо?")) return;
    CH.state = CH.demo();
    CH.save();
  };
  const syncTokenInput = document.getElementById("syncTokenInput");
  if (syncTokenInput) syncTokenInput.value = CH.githubToken();

  document.getElementById("saveSyncTokenBtn").onclick = () => {
    CH.setGithubToken(syncTokenInput.value);
    CH.toast(CH.githubToken() ? "Sync token saved" : "Sync token removed");
  };

  document.getElementById("pullSharedBtn").onclick = async () => {
    try {
      const remote = await CH.fetchSharedState();
      CH.state = CH.mergeState(remote, CH.state, "startup");
      CH.normalize();
      CH.persistLocal();
      CH.toast("Shared data loaded");
      setTimeout(() => location.reload(), 400);
    } catch (error) {
      alert("Не удалось загрузить общие данные.");
    }
  };

  document.getElementById("pushSharedBtn").onclick = async () => {
    try {
      await CH.pushSharedState();
      CH.toast("Shared data saved");
    } catch (error) {
      alert("Не удалось сохранить общие данные. Проверьте GitHub token.");
    }
  };
})();
