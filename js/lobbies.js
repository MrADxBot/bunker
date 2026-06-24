// ==================== LOBBIES PAGE (lobbies.js) ====================

const ROOMS_API = "api/rooms.php";
const USERS_API = "api/users.php";

let roomsList = [];
let currentUser = null;

const $ = (id) => document.getElementById(id);

function showNotification(msg, type = "info") {
  const notif = $("notification");
  if (!notif) return;
  notif.textContent = msg;
  notif.className = `notification ${type} show`;
  clearTimeout(notif._timeout);
  notif._timeout = setTimeout(() => notif.classList.remove("show"), 3000);
}

function updateProfileUI() {
  const usernameSpan = $("profileUsername");
  if (currentUser && currentUser.username) {
    usernameSpan.textContent = currentUser.username;
  } else {
    usernameSpan.textContent = "Гость";
  }
}

// Загрузка комнат с сервера
async function loadRooms() {
  const tbody = $("roomsTableBody");
  tbody.innerHTML = '<tr class="empty-rooms"><td colspan="5">Загрузка комнат...</td></tr>';

  try {
    const response = await fetch(ROOMS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list" }),
    });

    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Ошибка загрузки");

    roomsList = Array.isArray(data.rooms) ? data.rooms : [];
    renderRoomsTable();
  } catch (error) {
    console.error(error);
    tbody.innerHTML = `<tr class="empty-rooms"><td colspan="5">Ошибка: ${error.message}</td></tr>`;
  }
}

function renderRoomsTable() {
  const tbody = $("roomsTableBody");
  if (!roomsList.length) {
    tbody.innerHTML = '<tr class="empty-rooms"><td colspan="5">Нет открытых комнат. Создайте свою!</td></tr>';
    return;
  }

  tbody.innerHTML = roomsList.map(room => {
    // Определяем отображение приватности
    const isPrivate = room.private || false;
    const privacyHtml = isPrivate
      ? '<span class="badge-private yes">Да (приватная)</span>'
      : '<span class="badge-private no">Нет</span>';

    // Режим игры
    const gameMode = room.gameMode || "classic";
    const modeLabel = gameMode === "classic" ? "Классический" : "Не классика";
    const modeHtml = `<span class="game-mode-badge">${modeLabel}</span>`;

    // Заполненность
    const membersCount = room.membersCount || 0;
    const capacity = room.capacity || 5;
    const fullness = `${membersCount}/${capacity}`;

    // Кнопка входа (блокируем если игра уже началась)
    const joinDisabled = room.started === true || membersCount >= capacity;
    const joinBtnHtml = joinDisabled
      ? `<button class="btn btn-secondary room-join-btn" disabled>Недоступно</button>`
      : `<button class="btn btn-primary room-join-btn" data-room-code="${room.code}" data-room-private="${isPrivate}">Войти</button>`;

    return `
      <tr>
        <td class="room-name-cell">${escapeHtml(room.code)}</td>
        <td>${privacyHtml}</td>
        <td>${modeHtml}</td>
        <td>${fullness}</td>
        <td>${joinBtnHtml}</td>
      </tr>
    `;
  }).join("");

  // Навешиваем обработчики на кнопки "Войти"
  document.querySelectorAll(".room-join-btn[data-room-code]").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const roomCode = btn.dataset.roomCode;
      const isPrivate = btn.dataset.roomPrivate === "true";
      await handleJoinRoom(roomCode, isPrivate);
    });
  });
}

async function handleJoinRoom(roomCode, isPrivate) {
  // Проверяем авторизацию через BunkerAuth
  if (!window.BunkerAuth || !window.BunkerAuth.isAuthenticated()) {
    showNotification("Пожалуйста, войдите в аккаунт", "warning");
    window.BunkerAuth?.openAuthOverlay?.();
    return;
  }

  const user = window.BunkerAuth.getCurrentUser();
  const username = user?.username;

  if (!username) {
    showNotification("Не удалось определить имя пользователя", "error");
    return;
  }

  if (isPrivate) {
    // Показываем модалку для ввода пароля
    $("privateRoomCode").value = roomCode;
    $("privateUsername").value = username;
    $("privateJoinModal").classList.add("open");
  } else {
    // Прямой вход
    await joinRoom(roomCode, username);
  }
}

async function joinRoom(roomCode, username, password = null) {
  try {
    const payload = {
      action: "join",
      roomCode: roomCode,
      username: username,
    };
    if (password) {
      payload.password = password;
    }

    const response = await fetch(ROOMS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.error || "Не удалось войти в комнату");
    }

    showNotification(`Вход в комнату ${roomCode} выполнен!`, "success");
    // Перенаправляем в комнату
    window.location.href = `room.html?room=${roomCode}&name=${encodeURIComponent(username)}`;
  } catch (error) {
    showNotification(error.message, "error");
  }
}

