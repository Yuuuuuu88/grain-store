const token = localStorage.getItem("adminToken");

const adminsTableBody =
  document.getElementById("adminsTableBody");

const addAdminButton =
  document.getElementById("addAdminButton");

const adminModal =
  document.getElementById("adminModal");

const adminForm =
  document.getElementById("adminForm");

const modalTitle =
  document.getElementById("modalTitle");

const closeModalButton =
  document.getElementById("closeModalButton");

const cancelButton =
  document.getElementById("cancelButton");

const saveButton =
  document.getElementById("saveButton");

const logoutButton =
  document.getElementById("logoutButton");

const pageMessage =
  document.getElementById("pageMessage");

const modalMessage =
  document.getElementById("modalMessage");

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

const passwordLabel =
  document.getElementById("passwordLabel");

const passwordRequired =
  document.getElementById("passwordRequired");

const passwordHelp =
  document.getElementById("passwordHelp");

let admins = [];


// ======================================================
// 共用函式
// ======================================================

function redirectToLogin() {
  localStorage.removeItem("adminToken");
  window.location.href = "/admin/login.html";
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

  return date.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}


function showMessage(element, message, type = "success") {
  element.textContent = message;
  element.className = `message show ${type}`;
}


function hideMessage(element) {
  element.textContent = "";
  element.className = "message";
}


async function apiFetch(url, options = {}) {
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`
  };

  if (
    options.body &&
    !(options.body instanceof FormData)
  ) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  let data;

  try {
    data = await response.json();
  } catch {
    data = {
      success: false,
      message: "伺服器回傳格式錯誤"
    };
  }

  if (response.status === 401) {
    alert("登入已失效，請重新登入");
    redirectToLogin();
    throw new Error("登入已失效");
  }

  if (!response.ok || data.success === false) {
    throw new Error(
      data.message || "操作失敗"
    );
  }

  return data;
}


// ======================================================
// 管理員列表
// ======================================================

async function loadAdmins() {
  adminsTableBody.innerHTML = `
    <tr>
      <td class="empty-message" colspan="6">
        載入中……
      </td>
    </tr>
  `;

  try {
    const data = await apiFetch("/api/admin/admins");

    admins = Array.isArray(data.admins)
      ? data.admins
      : [];

    renderAdmins();
  } catch (error) {
    console.error(error);

    adminsTableBody.innerHTML = `
      <tr>
        <td class="empty-message" colspan="6">
          ${escapeHtml(error.message)}
        </td>
      </tr>
    `;
  }
}


function renderAdmins() {
  if (admins.length === 0) {
    adminsTableBody.innerHTML = `
      <tr>
        <td class="empty-message" colspan="6">
          目前沒有管理員資料
        </td>
      </tr>
    `;

    return;
  }

  adminsTableBody.innerHTML = admins
    .map((admin) => {
      const roleText =
        admin.role === "super_admin"
          ? "超級管理員"
          : "一般管理員";

      const roleClass =
        admin.role === "super_admin"
          ? "role-super"
          : "role-admin";

      const statusText =
        admin.is_active
          ? "啟用"
          : "停用";

      const statusClass =
        admin.is_active
          ? "status-active"
          : "status-inactive";

      const statusButtonClass =
        admin.is_active
          ? "btn-disable"
          : "btn-enable";

      const statusButtonText =
        admin.is_active
          ? "停用"
          : "啟用";

      return `
        <tr>
          <td>
            <strong>
              ${escapeHtml(admin.username)}
            </strong>
          </td>

          <td>
            ${escapeHtml(admin.display_name)}
          </td>

          <td>
            <span class="role-badge ${roleClass}">
              ${roleText}
            </span>
          </td>

          <td>
            <span class="status-badge ${statusClass}">
              ${statusText}
            </span>
          </td>

          <td>
            ${formatDate(admin.created_at)}
          </td>

          <td>
            <div class="actions">
              <button
                class="btn btn-edit btn-small"
                type="button"
                onclick="openEditModal(${admin.id})"
              >
                編輯
              </button>

              <button
                class="btn ${statusButtonClass} btn-small"
                type="button"
                onclick="changeAdminStatus(
                  ${admin.id},
                  ${!admin.is_active}
                )"
              >
                ${statusButtonText}
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}


// ======================================================
// 新增管理員
// ======================================================

function openAddModal() {
  adminForm.reset();

  adminIdInput.value = "";
  usernameInput.disabled = false;
  usernameInput.required = true;

  passwordInput.required = true;

  modalTitle.textContent = "新增管理員";
  passwordLabel.textContent = "密碼";
  passwordRequired.style.display = "inline";
  passwordHelp.textContent =
    "密碼至少需要 6 個字元。";

  roleInput.value = "admin";

  hideMessage(modalMessage);

  adminModal.classList.add("show");

  setTimeout(() => {
    usernameInput.focus();
  }, 50);
}


