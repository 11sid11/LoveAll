import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

test("orientation is expressed as two complete screen layouts", () => {
  for (const id of ["orient-a-left", "orient-a-right", "orient-b-left", "orient-b-right"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  assert.doesNotMatch(html, /Who's on your left\?/i);
  assert.doesNotMatch(html, /Set on left/i);
  assert.match(html, /Make the screen look like the court\./i);
});

test("the UI no longer presents a best-of-three match", () => {
  assert.doesNotMatch(html, /Best of 3/i);
  assert.doesNotMatch(app, /Best of 3/i);
  assert.match(app, /Finish match/);
  assert.match(app, /Play another game/);
});

test("each scoring side keeps correction outside the primary point button", () => {
  for (const side of ["left", "right"]) {
    const addStart = html.indexOf(`id="${side}-add"`);
    const addEnd = html.indexOf("</button>", addStart);
    const minusStart = html.indexOf(`id="${side}-minus"`);

    assert.ok(addStart >= 0, `${side} add button is present`);
    assert.ok(addEnd > addStart, `${side} add button closes`);
    assert.ok(minusStart > addEnd, `${side} correction control is separate from point target`);
  }
});

test("the app exposes PWA installation from the top navigation", () => {
  assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html, /id="install-app"/);
  assert.match(app, /setupInstallExperience/);
});

test("point logging includes energetic feedback hooks", () => {
  assert.match(app, /celebratePoint/);
  assert.match(app, /celebrateGame/);
  assert.match(app, /haptic\(gameEnded \? "game" : "point"\)/);
});

test("score footer keeps manual match controls together", () => {
  assert.match(html, /class="score-footer-actions"/);
  assert.match(html, /id="undo-button"/);
  assert.match(html, /id="switch-sides"/);
  assert.match(html, /LoveAll never flips them automatically/);
});
