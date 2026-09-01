const PATTERNS = Object.freeze({
  point: 42,
  correction: 18,
  undo: 22,
  switch: [24, 42, 24],
  game: [36, 50, 36, 70, 46],
});

function canVibrate() {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function haptic(kind = "point") {
  if (!canVibrate()) {
    return false;
  }

  const pattern = PATTERNS[kind] ?? PATTERNS.point;

  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

export async function tryEnterFullscreen(element = document.documentElement) {
  if (document.fullscreenElement || typeof element?.requestFullscreen !== "function") {
    return false;
  }

  try {
    await element.requestFullscreen();
    return true;
  } catch {
    return false;
  }
}

export async function tryLockLandscape() {
  const orientation = globalThis.screen?.orientation;
  if (typeof orientation?.lock !== "function") {
    return false;
  }

  try {
    await orientation.lock("landscape");
    return true;
  } catch {
    return false;
  }
}

export function tryUnlockOrientation() {
  const orientation = globalThis.screen?.orientation;
  if (typeof orientation?.unlock !== "function") {
    return false;
  }

  try {
    orientation.unlock();
    return true;
  } catch {
    return false;
  }
}
