import {
  MATCH_PHASES,
  MATCH_TYPES,
  addPoint,
  createMatch,
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
  deleteHistoryRecord,
  getLocalDateKey,
  loadActiveMatch,
  loadHistory,
  saveActiveMatch,
} from "./storage.js";
import {
  haptic,
  tryEnterFullscreen,
  tryLockLandscape,
  tryUnlockOrientation,
} from "./haptics.js";
import { celebrateGame, celebratePoint } from "./effects.js";
import { setupInstallExperience } from "./install.js";
import { releaseScreenWakeLock, requestScreenWakeLock } from "./wake-lock.js";

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
  installApp: document.querySelector("#install-app"),
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
  teamARecent: document.querySelector("#team-a-recent"),
  teamBRecent: document.querySelector("#team-b-recent"),
  doublesHint: document.querySelector("#doubles-hint"),
  orientBack: document.querySelector("#orient-back"),
  orientA: document.querySelector("#orient-a"),
  orientB: document.querySelector("#orient-b"),
  orientALeft: document.querySelector("#orient-a-left"),
  orientARight: document.querySelector("#orient-a-right"),
  orientBLeft: document.querySelector("#orient-b-left"),
  orientBRight: document.querySelector("#orient-b-right"),
  scoreHome: document.querySelector("#score-home"),
  fullscreenButton: document.querySelector("#fullscreen-button"),
  gameLabel: document.querySelector("#game-label"),
  leftName: document.querySelector("#left-name"),
  rightName: document.querySelector("#right-name"),
  leftScore: document.querySelector("#left-score"),
  rightScore: document.querySelector("#right-score"),
  leftAdd: document.querySelector("#left-add"),
  rightAdd: document.querySelector("#right-add"),
  leftMinus: document.querySelector("#left-minus"),
  rightMinus: document.querySelector("#right-minus"),
  undoButton: document.querySelector("#undo-button"),
  switchSides: document.querySelector("#switch-sides"),
  gameCelebration: document.querySelector("#game-celebration"),
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
  modalTertiary: document.querySelector("#modal-tertiary"),
  toast: document.querySelector("#toast"),
};

let activeMatch = loadActiveMatch();
let modalPrimaryAction = null;
let modalSecondaryAction = null;
let modalTertiaryAction = null;
let toastTimer = null;

initialize();

function initialize() {
  bindNavigation();
  bindLifecycle();
  bindSetup();
  bindOrientation();
  bindScoring();
  bindModal();
  setupInstall();
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

function bindLifecycle() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !views.score.hidden) {
      void requestScreenWakeLock();
    }
  });
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
  bindReactiveButton(elements.leftAdd, () => haptic("point"));
  bindReactiveButton(elements.rightAdd, () => haptic("point"));

  elements.leftAdd.addEventListener("click", (event) => handleAddPoint("left", event));
  elements.rightAdd.addEventListener("click", (event) => handleAddPoint("right", event));
  elements.leftMinus.addEventListener("click", () => handleSubtractPoint("left"));
  elements.rightMinus.addEventListener("click", () => handleSubtractPoint("right"));
  elements.undoButton.addEventListener("click", handleUndo);

  elements.switchSides.addEventListener("click", () => {
    if (!activeMatch || activeMatch.phase !== MATCH_PHASES.PLAYING) return;
    activeMatch = switchEnds(activeMatch);
    persistAndRenderScore();
    animateSideSwitch();
    haptic("switch");
  });

  elements.scoreHome.addEventListener("click", () => {
    renderHome();
    showView("home");
  });

  elements.fullscreenButton.addEventListener("click", async () => {
    const entered = await tryEnterFullscreen(document.documentElement);
    if (entered) {
      void tryLockLandscape();
    }
  });
}

function bindReactiveButton(button, onPress = null) {
  button.addEventListener("pointerdown", (event) => {
    setTapOrigin(button, event);
    button.classList.add("is-pressed");
    onPress?.();
  });

  for (const eventName of ["pointerup", "pointercancel", "pointerleave", "blur"]) {
    button.addEventListener(eventName, () => button.classList.remove("is-pressed"));
  }
}

