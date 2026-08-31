const PATTERNS = Object.freeze({
  point: 34,
  correction: 18,
  undo: 22,
  switch: [24, 42, 24],
  game: [36, 50, 36, 70, 46],
});

export function supportsHaptics() {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function haptic(kind = "point") {
  if (!supportsHaptics()) {
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
