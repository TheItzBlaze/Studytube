function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function getRemaining() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_LOCK_STATE" }, (response) => {
      resolve(response?.remaining || 0);
    });
  });
}

async function init() {
  const timerEl = document.getElementById("timer");
  const resumeBtn = document.getElementById("resumeBtn");

  let remaining = await getRemaining();

  const tick = async () => {
    remaining = await getRemaining();

    if (remaining <= 0) {
      timerEl.textContent = "0:00";
      resumeBtn.style.display = "inline-block";
      clearInterval(interval);
      return;
    }

    timerEl.textContent = formatTime(remaining);
  };

  resumeBtn.addEventListener("click", () => {
    location.href = "https://www.youtube.com/";
  });

  await tick();
  const interval = setInterval(tick, 1000);
}

init();