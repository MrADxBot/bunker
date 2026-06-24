// ==================== ONLINE ROOMS MODULE ====================

const BunkerRooms = (() => {
  const API_URL = "api/rooms.php";
  const POLL_INTERVAL_MS = 2000;

  const state = {
    connected: false,
    roomCode: "",
    clientId: "",
    username: "",
    roomVersion: 0,
    members: [],
    players: [],
    game: null,
    isHost: false,
    pollTimer: null,
    callbacks: {
      onRoomUpdate: null,
      onError: null,
      onConnected: null,
      onDisconnected: null,
    },
  };

  function notifyError(message) {
    if (typeof state.callbacks.onError === "function") {
      state.callbacks.onError(message);
    }
  }

  async function request(payload) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      throw new Error("Сервер вернул некорректный ответ");
    }

    if (!res.ok || !data.ok) {
      const serverMsg = data && data.error ? data.error : "Ошибка запроса";
      const err = new Error(serverMsg);
      err.data = data;
      throw err;
    }

    return data;
  }

  function normalizeRoom(room) {
    return {
      code: String(room.code || ""),
      version: Number(room.version || 0),
      players: Array.isArray(room.players) ? room.players.slice() : [],
      members: Array.isArray(room.members) ? room.members.slice() : [],
      game: room.game && typeof room.game === "object" ? room.game : null,
    };
  }

  function applyRoom(room) {
    const normalized = normalizeRoom(room || {});
    state.roomCode = normalized.code;
    state.roomVersion = normalized.version;
    state.players = normalized.players;
    state.members = normalized.members;
    state.game = normalized.game;

    const me = state.members.find((m) => m.clientId === state.clientId);
    state.isHost = Boolean(me && me.isHost);

    if (typeof state.callbacks.onRoomUpdate === "function") {
      state.callbacks.onRoomUpdate({
        roomCode: state.roomCode,
        roomVersion: state.roomVersion,
        players: state.players.slice(),
        members: state.members.slice(),
        game: state.game,
        isHost: state.isHost,
        username: state.username,
      });
    }
  }

  function clearPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  function resetState() {
    clearPolling();
    state.connected = false;
    state.roomCode = "";
    state.clientId = "";
    state.username = "";
    state.roomVersion = 0;
    state.members = [];
    state.players = [];
    state.game = null;
    state.isHost = false;
  }

  function startPolling() {
    clearPolling();
    state.pollTimer = setInterval(async () => {
      if (!state.connected) return;
      try {
        const data = await request({
          action: "poll",
          roomCode: state.roomCode,
          clientId: state.clientId,
        });
        applyRoom(data.room);
      } catch (err) {
        clearPolling();
        const message = err instanceof Error ? err.message : "Ошибка синхронизации комнаты";
        notifyError(message);
        if (message.includes("не состоит")) {
          disconnectLocal(false);
        }
      }
    }, POLL_INTERVAL_MS);
  }

  function disconnectLocal(callCallback = true) {
    resetState();
    if (callCallback && typeof state.callbacks.onDisconnected === "function") {
      state.callbacks.onDisconnected();
    }
  }

  async function createRoom(username) {
    const name = String(username || "").trim();
    if (!name) throw new Error("Введите имя пользователя");

    const data = await request({ action: "create", username: name });

    state.connected = true;
    state.clientId = data.clientId;
    state.username = name;
    applyRoom(data.room);
    startPolling();

    if (typeof state.callbacks.onConnected === "function") {
      state.callbacks.onConnected();
    }

    return getState();
  }

  async function joinRoom(roomCode, username) {
    const code = String(roomCode || "").trim().toUpperCase();
    const name = String(username || "").trim();

    if (!code) throw new Error("Введите код комнаты");
    if (!name) throw new Error("Введите имя пользователя");

    const data = await request({ action: "join", roomCode: code, username: name });

    state.connected = true;
    state.clientId = data.clientId;
    state.username = data.username || name;
    applyRoom(data.room);
    startPolling();

    if (typeof state.callbacks.onConnected === "function") {
      state.callbacks.onConnected();
    }

    return getState();
  }

  async function leaveRoom() {
    if (!state.connected) return;

    try {
      await request({
        action: "leave",
        roomCode: state.roomCode,
        clientId: state.clientId,
      });
    } finally {
      disconnectLocal(true);
    }
  }

  async function setReady(ready) {
    if (!state.connected) throw new Error("Нет подключения к комнате");

    const data = await request({
      action: "setReady",
      roomCode: state.roomCode,
      clientId: state.clientId,
      ready: Boolean(ready),
    });

    applyRoom(data.room);
    return getState();
  }

  async function updatePlayers(players) {
    if (!state.connected) return null;

    const incoming = Array.isArray(players) ? players.slice() : [];
    const data = await request({
      action: "updatePlayers",
      roomCode: state.roomCode,
      clientId: state.clientId,
      players: incoming,
      baseVersion: state.roomVersion,
    });

    applyRoom(data.room);
    return getState();
  }

  async function startGameSession(game) {
    if (!state.connected) throw new Error("Нет подключения к комнате");

    const data = await request({
      action: "startGame",
      roomCode: state.roomCode,
      clientId: state.clientId,
      game,
    });

    applyRoom(data.room);
    return getState();
  }

  async function gameAction(type, payload = {}) {
    if (!state.connected) throw new Error("Нет подключения к комнате");

    const data = await request({
      action: "gameAction",
      roomCode: state.roomCode,
      clientId: state.clientId,
      type,
      payload,
    });

    applyRoom(data.room);
    return getState();
  }

  function getState() {
    return {
      connected: state.connected,
      roomCode: state.roomCode,
      clientId: state.clientId,
      username: state.username,
      roomVersion: state.roomVersion,
      members: state.members.slice(),
      players: state.players.slice(),
      game: state.game,
      isHost: state.isHost,
    };
  }

  function init(options = {}) {
    state.callbacks.onRoomUpdate = options.onRoomUpdate || null;
    state.callbacks.onError = options.onError || null;
    state.callbacks.onConnected = options.onConnected || null;
    state.callbacks.onDisconnected = options.onDisconnected || null;
  }

  return {
    init,
    createRoom,
    joinRoom,
    leaveRoom,
    updatePlayers,
    setReady,
    startGameSession,
    gameAction,
    getState,
  };
})();

window.BunkerRooms = BunkerRooms;
