export const MATCH_TYPES = Object.freeze({
  SINGLES: "singles",
  DOUBLES: "doubles",
});

export const MATCH_PHASES = Object.freeze({
  ORIENT: "orient",
  PLAYING: "playing",
  GAME_OVER: "game-over",
});

const TEAM_A = "a";
const TEAM_B = "b";
const CURRENT_VERSION = 2;
const MAX_UNDO_STEPS = 24;

export function otherTeam(teamId) {
  assertTeamId(teamId);
  return teamId === TEAM_A ? TEAM_B : TEAM_A;
}

export function createMatch({ type, teamAName, teamBName, now = Date.now(), id }) {
  if (!Object.values(MATCH_TYPES).includes(type)) {
    throw new Error("Invalid match type.");
  }

  return {
    version: CURRENT_VERSION,
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
  if (!isGameWon(next.currentScore[teamId], next.currentScore[opponentId])) {
    return next;
  }

  next.games.push({
    number: next.currentGame,
    a: next.currentScore.a,
    b: next.currentScore.b,
    winner: teamId,
  });
  next.gamesWon[teamId] += 1;
  next.phase = MATCH_PHASES.GAME_OVER;
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

export function startNextGame(match, now = Date.now()) {
  if (match.phase !== MATCH_PHASES.GAME_OVER) {
    return match;
  }

  return {
    ...match,
    currentGame: match.currentGame + 1,
    currentScore: { a: 0, b: 0 },
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
  if (match.gamesWon.a === match.gamesWon.b) {
    return null;
  }

  return match.gamesWon.a > match.gamesWon.b ? TEAM_A : TEAM_B;
}

export function toHistoryRecord(match, endedAt = Date.now()) {
  if (match.phase !== MATCH_PHASES.GAME_OVER || match.games.length === 0) {
    throw new Error("Finish the current game before completing the match.");
  }

  return {
    version: CURRENT_VERSION,
    id: match.id,
    type: match.type,
    teams: {
      a: { ...match.teams.a },
      b: { ...match.teams.b },
    },
    startedAt: match.startedAt,
    endedAt,
    gamesWon: { ...match.gamesWon },
    winner: getMatchWinner(match),
    games: match.games.map((game) => ({ ...game })),
  };
}

export function normalizeActiveMatch(value) {
  if (isUsableActiveMatch(value)) {
    return value;
  }

  if (!isLegacyActiveMatch(value)) {
    return null;
  }

  const legacyPhase = value.phase;
  const phase = legacyPhase === "orient"
    ? MATCH_PHASES.ORIENT
    : legacyPhase === "game-over" || legacyPhase === "match-over"
      ? MATCH_PHASES.GAME_OVER
      : MATCH_PHASES.PLAYING;

  const currentGame = Math.max(1, Number.isInteger(value.currentGame) ? value.currentGame : 1);

  return {
    version: CURRENT_VERSION,
    id: value.id,
    type: value.type,
    teams: {
      a: { id: TEAM_A, name: value.teams.a.name },
      b: { id: TEAM_B, name: value.teams.b.name },
    },
    startedAt: Number.isFinite(value.startedAt) ? value.startedAt : Date.now(),
    updatedAt: Date.now(),
    currentGame,
    currentScore: { ...value.currentScore },
    gamesWon: { ...value.gamesWon },
    games: value.games.map((game) => ({ ...game })),
    leftTeamId: value.leftTeamId ?? null,
    phase,
    undoStack: [],
  };
}

export function isUsableActiveMatch(value) {
  if (!value || typeof value !== "object") return false;
  if (value.version !== CURRENT_VERSION || typeof value.id !== "string") return false;
  if (!Object.values(MATCH_TYPES).includes(value.type)) return false;
  if (!Object.values(MATCH_PHASES).includes(value.phase)) return false;
  if (!value.teams?.a?.name || !value.teams?.b?.name) return false;
  if (!Number.isInteger(value.currentGame) || value.currentGame < 1) return false;
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
  return Boolean(
    value
    && Number.isInteger(value.a)
    && Number.isInteger(value.b)
    && value.a >= 0
    && value.b >= 0,
  );
}

function isLegacyActiveMatch(value) {
  return Boolean(
    value
    && value.version === 1
    && typeof value.id === "string"
    && Object.values(MATCH_TYPES).includes(value.type)
    && value.teams?.a?.name
    && value.teams?.b?.name
    && isScorePair(value.currentScore)
    && isScorePair(value.gamesWon)
    && Array.isArray(value.games),
  );
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `match-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
