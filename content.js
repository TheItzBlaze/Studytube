const SHORTS_LINK_SELECTORS = [
  'a[href^="/shorts/"]',
  'a[href*="youtube.com/shorts/"]',
  'ytd-reel-shelf-renderer',
  'ytm-reel-shelf-renderer',
  'ytd-rich-shelf-renderer[is-shorts]',
  'ytd-rich-section-renderer',
  'ytd-guide-entry-renderer a[title="Shorts"]',
  'tp-yt-paper-item a[title="Shorts"]',
  'ytd-mini-guide-entry-renderer a[title="Shorts"]'
];

function hideElement(el) {
  if (!el) return;
  const block = el.closest(
    [
      'ytd-rich-item-renderer',
      'ytd-reel-shelf-renderer',
      'ytm-reel-shelf-renderer',
      'ytd-rich-shelf-renderer',
      'ytd-guide-entry-renderer',
      'ytd-mini-guide-entry-renderer',
      'ytd-video-renderer',
      'ytd-grid-video-renderer',
      'ytd-compact-video-renderer',
      'ytm-item-section-renderer'
    ].join(',')
  ) || el;

  block.style.setProperty('display', 'none', 'important');
  block.style.setProperty('visibility', 'hidden', 'important');
  block.setAttribute('data-shorts-blocked', 'true');
}

function removeShorts() {
  document.querySelectorAll(SHORTS_LINK_SELECTORS.join(',')).forEach(hideElement);

  // Also remove shelves/cards with “Shorts” label.
  const allNodes = document.querySelectorAll('span, yt-formatted-string, h2, h3');
  allNodes.forEach(node => {
    const text = (node.textContent || '').trim().toLowerCase();
    if (text === 'shorts') {
      hideElement(node);
    }
  });
}

async function checkAndOverlayIfLocked() {
  const response = await chrome.runtime.sendMessage({ type: "GET_LOCK_STATE" });
  if (response?.locked) {
    showLockOverlay(response.remaining);
  } else {
    removeOverlay();
  }
}

function formatTime(ms) {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

let overlayInterval = null;

function showLockOverlay(initialRemaining) {
  let overlay = document.getElementById('yt-shorts-lock-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'yt-shorts-lock-overlay';
    overlay.innerHTML = `
      <img class="yt-shorts-lock-bg-gif" src="${chrome.runtime.getURL('assets/media/bg.gif')}" alt="" />
      <div class="yt-shorts-lock-box">
        <h1>Stop. Back to work.</h1>
        <p>You opened a short-form video.</p>
        <p>YouTube is locked temporarily.</p>
        <div id="yt-shorts-lock-timer">2:00</div>
        <div class="yt-shorts-lock-brand">Made by ItzBlaze</div>
        <div class="yt-shorts-lock-accent"></div>
      </div>
    `;
    document.documentElement.appendChild(overlay);
  }

  const timerEl = document.getElementById('yt-shorts-lock-timer');
  const lockUntil = Date.now() + initialRemaining;

  if (overlayInterval) clearInterval(overlayInterval);

  const tick = async () => {
    const remaining = lockUntil - Date.now();
    if (remaining <= 0) {
      removeOverlay();
      await chrome.runtime.sendMessage({ type: "CLEAR_IF_EXPIRED" });
      return;
    }
    if (timerEl) timerEl.textContent = formatTime(remaining);
  };

  tick();
  overlayInterval = setInterval(tick, 1000);

}

function removeOverlay() {
  const overlay = document.getElementById('yt-shorts-lock-overlay');
  if (overlay) overlay.remove();
  if (overlayInterval) {
    clearInterval(overlayInterval);
    overlayInterval = null;
  }
}

function isShortsPath() {
  return location.pathname.startsWith('/shorts/');
}

async function reactToShortsPage() {
  if (isShortsPath()) {
    await chrome.runtime.sendMessage({ type: "TRIGGER_LOCK" });
    location.href = "https://www.youtube.com/";
  }
}

const observer = new MutationObserver(() => {
  removeShorts();
});

function init() {
  removeShorts();
  checkAndOverlayIfLocked();
  reactToShortsPage();

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      removeShorts();
      checkAndOverlayIfLocked();
      reactToShortsPage();
    }
  }, 800);
}

init();