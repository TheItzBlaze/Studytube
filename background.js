const LOCK_KEY = "yt_lock_until";
const LOCK_DURATION_MS = 2 * 60 * 1000;

async function getLockUntil() {
  const data = await chrome.storage.local.get([LOCK_KEY]);
  return data[LOCK_KEY] || 0;
}

async function setLockUntil(timestamp) {
  await chrome.storage.local.set({ [LOCK_KEY]: timestamp });
}

async function clearExpiredLock() {
  const lockUntil = await getLockUntil();
  if (lockUntil && Date.now() >= lockUntil) {
    await chrome.storage.local.remove([LOCK_KEY]);
  }
}

function isYouTubeUrl(url) {
  return /^https:\/\/(www|m)\.youtube\.com\//.test(url || "");
}

function isShortsUrl(url) {
  return /^https:\/\/(www|m)\.youtube\.com\/shorts\/[^/?#]+/.test(url || "");
}

async function activateLock() {
  const until = Date.now() + LOCK_DURATION_MS;
  await setLockUntil(until);
  chrome.alarms.create("yt_unlock_alarm", { when: until });
  return until;
}

async function redirectTabToBlocker(tabId, remainingMs) {
  const blockerUrl = chrome.runtime.getURL("blocker.html") + `?remaining=${remainingMs}`;
  try {
    await chrome.tabs.update(tabId, { url: blockerUrl });
  } catch (e) {
    console.error("Failed to redirect tab to blocker:", e);
  }
}

async function handleTab(tabId, url) {
  await clearExpiredLock();

  const lockUntil = await getLockUntil();
  const now = Date.now();

  if (isShortsUrl(url)) {
    const until = await activateLock();
    const remaining = until - now;
    await redirectTabToBlocker(tabId, remaining);
    return;
  }

  if (isYouTubeUrl(url) && lockUntil && now < lockUntil) {
    await redirectTabToBlocker(tabId, lockUntil - now);
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    const url = changeInfo.url || tab.url;
    if (url) {
      await handleTab(tabId, url);
    }
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab?.url) {
      await handleTab(tab.id, tab.url);
    }
  } catch (e) {
    console.error(e);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "GET_LOCK_STATE") {
      await clearExpiredLock();
      const lockUntil = await getLockUntil();
      const remaining = Math.max(0, lockUntil - Date.now());
      sendResponse({ locked: remaining > 0, remaining });
      return;
    }

    if (message?.type === "TRIGGER_LOCK") {
      const until = await activateLock();
      sendResponse({ locked: true, remaining: until - Date.now() });
      return;
    }

    if (message?.type === "CLEAR_IF_EXPIRED") {
      await clearExpiredLock();
      const lockUntil = await getLockUntil();
      sendResponse({ remaining: Math.max(0, lockUntil - Date.now()) });
      return;
    }
  })();

  return true;
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "yt_unlock_alarm") {
    await clearExpiredLock();
  }
});