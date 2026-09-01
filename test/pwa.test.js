import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifestText = await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8");
const manifest = JSON.parse(manifestText);
const serviceWorker = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const workflow = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");

test("manifest contains the core installability metadata", () => {
  assert.equal(manifest.short_name, "LoveAll");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
});

test("service worker precaches all runtime modules needed for offline scoring", () => {
  for (const asset of [
    "./index.html",
    "./styles.css",
    "./manifest.webmanifest",
    "./src/app.js",
    "./src/scoring.js",
    "./src/storage.js",
    "./src/haptics.js",
    "./src/effects.js",
    "./src/install.js",
    "./src/wake-lock.js",
    "./src/scoring-ui.css",
    "./src/qol.css",
  ]) {
    assert.match(serviceWorker, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("Pages workflow publishes the PWA manifest, worker, icon directory, and src assets", () => {
  assert.match(workflow, /manifest\.webmanifest sw\.js/);
  assert.match(workflow, /cp -R icons _site\/icons/);
  assert.match(workflow, /cp -R src _site\/src/);
});
