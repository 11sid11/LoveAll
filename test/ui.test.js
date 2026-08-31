import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("orientation choices do not both claim to be the left side", () => {
  const duplicateLeftLabels = html.match(/class="orientation-side">Left side/gi) ?? [];
  assert.equal(duplicateLeftLabels.length, 0);
});

test("orientation choices map named competitors to the scorer's left", () => {
  assert.match(html, /id="orient-a-name"/);
  assert.match(html, /id="orient-b-name"/);
  assert.equal((html.match(/Set on left/g) ?? []).length, 2);
});

test("each scoring side keeps correction outside the primary add-point button", () => {
  for (const side of ["left", "right"]) {
    const addStart = html.indexOf(`id="${side}-add"`);
    const addEnd = html.indexOf("</button>", addStart);
    const minusStart = html.indexOf(`id="${side}-minus"`);

    assert.ok(addStart >= 0, `${side} add button is present`);
    assert.ok(addEnd > addStart, `${side} add button closes`);
    assert.ok(minusStart > addEnd, `${side} correction control is separate from add-point target`);
  }
});

test("score footer groups match controls together", () => {
  assert.match(html, /class="score-footer-actions"/);
  assert.match(html, /id="undo-button"/);
  assert.match(html, /id="switch-sides"/);
});