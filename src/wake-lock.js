let activeLock = null;
let requestGeneration = 0;

export async function requestScreenWakeLock() {
  if (activeLock) return true;
  if (typeof navigator === "undefined" || typeof navigator.wakeLock?.request !== "function") {
    return false;
  }
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    return false;
  }

  const generation = ++requestGeneration;

  try {
    const lock = await navigator.wakeLock.request("screen");

    if (generation !== requestGeneration) {
      await safeRelease(lock);
      return false;
    }

    activeLock = lock;
    lock.addEventListener?.("release", () => {
      if (activeLock === lock) activeLock = null;
    }, { once: true });
    return true;
  } catch {
    return false;
  }
}

export async function releaseScreenWakeLock() {
  requestGeneration += 1;
  const lock = activeLock;
  activeLock = null;

  if (!lock) return true;
  return safeRelease(lock);
}

async function safeRelease(lock) {
  try {
    await lock.release();
    return true;
  } catch {
    return false;
  }
}
