import {
  MATCH_PHASES,
  MATCH_TYPES,
  addPoint,
  confirmMidGameChangeEnds,
  createMatch,
  getMatchWinner,
  orientMatch,
  otherTeam,
  startNextGame,
  subtractPoint,
  switchEnds,
  toHistoryRecord,
  undoLastScoreChange,
} from "./scoring.js";
import {
  addHistoryRecord,
  clearActiveMatch,
  getLocalDateKey,
  loadActiveMatch,
  loadHistory,
  saveActiveMatch,
} from "./storage.js";
import { haptic, tryEnterFullscreen } from "./haptics.js";

const views = {
  home: document.querySelector("#home-view"),
  setup: document.querySelector("#setup-view"),
  orient: document.querySelector("#orient-view"),
  score: document.querySelector("#score-view"),
  history: document.querySelector("#history-view"),
};

const elements = {
  body: document.body,
  siteHeader: document.querySelector("#site-header"),
  brandHome: document.querySelector("#brand-home"),
  openHistory: document.querySelector("#open-history"),
  viewAllHistory: document.querySelector("#view-all-history"),
  newMatch: document.querySelector("#new-match"),
  resumeCard: document.querySelector("#resume-card"),
  resumeMatch: document.querySelector("#resume-match"),
  resumeMeta: document.querySelector("#resume-meta"),
  resumeButton: document.querySelector("#resume-match-button"),
  discardMatch: document.querySelector("#discard-match"),
  recentList: document.querySelector("#recent-list"),
  recentEmpty: document.querySelector("#recent-empty"),
  setupBack: document.querySelector("#setup-back"),
  setupForm: document.querySelector("#setup-form"),
  setupError: document.querySelector("#setup-error"),
  teamAInput: document.querySelector("#team-a-name"),
  teamBInput: document.querySelector("#team-b-name"),
  teamALabel: document.querySelector("#team-a-label"),
  teamBLabel: document.querySelector("#team-b-label"),
  doublesHint: document.querySelector("#doubles-hint"),
  orientBack: document.querySelector("#orient-back"),
  orientA: document.querySelector("#orient-a"),
  orientB: document.querySelector("#orient-b"),
  orientAName: document.querySelector("#orient-a-name"),
  orientBName: document.querySelector("#orient-b-name"),
  scoreHome: document.querySelector("#score-home"),
  fullscreenButton: document.querySelector("#fullscreen-button"),
  gameLabel: document.querySelector("#game-label"),
  matchScoreLabel: document.querySelector("#match-score-label"),
  leftName: document.querySelector("#left-name"),
  rightName: document.querySelector("#right-name"),
  leftScore: document.querySelector("#left-score"),
  rightScore: document.querySelector("#right-score"),
  leftGamePips: document.querySelector("#left-game-pips"),
  rightGamePips: document.querySelector("#right-game-pips"),
  leftAdd: document.querySelector("#left-add"),
  rightAdd: document.querySelector("#right-add"),
  leftMinus: document.querySelector("#left-minus"),
  rightMinus: document.querySelector("#right-minus"),
  undoButton: document.querySelector("#undo-button"),
  switchSides: document.querySelector("#switch-sides"),
  scoreLive: document.querySelector("#score-live"),
  historyBack: document.querySelector("#history-back"),
  historyGroups: document.querySelector("#history-groups"),
  historyEmpty: document.querySelector("#history-empty"),
  modal: document.querySelector("#modal"),
  modalKicker: document.querySelector("#modal-kicker"),
  modalTitle: document.querySelector("#modal-title"),
  modalCopy: document.querySelector("#modal-copy"),
  modalScore: document.querySelector("#modal-score"),
  modalPrimary: document.querySelector("#modal-primary"),
  modalSecondary: document.querySelector("#modal-secondary"),
  toast: document.querySelector("#toast"),
};

let activeMatch = loadActiveMatch();
let modalPrimaryAction = null;
let modalSecondaryAction = null;
let toastTimer = null;

initialize();

function initialize() {
  bindNavigation();
  bindSetup();
  bindOrientation();
  bindScoring();
  bindModal();
  renderHome();
  showView("home");
}

function bindNavigation() {
  elements.brandHome.addEventListener("click", () => {
    renderHome();
    showView("home");
  });

  elements.openHistory.addEventListener("click", openHistory);
  elements.viewAllHistory.addEventListener("click", openHistory);
  elements.historyBack.addEventListener("click", () => {
    renderHome();
    showView("home");
  });

  elements.newMatch.addEventListener("click", beginNewMatch);

  elements.setupBack.addEventListener("click", () => {
    renderHome();
    showView("home");
  });

  elements.resumeButton.addEventListener("click", resumeActiveMatch);
  elements.discardMatch.addEventListener("click", confirmDiscardActiveMatch);
}

