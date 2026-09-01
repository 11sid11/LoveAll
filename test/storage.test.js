import test from "node:test";
import assert from "node:assert/strict";
import {
  addHistoryRecord,
  deleteHistoryRecord,
  loadHistory,
} from "../src/storage.js";

const HISTORY_KEY = "loveall.history.v1";

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.failWrites = false;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (this.failWrites) throw new Error("storage unavailable");
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

function useFreshStorage() {
  const storage = new MemoryStorage();
  globalThis.localStorage = storage;
  return storage;
}

function historyRecord(id, endedAt = 1) {
  return {
    version: 2,
    id,
    type: "singles",
    teams: {
      a: { id: "a", name: "Sid" },
      b: { id: "b", name: "Rahul" },
    },
    startedAt: endedAt - 100,
    endedAt,
    gamesWon: { a: 1, b: 0 },
    winner: "a",
    games: [{ number: 1, a: 21, b: 15, winner: "a" }],
  };
}

test("history records are deduplicated by match id", () => {
  useFreshStorage();

  assert.equal(addHistoryRecord(historyRecord("same", 100)), true);
  assert.equal(addHistoryRecord(historyRecord("same", 200)), true);

  const history = loadHistory();
  assert.equal(history.length, 1);
  assert.equal(history[0].id, "same");
  assert.equal(history[0].endedAt, 200);
});

test("history stays newest-first and bounded to 300 matches", () => {
  const storage = useFreshStorage();
  const records = Array.from({ length: 300 }, (_, index) => historyRecord(`old-${index}`, index + 1));
  storage.setItem(HISTORY_KEY, JSON.stringify(records));

  assert.equal(addHistoryRecord(historyRecord("newest", 1000)), true);

  const history = loadHistory();
  assert.equal(history.length, 300);
  assert.equal(history[0].id, "newest");
  assert.equal(history.at(-1).endedAt, 2);
});

test("malformed history entries are ignored", () => {
  const storage = useFreshStorage();
  storage.setItem(HISTORY_KEY, JSON.stringify([
    { id: "broken" },
    historyRecord("valid", 50),
    null,
  ]));

  assert.deepEqual(loadHistory().map((record) => record.id), ["valid"]);
});

test("failed history writes are reported without pretending success", () => {
  const storage = useFreshStorage();
  storage.failWrites = true;

  assert.equal(addHistoryRecord(historyRecord("unsaved", 10)), false);
  assert.equal(deleteHistoryRecord("unsaved"), true);
});

test("individual history records can be deleted without touching the others", () => {
  useFreshStorage();
  addHistoryRecord(historyRecord("first", 100));
  addHistoryRecord(historyRecord("second", 200));

  assert.equal(deleteHistoryRecord("second"), true);
  assert.deepEqual(loadHistory().map((record) => record.id), ["first"]);
});

test("delete reports a storage failure when a persisted record cannot be removed", () => {
  const storage = useFreshStorage();
  addHistoryRecord(historyRecord("keep", 100));
  storage.failWrites = true;

  assert.equal(deleteHistoryRecord("keep"), false);
  assert.deepEqual(loadHistory().map((record) => record.id), ["keep"]);
});
