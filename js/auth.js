// ==================== AUTH MODULE ====================

const BunkerAuth = (() => {
  const USERS_KEY = "bunker_users_v1";
  const SESSION_KEY = "bunker_current_user_v1";
  const ROLE_LABELS = {
    player: "Игрок",
    host: "Ведущий",
    admin: "Администратор",
  };

  const $ = (id) => document.getElementById(id);

  function notify(message, type = "info") {
    const notif = $("notification");
    if (!notif) return;
    notif.textContent = message;
    notif.className = `notification ${type} show`;
    clearTimeout(notif._timeout);
    notif._timeout = setTimeout(() => notif.classList.remove("show"), 3000);
  }

  function getUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
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
    const users = getUsers();
    const exists = users.some((u) => u.username.toLowerCase() === username.toLowerCase());
    if (exists) {
      notify("Такой логин уже существует", "warning");
      return false;
    }

    users.push({
      username,
      passwordHash: hashPassword(password),
      role,
      createdAt: new Date().toISOString(),
    });
    saveUsers(users);
    notify("Регистрация успешна. Теперь выполните вход.", "success");
    return true;
  }

  function login(username, password) {
    const users = getUsers();
    const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
      notify("Пользователь не найден", "error");
      return false;
    }

    if (user.passwordHash !== hashPassword(password)) {
      notify("Неверный пароль", "error");
      return false;
    }

    setCurrentUser(user.username);
    updateHeaderAuthState();
    closeAuthOverlay();
    notify(`Добро пожаловать, ${user.username}!`, "success");
    return true;
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
    return users.find((u) => u.username === username) || null;
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

    const users = getUsers();
    const idx = users.findIndex((u) => u.username === username);
    if (idx === -1) {
      notify("Пользователь не найден", "warning");
      return false;
    }

    users[idx].role = newRole;
    saveUsers(users);
    updateHeaderAuthState();
    notify(`Роль пользователя ${username} обновлена`, "success");
    return true;
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

    const users = getUsers();
    const filtered = users.filter((u) => u.username !== username);
    if (filtered.length === users.length) {
      notify("Пользователь не найден", "warning");
      return false;
    }

    saveUsers(filtered);
    notify(`Пользователь ${username} удален`, "success");
    return true;
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
