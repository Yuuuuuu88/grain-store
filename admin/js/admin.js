"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // ==============================
  // 取得 HTML 元素
  // ==============================

  const adminsTableBody =
    document.getElementById("adminsTableBody");

  const pageMessage =
    document.getElementById("pageMessage");

  const addAdminButton =
    document.getElementById("addAdminButton");

  const logoutButton =
    document.getElementById("logoutButton");

  const adminModal =
    document.getElementById("adminModal");

  const closeModalButton =
    document.getElementById("closeModalButton");

  const cancelButton =
    document.getElementById("cancelButton");

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

  const passwordLabel =
    document.getElementById("passwordLabel");

  const passwordRequired =
    document.getElementById("passwordRequired");

  const passwordHelp =
    document.getElementById("passwordHelp");

  const modalTitle =
    document.getElementById("modalTitle");

  const modalMessage =
    document.getElementById("modalMessage");

  const saveButton =
    document.getElementById("saveButton");

  // ==============================
  // 資料狀態
  // ==============================

  let admins = [];
  let currentAdmin = null;

  // ==============================
  // 檢查必要元素
  // ==============================

  const requiredElements = {
    adminsTableBody,
    pageMessage,
    addAdminButton,
    logoutButton,
    adminModal,
    closeModalButton,
    cancelButton,
    adminForm,
    adminIdInput,
    usernameInput,
    displayNameInput,
    roleInput,
    passwordInput,
    passwordLabel,
    passwordRequired,
    passwordHelp,
    modalTitle,
    modalMessage,
    saveButton
  };

  for (const [name, element] of Object.entries(requiredElements)) {
    if (!element) {
      console.error(`找不到 HTML 元素：${name}`);
    }
  }

  // ==============================
  // Token
  // ==============================

  function getToken() {
    return (
      localStorage.getItem("adminToken") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("adminToken") ||
      sessionStorage.getItem("token")
    );
  }

  function clearToken() {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("token");

    sessionStorage.removeItem("adminToken");
    sessionStorage.removeItem("token");
  }

  function redirectToLogin() {
    clearToken();
    window.location.href = "/admin/login.html";
  }

  // ==============================
  // 訊息顯示
  // ==============================

  function showMessage(
    element,
    message,
    type = "error"
  ) {
    if (!element) {
      return;
    }

    element.textContent = message;
    element.className = `message show ${type}`;
  }

  function hideMessage(element) {
    if (!element) {
      return;
    }

    element.textContent = "";
    element.className = "message";
  }

  // ==============================
  // 基本工具
  // ==============================

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
      return "－";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "－";
    }

    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  }

  function getRoleName(role) {
    if (role === "owner") {
      return "最高管理員";
    }

    if (role === "manager") {
      return "一般管理員";
    }

    return role || "未知權限";
  }

  function getRoleClass(role) {
    if (role === "owner") {
      return "role-owner";
    }

    return "role-manager";
  }

  // ==============================
  // API 共用函式
  // ==============================

  async function apiRequest(
    url,
    options = {}
  ) {
    const token = getToken();

    if (!token) {
      redirectToLogin();
      throw new Error("尚未登入");
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    };

    if (
      options.body &&
      !(options.body instanceof FormData)
    ) {
      headers["Content-Type"] = "application/json";
    }

    let response;

    try {
      response = await fetch(url, {
        ...options,
        headers
      });
    } catch (error) {
      console.error("無法連線到伺服器：", error);

      throw new Error(
        "無法連線到伺服器，請確認後端是否已啟動"
      );
    }

    let data;

    try {
      data = await response.json();
    } catch (error) {
      data = {
        success: false,
        message: "伺服器回傳格式錯誤"
      };
    }

    if (response.status === 401) {
      clearToken();

      alert(
        data.message ||
        "登入已過期，請重新登入"
      );

      window.location.href =
        "/admin/login.html";

      throw new Error(
        data.message ||
        "登入已過期，請重新登入"
      );
    }

    if (response.status === 403) {
      throw new Error(
        data.message ||
        "你沒有執行此操作的權限"
      );
    }

    if (!response.ok) {
      throw new Error(
        data.message ||
        `請求失敗，狀態碼：${response.status}`
      );
    }

    return data;
  }

  // ==============================
  // 表格顯示
  // ==============================

  function renderLoading() {
    adminsTableBody.innerHTML = `
      <tr>
        <td
          class="empty-message"
          colspan="6"
        >
          載入中……
        </td>
      </tr>
    `;
  }

  function renderError(message) {
    adminsTableBody.innerHTML = `
      <tr>
        <td
          class="empty-message"
          colspan="6"
        >
          ${escapeHtml(message)}
        </td>
      </tr>
    `;
  }

  function renderAdmins() {
    if (!Array.isArray(admins) || admins.length === 0) {
      adminsTableBody.innerHTML = `
        <tr>
          <td
            class="empty-message"
            colspan="6"
          >
            目前沒有管理員資料
          </td>
        </tr>
      `;

      return;
    }

    adminsTableBody.innerHTML = admins
      .map((admin) => {
        const isCurrentAdmin =
          currentAdmin &&
          Number(currentAdmin.id) ===
          Number(admin.id);

        const isActive =
          admin.is_active === true;

        const statusText =
          isActive
            ? "啟用中"
            : "已停用";

        const statusClass =
          isActive
            ? "status-active"
            : "status-inactive";

        const statusButtonText =
          isActive
            ? "停用"
            : "啟用";

        const statusButtonClass =
          isActive
            ? "btn-disable"
            : "btn-enable";

        const disableCurrentButton =
          isCurrentAdmin && isActive;

        return `
          <tr>
            <td>
              ${escapeHtml(admin.username)}

              ${
                isCurrentAdmin
                  ? "<strong>（目前登入）</strong>"
                  : ""
              }
            </td>

            <td>
              ${escapeHtml(
                admin.display_name || "－"
              )}
            </td>

            <td>
              <span
                class="role-badge ${getRoleClass(admin.role)}"
              >
                ${escapeHtml(
                  getRoleName(admin.role)
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
                  class="btn btn-edit btn-small"
                  type="button"
                  data-action="edit"
                  data-id="${admin.id}"
                >
                  編輯
                </button>

                <button
                  class="btn ${statusButtonClass} btn-small"
                  type="button"
                  data-action="status"
                  data-id="${admin.id}"
                  data-active="${isActive}"
                  ${
                    disableCurrentButton
                      ? "disabled"
                      : ""
                  }
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

  // ==============================
  // 取得目前登入管理員
  // ==============================

  async function loadCurrentAdmin() {
    const data = await apiRequest(
      "/api/admin/me"
    );

    currentAdmin = data.admin;

    if (!currentAdmin) {
      throw new Error(
        "無法取得目前登入管理員資料"
      );
    }

    if (currentAdmin.role !== "owner") {
      throw new Error(
        "只有最高管理員可以使用管理員管理功能"
      );
    }
  }

  // ==============================
  // 取得管理員列表
  // ==============================

  async function loadAdmins() {
    renderLoading();
    hideMessage(pageMessage);

    try {
      const data = await apiRequest(
        "/api/admin/admins"
      );

      admins = Array.isArray(data.admins)
        ? data.admins
        : [];

      renderAdmins();
    } catch (error) {
      console.error(
        "載入管理員列表失敗：",
        error
      );

      renderError(
        error.message ||
        "載入管理員列表失敗"
      );

      showMessage(
        pageMessage,
        error.message ||
        "載入管理員列表失敗",
        "error"
      );
    }
  }

  // ==============================
  // 重設表單
  // ==============================

  function resetForm() {
    adminForm.reset();

    adminIdInput.value = "";
    usernameInput.value = "";
    displayNameInput.value = "";
    roleInput.value = "manager";
    passwordInput.value = "";

    usernameInput.disabled = false;
    passwordInput.required = true;

    passwordLabel.textContent = "密碼";
    passwordRequired.style.display =
      "inline";

    passwordHelp.textContent =
      "密碼至少需要 6 個字元。";

    modalTitle.textContent =
      "新增管理員";

    saveButton.textContent =
      "儲存";

    saveButton.disabled = false;

    hideMessage(modalMessage);
  }

  // ==============================
  // 開啟新增視窗
  // ==============================

  function openAddModal() {
    resetForm();

    adminModal.classList.add("show");

    setTimeout(() => {
      usernameInput.focus();
    }, 0);
  }

  // ==============================
  // 開啟編輯視窗
  // ==============================

  function openEditModal(adminId) {
    const admin = admins.find(
      (item) =>
        Number(item.id) ===
        Number(adminId)
    );

    if (!admin) {
      showMessage(
        pageMessage,
        "找不到這位管理員",
        "error"
      );

      return;
    }

    resetForm();

    adminIdInput.value = admin.id;

    usernameInput.value =
      admin.username || "";

    displayNameInput.value =
      admin.display_name || "";

    roleInput.value =
      admin.role === "owner"
        ? "owner"
        : "manager";

    passwordInput.value = "";

    usernameInput.disabled = true;
    passwordInput.required = false;

    passwordLabel.textContent =
      "新密碼";

    passwordRequired.style.display =
      "none";

    passwordHelp.textContent =
      "如果不需要修改密碼，請保持空白。";

    modalTitle.textContent =
      "編輯管理員";

    saveButton.textContent =
      "儲存修改";

    adminModal.classList.add("show");

    setTimeout(() => {
      displayNameInput.focus();
    }, 0);
  }

  // ==============================
  // 關閉視窗
  // ==============================

  function closeModal() {
    adminModal.classList.remove("show");
    resetForm();
  }

  // ==============================
  // 新增管理員
  // ==============================

  async function createAdmin(formData) {
    return apiRequest(
      "/api/admin/admins",
      {
        method: "POST",
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          display_name:
            formData.display_name,
          role: formData.role
        })
      }
    );
  }

  // ==============================
  // 修改管理員
  // ==============================

  async function updateAdmin(
    adminId,
    formData
  ) {
    return apiRequest(
      `/api/admin/admins/${adminId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          display_name:
            formData.display_name,
          role: formData.role,
          password: formData.password
        })
      }
    );
  }

  // ==============================
  // 提交新增／修改表單
  // ==============================

  async function handleSubmit(event) {
    event.preventDefault();

    hideMessage(modalMessage);

    const adminId =
      adminIdInput.value.trim();

    const username =
      usernameInput.value.trim();

    const displayName =
      displayNameInput.value.trim();

    const role =
      roleInput.value;

    const password =
      passwordInput.value;

    // 顯示名稱
    if (!displayName) {
      showMessage(
        modalMessage,
        "請輸入顯示名稱",
        "error"
      );

      return;
    }

    // 權限
    if (
      role !== "manager" &&
      role !== "owner"
    ) {
      showMessage(
        modalMessage,
        "管理員權限格式錯誤",
        "error"
      );

      return;
    }

    // 新增模式
    if (!adminId) {
      if (!username) {
        showMessage(
          modalMessage,
          "請輸入帳號",
          "error"
        );

        return;
      }

      if (
        username.length < 3 ||
        username.length > 50
      ) {
        showMessage(
          modalMessage,
          "帳號長度必須為 3～50 個字元",
          "error"
        );

        return;
      }

      if (
        !/^[a-zA-Z0-9_]+$/.test(username)
      ) {
        showMessage(
          modalMessage,
          "帳號只能使用英文字母、數字與底線",
          "error"
        );

        return;
      }

      if (password.length < 6) {
        showMessage(
          modalMessage,
          "密碼至少需要 6 個字元",
          "error"
        );

        return;
      }
    }

    // 編輯模式，有填密碼才檢查
    if (
      adminId &&
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
    saveButton.textContent =
      adminId
        ? "儲存中……"
        : "新增中……";

    try {
      let data;

      if (adminId) {
        data = await updateAdmin(
          adminId,
          {
            display_name: displayName,
            role,
            password
          }
        );
      } else {
        data = await createAdmin({
          username,
          password,
          display_name: displayName,
          role
        });
      }

      closeModal();

      showMessage(
        pageMessage,
        data.message ||
        (adminId
          ? "管理員資料修改成功"
          : "管理員新增成功"),
        "success"
      );

      await loadCurrentAdmin();
      await loadAdmins();
    } catch (error) {
      console.error(
        "儲存管理員失敗：",
        error
      );

      showMessage(
        modalMessage,
        error.message ||
        "儲存管理員失敗",
        "error"
      );
    } finally {
      saveButton.disabled = false;

      saveButton.textContent =
        adminId
          ? "儲存修改"
          : "儲存";
    }
  }

  // ==============================
  // 啟用／停用管理員
  // ==============================

  async function toggleAdminStatus(
    adminId,
    currentStatus
  ) {
    const targetAdmin = admins.find(
      (item) =>
        Number(item.id) ===
        Number(adminId)
    );

    if (!targetAdmin) {
      showMessage(
        pageMessage,
        "找不到這位管理員",
        "error"
      );

      return;
    }

    const nextStatus = !currentStatus;

    const actionText =
      nextStatus
        ? "啟用"
        : "停用";

    const confirmed = window.confirm(
      `確定要${actionText}管理員「${targetAdmin.username}」嗎？`
    );

    if (!confirmed) {
      return;
    }

    hideMessage(pageMessage);

    try {
      const data = await apiRequest(
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
        data.message ||
        `管理員已${actionText}`,
        "success"
      );

      await loadAdmins();
    } catch (error) {
      console.error(
        "修改管理員狀態失敗：",
        error
      );

      showMessage(
        pageMessage,
        error.message ||
        "修改管理員狀態失敗",
        "error"
      );
    }
  }

  // ==============================
  // 表格按鈕事件
  // ==============================

  function handleTableClick(event) {
    const button =
      event.target.closest(
        "button[data-action]"
      );

    if (!button) {
      return;
    }

    const action =
      button.dataset.action;

    const adminId =
      Number(button.dataset.id);

    if (
      !Number.isInteger(adminId) ||
      adminId <= 0
    ) {
      showMessage(
        pageMessage,
        "管理員編號錯誤",
        "error"
      );

      return;
    }

    if (action === "edit") {
      openEditModal(adminId);
      return;
    }

    if (action === "status") {
      const currentStatus =
        button.dataset.active === "true";

      toggleAdminStatus(
        adminId,
        currentStatus
      );
    }
  }

  // ==============================
  // 登出
  // ==============================

  function logout() {
    const confirmed =
      window.confirm("確定要登出嗎？");

    if (!confirmed) {
      return;
    }

    clearToken();

    window.location.href =
      "/admin/login.html";
  }

  // ==============================
  // 綁定事件
  // ==============================

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

  logoutButton.addEventListener(
    "click",
    logout
  );

  adminForm.addEventListener(
    "submit",
    handleSubmit
  );

  adminsTableBody.addEventListener(
    "click",
    handleTableClick
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

  // ==============================
  // 頁面初始化
  // ==============================

  async function initializePage() {
    renderLoading();
    hideMessage(pageMessage);

    const token = getToken();

    if (!token) {
      redirectToLogin();
      return;
    }

    try {
      await loadCurrentAdmin();
      await loadAdmins();
    } catch (error) {
      console.error(
        "初始化管理員頁面失敗：",
        error
      );

      renderError(
        error.message ||
        "管理員頁面載入失敗"
      );

      showMessage(
        pageMessage,
        error.message ||
        "管理員頁面載入失敗",
        "error"
      );
    }
  }

  initializePage();
});