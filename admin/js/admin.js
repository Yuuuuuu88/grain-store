const API_BASE = "/api/admin";

const token =
  localStorage.getItem("adminToken") ||
  sessionStorage.getItem("adminToken");

const adminsTableBody =
  document.getElementById("adminsTableBody");

const pageMessage =
  document.getElementById("pageMessage");

const adminModal =
  document.getElementById("adminModal");

const adminForm =
  document.getElementById("adminForm");

const adminIdInput =
  document.getElementById("adminId");

const usernameInput =
  document.getElementById("username");

const displayNameInput =
  document.getElementById("displayName");

const roleInput =
  document.getElementById("role");

const passwordInput =
  document.getElementById("password");

const passwordRequired =
  document.getElementById("passwordRequired");

const passwordHelp =
  document.getElementById("passwordHelp");

const modalTitle =
  document.getElementById("modalTitle");

const modalSubtitle =
  document.getElementById("modalSubtitle");

const modalMessage =
  document.getElementById("modalMessage");

const saveButton =
  document.getElementById("saveButton");

const addAdminButton =
  document.getElementById("addAdminButton");

const closeModalButton =
  document.getElementById("closeModalButton");

const cancelButton =
  document.getElementById("cancelButton");

const logoutButton =
  document.getElementById("logoutButton");

const mobileMenuButton =
  document.getElementById("mobileMenuButton");

const sidebarOverlay =
  document.getElementById("sidebarOverlay");

const adminName =
  document.getElementById("adminName");

const adminRole =
  document.getElementById("adminRole");

const adminAvatar =
  document.getElementById("adminAvatar");

let currentAdmin = null;
let admins = [];
let isEditing = false;

/* =========================================
   基本工具
========================================= */

function redirectToLogin() {
  localStorage.removeItem("adminToken");
  sessionStorage.removeItem("adminToken");

  window.location.href = "/admin/login.html";
}

function getHeaders(includeJson = false) {
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

async function apiRequest(
  url,
  options = {}
) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(
        options.body !== undefined
      ),
      ...(options.headers || {})
    }
  });

  let data = null;

  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (
    response.status === 401 ||
    response.status === 403 &&
      data?.message?.includes("登入")
  ) {
    redirectToLogin();
    return null;
  }

  if (!response.ok) {
    const error = new Error(
      data?.message ||
      data?.error ||
      "操作失敗，請稍後再試。"
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "zh-TW",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }
  ).format(date);
}

function getRoleText(role) {
  if (role === "owner") {
    return "最高管理員";
  }

  if (role === "manager") {
    return "一般管理員";
  }

  return role || "—";
}

function getInitial(name) {
  const value = String(name || "管").trim();

  return value.charAt(0) || "管";
}

/* =========================================
   訊息顯示
========================================= */

function showPageMessage(
  message,
  type = "error"
) {
  pageMessage.textContent = message;
  pageMessage.className =
    `page-message show ${type}`;

  window.clearTimeout(
    showPageMessage.timer
  );

  showPageMessage.timer =
    window.setTimeout(() => {
      hidePageMessage();
    }, 5000);
}

function hidePageMessage() {
  pageMessage.textContent = "";
  pageMessage.className =
    "page-message";
}

function showModalMessage(
  message,
  type = "error"
) {
  modalMessage.textContent = message;
  modalMessage.className =
    `modal-message show ${type}`;
}

function hideModalMessage() {
  modalMessage.textContent = "";
  modalMessage.className =
    "modal-message";
}

/* =========================================
   登入管理員資料
========================================= */

async function loadCurrentAdmin() {
  const data = await apiRequest(
    `${API_BASE}/me`
  );

  if (!data) {
    return;
  }

  currentAdmin =
    data.admin ||
    data.data ||
    data;

  const displayName =
    currentAdmin.display_name ||
    currentAdmin.displayName ||
    currentAdmin.username ||
    "管理員";

  adminName.textContent = displayName;
  adminRole.textContent =
    getRoleText(currentAdmin.role);

  adminAvatar.textContent =
    getInitial(displayName);

  if (currentAdmin.role !== "owner") {
    window.location.href =
      "/admin/dashboard.html";
  }
}

/* =========================================
   管理員列表
========================================= */

