// ==================== BUNKER GAME LOGIC ====================

const BunkerGame = (() => {
  const Utils = window.BunkerGameUtils;

  // ---- State ----
  let state = Utils.createInitialState();

  let roomUiReady = false;
  let privateModalPlayerIndex = null;

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

  function initSetup() {
    showScreen("screen-setup");
    renderPlayerList();
    renderRoomState();
    updateStartButton();
  }

  function renderPlayerList() {
    const container = document.getElementById("player-list");
    const players = getPlayerNames();
    const canEdit = canEditPlayers();
    container.innerHTML = "";
    players.forEach((name, i) => {
      const div = document.createElement("div");
      div.className = "player-entry";
      div.innerHTML = `
        <span class="player-num">${i + 1}</span>
        <span class="player-name-display">${Utils.escapeHtml(name)}</span>
        <button class="btn-icon btn-remove" data-index="${i}" title="Удалить" ${canEdit ? "" : "disabled"}>✕</button>
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

  function setPlayerNames(names) {
    state._playerNames = Array.isArray(names) ? names.slice() : [];
    renderPlayerList();
    updateStartButton();
  }

  function getRoomState() {
    if (!window.BunkerRooms || typeof window.BunkerRooms.getState !== "function") {
      return { connected: false, isHost: false, roomCode: "", username: "", members: [] };
    }
    return window.BunkerRooms.getState();
  }

  function isConnectedRoom() {
    return Boolean(getRoomState().connected);
  }

  function canEditPlayers() {
    return !isConnectedRoom();
  }

  function addPlayer() {
    if (isConnectedRoom()) {
      showNotification("В онлайн-комнате список формируется автоматически по участникам", "warning");
      return;
    }

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
    if (isConnectedRoom()) {
      showNotification("В онлайн-комнате список формируется автоматически по участникам", "warning");
      return;
    }

    const names = getPlayerNames();
    names.splice(index, 1);
    renderPlayerList();
    updateStartButton();
  }

  function updateStartButton() {
    const btn = document.getElementById("btn-start-game");
    const addBtn = document.getElementById("btn-add-player");
    if (!btn) return;

    const names = getPlayerNames();
    const room = getRoomState();
    // Старт разрешён только хосту в онлайн-комнате и только при >= 2 игроках.
    btn.disabled = !room.connected || names.length < 2 || !room.isHost;
    if (addBtn) {
      addBtn.disabled = true;
      addBtn.style.display = "none";
    }

    const nameInput = document.getElementById("player-name-input");
    if (nameInput) {
      nameInput.disabled = true;
      nameInput.style.display = "none";
    }

    const addRow = document.getElementById("player-add-row");
    if (addRow) addRow.style.display = "none";
  }

  function renderRoomMembers(members) {
    const membersWrap = document.getElementById("room-members-wrap");
    const membersContainer = document.getElementById("room-members");
    if (!membersWrap || !membersContainer) return;

    if (!members || members.length === 0) {
      membersWrap.style.display = "none";
      membersContainer.innerHTML = "";
      return;
    }

    membersWrap.style.display = "block";
    membersContainer.innerHTML = members.map((member) => {
      const classes = `room-member-chip ${member.isHost ? "host" : ""}`.trim();
      const suffix = member.isHost ? " (хост)" : "";
      return `<span class="${classes}">${Utils.escapeHtml(member.username)}${suffix}</span>`;
    }).join("");
  }

  function renderRoomState() {
    const room = getRoomState();
    const statusEl = document.getElementById("room-status");
    const codeInput = document.getElementById("room-code-input");
    const usernameInput = document.getElementById("room-username-input");
    const createBtn = document.getElementById("btn-room-create");
    const joinBtn = document.getElementById("btn-room-join");
    const leaveBtn = document.getElementById("btn-room-leave");
    const playersCard = document.getElementById("players-setup-card");

    if (!statusEl || !codeInput || !usernameInput || !createBtn || !joinBtn || !leaveBtn) return;

    if (room.connected) {
      statusEl.textContent = `Вы в комнате ${room.roomCode}. Игроки добавляются автоматически при подключении к лобби.`;
      codeInput.value = room.roomCode;
      usernameInput.value = room.username;
      createBtn.disabled = true;
      joinBtn.disabled = true;
      leaveBtn.disabled = false;
      renderRoomMembers(room.members || []);
      if (playersCard) playersCard.style.display = "block";
    } else {
      statusEl.textContent = "Офлайн режим: игра только на этом устройстве.";
      createBtn.disabled = false;
      joinBtn.disabled = false;
      leaveBtn.disabled = true;
      renderRoomMembers([]);
      if (playersCard) playersCard.style.display = "none";
    }

    updateStartButton();
  }

  function getDefaultRoomUsername() {
    if (window.BunkerAuth && typeof window.BunkerAuth.getCurrentUser === "function") {
      const user = window.BunkerAuth.getCurrentUser();
      if (user && user.username) return user.username;
    }
    return "";
  }

  async function createRoomFromUi() {
    const usernameInput = document.getElementById("room-username-input");
    if (!usernameInput || !window.BunkerRooms) return;

    const username = (usernameInput.value || "").trim() || getDefaultRoomUsername();
    if (!username) {
      showNotification("Введите имя для онлайн-комнаты", "warning");
      return;
    }

    try {
      await window.BunkerRooms.createRoom(username);
      showNotification("Комната создана", "success");
      renderRoomState();
    } catch (err) {
      showNotification(err.message || "Не удалось создать комнату", "error");
    }
  }

  async function joinRoomFromUi() {
    const codeInput = document.getElementById("room-code-input");
    const usernameInput = document.getElementById("room-username-input");
    if (!codeInput || !usernameInput || !window.BunkerRooms) return;

    const roomCode = (codeInput.value || "").trim().toUpperCase();
    const username = (usernameInput.value || "").trim() || getDefaultRoomUsername();
    if (!username) {
      showNotification("Введите имя для онлайн-комнаты", "warning");
      return;
    }

    try {
      await window.BunkerRooms.joinRoom(roomCode, username);
      showNotification("Подключение к комнате выполнено", "success");
      renderRoomState();
    } catch (err) {
      showNotification(err.message || "Не удалось войти в комнату", "error");
    }
  }

  async function leaveRoomFromUi() {
    if (!window.BunkerRooms) return;
    try {
      await window.BunkerRooms.leaveRoom();
      showNotification("Вы вышли из комнаты", "info");
      renderRoomState();
    } catch (err) {
      showNotification(err.message || "Не удалось выйти из комнаты", "error");
    }
  }

  function bindRoomEvents() {
    if (roomUiReady || !window.BunkerRooms) return;
    roomUiReady = true;

    window.BunkerRooms.init({
      onRoomUpdate: (payload) => {
        // В setup состояние игроков полностью приходит с сервера комнаты.
        if (state.phase === "setup") {
          setPlayerNames(payload.players || []);
        }

        // Если игра уже запущена у хоста, применяем удалённый снимок фазы.
        if (payload.game) {
          applyRemoteGameState(payload.game);
          refreshPrivateModalIfOpen();
        } else if (isConnectedRoom() && state.phase !== "setup") {
          applyRemoteLobbyState(payload.players || []);
        }
        renderRoomState();
      },
      onError: (message) => {
        showNotification(message || "Ошибка комнаты", "warning");
      },
      onDisconnected: () => {
        if (state.phase === "setup") {
          setPlayerNames([]);
        }
        renderRoomState();
      },
    });

    const roomUsernameInput = document.getElementById("room-username-input");
    if (roomUsernameInput && !roomUsernameInput.value) {
      roomUsernameInput.value = getDefaultRoomUsername();
    }

    document.getElementById("btn-room-create")?.addEventListener("click", createRoomFromUi);
    document.getElementById("btn-room-join")?.addEventListener("click", joinRoomFromUi);
    document.getElementById("btn-room-leave")?.addEventListener("click", leaveRoomFromUi);

    document.getElementById("room-code-input")?.addEventListener("input", (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    });

    document.getElementById("room-code-input")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") joinRoomFromUi();
    });
  }

  function applyRemoteGameState(game) {
    if (!game || typeof game !== "object") return;

    const prevPhase = state.phase;
    const prevRound = state.round;
    const prevSelectedIndex = state.currentPlayerIndex;
    const room = getRoomState();
    const isOnline = Boolean(room.connected);

    const players = Array.isArray(game.players) ? game.players : [];
    const catastrophe = game.catastrophe || null;
    const bunkerCapacity = Number(game.bunkerCapacity || 0);
    const round = Number(game.round || 1);
    const remotePhase = String(game.phase || "setup");

    if (players.length < 2 || !catastrophe || !bunkerCapacity) {
      return;
    }

    // Полностью гидратируем локальный state снимком от сервера, чтобы не копить рассинхрон.
    state.players = players;
    state.catastrophe = catastrophe;
    state.bunkerCapacity = bunkerCapacity;
    state.survivorCount = bunkerCapacity;
    state.round = round;
    state.eliminatedPlayers = [];
    state.votingResults = {};
    state.roundPlayedPlayers = {};
    state.turnRevealed = false;
    state.tieCandidates = [];
    state.phase = remotePhase;
    if (!isOnline) {
      state.currentPlayerIndex = Number(game.currentPlayerIndex || 0);
    }
    state.roundPlayedPlayers = game.roundPlayedPlayers || {};
    state.turnRevealed = Boolean(game.turnRevealed);
    state.tieCandidates = Array.isArray(game.tieCandidates) ? game.tieCandidates : [];
    state.votingResults = game.voteCounts || {};
    state._voterChoices = game.voterChoices || {};
    state._revealsThisRound = game.revealsThisRound || {};
    state.eliminatedPlayers = Array.isArray(game.eliminatedPlayers)
      ? game.eliminatedPlayers
      : state.players.filter((p) => p.isEliminated);

    if (remotePhase === "catastrophe") {
      if (prevPhase !== "catastrophe") {
        showNotification("Хост начал игру. Переход к катастрофе...", "info");
      }
      showCatastropheScreen();
      return;
    }

    if (remotePhase === "game") {
      if (isOnline) {
        const enteredNewRound = prevPhase !== "game" || round !== prevRound;
        const selfIdx = state.players.findIndex((p) => p.playerName === room.username && !p.isEliminated);

        if (enteredNewRound) {
          // На старте нового раунда фокусируем карточку текущего пользователя.
          state.currentPlayerIndex = selfIdx;
        } else {
          // Во время polling сохраняем выбранную карточку, если она всё ещё валидна.
          const stillValid = Number.isInteger(prevSelectedIndex)
            && prevSelectedIndex >= 0
            && prevSelectedIndex < state.players.length
            && !state.players[prevSelectedIndex]?.isEliminated;

          if (stillValid) {
            state.currentPlayerIndex = prevSelectedIndex;
          } else {
            state.currentPlayerIndex = selfIdx;
          }
        }
      }

      showScreen("screen-game");
      renderGameOverview();

      const selectedIdx = state.currentPlayerIndex;
      const selectedValid = Number.isInteger(selectedIdx)
        && selectedIdx >= 0
        && selectedIdx < state.players.length
        && !state.players[selectedIdx]?.isEliminated;

      if (selectedValid) {
        renderPlayerCard(state.players[selectedIdx], selectedIdx);
      } else {
        const cardDiv = document.getElementById("current-player-card");
        if (cardDiv) {
          cardDiv.innerHTML = `
            <p style="color:var(--text-muted); text-align:center; padding:2rem;">
              Выберите игрока слева
            </p>
          `;
        }
      }
      return;
    }

    if (remotePhase === "voting") {
      showScreen("screen-voting");
      renderVoting();
      return;
    }

    if (remotePhase === "results") {
      showScreen("screen-results");
      renderResults(state.players.filter((p) => !p.isEliminated));
    }
  }

  function applyRemoteLobbyState(roomPlayers) {
    state = Utils.createInitialState(roomPlayers);
    initSetup();
    showNotification("Хост начал новую игру", "info");
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

    // Вместимость бункера: ceil(половина игроков), но при 3 игроках только 1 место.
    const capacity = names.length === 3 ? 1 : Math.ceil(names.length / 2);
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

    const room = getRoomState();
    if (room.connected && room.isHost && window.BunkerRooms?.startGameSession) {
      window.BunkerRooms.startGameSession({
        phase: "catastrophe",
        startedAt: Date.now(),
        bunkerCapacity: state.bunkerCapacity,
        round: state.round,
        catastrophe: state.catastrophe,
        players: state.players,
      }).catch((err) => {
        showNotification(err.message || "Не удалось синхронизировать старт игры", "warning");
      });
    }

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

    const proceedBtn = document.getElementById("btn-proceed-game");
    if (proceedBtn) {
      const room = getRoomState();
      proceedBtn.disabled = Boolean(room.connected && !room.isHost);
    }
  }

  // ---- Game Phase (Card Reveal) ----
  function startGamePhase() {
    if (isConnectedRoom()) {
      window.BunkerRooms?.gameAction("proceedGame", {}).catch((err) => {
        showNotification(err.message || "Не удалось перейти к фазе игры", "warning");
      });
      return;
    }

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
        <span class="mini-avatar">${Utils.getAvatarEmoji(i)}</span>
        <span class="mini-name">${Utils.escapeHtml(player.playerName)}</span>
        ${player.isEliminated ? '<span class="mini-status eliminated-badge">Выбыл</span>' : ""}
      `;
      div.addEventListener("click", () => {
        if (player.isEliminated) return;
        if (state.phase !== "game") return;
        if (!isConnectedRoom() && i !== state.currentPlayerIndex) {
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

  function canRevealKey(key) {
    return Utils.canRevealKey(state.round, key);
  }

  function getPlayerAttributes(player) {
    return Utils.getPlayerAttributes(player);
  }

  function hasRevealableAttributes(player) {
    return Utils.hasRevealableAttributes(player, state.round);
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
    const room = getRoomState();
    const isOnline = Boolean(room.connected);
    const isSelfPlayer = isOnline ? player.playerName === room.username : playerIndex === state.currentPlayerIndex;
    const alreadyPlayedThisRound = isOnline && Boolean(state.roundPlayedPlayers && state.roundPlayedPlayers[String(playerIndex)]);

    const attrs = getPlayerAttributes(player);

    const revealedCount = Object.values(player.revealed).filter(Boolean).length;
    const totalAttrs = attrs.length;

    cardDiv.innerHTML = `
      <div class="player-card-header">
        <div class="player-card-avatar">${Utils.getAvatarEmoji(playerIndex)}</div>
        <div class="player-card-info">
          <h2 class="player-card-name">${Utils.escapeHtml(player.playerName)}</h2>
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
        ${isSelfPlayer ? `<button class="btn btn-secondary" id="btn-private-view">Мои карты (приватно)</button>` : ""}
        ${isSelfPlayer && state.phase === "game" && !alreadyPlayedThisRound ? `<button class="btn btn-primary" id="btn-next-player-card" ${isOnline ? "" : (state.turnRevealed ? "" : "disabled")}>Завершить ход</button>` : ""}
      </div>
    `;

    // Attach action button handlers without inline onclick
    if (isSelfPlayer) {
      cardDiv.querySelector("#btn-private-view")?.addEventListener("click", () => openPrivateView(playerIndex));
      cardDiv.querySelector("#btn-next-player-card")?.addEventListener("click", nextPlayer);
    }
  }

  function openPrivateView(playerIndex) {
    if (state.phase !== "game") return;
    if (!isConnectedRoom() && playerIndex !== state.currentPlayerIndex) {
      showNotification("Сейчас ход другого игрока", "warning");
      return;
    }

    const player = state.players[playerIndex];
    if (isConnectedRoom()) {
      const room = getRoomState();
      if (player.playerName !== room.username) {
        showNotification("Можно смотреть только свою приватную карточку", "warning");
        return;
      }
      if (state.roundPlayedPlayers && state.roundPlayedPlayers[String(playerIndex)]) {
        showNotification("Ваш ход в этом раунде уже завершен", "info");
      }
    }

    const attrs = getPlayerAttributes(player);
    const modal = document.getElementById("private-player-modal");
    const nameEl = document.getElementById("private-player-name");
    const noteEl = document.getElementById("private-round-note");
    const attrsEl = document.getElementById("private-attrs");

    if (!modal || !nameEl || !noteEl || !attrsEl) return;

    privateModalPlayerIndex = playerIndex;

    nameEl.textContent = player.playerName;
    noteEl.textContent = state.round === 1
      ? "В 1-м раунде для раскрытия доступна только Профессия."
      : "Выберите 1 атрибут, который раскроете всем игрокам в этом раунде.";

    // В онлайн-режиме лимит раскрытий берём из серверного флага, офлайн — из локального.
    const revealedThisRound = isConnectedRoom()
      ? Boolean(state._revealsThisRound && state._revealsThisRound[String(playerIndex)])
      : state.turnRevealed;

    attrsEl.innerHTML = attrs.map((attr) => {
      const isRevealed = player.revealed[attr.key];
      const canReveal = !isRevealed
        && !revealedThisRound
        && canRevealKey(attr.key)
        && (isConnectedRoom() ? true : playerIndex === state.currentPlayerIndex);
      const blockedByRound = !isRevealed && !canRevealKey(attr.key);

      return `
        <div class="private-attr">
          <div class="private-attr-head">
            <span>${attr.icon}</span>
            <strong>${attr.label}</strong>
          </div>
          <div class="private-attr-value">${Utils.escapeHtml(attr.value)}</div>
          ${attr.desc ? `<div class="private-attr-desc">${Utils.escapeHtml(attr.desc)}</div>` : ""}
          <div class="private-attr-actions">
            <button class="btn btn-primary btn-reveal-choice" data-key="${attr.key}" ${canReveal ? "" : "disabled"}>
              Раскрыть всем
            </button>
            <span class="private-state">${isRevealed ? "Уже раскрыто" : blockedByRound ? "Недоступно в этом раунде" : revealedThisRound ? "Лимит раскрытия исчерпан" : "Скрыто"}</span>
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
    privateModalPlayerIndex = null;
    document.getElementById("private-player-modal")?.classList.remove("open");
  }

  function refreshPrivateModalIfOpen() {
    const modal = document.getElementById("private-player-modal");
    if (!modal || !modal.classList.contains("open")) return;
    if (privateModalPlayerIndex === null) return;
    if (!state.players[privateModalPlayerIndex] || state.players[privateModalPlayerIndex].isEliminated) {
      closePrivateView();
      return;
    }
    openPrivateView(privateModalPlayerIndex);
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

  async function revealFromPrivate(playerIndex, key) {
    const player = state.players[playerIndex];
    if (!player || player.isEliminated) return;
    if (!isConnectedRoom() && playerIndex !== state.currentPlayerIndex) return;
    if (!isConnectedRoom() && state.turnRevealed) return;
    if (!canRevealKey(key)) {
      showNotification("Этот атрибут нельзя раскрыть в текущем раунде", "warning");
      return;
    }
    if (player.revealed[key]) {
      showNotification("Атрибут уже раскрыт", "info");
      return;
    }

    if (isConnectedRoom()) {
      try {
        // Решение о валидности раскрытия принимает сервер (фаза, лимиты, очередь хода).
        await window.BunkerRooms.gameAction("revealAttribute", { key });
        refreshPrivateModalIfOpen();
      } catch (err) {
        showNotification(err.message || "Не удалось раскрыть атрибут", "warning");
      }
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
          <div class="attr-value">${Utils.escapeHtml(attr.value)}</div>
          ${attr.desc ? `<div class="attr-desc">${Utils.escapeHtml(attr.desc)}</div>` : ""}
        </div>
      `;
    } else {
      return `
        <div class="attribute-card hidden" data-key="${attr.key}" title="Нажмите, чтобы раскрыть">
          <div class="attr-icon">?</div>
          <div class="attr-label">${attr.label}</div>
          <div class="attr-value">???</div>
        </div>
      `;
    }
  }

  async function nextPlayer() {
    if (isConnectedRoom()) {
      try {
        await window.BunkerRooms.gameAction("nextPlayer", {});
      } catch (err) {
        showNotification(err.message || "Не удалось завершить ход", "warning");
      }
      return;
    }

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

    const room = getRoomState();
    const isOnline = Boolean(room.connected);
    // В онлайне 1 клиент = 1 голос за раунд, повторное голосование блокируем по clientId.
    const hasVotedOnline = isOnline && Boolean(state._voterChoices && state._voterChoices[room.clientId]);

    votingPool.forEach((player, i) => {
      const idx = state.players.indexOf(player);
      const voteCount = state.votingResults[player.playerName] || 0;
      const div = document.createElement("div");
      div.className = "voting-player-card";
      div.id = `vote-card-${idx}`;
      div.innerHTML = `
        <div class="voting-avatar">${Utils.getAvatarEmoji(idx)}</div>
        <div class="voting-name">${Utils.escapeHtml(player.playerName)}</div>
        <div class="voting-profession">${player.revealed.profession ? Utils.escapeHtml(player.profession.name) : "???"}</div>
        <div class="vote-count" id="vote-count-${idx}">${voteCount} голос(ов)</div>
        <button class="btn btn-secondary btn-vote-view-card">
          Посмотреть карточку
        </button>
        <button class="btn btn-vote" ${hasVotedOnline ? "disabled" : ""}>
          Голосовать за выбывание
        </button>
      `;
      div.querySelector(".btn-vote-view-card")?.addEventListener("click", () => openVotingPlayerCard(idx));
      div.querySelector(".btn-vote").addEventListener("click", () => castVote(player.playerName, idx));
      container.appendChild(div);
    });

    // Update vote submit button
    const confirmBtn = document.getElementById("btn-confirm-votes");
    if (confirmBtn) {
      if (isOnline) {
        confirmBtn.disabled = true;
        confirmBtn.style.display = "none";
      } else {
        confirmBtn.style.display = "inline-flex";
        confirmBtn.disabled = Object.keys(state.votingResults).length === 0;
      }
    }
  }

  async function castVote(playerName, playerIndex) {
    if (isConnectedRoom()) {
      try {
        // Отправляем только цель голоса; сервер сам обновляет агрегированные счётчики.
        await window.BunkerRooms.gameAction("castVote", { targetName: playerName });
        showNotification(`Ваш голос за ${playerName} принят`, "info");
      } catch (err) {
        showNotification(err.message || "Не удалось проголосовать", "warning");
      }
      return;
    }

    // Simple voting: click = add vote
    if (!state.votingResults[playerName]) state.votingResults[playerName] = 0;
    state.votingResults[playerName]++;

    const countEl = document.getElementById(`vote-count-${playerIndex}`);
    if (countEl) countEl.textContent = `${state.votingResults[playerName]} голос(ов)`;

    document.getElementById("btn-confirm-votes").disabled = false;
    showNotification(`Голос за ${playerName} засчитан!`, "info");
  }

  function confirmVotes() {
    if (isConnectedRoom()) {
      showNotification("В онлайн-режиме итоги считаются автоматически", "info");
      return;
    }

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
        <div class="result-avatar">${Utils.getAvatarEmoji(idx)}</div>
        <div class="result-info">
          <div class="result-name">${Utils.escapeHtml(player.playerName)}</div>
          <div class="result-profession">${Utils.escapeHtml(player.profession.name)}</div>
          <div class="result-attrs">
            <span>Здоровье: ${Utils.escapeHtml(player.health.name)}</span>
            <span>Хобби: ${Utils.escapeHtml(player.hobby.name)}</span>
            <span>Багаж: ${Utils.escapeHtml(player.luggage.name)}</span>
          </div>
        </div>
        <div class="result-badge">В бункере</div>
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
        <div class="result-avatar dim">${Utils.getAvatarEmoji(idx)}</div>
        <div class="result-info">
          <div class="result-name">${Utils.escapeHtml(player.playerName)}</div>
          <div class="result-profession">${Utils.escapeHtml(player.profession.name)}</div>
        </div>
        <div class="result-badge-out">Не попал</div>
      `;
      eliminatedContainer.appendChild(div);
    });
  }

  async function restartGame() {
    const room = getRoomState();

    if (room.connected) {
      if (!room.isHost) {
        showNotification("Только хост может начать новую игру", "warning");
        return;
      }
      try {
        await window.BunkerRooms.gameAction("resetGame", {});
      } catch (err) {
        showNotification(err.message || "Не удалось начать новую игру", "error");
      }
      return;
    }

    state = Utils.createInitialState();
    initSetup();
  }

  async function backToMainMenu() {
    const room = getRoomState();

    if (room.connected && window.BunkerRooms) {
      try {
        await window.BunkerRooms.leaveRoom();
      } catch (err) {
        showNotification(err.message || "Не удалось выйти в главное меню", "error");
      }
      return;
    }

    state = Utils.createInitialState();
    initSetup();
  }

  // ---- Public API ----
  return {
    init() {
      state = Utils.createInitialState();
      initSetup();
      bindRoomEvents();
      renderRoomState();
      // Attach global button handlers
      document.getElementById("btn-add-player")?.addEventListener("click", addPlayer);
      document.getElementById("player-name-input")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") addPlayer();
      });
      document.getElementById("btn-start-game")?.addEventListener("click", startGame);
      document.getElementById("btn-proceed-game")?.addEventListener("click", startGamePhase);
      document.getElementById("btn-confirm-votes")?.addEventListener("click", confirmVotes);
      document.getElementById("btn-restart")?.addEventListener("click", restartGame);
      document.getElementById("btn-back-menu")?.addEventListener("click", backToMainMenu);

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
