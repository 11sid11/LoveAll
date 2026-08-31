import { normalizeActiveMatch } from "./scoring.js";

const ACTIVE_MATCH_KEY = "loveall.active-match.v1";
const HISTORY_KEY = "loveall.history.v1";
const MAX_HISTORY_ITEMS = 300;

export function loadActiveMatch() {
  const rawValue = readJson(ACTIVE_MATCH_KEY, null);
  const match = normalizeActiveMatch(rawValue);

  if (match && rawValue?.version !== match.version) {
    writeJson(ACTIVE_MATCH_KEY, match);
  }

  return match;
}

export function saveActiveMatch(match) {
  return writeJson(ACTIVE_MATCH_KEY, match);
}

export function clearActiveMatch() {
  try {
    localStorage.removeItem(ACTIVE_MATCH_KEY);
  } catch {
    // Storage can be unavailable in restricted browsing modes. Keep the in-memory session usable.
  }
}

export function loadHistory() {
  const value = readJson(HISTORY_KEY, []);
  if (!Array.isArray(value)) return [];

  return value
    .filter(isUsableHistoryRecord)
    .sort((a, b) => b.endedAt - a.endedAt)
    .slice(0, MAX_HISTORY_ITEMS);
}

export function addHistoryRecord(record) {
  const history = loadHistory().filter((item) => item.id !== record.id);
  history.unshift(record);
  return writeJson(HISTORY_KEY, history.slice(0, MAX_HISTORY_ITEMS));
}

export function getLocalDateKey(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isUsableHistoryRecord(value) {
  return Boolean(
    value
    && (value.version === 1 || value.version === 2)
    && typeof value.id === "string"
    && Number.isFinite(value.endedAt)
    && value.teams?.a?.name
    && value.teams?.b?.name
    && Number.isInteger(value.gamesWon?.a)
    && Number.isInteger(value.gamesWon?.b)
    && Array.isArray(value.games),
  );
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
