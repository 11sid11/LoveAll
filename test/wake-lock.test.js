import test from "node:test";
import assert from "node:assert/strict";
import {
  releaseScreenWakeLock,
  requestScreenWakeLock,
} from "../src/wake-lock.js";

function setGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
}

function createLock() {
  let releaseListener = null;

  return {
    released: false,
    addEventListener(type, listener) {
      if (type === "release") releaseListener = listener;
    },
    async release() {
      this.released = true;
      releaseListener?.();
    },
  };
}

test("screen wake lock is requested once and released cleanly", async () => {
  await releaseScreenWakeLock();
  const lock = createLock();
  const requestedTypes = [];

  setGlobal("document", { visibilityState: "visible" });
  setGlobal("navigator", {
    wakeLock: {
      async request(type) {
        requestedTypes.push(type);
        return lock;
      },
    },
  });

  assert.equal(await requestScreenWakeLock(), true);
  assert.equal(await requestScreenWakeLock(), true);
  assert.deepEqual(requestedTypes, ["screen"]);

  assert.equal(await releaseScreenWakeLock(), true);
  assert.equal(lock.released, true);
});

test("wake lock quietly skips unsupported or hidden contexts", async () => {
  await releaseScreenWakeLock();
  setGlobal("document", { visibilityState: "hidden" });
  setGlobal("navigator", {
    wakeLock: {
      async request() {
        throw new Error("should not be called while hidden");
      },
    },
  });

  assert.equal(await requestScreenWakeLock(), false);

  setGlobal("document", { visibilityState: "visible" });
  setGlobal("navigator", {});
  assert.equal(await requestScreenWakeLock(), false);
});
