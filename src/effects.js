const POINT_VECTORS = Object.freeze([
  [-44, -28],
  [-18, -48],
  [18, -46],
  [46, -24],
  [42, 20],
  [14, 44],
  [-24, 42],
  [-46, 16],
]);

export function celebratePoint(button, event) {
  if (!button) return;

  const side = button.closest(".score-side");
  side?.classList.remove("point-hit");
  void side?.offsetWidth;
  side?.classList.add("point-hit");

  window.setTimeout(() => side?.classList.remove("point-hit"), 320);

  if (prefersReducedMotion()) return;

  const rect = button.getBoundingClientRect();
  const originX = rect.width > 0 ? event.clientX - rect.left : rect.width / 2;
  const originY = rect.height > 0 ? event.clientY - rect.top : rect.height / 2;

  for (const [dx, dy] of POINT_VECTORS) {
    const spark = document.createElement("span");
    spark.className = "point-spark";
    spark.style.setProperty("--spark-x", `${originX}px`);
    spark.style.setProperty("--spark-y", `${originY}px`);
    spark.style.setProperty("--spark-dx", `${dx}px`);
    spark.style.setProperty("--spark-dy", `${dy}px`);
    button.append(spark);
    spark.addEventListener("animationend", () => spark.remove(), { once: true });
  }
}

export function celebrateGame(container, winningSide) {
  if (!container || prefersReducedMotion()) return;

  container.replaceChildren();
  container.dataset.side = winningSide;
  container.classList.add("is-active");

  for (let index = 0; index < 24; index += 1) {
    const particle = document.createElement("span");
    particle.className = "game-spark";

    const column = index % 8;
    const row = Math.floor(index / 8);
    const x = 8 + column * 12;
    const y = 18 + row * 24 + (column % 2) * 5;
    const travelX = (column - 3.5) * 18;
    const travelY = -44 - row * 16 - (column % 3) * 8;
    const delay = (index % 6) * 22;

    particle.style.setProperty("--game-x", `${x}%`);
    particle.style.setProperty("--game-y", `${y}%`);
    particle.style.setProperty("--game-dx", `${travelX}px`);
    particle.style.setProperty("--game-dy", `${travelY}px`);
    particle.style.setProperty("--game-delay", `${delay}ms`);
    container.append(particle);
  }

  window.setTimeout(() => {
    container.classList.remove("is-active");
    container.replaceChildren();
    delete container.dataset.side;
  }, 1100);
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}