async function loadAdmins() {
  adminsTableBody.innerHTML = `
    <tr>
      <td colspan="6" class="empty-row">
        載入中……
      </td>
    </tr>
  `;

  try {
    const data = await apiRequest(
      `${API_BASE}/admins`
    );

    admins = Array.isArray(data)
      ? data
      : data?.admins ||
        data?.data ||
        [];

    renderAdmins();
  } catch (error) {
    admins = [];

    adminsTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-row">
          無法載入管理員資料。
        </td>
      </tr>
    `;

    showPageMessage(error.message);
  }
}

function renderAdmins() {
  if (!admins.length) {
    adminsTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-row">
          目前沒有管理員資料。
        </td>
      </tr>
    `;

    return;
  }

  adminsTableBody.innerHTML =
    admins.map((admin) => {
      const adminId =
        Number(admin.id);

      const currentAdminId =
        Number(currentAdmin?.id);

      const isCurrent =
        adminId === currentAdminId;

      const isActive =
        admin.is_active === true ||
        admin.is_active === "true" ||
        admin.is_active === 1;

      const roleClass =
        admin.role === "owner"
          ? "role-owner"
          : "role-manager";

      const statusClass =
        isActive
          ? "status-active"
          : "status-inactive";

      const statusText =
        isActive ? "啟用中" : "已停用";

      const toggleClass =
        isActive
          ? "disable-button"
          : "enable-button";

      const toggleText =
        isActive ? "停用" : "啟用";

      return `
        <tr>
          <td>
            <span class="username-cell">
              ${escapeHtml(admin.username)}
            </span>

            ${
              isCurrent
                ? `
                  <span class="current-label">
                    目前帳號
                  </span>
                `
                : ""
            }
          </td>

          <td>
            ${escapeHtml(
              admin.display_name || "—"
            )}
          </td>

          <td>
            <span
              class="role-badge ${roleClass}"
            >
              ${escapeHtml(
                getRoleText(admin.role)
              )}
            </span>
          </td>

          <td>
            <span
              class="status-badge ${statusClass}"
            >
              ${statusText}
            </span>
          </td>

          <td>
            ${escapeHtml(
              formatDate(admin.created_at)
            )}
          </td>

          <td>
            <div class="actions">
              <button
                type="button"
                class="table-button edit-button"
                data-action="edit"
                data-id="${adminId}"
              >
                編輯
              </button>

              <button
                type="button"
                class="table-button ${toggleClass}"
                data-action="toggle"
                data-id="${adminId}"
                data-active="${isActive}"
                ${isCurrent ? "disabled" : ""}
                title="${
                  isCurrent
                    ? "不能停用目前登入的帳號"
                    : ""
                }"
              >
                ${toggleText}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
}

/* =========================================
   Modal
========================================= */

function openCreateModal() {
  isEditing = false;

  adminForm.reset();

  adminIdInput.value = "";
  usernameInput.disabled = false;
  passwordInput.required = true;

  roleInput.value = "manager";

  modalTitle.textContent =
    "新增管理員";

  modalSubtitle.textContent =
    "建立新的後台管理員帳號。";

  passwordRequired.classList.remove(
    "hidden"
  );

  passwordHelp.textContent =
    "新增管理員時必須輸入密碼，至少 6 個字元。";

  saveButton.textContent =
    "建立管理員";

  hideModalMessage();
  showModal();

  window.setTimeout(() => {
    usernameInput.focus();
  }, 100);
}

function openEditModal(admin) {
  isEditing = true;

  adminForm.reset();

  adminIdInput.value = admin.id;
  usernameInput.value =
    admin.username || "";

  displayNameInput.value =
    admin.display_name || "";

  roleInput.value =
    admin.role || "manager";

  passwordInput.value = "";
  passwordInput.required = false;

  usernameInput.disabled = true;

  modalTitle.textContent =
    "編輯管理員";

  modalSubtitle.textContent =
    `修改「${admin.username}」的名稱、權限或密碼。`;

  passwordRequired.classList.add(
    "hidden"
  );

  passwordHelp.textContent =
    "不修改密碼時請保持空白；輸入新密碼則至少 6 個字元。";

  saveButton.textContent =
    "儲存修改";

  hideModalMessage();
  showModal();

  window.setTimeout(() => {
    displayNameInput.focus();
  }, 100);
}

function showModal() {
  adminModal.classList.add("show");
  adminModal.setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.classList.add(
    "modal-open"
  );
}

function closeModal() {
  adminModal.classList.remove("show");
  adminModal.setAttribute(
    "aria-hidden",
    "true"
  );

  document.body.classList.remove(
    "modal-open"
  );

  adminForm.reset();
  adminIdInput.value = "";
  usernameInput.disabled = false;

  hideModalMessage();

  isEditing = false;
}

/* =========================================
   新增與編輯
========================================= */

function validateForm() {
  const username =
    usernameInput.value.trim();

  const displayName =
    displayNameInput.value.trim();

  const password =
    passwordInput.value;

  if (!isEditing) {
    const usernamePattern =
      /^[A-Za-z0-9_]+$/;

    if (username.length < 3) {
      throw new Error(
        "管理員帳號至少需要 3 個字元。"
      );
    }

    if (!usernamePattern.test(username)) {
      throw new Error(
        "管理員帳號只能包含英文字母、數字及底線。"
      );
    }
  }

  if (!displayName) {
    throw new Error(
      "請輸入顯示名稱。"
    );
  }

  if (!isEditing && password.length < 6) {
    throw new Error(
      "登入密碼至少需要 6 個字元。"
    );
  }

  if (
    isEditing &&
    password &&
    password.length < 6
  ) {
    throw new Error(
      "新密碼至少需要 6 個字元。"
    );
  }
}

async function handleFormSubmit(event) {
  event.preventDefault();

  hideModalMessage();

  try {
    validateForm();

    saveButton.disabled = true;
    saveButton.textContent =
      isEditing
        ? "儲存中……"
        : "建立中……";

    if (isEditing) {
      await updateAdmin();
    } else {
      await createAdmin();
    }

    closeModal();
    await loadAdmins();

    showPageMessage(
      isEditing
        ? "管理員資料已更新。"
        : "管理員帳號已建立。",
      "success"
    );
  } catch (error) {
    showModalMessage(error.message);
  } finally {
    saveButton.disabled = false;

    saveButton.textContent =
      isEditing
        ? "儲存修改"
        : "建立管理員";
  }
}

async function createAdmin() {
  const payload = {
    username:
      usernameInput.value.trim(),

    display_name:
      displayNameInput.value.trim(),

    role:
      roleInput.value,

    password:
      passwordInput.value
  };

  await apiRequest(
    `${API_BASE}/admins`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

async function updateAdmin() {
  const id =
    adminIdInput.value;

  const payload = {
    display_name:
      displayNameInput.value.trim(),

    role:
      roleInput.value
  };

  const password =
    passwordInput.value;

  if (password) {
    payload.password = password;
  }

  await apiRequest(
    `${API_BASE}/admins/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(payload)
    }
  );
}