function bindSetup() {
  elements.setupForm.addEventListener("change", (event) => {
    if (event.target.name === "match-type") {
      updateSetupLabels();
    }
  });

  elements.setupForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const data = new FormData(elements.setupForm);
    const type = data.get("match-type");
    const teamAName = normalizeName(data.get("team-a-name"));
    const teamBName = normalizeName(data.get("team-b-name"));

    if (!teamAName || !teamBName) {
      showSetupError("Add a name for both sides.");
      return;
    }

    if (teamAName.localeCompare(teamBName, undefined, { sensitivity: "accent" }) === 0) {
      showSetupError("Use different names so the two sides stay easy to identify.");
      return;
    }

    elements.setupError.hidden = true;
    activeMatch = createMatch({ type, teamAName, teamBName });
    saveActiveMatch(activeMatch);
    renderOrientation();
    showView("orient");
  });
}

function bindOrientation() {
  elements.orientBack.addEventListener("click", () => {
    if (!activeMatch) {
      showView("setup");
      return;
    }

    elements.teamAInput.value = activeMatch.teams.a.name;
    elements.teamBInput.value = activeMatch.teams.b.name;
    const typeInput = elements.setupForm.querySelector(`input[name="match-type"][value="${activeMatch.type}"]`);
    if (typeInput) typeInput.checked = true;
    updateSetupLabels();
    clearActiveMatch();
    activeMatch = null;
    showView("setup");
  });

  elements.orientA.addEventListener("click", () => completeOrientation("a"));
  elements.orientB.addEventListener("click", () => completeOrientation("b"));
}

function bindScoring() {
  bindReactiveButton(elements.leftAdd);
  bindReactiveButton(elements.rightAdd);

  elements.leftAdd.addEventListener("click", (event) => handleAddPoint("left", event));
  elements.rightAdd.addEventListener("click", (event) => handleAddPoint("right", event));
  elements.leftMinus.addEventListener("click", () => handleSubtractPoint("left"));
  elements.rightMinus.addEventListener("click", () => handleSubtractPoint("right"));
  elements.undoButton.addEventListener("click", handleUndo);

  elements.switchSides.addEventListener("click", () => {
    if (!activeMatch || activeMatch.phase !== MATCH_PHASES.PLAYING) return;
    activeMatch = switchEnds(activeMatch);
    persistAndRenderScore();
    haptic("switch");
    showToast("Court sides switched");
  });

  elements.scoreHome.addEventListener("click", () => {
    leaveFullscreen();
    renderHome();
    showView("home");
  });

  elements.fullscreenButton.addEventListener("click", () => {
    tryEnterFullscreen(document.documentElement);
  });
}

function bindReactiveButton(button) {
  button.addEventListener("pointerdown", (event) => {
    setTapOrigin(button, event);
    button.classList.add("is-pressed");
  });

  for (const eventName of ["pointerup", "pointercancel", "pointerleave", "blur"]) {
    button.addEventListener(eventName, () => button.classList.remove("is-pressed"));
  }
}

function bindModal() {
  elements.modalPrimary.addEventListener("click", () => {
    modalPrimaryAction?.();
  });

  elements.modalSecondary.addEventListener("click", () => {
    modalSecondaryAction?.();
  });
}

function beginNewMatch() {
  if (!activeMatch) {
    openSetup();
    return;
  }

  showModal({
    kicker: "Match in progress",
    title: "Start a new match?",
    copy: "Starting over will discard the current score. Your completed match history will stay untouched.",
    secondaryLabel: "Keep match",
    primaryLabel: "Start new",
    onSecondary: hideModal,
    onPrimary: () => {
      clearActiveMatch();
      activeMatch = null;
      hideModal();
      openSetup();
    },
  });
}

function openSetup() {
  resetSetupForm();
  showView("setup");
  requestAnimationFrame(() => elements.teamAInput.focus());
}

function completeOrientation(leftTeamId) {
  if (!activeMatch) return;

  activeMatch = orientMatch(activeMatch, leftTeamId);
  saveActiveMatch(activeMatch);
  renderScore();
  showView("score");
  haptic("switch");
  tryEnterFullscreen(document.documentElement);
}

