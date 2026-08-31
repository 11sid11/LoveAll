import test from "node:test";
import assert from "node:assert/strict";
import {
  MATCH_PHASES,
  MATCH_TYPES,
  addPoint,
  createMatch,
  isGameWon,
  normalizeActiveMatch,
  orientMatch,
  startNextGame,
  switchEnds,
  toHistoryRecord,
  undoLastScoreChange,
} from "../src/scoring.js";

function newMatch() {
  return orientMatch(createMatch({
    type: MATCH_TYPES.SINGLES,
    teamAName: "Sid",
    teamBName: "Rahul",
    now: 1,
    id: "test-match",
  }), "a", 2);
}

function givePoints(match, teamId, count) {
  let next = match;
  for (let index = 0; index < count; index += 1) {
    next = addPoint(next, teamId, 10 + index);
  }
  return next;
}

test("standard badminton game win rules are enforced", () => {
  assert.equal(isGameWon(20, 18), false);
  assert.equal(isGameWon(21, 19), true);
  assert.equal(isGameWon(21, 20), false);
  assert.equal(isGameWon(22, 20), true);
  assert.equal(isGameWon(29, 29), false);
  assert.equal(isGameWon(30, 29), true);
});

test("winning one game records it and waits for the scorer's decision", () => {
  const match = givePoints(newMatch(), "a", 21);

  assert.equal(match.phase, MATCH_PHASES.GAME_OVER);
  assert.deepEqual(match.gamesWon, { a: 1, b: 0 });
  assert.equal(match.games.length, 1);
  assert.deepEqual(match.games[0], { number: 1, a: 21, b: 0, winner: "a" });
});

test("starting another game resets points without changing screen sides", () => {
  const gameOne = givePoints(newMatch(), "a", 21);
  const gameTwo = startNextGame(gameOne, 100);

  assert.equal(gameTwo.phase, MATCH_PHASES.PLAYING);
  assert.equal(gameTwo.currentGame, 2);
  assert.deepEqual(gameTwo.currentScore, { a: 0, b: 0 });
  assert.equal(gameTwo.leftTeamId, "a");
  assert.deepEqual(gameTwo.gamesWon, { a: 1, b: 0 });
});

test("manual side switching is the only thing that changes screen orientation", () => {
  let match = givePoints(newMatch(), "a", 21);
  match = startNextGame(match, 100);
  assert.equal(match.leftTeamId, "a");

  match = switchEnds(match, 101);
  assert.equal(match.leftTeamId, "b");

  match = givePoints(match, "b", 21);
  match = startNextGame(match, 200);
  assert.equal(match.leftTeamId, "b");
});

test("score undo never rewinds a later manual side switch", () => {
  let match = newMatch();
  match = addPoint(match, "a", 10);
  match = switchEnds(match, 11);
  match = undoLastScoreChange(match, 12);

  assert.deepEqual(match.currentScore, { a: 0, b: 0 });
  assert.equal(match.leftTeamId, "b");
});

test("a match can be completed after a single finished game", () => {
  const match = givePoints(newMatch(), "a", 21);
  const record = toHistoryRecord(match, 500);

  assert.equal(record.version, 2);
  assert.equal(record.winner, "a");
  assert.equal(record.endedAt, 500);
  assert.deepEqual(record.gamesWon, { a: 1, b: 0 });
  assert.equal(record.games.length, 1);
});

test("the same players can continue for any number of games", () => {
  let match = newMatch();

  for (let game = 1; game <= 4; game += 1) {
    match = givePoints(match, game % 2 === 0 ? "b" : "a", 21);
    assert.equal(match.phase, MATCH_PHASES.GAME_OVER);
    if (game < 4) match = startNextGame(match, 100 * game);
  }

  assert.equal(match.currentGame, 4);
  assert.equal(match.games.length, 4);
  assert.deepEqual(match.gamesWon, { a: 2, b: 2 });
  assert.equal(toHistoryRecord(match, 999).winner, null);
});

test("legacy active matches migrate without reintroducing automatic change-end prompts", () => {
  const legacy = {
    version: 1,
    id: "legacy",
    type: MATCH_TYPES.SINGLES,
    teams: { a: { name: "A" }, b: { name: "B" } },
    startedAt: 1,
    currentGame: 3,
    currentScore: { a: 11, b: 7 },
    gamesWon: { a: 1, b: 1 },
    games: [],
    leftTeamId: "a",
    phase: "change-ends",
    undoStack: [],
  };

  const migrated = normalizeActiveMatch(legacy);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.phase, MATCH_PHASES.PLAYING);
  assert.equal(migrated.leftTeamId, "a");
});
