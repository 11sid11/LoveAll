export const MATCH_TYPES = Object.freeze({
  SINGLES: "singles",
  DOUBLES: "doubles",
});

export const MATCH_PHASES = Object.freeze({
  ORIENT: "orient",
  PLAYING: "playing",
  CHANGE_ENDS: "change-ends",
  GAME_OVER: "game-over",
  MATCH_OVER: "match-over",
});

const TEAM_A = "a";
const TEAM_B = "b";
const MAX_UNDO_STEPS = 20;

export function otherTeam(teamId) {
  return teamId === TEAM_A ? TEAM_B : TEAM_A;
}

export function createMatch({ type, teamAName, teamBName, now = Date.now(), id }) {
  if (!Object.values(MATCH_TYPES).includes(type)) {
    throw new Error("Invalid match type.");
  }

  return {
    version: 1,
    id: id ?? createId(),
    type,
    teams: {
      a: { id: TEAM_A, name: teamAName },
      b: { id: TEAM_B, name: teamBName },
    },
    startedAt: now,
    updatedAt: now,
    currentGame: 1,
    currentScore: { a: 0, b: 0 },
    gamesWon: { a: 0, b: 0 },
    games: [],
    leftTeamId: null,
    midGameChangeEndsDone: false,
    phase: MATCH_PHASES.ORIENT,
    undoStack: [],
  };
}

export function orientMatch(match, leftTeamId, now = Date.now()) {
  assertTeamId(leftTeamId);
  return {
    ...match,
    leftTeamId,
    phase: MATCH_PHASES.PLAYING,
    updatedAt: now,
  };
}

export function addPoint(match, teamId, now = Date.now()) {
  assertScoringAllowed(match);
  assertTeamId(teamId);

  const next = withUndoSnapshot(match, now);
  next.currentScore[teamId] += 1;

  const opponentId = otherTeam(teamId);
  const teamScore = next.currentScore[teamId];
  const opponentScore = next.currentScore[opponentId];

  if (isGameWon(teamScore, opponentScore)) {
    next.games.push({
      number: next.currentGame,
      a: next.currentScore.a,
      b: next.currentScore.b,
      winner: teamId,
    });
    next.gamesWon[teamId] += 1;
    next.phase = next.gamesWon[teamId] === 2
      ? MATCH_PHASES.MATCH_OVER
      : MATCH_PHASES.GAME_OVER;
    return next;
  }

  if (
    next.currentGame === 3
    && !next.midGameChangeEndsDone
    && teamScore === 11
  ) {
    next.phase = MATCH_PHASES.CHANGE_ENDS;
  }

  return next;
}

export function subtractPoint(match, teamId, now = Date.now()) {
  assertScoringAllowed(match);
  assertTeamId(teamId);

  if (match.currentScore[teamId] === 0) {
    return match;
  }

  const next = withUndoSnapshot(match, now);
  next.currentScore[teamId] -= 1;
  return next;
}

export function undoLastScoreChange(match, now = Date.now()) {
  if (!Array.isArray(match.undoStack) || match.undoStack.length === 0) {
    return match;
  }

  const undoStack = [...match.undoStack];
  const previous = undoStack.pop();

  return {
    ...match,
    currentGame: previous.currentGame,
    currentScore: { ...previous.currentScore },
    gamesWon: { ...previous.gamesWon },
    games: previous.games.map((game) => ({ ...game })),
    midGameChangeEndsDone: previous.midGameChangeEndsDone,
    phase: previous.phase,
    undoStack,
    updatedAt: now,
  };
}

export function switchEnds(match, now = Date.now()) {
  if (!match.leftTeamId) {
    return match;
  }

  return {
    ...match,
    leftTeamId: otherTeam(match.leftTeamId),
    updatedAt: now,
  };
}

export function confirmMidGameChangeEnds(match, now = Date.now()) {
  if (match.phase !== MATCH_PHASES.CHANGE_ENDS) {
    return match;
  }

  return {
    ...switchEnds(match, now),
    midGameChangeEndsDone: true,
    phase: MATCH_PHASES.PLAYING,
    undoStack: [],
    updatedAt: now,
  };
}

export function startNextGame(match, now = Date.now()) {
  if (match.phase !== MATCH_PHASES.GAME_OVER) {
    return match;
  }

  return {
    ...match,
    currentGame: match.currentGame + 1,
    currentScore: { a: 0, b: 0 },
    leftTeamId: otherTeam(match.leftTeamId),
    midGameChangeEndsDone: false,
    phase: MATCH_PHASES.PLAYING,
    undoStack: [],
    updatedAt: now,
  };
}

export function isGameWon(score, opponentScore) {
  if (score === 30) {
    return true;
  }

  return score >= 21 && score - opponentScore >= 2;
}

export function getMatchWinner(match) {
  if (match.gamesWon.a === 2) return TEAM_A;
  if (match.gamesWon.b === 2) return TEAM_B;
  return null;
}

export function toHistoryRecord(match, endedAt = Date.now()) {
  const winner = getMatchWinner(match);
  if (!winner || match.phase !== MATCH_PHASES.MATCH_OVER) {
    throw new Error("Only completed matches can be added to history.");
  }

  return {
    version: 1,
    id: match.id,
    type: match.type,
    teams: {
      a: { ...match.teams.a },
      b: { ...match.teams.b },
    },
    startedAt: match.startedAt,
    endedAt,
    gamesWon: { ...match.gamesWon },
    winner,
    games: match.games.map((game) => ({ ...game })),
  };
}

export function isUsableActiveMatch(value) {
  if (!value || typeof value !== "object") return false;
  if (value.version !== 1 || typeof value.id !== "string") return false;
  if (!Object.values(MATCH_TYPES).includes(value.type)) return false;
  if (!Object.values(MATCH_PHASES).includes(value.phase)) return false;
  if (!value.teams?.a?.name || !value.teams?.b?.name) return false;
  if (!Number.isInteger(value.currentGame) || value.currentGame < 1 || value.currentGame > 3) return false;
  if (!isScorePair(value.currentScore) || !isScorePair(value.gamesWon)) return false;
  if (value.leftTeamId !== null && value.leftTeamId !== TEAM_A && value.leftTeamId !== TEAM_B) return false;
  if (!Array.isArray(value.games) || !Array.isArray(value.undoStack)) return false;
  return true;
}

function withUndoSnapshot(match, now) {
  const snapshot = {
    currentGame: match.currentGame,
    currentScore: { ...match.currentScore },
    gamesWon: { ...match.gamesWon },
    games: match.games.map((game) => ({ ...game })),
    midGameChangeEndsDone: match.midGameChangeEndsDone,
    phase: match.phase,
  };

  return {
    ...match,
    currentScore: { ...match.currentScore },
    gamesWon: { ...match.gamesWon },
    games: match.games.map((game) => ({ ...game })),
    undoStack: [...match.undoStack, snapshot].slice(-MAX_UNDO_STEPS),
    updatedAt: now,
  };
}

function assertScoringAllowed(match) {
  if (match.phase !== MATCH_PHASES.PLAYING) {
    throw new Error("Score changes are only allowed while a game is active.");
  }
}

function assertTeamId(teamId) {
  if (teamId !== TEAM_A && teamId !== TEAM_B) {
    throw new Error("Invalid team id.");
  }
}

function isScorePair(value) {
  return value
    && Number.isInteger(value.a)
    && Number.isInteger(value.b)
    && value.a >= 0
    && value.b >= 0;
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `match-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