function handleAddPoint(side, event) {
  if (!activeMatch || activeMatch.phase !== MATCH_PHASES.PLAYING) return;

  const teamId = teamForPhysicalSide(side);
  const previousPhase = activeMatch.phase;
  activeMatch = addPoint(activeMatch, teamId);

  const button = side === "left" ? elements.leftAdd : elements.rightAdd;
  setTapOrigin(button, event);
  pulseButton(button);

  if (activeMatch.phase === MATCH_PHASES.MATCH_OVER) {
    haptic("match");
  } else if (activeMatch.phase === MATCH_PHASES.GAME_OVER) {
    haptic("game");
  } else {
    haptic("point");
  }

  persistAndRenderScore();
  animateScore(side);

  if (previousPhase !== activeMatch.phase && activeMatch.phase === MATCH_PHASES.CHANGE_ENDS) {
    showToast("11-point interval");
  }
}

function handleSubtractPoint(side) {
  if (!activeMatch || activeMatch.phase !== MATCH_PHASES.PLAYING) return;

  const teamId = teamForPhysicalSide(side);
  const before = activeMatch.currentScore[teamId];
  activeMatch = subtractPoint(activeMatch, teamId);
  if (activeMatch.currentScore[teamId] === before) return;

  haptic("correction");
  persistAndRenderScore();
  animateScore(side);
}

function handleUndo() {
  if (!activeMatch || activeMatch.undoStack.length === 0) return;

  activeMatch = undoLastScoreChange(activeMatch);
  haptic("undo");
  persistAndRenderScore();
  showToast("Last score change undone");
}

function persistAndRenderScore() {
  saveActiveMatch(activeMatch);
  renderScore();
}

function renderHome() {
  activeMatch = loadActiveMatch() ?? activeMatch;
  renderResumeCard();
  renderRecentMatches();
}

function renderResumeCard() {
  if (!activeMatch) {
    elements.resumeCard.hidden = true;
    return;
  }

  elements.resumeCard.hidden = false;
  elements.resumeMatch.textContent = `${activeMatch.teams.a.name} vs ${activeMatch.teams.b.name}`;

  if (activeMatch.phase === MATCH_PHASES.ORIENT) {
    elements.resumeMeta.textContent = "Court orientation not set";
    return;
  }

  const score = `${activeMatch.currentScore.a}–${activeMatch.currentScore.b}`;
  elements.resumeMeta.textContent = `Game ${activeMatch.currentGame} · ${score}`;
}

function renderRecentMatches() {
  const recent = loadHistory().slice(0, 3);
  elements.recentList.replaceChildren();
  elements.recentEmpty.hidden = recent.length > 0;

  for (const record of recent) {
    elements.recentList.append(createMatchRow(record, true));
  }
}

function renderOrientation() {
  if (!activeMatch) return;
  elements.orientAName.textContent = activeMatch.teams.a.name;
  elements.orientBName.textContent = activeMatch.teams.b.name;
  elements.orientA.setAttribute("aria-label", `${activeMatch.teams.a.name} is on my left`);
  elements.orientB.setAttribute("aria-label", `${activeMatch.teams.b.name} is on my left`);
}

function renderScore() {
  if (!activeMatch || !activeMatch.leftTeamId) return;

  const leftTeamId = activeMatch.leftTeamId;
  const rightTeamId = otherTeam(leftTeamId);
  const leftTeam = activeMatch.teams[leftTeamId];
  const rightTeam = activeMatch.teams[rightTeamId];

  elements.gameLabel.textContent = `Game ${activeMatch.currentGame}`;
  elements.matchScoreLabel.textContent = "Best of 3";
  elements.leftName.textContent = leftTeam.name;
  elements.rightName.textContent = rightTeam.name;
  elements.leftScore.textContent = activeMatch.currentScore[leftTeamId];
  elements.rightScore.textContent = activeMatch.currentScore[rightTeamId];

  elements.leftAdd.setAttribute("aria-label", `Add point to ${leftTeam.name}`);
  elements.rightAdd.setAttribute("aria-label", `Add point to ${rightTeam.name}`);
  elements.leftMinus.setAttribute("aria-label", `Subtract point from ${leftTeam.name}`);
  elements.rightMinus.setAttribute("aria-label", `Subtract point from ${rightTeam.name}`);

  renderGamePips(elements.leftGamePips, activeMatch.gamesWon[leftTeamId]);
  renderGamePips(elements.rightGamePips, activeMatch.gamesWon[rightTeamId]);

  const scoringEnabled = activeMatch.phase === MATCH_PHASES.PLAYING;
  elements.leftAdd.disabled = !scoringEnabled;
  elements.rightAdd.disabled = !scoringEnabled;
  elements.leftMinus.disabled = !scoringEnabled || activeMatch.currentScore[leftTeamId] === 0;
  elements.rightMinus.disabled = !scoringEnabled || activeMatch.currentScore[rightTeamId] === 0;
  elements.switchSides.disabled = !scoringEnabled;
  elements.undoButton.disabled = activeMatch.undoStack.length === 0;

  elements.scoreLive.textContent = `${leftTeam.name} ${activeMatch.currentScore[leftTeamId]}, ${rightTeam.name} ${activeMatch.currentScore[rightTeamId]}`;

  renderPhaseModal();
}