async function createRoom(username, gameMode, isPrivate, password) {
  try {
    const payload = {
      action: "create",
      username: username,
      gameMode: gameMode,
      private: isPrivate,
    };
    if (isPrivate && password) {
      payload.password = password;
    }

    const response = await fetch(ROOMS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.error || "Не удалось создать комнату");
    }

    showNotification(`Комната ${data.roomCode} создана!`, "success");
    window.location.href = `room.html?room=${data.roomCode}&name=${encodeURIComponent(username)}`;
  } catch (error) {
    showNotification(error.message, "error");
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Выпадающее меню профиля
function initProfileDropdown() {
  const profileBtn = $("profileBtn");
  const dropdown = $("dropdownMenu");

  profileBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("show");
  });

  document.addEventListener("click", () => {
    dropdown.classList.remove("show");
  });

  $("logoutBtn")?.addEventListener("click", () => {
    if (window.BunkerAuth) {
      window.BunkerAuth.logout();
      currentUser = null;
      updateProfileUI();
      showNotification("Вы вышли из аккаунта", "info");
      loadRooms(); // Перезагружаем комнаты
    }
  });
}

// Модалка создания комнаты
function initCreateModal() {
  const modal = $("createRoomModal");
  const createBtn = $("createRoomBtn");
  const closeBtn = $("closeCreateModal");
  const cancelBtn = $("cancelCreateBtn");
  const isPrivateCheckbox = $("isPrivateCheckbox");
  const passwordField = $("passwordField");

  createBtn?.addEventListener("click", () => {
    // Проверяем авторизацию
    if (!window.BunkerAuth || !window.BunkerAuth.isAuthenticated()) {
      showNotification("Для создания комнаты нужно войти в аккаунт", "warning");
      window.BunkerAuth?.openAuthOverlay?.();
      return;
    }
    const user = window.BunkerAuth.getCurrentUser();
    if (user?.username) {
      $("createUsername").value = user.username;
    }
    modal.classList.add("open");
  });

  closeBtn?.addEventListener("click", () => modal.classList.remove("open"));
  cancelBtn?.addEventListener("click", () => modal.classList.remove("open"));

  isPrivateCheckbox?.addEventListener("change", (e) => {
    if (e.target.checked) {
      passwordField.classList.add("show");
    } else {
      passwordField.classList.remove("show");
    }
  });

  $("createRoomForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = $("createUsername").value.trim();
    const gameMode = $("gameMode").value;
    const isPrivate = $("isPrivateCheckbox").checked;
    const password = $("roomPassword").value.trim();

    if (!username) {
      showNotification("Введите имя", "warning");
      return;
    }

    modal.classList.remove("open");
    await createRoom(username, gameMode, isPrivate, isPrivate ? password : null);
  });
}

// Модалка входа в приватную комнату
function initPrivateJoinModal() {
  const modal = $("privateJoinModal");
  const closeBtn = $("closePrivateModal");
  const cancelBtn = $("cancelPrivateBtn");

  closeBtn?.addEventListener("click", () => modal.classList.remove("open"));
  cancelBtn?.addEventListener("click", () => modal.classList.remove("open"));

  $("privateJoinForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const roomCode = $("privateRoomCode").value.trim().toUpperCase();
    const password = $("privatePassword").value.trim();
    const username = $("privateUsername").value.trim();

    if (!roomCode || !password || !username) {
      showNotification("Заполните все поля", "warning");
      return;
    }

    modal.classList.remove("open");
    await joinRoom(roomCode, username, password);
  });
}

// Обновление текущего пользователя через BunkerAuth
function updateCurrentUser() {
  if (window.BunkerAuth) {
    currentUser = window.BunkerAuth.getCurrentUser();
    updateProfileUI();
  }
}

// Инициализация
document.addEventListener("DOMContentLoaded", async () => {
  // Инициализируем BunkerAuth
  if (window.BunkerAuth && typeof window.BunkerAuth.init === "function") {
    window.BunkerAuth.init(() => {
      updateCurrentUser();
      loadRooms();
    }, { openOnUnauth: false });
  }

  updateCurrentUser();
  initProfileDropdown();
  initCreateModal();
  initPrivateJoinModal();

  $("refreshBtn")?.addEventListener("click", loadRooms);
  $("backBtn")?.addEventListener("click", () => {
    window.location.href = "main.html";
  });

  // Закрытие модалок по клику на оверлей
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("open");
      }
    });
  });

  await loadRooms();
});