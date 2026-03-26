// ==================== BUNKER GAME LOGIC ====================

const BunkerGame = (() => {
  // ---- State ----
  let state = {
    phase: "setup",        // setup | catastrophe | game | voting | results
    players: [],           // array of player card objects
    catastrophe: null,
    bunkerCapacity: 0,
    currentPlayerIndex: 0,
    round: 1,
    votingResults: {},
    survivorCount: 0,
    eliminatedPlayers: [],
    activeActionCard: null,
    roundPlayedPlayers: {},
    turnRevealed: false,
    tieCandidates: [],
  };

  // ---- DOM helpers ----
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function showScreen(id) {
    $$(".screen").forEach((s) => s.classList.remove("active"));
    const el = document.getElementById(id);
    if (el) el.classList.add("active");
  }

  function showNotification(msg, type = "info") {
    const notif = document.getElementById("notification");
    if (!notif) return;
    notif.textContent = msg;
    notif.className = `notification ${type} show`;
    clearTimeout(notif._timeout);
    notif._timeout = setTimeout(() => notif.classList.remove("show"), 3500);
  }

  // ---- Setup Phase ----
  function initSetup() {
    showScreen("screen-setup");
    renderPlayerList();
    updateStartButton();
  }

  function renderPlayerList() {
    const container = document.getElementById("player-list");
    const players = getPlayerNames();
    container.innerHTML = "";
    players.forEach((name, i) => {
      const div = document.createElement("div");
      div.className = "player-entry";
      div.innerHTML = `
        <span class="player-num">${i + 1}</span>
        <span class="player-name-display">${escapeHtml(name)}</span>
        <button class="btn-icon btn-remove" data-index="${i}" title="Удалить">✕</button>
      `;
      container.appendChild(div);
    });
    container.querySelectorAll(".btn-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        removePlayer(parseInt(btn.dataset.index));
      });
    });
  }

  function getPlayerNames() {
    return (state._playerNames = state._playerNames || []);
  }

  function addPlayer() {
    const input = document.getElementById("player-name-input");
    const name = input.value.trim();
    if (!name) { showNotification("Введите имя игрока!", "warning"); return; }
    if (name.length > 30) { showNotification("Имя слишком длинное!", "warning"); return; }
    const names = getPlayerNames();
    if (names.includes(name)) { showNotification("Такой игрок уже есть!", "warning"); return; }
    if (names.length >= 12) { showNotification("Максимум 12 игроков!", "warning"); return; }
    names.push(name);
    input.value = "";
    input.focus();
    renderPlayerList();
    updateStartButton();
  }

  function removePlayer(index) {
    const names = getPlayerNames();
    names.splice(index, 1);
    renderPlayerList();
    updateStartButton();
  }


  // updateCapacityDisplay удалён — capacity теперь вычисляется автоматически


  function updateStartButton() {
    const btn = document.getElementById("btn-start-game");
    const names = getPlayerNames();
    btn.disabled = names.length < 2;
  }

  function startGame() {
    if (window.BunkerAuth && typeof window.BunkerAuth.isAuthenticated === "function") {
      if (!window.BunkerAuth.isAuthenticated()) {
        window.BunkerAuth.requireAuth();
        return;
      }
    }

    const names = getPlayerNames();
    if (names.length < 2) { showNotification("Нужно минимум 2 игрока!", "warning"); return; }

    // Вместимость бункера = ceil(половина игроков)
    const capacity = Math.ceil(names.length / 2);
    state.bunkerCapacity = capacity;
    state.survivorCount = capacity;
    state.round = 1;
    state.eliminatedPlayers = [];
    state.votingResults = {};
    state.currentPlayerIndex = 0;
    state.roundPlayedPlayers = {};
    state.turnRevealed = false;
    state.tieCandidates = [];

    // Generate cards
    state.players = names.map((name) => generatePlayerCard(name));
    state.catastrophe = generateCatastrophe();

    showCatastropheScreen();
  }

  // ---- Catastrophe Screen ----
  function showCatastropheScreen() {
    state.phase = "catastrophe";
    showScreen("screen-catastrophe");

    const cat = state.catastrophe;
    document.getElementById("catastrophe-icon").textContent = cat.icon;
    document.getElementById("catastrophe-title").textContent = cat.title;
    document.getElementById("catastrophe-description").textContent = cat.description;

    const bunkerDesc = generateBunkerDescription(state.bunkerCapacity);
    document.getElementById("bunker-description").textContent = bunkerDesc;
    document.getElementById("bunker-capacity-display").textContent = state.bunkerCapacity;
    document.getElementById("total-players-display").textContent = state.players.length;
    document.getElementById("eliminated-need-display").textContent = state.players.length - state.bunkerCapacity;
  }

  // ---- Game Phase (Card Reveal) ----
  function startGamePhase() {
    state.phase = "game";
    beginRound();
  }

  function beginRound() {
    state.phase = "game";
    state.tieCandidates = [];
    state.roundPlayedPlayers = {};

    state.players.forEach((player, i) => {
      if (!player.isEliminated) {
        state.roundPlayedPlayers[i] = false;
      }
    });

    const firstAlive = getFirstAliveIndex();
    if (firstAlive === -1) {
      endGame();
      return;
    }
    state.currentPlayerIndex = firstAlive;

    showNotification(`Раунд ${state.round}: исследование бункера и открытие карт`, "info");
    showScreen("screen-game");
    renderGameOverview();
    showCurrentPlayerCard();
  }

  function getFirstAliveIndex() {
    return state.players.findIndex((p) => !p.isEliminated);
  }

  function getNextAliveNotPlayedIndex(afterIndex) {
    for (let i = afterIndex + 1; i < state.players.length; i++) {
      if (!state.players[i].isEliminated && !state.roundPlayedPlayers[i]) return i;
    }
    for (let i = 0; i <= afterIndex; i++) {
      if (!state.players[i].isEliminated && !state.roundPlayedPlayers[i]) return i;
    }
    return -1;
  }

  function renderGameOverview() {
    const container = document.getElementById("players-overview");
    container.innerHTML = "";

    state.players.forEach((player, i) => {
      const div = document.createElement("div");
      div.className = `mini-player-card ${player.isEliminated ? "eliminated" : ""} ${i === state.currentPlayerIndex && !player.isEliminated ? "active" : ""}`;
      div.id = `mini-card-${i}`;
      div.innerHTML = `
        <span class="mini-avatar">${getAvatarEmoji(i)}</span>
        <span class="mini-name">${escapeHtml(player.playerName)}</span>
        ${player.isEliminated ? '<span class="mini-status eliminated-badge">Выбыл</span>' : ""}
      `;
      div.addEventListener("click", () => {
        if (player.isEliminated) return;
        if (state.phase !== "game") return;
        if (i !== state.currentPlayerIndex) {
          showNotification("Сейчас ход другого игрока", "warning");
          return;
        }
        viewPlayerCard(i);
      });
      container.appendChild(div);
    });

    // Update round indicator
    const aliveCount = state.players.filter((p) => !p.isEliminated).length;
    document.getElementById("round-display").textContent = state.round;
    document.getElementById("alive-display").textContent = aliveCount;
    document.getElementById("bunker-spots-display").textContent = state.bunkerCapacity;
  }

  function getAvatarEmoji(index) {
    const avatars = ["👨", "👩", "🧔", "👩‍🦰", "👨‍🦱", "👩‍🦱", "🧓", "👵", "👦", "👧", "🧑", "👩‍🦳"];
    return avatars[index % avatars.length];
  }

  function canRevealKey(key) {
    return state.round === 1 ? key === "profession" : true;
  }

  function getPlayerAttributes(player) {
    return [
      { key: "profession", icon: "💼", label: "Профессия", value: player.profession.name, desc: player.profession.description },
      { key: "health", icon: "❤️", label: "Здоровье", value: player.health.name, desc: "" },
      { key: "hobby", icon: "🎯", label: "Хобби", value: player.hobby.name, desc: "" },
      { key: "luggage", icon: "🎒", label: "Багаж", value: player.luggage.name, desc: "" },
      { key: "phobiaFact", icon: "🔮", label: "Факт/Фобия", value: player.phobiaFact.name, desc: "" },
      { key: "actionCard", icon: player.actionCard.icon, label: "Карта действия", value: player.actionCard.name, desc: player.actionCard.description },
    ];
  }

  function hasRevealableAttributes(player) {
    return getPlayerAttributes(player).some((a) => !player.revealed[a.key] && canRevealKey(a.key));
  }

  function showCurrentPlayerCard() {
    // Find next non-eliminated player
    const alive = state.players.filter((p) => !p.isEliminated);
    if (alive.length <= state.bunkerCapacity) {
      endGame();
      return;
    }

    if (state.currentPlayerIndex < 0 || state.currentPlayerIndex >= state.players.length || state.players[state.currentPlayerIndex].isEliminated) {
      const nextAlive = getFirstAliveIndex();
      if (nextAlive === -1) {
        endGame();
        return;
      }
      state.currentPlayerIndex = nextAlive;
    }

    viewPlayerCard(state.currentPlayerIndex);
  }

  function viewPlayerCard(playerIndex) {
    const player = state.players[playerIndex];
    if (player.isEliminated) return;
    state.currentPlayerIndex = playerIndex;
    state.turnRevealed = false;

    // По правилам в 1-м раунде каждый обязан раскрыть профессию.
    if (state.round === 1 && !player.revealed.profession) {
      player.revealed.profession = true;
      state.turnRevealed = true;
    }

    if (!state.turnRevealed && !hasRevealableAttributes(player)) {
      state.turnRevealed = true;
    }

    renderGameOverview();
    renderPlayerCard(player, playerIndex);
  }

  function renderPlayerCard(player, playerIndex) {
    const cardDiv = document.getElementById("current-player-card");
    const isCurrentTurn = playerIndex === state.currentPlayerIndex;

    const attrs = getPlayerAttributes(player);

    const revealedCount = Object.values(player.revealed).filter(Boolean).length;
    const totalAttrs = attrs.length;

    cardDiv.innerHTML = `
      <div class="player-card-header">
        <div class="player-card-avatar">${getAvatarEmoji(playerIndex)}</div>
        <div class="player-card-info">
          <h2 class="player-card-name">${escapeHtml(player.playerName)}</h2>
          <div class="reveal-progress">
            <div class="reveal-bar" style="width: ${(revealedCount / totalAttrs) * 100}%"></div>
          </div>
          <span class="reveal-count">${revealedCount}/${totalAttrs} раскрыто</span>
        </div>
      </div>
      <div class="attributes-grid">
        ${attrs.map((attr) => renderAttribute(attr, player.revealed[attr.key])).join("")}
      </div>
      <div class="card-actions">
        ${isCurrentTurn ? `<button class="btn btn-secondary" id="btn-private-view">🙈 Мои карты (приватно)</button>` : ""}
        ${isCurrentTurn ? `<button class="btn btn-primary" id="btn-next-player-card" ${state.turnRevealed ? "" : "disabled"}>➡️ Следующий игрок</button>` : ""}
      </div>
    `;

    // Attach action button handlers without inline onclick
    if (isCurrentTurn) {
      cardDiv.querySelector("#btn-private-view")?.addEventListener("click", () => openPrivateView(playerIndex));
      cardDiv.querySelector("#btn-next-player-card")?.addEventListener("click", nextPlayer);
    }
  }

  function openPrivateView(playerIndex) {
    if (state.phase !== "game") return;
    if (playerIndex !== state.currentPlayerIndex) {
      showNotification("Сейчас ход другого игрока", "warning");
      return;
    }

    const player = state.players[playerIndex];
    const attrs = getPlayerAttributes(player);
    const modal = document.getElementById("private-player-modal");
    const nameEl = document.getElementById("private-player-name");
    const noteEl = document.getElementById("private-round-note");
    const attrsEl = document.getElementById("private-attrs");

    if (!modal || !nameEl || !noteEl || !attrsEl) return;

    nameEl.textContent = player.playerName;
    noteEl.textContent = state.round === 1
      ? "В 1-м раунде для раскрытия доступна только Профессия."
      : "Выберите 1 атрибут, который раскроете всем игрокам в этом раунде.";

    attrsEl.innerHTML = attrs.map((attr) => {
      const isRevealed = player.revealed[attr.key];
      const canReveal = !isRevealed && !state.turnRevealed && canRevealKey(attr.key);
      const blockedByRound = !isRevealed && !canRevealKey(attr.key);

      return `
        <div class="private-attr">
          <div class="private-attr-head">
            <span>${attr.icon}</span>
            <strong>${attr.label}</strong>
          </div>
          <div class="private-attr-value">${escapeHtml(attr.value)}</div>
          ${attr.desc ? `<div class="private-attr-desc">${escapeHtml(attr.desc)}</div>` : ""}
          <div class="private-attr-actions">
            <button class="btn btn-primary btn-reveal-choice" data-key="${attr.key}" ${canReveal ? "" : "disabled"}>
              Раскрыть всем
            </button>
            <span class="private-state">${isRevealed ? "Уже раскрыто" : blockedByRound ? "Недоступно в этом раунде" : state.turnRevealed ? "Лимит раскрытия исчерпан" : "Скрыто"}</span>
          </div>
        </div>
      `;
    }).join("");

    attrsEl.querySelectorAll(".btn-reveal-choice").forEach((btn) => {
      btn.addEventListener("click", () => {
        revealFromPrivate(playerIndex, btn.dataset.key);
      });
    });

    modal.classList.add("open");
  }

  function closePrivateView() {
    document.getElementById("private-player-modal")?.classList.remove("open");
  }

  function openVotingPlayerCard(playerIndex) {
    if (state.phase !== "voting") return;

    const player = state.players[playerIndex];
    if (!player) return;

    const modal = document.getElementById("voting-card-modal");
    const nameEl = document.getElementById("voting-card-player-name");
    const contentEl = document.getElementById("voting-card-content");
    if (!modal || !nameEl || !contentEl) return;

    const attrs = getPlayerAttributes(player);
    nameEl.textContent = player.playerName;
    contentEl.innerHTML = attrs.map((attr) => renderAttribute(attr, player.revealed[attr.key])).join("");

    modal.classList.add("open");
  }

  function closeVotingPlayerCard() {
    document.getElementById("voting-card-modal")?.classList.remove("open");
  }

  function revealFromPrivate(playerIndex, key) {
    const player = state.players[playerIndex];
    if (!player || player.isEliminated) return;
    if (playerIndex !== state.currentPlayerIndex) return;
    if (state.turnRevealed) return;
    if (!canRevealKey(key)) {
      showNotification("Этот атрибут нельзя раскрыть в текущем раунде", "warning");
      return;
    }
    if (player.revealed[key]) {
      showNotification("Атрибут уже раскрыт", "info");
      return;
    }

    player.revealed[key] = true;
    state.turnRevealed = true;
    closePrivateView();
    renderPlayerCard(player, playerIndex);
    showNotification(`Игрок раскрыл: ${key === "profession" ? "Профессию" : "атрибут"}`, "success");
  }

  function renderAttribute(attr, isRevealed) {
    if (isRevealed) {
      return `
        <div class="attribute-card revealed" data-key="${attr.key}">
          <div class="attr-icon">${attr.icon}</div>
          <div class="attr-label">${attr.label}</div>
          <div class="attr-value">${escapeHtml(attr.value)}</div>
          ${attr.desc ? `<div class="attr-desc">${escapeHtml(attr.desc)}</div>` : ""}
        </div>
      `;
    } else {
      return `
        <div class="attribute-card hidden" data-key="${attr.key}" title="Нажмите, чтобы раскрыть">
          <div class="attr-icon">❓</div>
          <div class="attr-label">${attr.label}</div>
          <div class="attr-value">???</div>
        </div>
      `;
    }
  }

  function nextPlayer() {
    if (!state.turnRevealed) {
      showNotification("Сначала раскройте 1 атрибут этого игрока", "warning");
      return;
    }

    state.roundPlayedPlayers[state.currentPlayerIndex] = true;

    const alivePlayers = state.players.filter((p) => !p.isEliminated);
    if (alivePlayers.length <= state.bunkerCapacity) {
      endGame();
      return;
    }

    const next = getNextAliveNotPlayedIndex(state.currentPlayerIndex);

    if (next === -1) {
      // Круг открытия карт завершён — переходим к голосованию.
      startVotingPhase();
    } else {
      state.currentPlayerIndex = next;
      renderGameOverview();
      viewPlayerCard(next);
    }
  }

  // ---- Voting Phase ----
  function startVotingPhase() {
    state.phase = "voting";
    state.votingResults = {};
    state.tieCandidates = [];
    state.players.forEach((p) => { if (!p.isEliminated) p.votes = 0; });
    showScreen("screen-voting");
    renderVoting();
  }

  function renderVoting() {
    const alivePlayers = state.players.filter((p) => !p.isEliminated);
    const votingPool = state.tieCandidates.length > 0
      ? alivePlayers.filter((p) => state.tieCandidates.includes(p.playerName))
      : alivePlayers;
    const container = document.getElementById("voting-players");
    container.innerHTML = "";

    document.getElementById("voting-round").textContent = state.round;
    document.getElementById("voting-eliminate").textContent = 1;

    votingPool.forEach((player, i) => {
      const idx = state.players.indexOf(player);
      const voteCount = state.votingResults[player.playerName] || 0;
      const div = document.createElement("div");
      div.className = "voting-player-card";
      div.id = `vote-card-${idx}`;
      div.innerHTML = `
        <div class="voting-avatar">${getAvatarEmoji(idx)}</div>
        <div class="voting-name">${escapeHtml(player.playerName)}</div>
        <div class="voting-profession">${player.revealed.profession ? escapeHtml(player.profession.name) : "???"}</div>
        <div class="vote-count" id="vote-count-${idx}">${voteCount} голос(ов)</div>
        <button class="btn btn-secondary btn-vote-view-card">
          Посмотреть карточку
        </button>
        <button class="btn btn-vote">
          🗳️ Голосовать за выбывание
        </button>
      `;
      div.querySelector(".btn-vote-view-card")?.addEventListener("click", () => openVotingPlayerCard(idx));
      div.querySelector(".btn-vote").addEventListener("click", () => castVote(player.playerName, idx));
      container.appendChild(div);
    });

    // Update vote submit button
    document.getElementById("btn-confirm-votes").disabled = Object.keys(state.votingResults).length === 0;
  }

  function castVote(playerName, playerIndex) {
    // Simple voting: click = add vote
    if (!state.votingResults[playerName]) state.votingResults[playerName] = 0;
    state.votingResults[playerName]++;

    const countEl = document.getElementById(`vote-count-${playerIndex}`);
    if (countEl) countEl.textContent = `${state.votingResults[playerName]} голос(ов)`;

    document.getElementById("btn-confirm-votes").disabled = false;
    showNotification(`Голос за ${playerName} засчитан!`, "info");
  }

  function confirmVotes() {
    const alive = state.players.filter((p) => !p.isEliminated);
    const pool = state.tieCandidates.length > 0
      ? alive.filter((p) => state.tieCandidates.includes(p.playerName))
      : alive;

    if (pool.length === 0) {
      showNotification("Нет кандидатов для голосования", "warning");
      return;
    }

    let maxVotes = -1;
    pool.forEach((p) => {
      const v = state.votingResults[p.playerName] || 0;
      if (v > maxVotes) maxVotes = v;
    });

    if (maxVotes <= 0) {
      showNotification("Добавьте голоса перед подтверждением", "warning");
      return;
    }

    let leaders = pool.filter((p) => (state.votingResults[p.playerName] || 0) === maxVotes);

    if (leaders.length > 1 && state.tieCandidates.length === 0) {
      // Переголосование только между кандидатами с максимумом.
      state.tieCandidates = leaders.map((p) => p.playerName);
      state.votingResults = {};
      renderVoting();
      showNotification(`Ничья: ${state.tieCandidates.join(", ")}. Проведите переголосование.`, "warning");
      return;
    }

    if (leaders.length > 1 && state.tieCandidates.length > 0) {
      // По правилам после повторной ничьей определяем случайно.
      leaders = [leaders[Math.floor(Math.random() * leaders.length)]];
      showNotification("Повторная ничья: кандидат выбран случайно", "warning");
    }

    const eliminated = leaders[0];
    eliminated.isEliminated = true;
    eliminated.votes = state.votingResults[eliminated.playerName] || 0;
    state.eliminatedPlayers.push(eliminated);
    state.tieCandidates = [];

    showNotification(`Выбыл: ${eliminated.playerName}!`, "error");

    const remainingAlive = state.players.filter((p) => !p.isEliminated);
    if (remainingAlive.length <= state.bunkerCapacity) {
      setTimeout(() => endGame(), 1500);
    } else {
      state.round++;
      setTimeout(() => {
        beginRound();
      }, 1500);
    }
  }

  // ---- End Game ----
  function endGame() {
    state.phase = "results";
    const survivors = state.players.filter((p) => !p.isEliminated);
    showScreen("screen-results");
    renderResults(survivors);
  }

  function renderResults(survivors) {
    document.getElementById("results-catastrophe").textContent = state.catastrophe.title;
    document.getElementById("results-catastrophe-icon").textContent = state.catastrophe.icon;

    const survivorContainer = document.getElementById("survivors-list");
    survivorContainer.innerHTML = "";
    survivors.forEach((player, i) => {
      const idx = state.players.indexOf(player);
      const div = document.createElement("div");
      div.className = "result-card survivor";
      div.innerHTML = `
        <div class="result-rank">${i + 1}</div>
        <div class="result-avatar">${getAvatarEmoji(idx)}</div>
        <div class="result-info">
          <div class="result-name">${escapeHtml(player.playerName)}</div>
          <div class="result-profession">${escapeHtml(player.profession.name)}</div>
          <div class="result-attrs">
            <span>❤️ ${escapeHtml(player.health.name)}</span>
            <span>🎯 ${escapeHtml(player.hobby.name)}</span>
            <span>🎒 ${escapeHtml(player.luggage.name)}</span>
          </div>
        </div>
        <div class="result-badge">🏆 В бункере!</div>
      `;
      survivorContainer.appendChild(div);
    });

    const eliminatedContainer = document.getElementById("eliminated-list");
    eliminatedContainer.innerHTML = "";
    state.eliminatedPlayers.forEach((player) => {
      const idx = state.players.indexOf(player);
      const div = document.createElement("div");
      div.className = "result-card eliminated";
      div.innerHTML = `
        <div class="result-avatar dim">${getAvatarEmoji(idx)}</div>
        <div class="result-info">
          <div class="result-name">${escapeHtml(player.playerName)}</div>
          <div class="result-profession">${escapeHtml(player.profession.name)}</div>
        </div>
        <div class="result-badge-out">☠️ Не попал</div>
      `;
      eliminatedContainer.appendChild(div);
    });
  }

  function restartGame() {
    state = {
      phase: "setup",
      players: [],
      catastrophe: null,
      bunkerCapacity: 0,
      currentPlayerIndex: 0,
      round: 1,
      votingResults: {},
      survivorCount: 0,
      eliminatedPlayers: [],
      activeActionCard: null,
      roundPlayedPlayers: {},
      turnRevealed: false,
      tieCandidates: [],
      _playerNames: [],
    };
    initSetup();
  }

  // ---- Utilities ----
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeJs(str) {
    return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }

  // ---- Public API ----
  return {
    init() {
      state._playerNames = [];
      initSetup();
      // Attach global button handlers
      document.getElementById("btn-add-player")?.addEventListener("click", addPlayer);
      document.getElementById("player-name-input")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") addPlayer();
      });
      document.getElementById("btn-start-game")?.addEventListener("click", startGame);
      document.getElementById("btn-proceed-game")?.addEventListener("click", startGamePhase);
      document.getElementById("btn-confirm-votes")?.addEventListener("click", confirmVotes);
      document.getElementById("btn-restart")?.addEventListener("click", restartGame);

      document.getElementById("btn-close-private")?.addEventListener("click", closePrivateView);
      document.getElementById("btn-private-done")?.addEventListener("click", closePrivateView);
      document.getElementById("private-player-modal")?.addEventListener("click", (e) => {
        if (e.target === e.currentTarget) closePrivateView();
      });

      document.getElementById("btn-close-voting-card")?.addEventListener("click", closeVotingPlayerCard);
      document.getElementById("btn-voting-card-done")?.addEventListener("click", closeVotingPlayerCard);
      document.getElementById("voting-card-modal")?.addEventListener("click", (e) => {
        if (e.target === e.currentTarget) closeVotingPlayerCard();
      });
    },
    resetToSetup() {
      restartGame();
    },
  };
})();

window.BunkerGame = BunkerGame;

document.addEventListener("DOMContentLoaded", () => {
  if (window.BunkerAuth && typeof window.BunkerAuth.init === "function") {
    window.BunkerAuth.init(null, { openOnUnauth: false });
    window.BunkerGame.init();
  } else {
    window.BunkerGame.init();
  }
});
