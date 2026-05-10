// ==================== AUTH MODULE ====================

const BunkerAuth = (() => {
  const USERS_API = "api/users.php";
  const SESSION_KEY = "bunker_current_user_v1";
  const ROLE_LABELS = {
    player: "Игрок",
    host: "Ведущий",
    admin: "Администратор",
  };

  // Пользователи теперь хранятся на сервере в JSON-файле.
  // В браузере остаётся только короткая сессия: имя текущего пользователя.
  let usersCache = [];
  let usersLoaded = false;

  const $ = (id) => document.getElementById(id);

  function notify(message, type = "info") {
    const notif = $("notification");
    if (!notif) return;
    notif.textContent = message;
    notif.className = `notification ${type} show`;
    clearTimeout(notif._timeout);
    notif._timeout = setTimeout(() => notif.classList.remove("show"), 3000);
  }

  function request(payload) {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", USERS_API, false);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify(payload));

    let data = {};
    try {
      data = JSON.parse(xhr.responseText || "{}");
    } catch {
      console.error(`[BunkerAuth] Ошибка парсинга JSON ответа API:`, xhr.responseText);
      throw new Error("Сервер вернул некорректный ответ");
    }

    if (xhr.status < 200 || xhr.status >= 300 || !data.ok) {
      const errorMsg = data.error || "Ошибка запроса к пользователям";
      console.error(`[BunkerAuth] Ошибка API (статус ${xhr.status}):`, errorMsg, data);
      throw new Error(errorMsg);
    }

    return data;
  }

  function normalizeUsers(users) {
    return Array.isArray(users)
      ? users.map((user) => ({
          username: String(user.username || ""),
          role: String(user.role || "player"),
          createdAt: String(user.createdAt || ""),
        }))
      : [];
  }

  function loadUsers(force = false) {
    if (usersLoaded && !force) {
      return usersCache;
    }

    try {
      const data = request({ action: "list" });
      usersCache = normalizeUsers(data.users);
      usersLoaded = true;
      console.log(`[BunkerAuth] Загружено пользователей: ${usersCache.length}`);
      return usersCache;
    } catch (error) {
      console.error(`[BunkerAuth] Ошибка при загрузке пользователей:`, error);
      usersCache = [];
      usersLoaded = true;
      return usersCache;
    }
  }

  function refreshUsers() {
    return loadUsers(true);
  }

  function getUsers() {
    return loadUsers(false).slice();
  }

  function hashPassword(password) {
    // Это легкая клиентская защита от хранения пароля в открытом виде.
    return btoa(unescape(encodeURIComponent(password)));
  }

  function getCurrentUsername() {
    return localStorage.getItem(SESSION_KEY) || "";
  }

  function setCurrentUser(username) {
    if (username) {
      localStorage.setItem(SESSION_KEY, username);
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  function updateHeaderAuthState() {
    const user = getCurrentUser();
    const status = $("auth-status");
    const loginBtn = $("btn-login");
    const logoutBtn = $("btn-logout");
    if (!status || !logoutBtn) return;

    if (user) {
      const roleText = ROLE_LABELS[user.role] || user.role || "Пользователь";
      status.textContent = `Пользователь: ${user.username} (${roleText})`;
      if (loginBtn) loginBtn.style.display = "none";
      logoutBtn.style.display = "inline-flex";
    } else {
      status.textContent = "Гость";
      if (loginBtn) loginBtn.style.display = "inline-flex";
      logoutBtn.style.display = "none";
    }
  }

  function setAuthView(view = "login") {
    const loginPanel = $("auth-panel-login");
    const registerPanel = $("auth-panel-register");
    if (!loginPanel || !registerPanel) return;

    const showRegister = view === "register";
    loginPanel.style.display = showRegister ? "none" : "block";
    registerPanel.style.display = showRegister ? "block" : "none";
  }

  function openAuthOverlay(view = "login") {
    const overlay = $("auth-overlay");
    setAuthView(view);
    if (overlay) overlay.classList.add("open");
  }

  function closeAuthOverlay() {
    const overlay = $("auth-overlay");
    if (overlay) overlay.classList.remove("open");
  }

  function validateCredentials(username, password) {
    if (!username || !password) {
      notify("Заполните логин и пароль", "warning");
      return false;
    }
    if (username.length < 3) {
      notify("Логин должен быть не короче 3 символов", "warning");
      return false;
    }
    if (password.length < 4) {
      notify("Пароль должен быть не короче 4 символов", "warning");
      return false;
    }
    return true;
  }

  function register(username, password, role = "player") {
    try {
      request({
        action: "register",
        username,
        passwordHash: hashPassword(password),
        role,
      });
      refreshUsers();
      notify("Регистрация успешна. Теперь выполните вход.", "success");
      return true;
    } catch (error) {
      notify(error.message || "Не удалось зарегистрировать пользователя", "warning");
      return false;
    }
  }

  function login(username, password) {
    try {
      const data = request({
        action: "login",
        username,
        passwordHash: hashPassword(password),
      });
      const user = data.user || null;
      if (!user) {
        throw new Error("Пользователь не найден");
      }

      setCurrentUser(user.username);
      refreshUsers();
      updateHeaderAuthState();
      closeAuthOverlay();
      notify(`Добро пожаловать, ${user.username}!`, "success");
      return true;
    } catch (error) {
      notify(error.message || "Не удалось выполнить вход", "error");
      return false;
    }
  }

  function logout() {
    setCurrentUser("");
    updateHeaderAuthState();
    openAuthOverlay();
    notify("Вы вышли из аккаунта", "info");
    if (window.BunkerGame && typeof window.BunkerGame.resetToSetup === "function") {
      window.BunkerGame.resetToSetup();
    }
  }

  function bindEvents(onAuthSuccess) {
    $("register-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const username = $("register-username")?.value.trim() || "";
      const password = $("register-password")?.value || "";
      const role = $("register-role")?.value || "player";

      if (!validateCredentials(username, password)) return;
      register(username, password, role);
      const loginField = $("login-username");
      if (loginField) loginField.value = username;
      setAuthView("login");
    });

    $("login-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const username = $("login-username")?.value.trim() || "";
      const password = $("login-password")?.value || "";

      if (!validateCredentials(username, password)) return;
      const ok = login(username, password);
      if (ok && typeof onAuthSuccess === "function") onAuthSuccess();
    });

    $("btn-logout")?.addEventListener("click", logout);
    $("btn-login")?.addEventListener("click", () => openAuthOverlay("login"));
    $("btn-show-register")?.addEventListener("click", () => setAuthView("register"));
    $("btn-show-login")?.addEventListener("click", () => setAuthView("login"));
    $("btn-auth-close")?.addEventListener("click", closeAuthOverlay);
  }

  function getCurrentUser() {
    const username = getCurrentUsername();
    if (!username) return null;
    const users = getUsers();
    const user = users.find((u) => u.username === username) || null;
    if (!user && username) {
      console.warn(`[BunkerAuth] Пользователь "${username}" не найден в списке`, { username, users });
    }
    return user;
  }

  function isAdmin() {
    const current = getCurrentUser();
    return Boolean(current && current.role === "admin");
  }

  function listUsers() {
    return getUsers().map((u) => ({
      username: u.username,
      role: u.role || "player",
      createdAt: u.createdAt,
    }));
  }

  function updateUserRole(username, newRole) {
    if (!isAdmin()) {
      notify("Недостаточно прав", "error");
      return false;
    }

    if (!ROLE_LABELS[newRole]) {
      notify("Неизвестная роль", "warning");
      return false;
    }

    try {
      request({
        action: "updateRole",
        username,
        newRole,
      });
      refreshUsers();
      updateHeaderAuthState();
      notify(`Роль пользователя ${username} обновлена`, "success");
      return true;
    } catch (error) {
      notify(error.message || "Не удалось обновить роль", "warning");
      return false;
    }
  }

  function deleteUser(username) {
    if (!isAdmin()) {
      notify("Недостаточно прав", "error");
      return false;
    }

    const current = getCurrentUser();
    if (current && current.username === username) {
      notify("Нельзя удалить текущего пользователя", "warning");
      return false;
    }

    try {
      request({
        action: "delete",
        username,
      });
      refreshUsers();
      notify(`Пользователь ${username} удален`, "success");
      return true;
    } catch (error) {
      notify(error.message || "Не удалось удалить пользователя", "warning");
      return false;
    }
  }

  function isAuthenticated() {
    return Boolean(getCurrentUser());
  }

  function requireAuth(onAuthSuccess) {
    if (isAuthenticated()) {
      if (typeof onAuthSuccess === "function") onAuthSuccess();
      return true;
    }
    openAuthOverlay();
    notify("Для этого действия нужно войти в аккаунт", "warning");
    return false;
  }

  function init(onAuthSuccess, options = {}) {
    const { openOnUnauth = false } = options;
    loadUsers();
    updateHeaderAuthState();
    bindEvents(onAuthSuccess);

    if (isAuthenticated()) {
      closeAuthOverlay();
      if (typeof onAuthSuccess === "function") onAuthSuccess();
    } else if (openOnUnauth) {
      openAuthOverlay();
    }
  }

  return {
    init,
    logout,
    isAdmin,
    isAuthenticated,
    requireAuth,
    openAuthOverlay,
    listUsers,
    updateUserRole,
    deleteUser,
    getCurrentUser,
    roleLabels: ROLE_LABELS,
  };
})();

window.BunkerAuth = BunkerAuth;
