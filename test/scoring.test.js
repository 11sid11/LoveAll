import test from "node:test";
import assert from "node:assert/strict";
import {
  MATCH_PHASES,
  MATCH_TYPES,
  addPoint,
  confirmMidGameChangeEnds,
  createMatch,
  isGameWon,
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

test("winning a game records it and pauses before the next game", () => {
  const match = givePoints(newMatch(), "a", 21);

  assert.equal(match.phase, MATCH_PHASES.GAME_OVER);
  assert.deepEqual(match.gamesWon, { a: 1, b: 0 });
  assert.equal(match.games.length, 1);
  assert.deepEqual(match.games[0], { number: 1, a: 21, b: 0, winner: "a" });
});

test("starting the next game resets points and swaps physical court ends", () => {
  const gameOne = givePoints(newMatch(), "a", 21);
  const gameTwo = startNextGame(gameOne, 100);

  assert.equal(gameTwo.phase, MATCH_PHASES.PLAYING);
  assert.equal(gameTwo.currentGame, 2);
  assert.deepEqual(gameTwo.currentScore, { a: 0, b: 0 });
  assert.equal(gameTwo.leftTeamId, "b");
  assert.deepEqual(gameTwo.gamesWon, { a: 1, b: 0 });
});

test("third game pauses at 11 for the mandatory change of ends", () => {
  let match = givePoints(newMatch(), "a", 21);
  match = startNextGame(match, 100);
  match = givePoints(match, "b", 21);
  match = startNextGame(match, 200);
  match = givePoints(match, "a", 11);

  assert.equal(match.currentGame, 3);
  assert.equal(match.phase, MATCH_PHASES.CHANGE_ENDS);
  assert.equal(match.leftTeamId, "a");

  const changed = confirmMidGameChangeEnds(match, 300);
  assert.equal(changed.phase, MATCH_PHASES.PLAYING);
  assert.equal(changed.leftTeamId, "b");
  assert.equal(changed.midGameChangeEndsDone, true);
  assert.equal(changed.undoStack.length, 0);
});

test("score undo never rewinds a later manual court-side switch", () => {
  let match = newMatch();
  match = addPoint(match, "a", 10);
  match = switchEnds(match, 11);
  match = undoLastScoreChange(match, 12);

  assert.deepEqual(match.currentScore, { a: 0, b: 0 });
  assert.equal(match.leftTeamId, "b");
});

test("a best-of-three match completes after two game wins and serializes to history", () => {
  let match = givePoints(newMatch(), "a", 21);
  match = startNextGame(match, 100);
  match = givePoints(match, "a", 21);

  assert.equal(match.phase, MATCH_PHASES.MATCH_OVER);
  assert.deepEqual(match.gamesWon, { a: 2, b: 0 });

  const record = toHistoryRecord(match, 500);
  assert.equal(record.winner, "a");
  assert.equal(record.endedAt, 500);
  assert.deepEqual(record.gamesWon, { a: 2, b: 0 });
  assert.equal(record.games.length, 2);
});