/* =========================================
   啟用與停用
========================================= */

async function toggleAdminStatus(
  admin,
  button
) {
  const isActive =
    admin.is_active === true ||
    admin.is_active === "true" ||
    admin.is_active === 1;

  const nextStatus =
    !isActive;

  const actionText =
    nextStatus ? "啟用" : "停用";

  const confirmed =
    window.confirm(
      `確定要${actionText}管理員「${admin.username}」嗎？`
    );

  if (!confirmed) {
    return;
  }

  try {
    button.disabled = true;
    button.textContent =
      `${actionText}中……`;

    await apiRequest(
      `${API_BASE}/admins/${admin.id}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({
          is_active: nextStatus
        })
      }
    );

    await loadAdmins();

    showPageMessage(
      `管理員「${admin.username}」已${actionText}。`,
      "success"
    );
  } catch (error) {
    button.disabled = false;
    button.textContent = actionText;

    showPageMessage(error.message);
  }
}

/* =========================================
   表格操作
========================================= */

function handleTableClick(event) {
  const button =
    event.target.closest(
      "[data-action]"
    );

  if (!button) {
    return;
  }

  const adminId =
    Number(button.dataset.id);

  const admin =
    admins.find(
      (item) =>
        Number(item.id) === adminId
    );

  if (!admin) {
    showPageMessage(
      "找不到指定的管理員資料。"
    );

    return;
  }

  const action =
    button.dataset.action;

  if (action === "edit") {
    openEditModal(admin);
    return;
  }

  if (action === "toggle") {
    toggleAdminStatus(
      admin,
      button
    );
  }
}

/* =========================================
   側邊欄
========================================= */

function openSidebar() {
  document.body.classList.add(
    "sidebar-open"
  );
}

function closeSidebar() {
  document.body.classList.remove(
    "sidebar-open"
  );
}

function toggleSidebar() {
  document.body.classList.toggle(
    "sidebar-open"
  );
}

/* =========================================
   登出
========================================= */

function logout() {
  const confirmed =
    window.confirm("確定要登出嗎？");

  if (!confirmed) {
    return;
  }

  redirectToLogin();
}

/* =========================================
   事件監聽
========================================= */

addAdminButton.addEventListener(
  "click",
  openCreateModal
);

closeModalButton.addEventListener(
  "click",
  closeModal
);

cancelButton.addEventListener(
  "click",
  closeModal
);

adminForm.addEventListener(
  "submit",
  handleFormSubmit
);

adminsTableBody.addEventListener(
  "click",
  handleTableClick
);

logoutButton.addEventListener(
  "click",
  logout
);

mobileMenuButton.addEventListener(
  "click",
  toggleSidebar
);

sidebarOverlay.addEventListener(
  "click",
  closeSidebar
);

adminModal.addEventListener(
  "click",
  (event) => {
    if (event.target === adminModal) {
      closeModal();
    }
  }
);

document.addEventListener(
  "keydown",
  (event) => {
    if (
      event.key === "Escape" &&
      adminModal.classList.contains("show")
    ) {
      closeModal();
    }
  }
);

window.addEventListener(
  "resize",
  () => {
    if (window.innerWidth > 760) {
      closeSidebar();
    }
  }
);

/* =========================================
   初始化
========================================= */

async function initializePage() {
  if (!token) {
    redirectToLogin();
    return;
  }

  try {
    await loadCurrentAdmin();

    if (
      !currentAdmin ||
      currentAdmin.role !== "owner"
    ) {
      return;
    }

    await loadAdmins();
  } catch (error) {
    showPageMessage(error.message);
  }
}

initializePage();