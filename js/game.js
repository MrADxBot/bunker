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
    updateCapacityDisplay();
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
    updateCapacityDisplay();
    updateStartButton();
  }

  function removePlayer(index) {
    const names = getPlayerNames();
    names.splice(index, 1);
    renderPlayerList();
    updateCapacityDisplay();
    updateStartButton();
  }

  function updateCapacityDisplay() {
    const names = getPlayerNames();
    const total = names.length;
    const capacitySlider = document.getElementById("bunker-capacity");
    const capacityVal = document.getElementById("capacity-value");

    if (total < 2) {
      capacitySlider.disabled = true;
      capacitySlider.min = 1;
      capacitySlider.max = 1;
      capacitySlider.value = 1;
    } else {
      const max = Math.max(1, Math.floor(total / 2));
      capacitySlider.disabled = false;
      capacitySlider.min = 1;
      capacitySlider.max = max;
      // Set to ceil(total/2) as recommended default, capped to valid range
      capacitySlider.value = Math.min(max, Math.ceil(total / 2));
    }
    capacityVal.textContent = capacitySlider.value;
    const statDisplay = document.getElementById("capacity-stat-display");
    if (statDisplay) statDisplay.textContent = capacitySlider.value;
    document.getElementById("player-count-display").textContent = total;
  }

  function updateStartButton() {
    const btn = document.getElementById("btn-start-game");
    const names = getPlayerNames();
    btn.disabled = names.length < 2;
  }

  function startGame() {
    const names = getPlayerNames();
    if (names.length < 2) { showNotification("Нужно минимум 2 игрока!", "warning"); return; }

    const capacity = parseInt(document.getElementById("bunker-capacity").value);
    state.bunkerCapacity = capacity;
    state.survivorCount = capacity;
    state.round = 1;
    state.eliminatedPlayers = [];
    state.votingResults = {};
    state.currentPlayerIndex = 0;

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
    state.currentPlayerIndex = 0;
    showScreen("screen-game");
    renderGameOverview();
    showCurrentPlayerCard();
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
        if (!player.isEliminated) viewPlayerCard(i);
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

  function showCurrentPlayerCard() {
    // Find next non-eliminated player
    const alive = state.players.filter((p) => !p.isEliminated);
    if (alive.length <= state.bunkerCapacity) {
      endGame();
      return;
    }

    while (state.currentPlayerIndex < state.players.length && state.players[state.currentPlayerIndex].isEliminated) {
      state.currentPlayerIndex++;
    }
    if (state.currentPlayerIndex >= state.players.length) {
      state.currentPlayerIndex = 0;
      // Start voting after all alive players have shown cards in this round
      startVotingPhase();
      return;
    }

    viewPlayerCard(state.currentPlayerIndex);
  }

  function viewPlayerCard(playerIndex) {
    const player = state.players[playerIndex];
    if (player.isEliminated) return;
    state.currentPlayerIndex = playerIndex;
    renderGameOverview();
    renderPlayerCard(player, playerIndex);
  }

  function renderPlayerCard(player, playerIndex) {
    const cardDiv = document.getElementById("current-player-card");
    const isCurrentTurn = playerIndex === state.currentPlayerIndex;

    const attrs = [
      { key: "profession", icon: "💼", label: "Профессия", value: player.profession.name, desc: player.profession.description },
      { key: "health", icon: "❤️", label: "Здоровье", value: player.health.name, desc: "" },
      { key: "hobby", icon: "🎯", label: "Хобби", value: player.hobby.name, desc: "" },
      { key: "luggage", icon: "🎒", label: "Багаж", value: player.luggage.name, desc: "" },
      { key: "phobiaFact", icon: "🔮", label: "Факт/Фобия", value: player.phobiaFact.name, desc: "" },
      { key: "actionCard", icon: player.actionCard.icon, label: "Карта действия", value: player.actionCard.name, desc: player.actionCard.description },
    ];

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
        ${isCurrentTurn ? `<button class="btn btn-secondary" id="btn-reveal-random">🎲 Раскрыть случайный атрибут</button>` : ""}
        ${isCurrentTurn ? `<button class="btn btn-primary" id="btn-next-player-card">➡️ Следующий игрок</button>` : ""}
        ${isCurrentTurn && revealedCount < totalAttrs ? `<button class="btn btn-reveal-all" id="btn-reveal-all-card">👁️ Раскрыть всё</button>` : ""}
      </div>
    `;

    // Attach action button handlers without inline onclick
    if (isCurrentTurn) {
      cardDiv.querySelector("#btn-reveal-random")?.addEventListener("click", () => revealRandomAttribute(playerIndex));
      cardDiv.querySelector("#btn-next-player-card")?.addEventListener("click", nextPlayer);
      cardDiv.querySelector("#btn-reveal-all-card")?.addEventListener("click", () => revealAll(playerIndex));
    }

    // Add reveal click handlers
    cardDiv.querySelectorAll(".attribute-card.hidden").forEach((el) => {
      el.addEventListener("click", () => {
        const key = el.dataset.key;
        if (!player.revealed[key]) {
          player.revealed[key] = true;
          renderPlayerCard(player, playerIndex);
        }
      });
    });
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

  function revealRandomAttribute(playerIndex) {
    const player = state.players[playerIndex];
    const hidden = Object.keys(player.revealed).filter((k) => !player.revealed[k]);
    if (hidden.length === 0) { showNotification("Все атрибуты уже раскрыты!", "info"); return; }
    const key = hidden[Math.floor(Math.random() * hidden.length)];
    player.revealed[key] = true;
    renderPlayerCard(player, playerIndex);
    showNotification("Атрибут раскрыт!", "success");
  }

  function revealAll(playerIndex) {
    const player = state.players[playerIndex];
    Object.keys(player.revealed).forEach((k) => (player.revealed[k] = true));
    renderPlayerCard(player, playerIndex);
  }

  function nextPlayer() {
    const alivePlayers = state.players.filter((p) => !p.isEliminated);
    if (alivePlayers.length <= state.bunkerCapacity) {
      endGame();
      return;
    }

    // Find next alive player after current
    let next = state.currentPlayerIndex + 1;
    while (next < state.players.length && state.players[next].isEliminated) next++;

    if (next >= state.players.length) {
      // All alive players have gone — start voting
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
    state.players.forEach((p) => { if (!p.isEliminated) p.votes = 0; });
    showScreen("screen-voting");
    renderVoting();
  }

  function renderVoting() {
    const alivePlayers = state.players.filter((p) => !p.isEliminated);
    const container = document.getElementById("voting-players");
    container.innerHTML = "";

    document.getElementById("voting-round").textContent = state.round;
    document.getElementById("voting-eliminate").textContent = Math.max(1, alivePlayers.length - state.bunkerCapacity);

    alivePlayers.forEach((player, i) => {
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
        <button class="btn btn-vote">
          🗳️ Голосовать за выбывание
        </button>
      `;
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
    // Find player(s) with most votes
    const alive = state.players.filter((p) => !p.isEliminated);
    const toEliminate = Math.max(1, alive.length - state.bunkerCapacity);

    // Sort by votes descending
    const sorted = alive.slice().sort((a, b) => {
      const va = state.votingResults[a.playerName] || 0;
      const vb = state.votingResults[b.playerName] || 0;
      return vb - va;
    });

    const eliminated = sorted.slice(0, toEliminate);
    const names = eliminated.map((p) => p.playerName);

    eliminated.forEach((p) => {
      p.isEliminated = true;
      p.votes = state.votingResults[p.playerName] || 0;
      state.eliminatedPlayers.push(p);
    });

    showNotification(`Выбыли: ${names.join(", ")}!`, "error");

    const remainingAlive = state.players.filter((p) => !p.isEliminated);
    if (remainingAlive.length <= state.bunkerCapacity) {
      setTimeout(() => endGame(), 1500);
    } else {
      state.round++;
      state.currentPlayerIndex = 0;
      setTimeout(() => {
        state.phase = "game";
        showScreen("screen-game");
        renderGameOverview();
        showCurrentPlayerCard();
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
      document.getElementById("bunker-capacity")?.addEventListener("input", function () {
        document.getElementById("capacity-value").textContent = this.value;
        const statDisplay = document.getElementById("capacity-stat-display");
        if (statDisplay) statDisplay.textContent = this.value;
      });
      document.getElementById("btn-proceed-game")?.addEventListener("click", startGamePhase);
      document.getElementById("btn-start-voting")?.addEventListener("click", startVotingPhase);
      document.getElementById("btn-confirm-votes")?.addEventListener("click", confirmVotes);
      document.getElementById("btn-restart")?.addEventListener("click", restartGame);
    },
  };
})();

document.addEventListener("DOMContentLoaded", () => BunkerGame.init());
