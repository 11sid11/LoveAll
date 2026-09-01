import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

function functionBlock(name, nextName) {
  const start = app.indexOf(`function ${name}`);
  const end = nextName ? app.indexOf(`function ${nextName}`, start) : app.length;
  assert.ok(start >= 0, `${name} exists`);
  assert.ok(end > start, `${name} block is bounded`);
  return app.slice(start, end);
}

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

test("point logging starts haptic feedback on pointer contact", () => {
  const bindScoring = functionBlock("bindScoring", "bindReactiveButton");
  const reactiveButton = functionBlock("bindReactiveButton", "bindModal");

  assert.match(bindScoring, /bindReactiveButton\(elements\.leftAdd, \(\) => haptic\("point"\)\)/);
  assert.match(bindScoring, /bindReactiveButton\(elements\.rightAdd, \(\) => haptic\("point"\)\)/);
  assert.match(reactiveButton, /pointerdown/);
  assert.match(reactiveButton, /onPress\?\.\(\)/);
  assert.match(app, /celebratePoint/);
  assert.match(app, /celebrateGame/);
});

test("automatic fullscreen is removed while landscape locking remains best-effort", () => {
  const completeOrientation = functionBlock("completeOrientation", "handleAddPoint");
  const showView = functionBlock("showView", "showModal");

  assert.doesNotMatch(completeOrientation, /tryEnterFullscreen/);
  assert.match(showView, /tryLockLandscape\(\)/);
  assert.match(showView, /tryUnlockOrientation\(\)/);
  assert.match(app, /fullscreenButton\.addEventListener/);
  assert.match(app, /tryEnterFullscreen/);
});

test("side switching lives in the court divider instead of the bottom toolbar", () => {
  const dividerStart = html.indexOf('class="court-divider"');
  const switchStart = html.indexOf('id="switch-sides"');
  const footerStart = html.indexOf('class="score-footer"');

  assert.ok(dividerStart >= 0, "court divider exists");
  assert.ok(switchStart > dividerStart, "switch control is inside the central court region");
  assert.ok(switchStart < footerStart, "switch control appears before the footer");
  assert.match(html, /class="court-swap-button"/);
  assert.match(html, /LoveAll never flips them automatically/);
});
