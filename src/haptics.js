const PATTERNS = Object.freeze({
  point: 14,
  correction: 8,
  undo: 10,
  switch: [12, 34, 12],
  game: [18, 45, 24],
  match: [22, 45, 22, 70, 32],
});

export function haptic(kind = "point") {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
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
    await element.requestFullscreen({ navigationUI: "hide" });
    return true;
  } catch {
    return false;
  }
}