function renderGamePips(container, wins) {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 2; index += 1) {
    const pip = document.createElement("span");
    pip.className = `game-pip${index < wins ? " won" : ""}`;
    fragment.append(pip);
  }
  container.replaceChildren(fragment);
}

function renderPhaseModal() {
  if (!activeMatch) {
    hideModal();
    return;
  }

  if (activeMatch.phase === MATCH_PHASES.CHANGE_ENDS) {
    showModal({
      kicker: "Game 3 · 11-point interval",
      title: "Change ends",
      copy: "Let the players change ends, then remap the screen to match the court.",
      score: formatCurrentScoreByTeam(),
      secondaryLabel: "Undo point",
      primaryLabel: "Sides changed",
      onSecondary: handleUndo,
      onPrimary: () => {
        activeMatch = confirmMidGameChangeEnds(activeMatch);
        saveActiveMatch(activeMatch);
        haptic("switch");
        renderScore();
      },
    });
    return;
  }

  if (activeMatch.phase === MATCH_PHASES.GAME_OVER) {
    const completedGame = activeMatch.games.at(-1);
    const winnerName = activeMatch.teams[completedGame.winner].name;
    showModal({
      kicker: `Game ${completedGame.number} complete`,
      title: `${winnerName} takes it`,
      copy: "Players change ends for the next game. LoveAll will flip the court when you continue.",
      score: `${completedGame.a} – ${completedGame.b}`,
      secondaryLabel: "Undo point",
      primaryLabel: `Start Game ${activeMatch.currentGame + 1}`,
      onSecondary: handleUndo,
      onPrimary: () => {
        activeMatch = startNextGame(activeMatch);
        saveActiveMatch(activeMatch);
        haptic("switch");
        renderScore();
      },
    });
    return;
  }

  if (activeMatch.phase === MATCH_PHASES.MATCH_OVER) {
    const winnerId = getMatchWinner(activeMatch);
    const winnerName = activeMatch.teams[winnerId].name;
    showModal({
      kicker: "Match complete",
      title: `${winnerName} wins`,
      copy: `${activeMatch.gamesWon.a}–${activeMatch.gamesWon.b} in games`,
      score: activeMatch.games.map((game) => `${game.a}–${game.b}`).join("  ·  "),
      secondaryLabel: "Undo point",
      primaryLabel: "Done",
      onSecondary: handleUndo,
      onPrimary: completeMatch,
    });
    return;
  }

  hideModal();
}

function completeMatch() {
  if (!activeMatch || activeMatch.phase !== MATCH_PHASES.MATCH_OVER) return;

  const record = toHistoryRecord(activeMatch);
  addHistoryRecord(record);
  clearActiveMatch();
  activeMatch = null;
  hideModal();
  leaveFullscreen();
  renderHome();
  showView("home");
  showToast("Match saved to history");
}

function resumeActiveMatch() {
  if (!activeMatch) return;

  if (activeMatch.phase === MATCH_PHASES.ORIENT || !activeMatch.leftTeamId) {
    renderOrientation();
    showView("orient");
    return;
  }

  renderScore();
  showView("score");
}

function confirmDiscardActiveMatch() {
  if (!activeMatch) return;

  showModal({
    kicker: "Match in progress",
    title: "Discard match?",
    copy: "The current score will be removed. Completed match history is not affected.",
    secondaryLabel: "Keep match",
    primaryLabel: "Discard",
    onSecondary: hideModal,
    onPrimary: () => {
      clearActiveMatch();
      activeMatch = null;
      hideModal();
      renderHome();
      showToast("Match discarded");
    },
  });
}

function openHistory() {
  renderHistory();
  showView("history");
}