// ======================================================
// 編輯管理員
// ======================================================

function openEditModal(adminId) {
  const admin = admins.find(
    (item) => Number(item.id) === Number(adminId)
  );

  if (!admin) {
    showMessage(
      pageMessage,
      "找不到管理員資料",
      "error"
    );

    return;
  }

  adminForm.reset();

  adminIdInput.value = admin.id;
  usernameInput.value = admin.username;
  usernameInput.disabled = true;
  usernameInput.required = false;

  displayNameInput.value =
    admin.display_name || "";

  roleInput.value = admin.role;

  passwordInput.required = false;
  passwordInput.value = "";

  modalTitle.textContent = "編輯管理員";
  passwordLabel.textContent = "新密碼";
  passwordRequired.style.display = "none";
  passwordHelp.textContent =
    "不修改密碼時請保持空白；新密碼至少需要 6 個字元。";

  hideMessage(modalMessage);

  adminModal.classList.add("show");

  setTimeout(() => {
    displayNameInput.focus();
  }, 50);
}


// ======================================================
// 關閉視窗
// ======================================================

function closeModal() {
  adminModal.classList.remove("show");
  adminForm.reset();
  hideMessage(modalMessage);
}


// ======================================================
// 儲存新增／編輯
// ======================================================

adminForm.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    hideMessage(modalMessage);

    const adminId = adminIdInput.value.trim();
    const isEditing = Boolean(adminId);

    const username =
      usernameInput.value.trim();

    const displayName =
      displayNameInput.value.trim();

    const role =
      roleInput.value;

    const password =
      passwordInput.value;

    if (!displayName) {
      showMessage(
        modalMessage,
        "請輸入顯示名稱",
        "error"
      );

      return;
    }

    if (!isEditing && !username) {
      showMessage(
        modalMessage,
        "請輸入管理員帳號",
        "error"
      );

      return;
    }

    if (!isEditing && password.length < 6) {
      showMessage(
        modalMessage,
        "密碼至少需要 6 個字元",
        "error"
      );

      return;
    }

    if (
      isEditing &&
      password &&
      password.length < 6
    ) {
      showMessage(
        modalMessage,
        "新密碼至少需要 6 個字元",
        "error"
      );

      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "儲存中……";

    try {
      if (isEditing) {
        await apiFetch(
          `/api/admin/admins/${adminId}`,
          {
            method: "PUT",
            body: JSON.stringify({
              display_name: displayName,
              role,
              password
            })
          }
        );

        closeModal();

        showMessage(
          pageMessage,
          "管理員資料修改成功",
          "success"
        );
      } else {
        await apiFetch(
          "/api/admin/admins",
          {
            method: "POST",
            body: JSON.stringify({
              username,
              display_name: displayName,
              role,
              password
            })
          }
        );

        closeModal();

        showMessage(
          pageMessage,
          "管理員新增成功",
          "success"
        );
      }

      await loadAdmins();
    } catch (error) {
      console.error(error);

      showMessage(
        modalMessage,
        error.message,
        "error"
      );
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "儲存";
    }
  }
);


// ======================================================
// 啟用／停用
// ======================================================

async function changeAdminStatus(
  adminId,
  nextStatus
) {
  const admin = admins.find(
    (item) => Number(item.id) === Number(adminId)
  );

  if (!admin) {
    showMessage(
      pageMessage,
      "找不到管理員資料",
      "error"
    );

    return;
  }

  const actionText =
    nextStatus ? "啟用" : "停用";

  const confirmed = window.confirm(
    `確定要${actionText}管理員「${admin.username}」嗎？`
  );

  if (!confirmed) {
    return;
  }

  try {
    const data = await apiFetch(
      `/api/admin/admins/${adminId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({
          is_active: nextStatus
        })
      }
    );

    showMessage(
      pageMessage,
      data.message || `管理員已${actionText}`,
      "success"
    );

    await loadAdmins();
  } catch (error) {
    console.error(error);

    showMessage(
      pageMessage,
      error.message,
      "error"
    );
  }
}


// ======================================================
// 事件
// ======================================================

addAdminButton.addEventListener(
  "click",
  openAddModal
);

closeModalButton.addEventListener(
  "click",
  closeModal
);

cancelButton.addEventListener(
  "click",
  closeModal
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

logoutButton.addEventListener(
  "click",
  () => {
    localStorage.removeItem("adminToken");
    window.location.href = "/admin/login.html";
  }
);


// 讓 HTML 的 onclick 可以呼叫
window.openEditModal = openEditModal;
window.changeAdminStatus = changeAdminStatus;


// ======================================================
// 啟動
// ======================================================

if (!token) {
  redirectToLogin();
} else {
  loadAdmins();
}