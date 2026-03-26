// ==================== PROFILE PAGE ====================

(() => {
  const ROLE_PERMISSIONS = {
    player: [
      "Участие в партии и голосовании",
      "Просмотр личных данных профиля",
    ],
    host: [
      "Все права Игрока",
      "Организация и ведение игровой сессии",
    ],
    admin: [
      "Все права Ведущего",
      "Расширенный доступ к настройкам аккаунта",
    ],
  };

  const $ = (id) => document.getElementById(id);

  function formatDate(isoDate) {
    if (!isoDate) return "-";
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("ru-RU");
  }

  function renderProfile() {
    const user = window.BunkerAuth?.getCurrentUser?.();
    const profileBlock = $("profile-content");
    const guestBlock = $("profile-guest");
    const adminPanel = $("admin-panel");

    if (!profileBlock || !guestBlock || !adminPanel) return;

    if (!user) {
      profileBlock.style.display = "none";
      guestBlock.style.display = "block";
      adminPanel.style.display = "none";
      return;
    }

    profileBlock.style.display = "grid";
    guestBlock.style.display = "none";

    $("profile-username").textContent = user.username || "-";
    $("profile-role").textContent = window.BunkerAuth.roleLabels[user.role] || user.role || "-";
    $("profile-created").textContent = formatDate(user.createdAt);

    const permissions = ROLE_PERMISSIONS[user.role] || ROLE_PERMISSIONS.player;
    const list = $("profile-permissions");
    if (list) {
      list.innerHTML = permissions.map((item) => `<li>${item}</li>`).join("");
    }

    if (window.BunkerAuth?.isAdmin?.()) {
      adminPanel.style.display = "block";
      renderAdminUsersTable(user.username);
    } else {
      adminPanel.style.display = "none";
    }
  }

  function renderAdminUsersTable(currentUsername) {
    const tbody = $("admin-users-body");
    const users = window.BunkerAuth?.listUsers?.() || [];
    if (!tbody) return;

    tbody.innerHTML = users.map((user) => {
      const roleOptions = Object.entries(window.BunkerAuth.roleLabels)
        .map(([value, label]) => `<option value="${value}" ${user.role === value ? "selected" : ""}>${label}</option>`)
        .join("");

      const canDelete = user.username !== currentUsername;

      return `
        <tr>
          <td>${user.username}</td>
          <td>
            <select class="admin-role-select" data-username="${user.username}">
              ${roleOptions}
            </select>
          </td>
          <td>${formatDate(user.createdAt)}</td>
          <td>
            <button class="btn btn-secondary btn-admin-save" data-username="${user.username}">Сохранить</button>
            <button class="btn btn-danger btn-admin-delete" data-username="${user.username}" ${canDelete ? "" : "disabled"}>Удалить</button>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll(".btn-admin-save").forEach((btn) => {
      btn.addEventListener("click", () => {
        const username = btn.dataset.username;
        const select = tbody.querySelector(`.admin-role-select[data-username=\"${username}\"]`);
        const role = select?.value;
        if (!username || !role) return;
        const ok = window.BunkerAuth?.updateUserRole?.(username, role);
        if (ok) renderProfile();
      });
    });

    tbody.querySelectorAll(".btn-admin-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        const username = btn.dataset.username;
        if (!username) return;
        const confirmed = window.confirm(`Удалить пользователя ${username}?`);
        if (!confirmed) return;
        const ok = window.BunkerAuth?.deleteUser?.(username);
        if (ok) renderProfile();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (window.BunkerAuth && typeof window.BunkerAuth.init === "function") {
      window.BunkerAuth.init(renderProfile, { openOnUnauth: false });
    }

    $("btn-open-auth")?.addEventListener("click", () => {
      window.BunkerAuth?.openAuthOverlay?.();
    });

    renderProfile();
  });
})();