function renderHistory() {
  const history = loadHistory();
  elements.historyGroups.replaceChildren();
  elements.historyEmpty.hidden = history.length > 0;

  const groups = new Map();
  for (const record of history) {
    const key = getLocalDateKey(record.endedAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }

  for (const [dateKey, records] of groups) {
    const group = document.createElement("section");
    group.className = "history-group";

    const heading = document.createElement("h2");
    heading.className = "history-date";
    heading.textContent = formatDateKey(dateKey);

    const list = document.createElement("div");
    list.className = "history-group-list";
    for (const record of records) {
      list.append(createMatchRow(record, false));
    }

    group.append(heading, list);
    elements.historyGroups.append(group);
  }
}

function createMatchRow(record, includeDate) {
  const row = document.createElement("article");
  row.className = "match-row";

  const main = document.createElement("div");
  main.className = "match-row-main";

  const names = document.createElement("div");
  names.className = "match-names";

  const teamA = document.createElement("span");
  teamA.textContent = record.teams.a.name;
  if (record.winner === "a") teamA.classList.add("winner");

  const versus = document.createElement("span");
  versus.className = "versus";
  versus.textContent = "vs";

  const teamB = document.createElement("span");
  teamB.textContent = record.teams.b.name;
  if (record.winner === "b") teamB.classList.add("winner");

  names.append(teamA, versus, teamB);

  const detail = document.createElement("div");
  detail.className = "match-detail";
  const games = record.games.map((game) => `${game.a}–${game.b}`).join(" · ");
  const time = formatTime(record.endedAt);
  detail.textContent = includeDate
    ? `${formatShortDate(record.endedAt)} · ${time} · ${games}`
    : `${time} · ${games}`;

  const result = document.createElement("div");
  result.className = "match-result";
  result.textContent = `${record.gamesWon.a}–${record.gamesWon.b}`;

  main.append(names, detail);
  row.append(main, result);
  return row;
}

function showView(name) {
  for (const [viewName, view] of Object.entries(views)) {
    view.hidden = viewName !== name;
  }

  const isScoring = name === "score";
  elements.siteHeader.hidden = isScoring;
  elements.body.classList.toggle("scoring-active", isScoring);

  if (!isScoring && elements.modal.hidden === false && activeMatch?.phase === MATCH_PHASES.PLAYING) {
    hideModal();
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

function showModal({
  kicker,
  title,
  copy,
  score = "",
  secondaryLabel,
  primaryLabel,
  onSecondary,
  onPrimary,
}) {
  elements.modalKicker.textContent = kicker;
  elements.modalTitle.textContent = title;
  elements.modalCopy.textContent = copy;
  elements.modalScore.textContent = score;
  elements.modalScore.hidden = !score;
  elements.modalSecondary.textContent = secondaryLabel;
  elements.modalPrimary.textContent = primaryLabel;
  modalSecondaryAction = onSecondary;
  modalPrimaryAction = onPrimary;
  elements.modal.hidden = false;
  requestAnimationFrame(() => elements.modalPrimary.focus());
}

function hideModal() {
  elements.modal.hidden = true;
  modalPrimaryAction = null;
  modalSecondaryAction = null;
}

function resetSetupForm() {
  elements.setupForm.reset();
  elements.setupError.hidden = true;
  elements.teamAInput.value = "";
  elements.teamBInput.value = "";
  updateSetupLabels();
}

function updateSetupLabels() {
  const type = new FormData(elements.setupForm).get("match-type");
  const doubles = type === MATCH_TYPES.DOUBLES;
  elements.teamALabel.textContent = doubles ? "Team A" : "Player A";
  elements.teamBLabel.textContent = doubles ? "Team B" : "Player B";
  elements.doublesHint.hidden = !doubles;
}

function showSetupError(message) {
  elements.setupError.textContent = message;
  elements.setupError.hidden = false;
}

function teamForPhysicalSide(side) {
  if (!activeMatch?.leftTeamId) return "a";
  return side === "left" ? activeMatch.leftTeamId : otherTeam(activeMatch.leftTeamId);
}

function formatCurrentScoreByTeam() {
  return `${activeMatch.currentScore.a} – ${activeMatch.currentScore.b}`;
}

function normalizeName(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 30);
}

function setTapOrigin(button, event) {
  const rect = button.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  button.style.setProperty("--tap-x", `${Math.max(0, Math.min(100, x))}%`);
  button.style.setProperty("--tap-y", `${Math.max(0, Math.min(100, y))}%`);
}

function pulseButton(button) {
  button.classList.remove("tap-pulse");
  void button.offsetWidth;
  button.classList.add("tap-pulse");
}

function animateScore(side) {
  const score = side === "left" ? elements.leftScore : elements.rightScore;
  score.classList.remove("score-pop");
  void score.offsetWidth;
  score.classList.add("score-pop");
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 1300);
}

function formatDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatShortDate(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(new Date(timestamp));
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function leaveFullscreen() {
  if (document.fullscreenElement && typeof document.exitFullscreen === "function") {
    document.exitFullscreen().catch(() => {});
  }
}