function bindModal() {
  elements.modalPrimary.addEventListener("click", () => modalPrimaryAction?.());
  elements.modalSecondary.addEventListener("click", () => modalSecondaryAction?.());
  elements.modalTertiary.addEventListener("click", () => modalTertiaryAction?.());
}

function setupInstall() {
  setupInstallExperience({
    button: elements.installApp,
    onInstalled: () => showToast("LoveAll installed"),
    onManualInstall: ({ isAppleMobile }) => {
      showModal({
        kicker: "Install LoveAll",
        title: isAppleMobile ? "Add it to your Home Screen" : "Install from your browser",
        copy: isAppleMobile
          ? "In Safari, tap Share, choose Add to Home Screen, turn on Open as Web App, then tap Add."
          : "Open your browser menu and choose Install app or Add to Home Screen. The exact wording depends on your browser.",
        primaryLabel: "Got it",
        onPrimary: hideModal,
      });
    },
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
    copy: "Starting over will discard the current score. Completed history stays untouched.",
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
}

function handleAddPoint(side, event) {
  if (!activeMatch || activeMatch.phase !== MATCH_PHASES.PLAYING) return;

  const teamId = teamForPhysicalSide(side);
  activeMatch = addPoint(activeMatch, teamId);

  const button = side === "left" ? elements.leftAdd : elements.rightAdd;
  setTapOrigin(button, event);
  pulseButton(button);
  celebratePoint(button, event);

  const gameEnded = activeMatch.phase === MATCH_PHASES.GAME_OVER;
  if (gameEnded) {
    haptic("game");
  }

  persistAndRenderScore();
  animateScore(side);

  if (gameEnded) {
    celebrateGame(elements.gameCelebration, side);
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
  showToast("Last point undone");
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
    elements.resumeMeta.textContent = "Screen layout not set";
    return;
  }

  const score = `${activeMatch.currentScore.a}–${activeMatch.currentScore.b}`;
  const status = activeMatch.phase === MATCH_PHASES.GAME_OVER ? "Game complete" : `Game ${activeMatch.currentGame}`;
  elements.resumeMeta.textContent = `${status} · ${score}`;
}

function renderRecentMatches() {
  const recent = loadHistory().slice(0, 3);
  elements.recentList.replaceChildren();
  elements.recentEmpty.hidden = recent.length > 0;

  for (const record of recent) {
    elements.recentList.append(createMatchRow(record, {
      includeDate: true,
      allowRematch: true,
    }));
  }
}

function renderOrientation() {
  if (!activeMatch) return;

  const teamA = activeMatch.teams.a.name;
  const teamB = activeMatch.teams.b.name;

  elements.orientALeft.textContent = teamA;
  elements.orientARight.textContent = teamB;
  elements.orientBLeft.textContent = teamB;
  elements.orientBRight.textContent = teamA;

  elements.orientA.setAttribute("aria-label", `Use layout with ${teamA} on the left half and ${teamB} on the right half`);
  elements.orientB.setAttribute("aria-label", `Use layout with ${teamB} on the left half and ${teamA} on the right half`);
}

function renderScore() {
  if (!activeMatch || !activeMatch.leftTeamId) return;

  const leftTeamId = activeMatch.leftTeamId;
  const rightTeamId = otherTeam(leftTeamId);
  const leftTeam = activeMatch.teams[leftTeamId];
  const rightTeam = activeMatch.teams[rightTeamId];

  elements.gameLabel.textContent = `Game ${activeMatch.currentGame}`;
  elements.leftName.textContent = leftTeam.name;
  elements.rightName.textContent = rightTeam.name;
  elements.leftScore.textContent = activeMatch.currentScore[leftTeamId];
  elements.rightScore.textContent = activeMatch.currentScore[rightTeamId];

  elements.leftAdd.setAttribute("aria-label", `Add point to ${leftTeam.name}`);
  elements.rightAdd.setAttribute("aria-label", `Add point to ${rightTeam.name}`);
  elements.leftMinus.setAttribute("aria-label", `Subtract point from ${leftTeam.name}`);
  elements.rightMinus.setAttribute("aria-label", `Subtract point from ${rightTeam.name}`);

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

function renderPhaseModal() {
  if (!activeMatch || activeMatch.phase !== MATCH_PHASES.GAME_OVER) {
    hideModal();
    return;
  }

  const completedGame = activeMatch.games.at(-1);
  const winnerName = activeMatch.teams[completedGame.winner].name;

  showModal({
    kicker: `Game ${completedGame.number} complete`,
    title: `${winnerName} wins`,
    copy: "Finish this match here, or play another game with the same players.",
    score: `${completedGame.a} – ${completedGame.b}`,
    secondaryLabel: "Finish match",
    primaryLabel: "Play another game",
    tertiaryLabel: "Undo last point",
    onSecondary: completeMatch,
    onPrimary: startAnotherGame,
    onTertiary: handleUndo,
  });
}

function startAnotherGame() {
  if (!activeMatch || activeMatch.phase !== MATCH_PHASES.GAME_OVER) return;

  activeMatch = startNextGame(activeMatch);
  saveActiveMatch(activeMatch);
  renderScore();
  showToast(`Game ${activeMatch.currentGame} ready`);
}

function completeMatch() {
  if (!activeMatch || activeMatch.phase !== MATCH_PHASES.GAME_OVER) return;

  const record = toHistoryRecord(activeMatch);
  if (!addHistoryRecord(record)) {
    showToast("Couldn't save match — score kept", 2600);
    return;
  }

  clearActiveMatch();
  activeMatch = null;
  hideModal();
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
    copy: "The current score will be removed. Completed history is not affected.",
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
      list.append(createMatchRow(record, {
        allowRematch: true,
        allowDelete: true,
      }));
    }

    group.append(heading, list);
    elements.historyGroups.append(group);
  }
}

function createMatchRow(record, {
  includeDate = false,
  allowRematch = false,
  allowDelete = false,
} = {}) {
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
  const gameScores = record.games.map((game) => `${game.a}–${game.b}`).join(" · ");
  const time = formatTime(record.endedAt);
  detail.textContent = includeDate
    ? `${formatShortDate(record.endedAt)} · ${time} · ${gameScores}`
    : `${time} · ${gameScores}`;

  main.append(names, detail);

  const actions = document.createElement("div");
  actions.className = "match-row-actions";

  if (allowRematch && Object.values(MATCH_TYPES).includes(record.type)) {
    actions.append(createMatchAction("↻ Rematch", () => requestRematch(record)));
  }

  if (allowDelete) {
    actions.append(createMatchAction("Delete", () => confirmDeleteHistoryRecord(record), true));
  }

  if (actions.childElementCount > 0) {
    main.append(actions);
  }

  const result = document.createElement("div");
  result.className = "match-result";
  result.textContent = `${record.gamesWon.a}–${record.gamesWon.b}`;
  result.setAttribute("aria-label", `${record.gamesWon.a} games to ${record.gamesWon.b}`);

  row.append(main, result);
  return row;
}

function createMatchAction(label, onClick, danger = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `match-row-action${danger ? " danger" : ""}`;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function requestRematch(record) {
  const start = () => startRematch(record);

  if (!activeMatch) {
    start();
    return;
  }

  showModal({
    kicker: "Match in progress",
    title: "Start this rematch?",
    copy: "Your current score will be discarded. Completed history stays untouched.",
    secondaryLabel: "Keep match",
    primaryLabel: "Start rematch",
    onSecondary: hideModal,
    onPrimary: start,
  });
}

function startRematch(record) {
  clearActiveMatch();
  activeMatch = createMatch({
    type: record.type,
    teamAName: record.teams.a.name,
    teamBName: record.teams.b.name,
  });
  saveActiveMatch(activeMatch);
  hideModal();
  renderOrientation();
  showView("orient");
}

function confirmDeleteHistoryRecord(record) {
  showModal({
    kicker: "History",
    title: "Delete this match?",
    copy: `${record.teams.a.name} vs ${record.teams.b.name} · ${formatShortDate(record.endedAt)}`,
    secondaryLabel: "Delete",
    primaryLabel: "Keep",
    onSecondary: () => removeHistoryRecord(record.id),
    onPrimary: hideModal,
  });
}

function removeHistoryRecord(recordId) {
  if (!deleteHistoryRecord(recordId)) {
    showToast("Couldn't delete match", 2200);
    return;
  }

  hideModal();
  renderHistory();
  showToast("Match deleted");
}

function showView(name) {
  const wasScoring = !views.score.hidden;

  for (const [viewName, view] of Object.entries(views)) {
    view.hidden = viewName !== name;
  }

  const isScoring = name === "score";
  elements.siteHeader.hidden = isScoring;
  elements.body.classList.toggle("scoring-active", isScoring);

  if (isScoring && !wasScoring) {
    void tryLockLandscape();
    void requestScreenWakeLock();
  } else if (!isScoring && wasScoring) {
    tryUnlockOrientation();
    void releaseScreenWakeLock();
    leaveFullscreen();
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

function showModal({
  kicker,
  title,
  copy,
  score = "",
  secondaryLabel = "",
  primaryLabel,
  tertiaryLabel = "",
  onSecondary = null,
  onPrimary,
  onTertiary = null,
}) {
  elements.modalKicker.textContent = kicker;
  elements.modalTitle.textContent = title;
  elements.modalCopy.textContent = copy;
  elements.modalScore.textContent = score;
  elements.modalScore.hidden = !score;

  elements.modalSecondary.textContent = secondaryLabel;
  elements.modalSecondary.hidden = !secondaryLabel;
  elements.modalPrimary.textContent = primaryLabel;
  elements.modalTertiary.textContent = tertiaryLabel;
  elements.modalTertiary.hidden = !tertiaryLabel;

  modalSecondaryAction = onSecondary;
  modalPrimaryAction = onPrimary;
  modalTertiaryAction = onTertiary;

  elements.modal.hidden = false;
  requestAnimationFrame(() => elements.modalPrimary.focus());
}

function hideModal() {
  elements.modal.hidden = true;
  modalPrimaryAction = null;
  modalSecondaryAction = null;
  modalTertiaryAction = null;
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
  renderRecentNameSuggestions(type);
}

function renderRecentNameSuggestions(type) {
  const names = getRecentNames(type);
  renderRecentNameOptions(elements.teamARecent, elements.teamAInput, names);
  renderRecentNameOptions(elements.teamBRecent, elements.teamBInput, names);
}

function getRecentNames(type, limit = 4) {
  const names = [];
  const seen = new Set();

  for (const record of loadHistory()) {
    if (record.type !== type) continue;

    for (const team of [record.teams.a, record.teams.b]) {
      const name = normalizeName(team.name);
      const key = name.toLocaleLowerCase();
      if (!name || seen.has(key)) continue;

      seen.add(key);
      names.push(name);
      if (names.length >= limit) return names;
    }
  }

  return names;
}

function renderRecentNameOptions(container, input, names) {
  container.replaceChildren();
  container.hidden = names.length === 0;
  if (names.length === 0) return;

  const label = document.createElement("span");
  label.className = "recent-name-label";
  label.textContent = "Recent";
  container.append(label);

  for (const name of names) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "recent-name-chip";
    button.textContent = name;
    button.addEventListener("click", () => {
      input.value = name;
      input.focus();
    });
    container.append(button);
  }
}

function showSetupError(message) {
  elements.setupError.textContent = message;
  elements.setupError.hidden = false;
}

function teamForPhysicalSide(side) {
  if (!activeMatch?.leftTeamId) return "a";
  return side === "left" ? activeMatch.leftTeamId : otherTeam(activeMatch.leftTeamId);
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

  const hasPointerPosition = Number.isFinite(event.clientX)
    && Number.isFinite(event.clientY)
    && (event.clientX !== 0 || event.clientY !== 0);
  const x = hasPointerPosition ? event.clientX - rect.left : rect.width / 2;
  const y = hasPointerPosition ? event.clientY - rect.top : rect.height / 2;

  button.style.setProperty("--tap-x", `${Math.max(0, Math.min(rect.width, x))}px`);
  button.style.setProperty("--tap-y", `${Math.max(0, Math.min(rect.height, y))}px`);
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

function animateSideSwitch() {
  elements.switchSides.classList.remove("is-switching");
  void elements.switchSides.offsetWidth;
  elements.switchSides.classList.add("is-switching");
  window.setTimeout(() => elements.switchSides.classList.remove("is-switching"), 280);
}

function showToast(message, duration = 1400) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, duration);
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
