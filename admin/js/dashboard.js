const TOKEN_KEY = "adminToken";

const roleNames = {
  owner: "最高管理員",
  manager: "主管",
  staff: "一般店員",
};

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    redirectToLogin();
    return;
  }

  setupMobileMenu();
  setupLogout();

  try {
    const admin = await fetchCurrentAdmin(token);

    renderAdminInformation(admin);
    applyRolePermissions(admin.role);

    const dashboardData = await fetchDashboardData(token);

    renderDashboardStatistics(dashboardData);
  } catch (error) {
    console.error(error);

    if (
      error.message === "UNAUTHORIZED" ||
      error.message === "FORBIDDEN"
    ) {
      localStorage.removeItem(TOKEN_KEY);
      redirectToLogin();
      return;
    }

    showDashboardError();
    alert("Dashboard 資料載入失敗，請稍後再試。");
  }
});

async function fetchCurrentAdmin(token) {
  const response = await fetch("/api/admin/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    throw new Error("UNAUTHORIZED");
  }

  if (response.status === 403) {
    throw new Error("FORBIDDEN");
  }

  if (!response.ok) {
    throw new Error("取得管理員資料失敗");
  }

  const result = await response.json();

  return result.admin || result.data || result;
}

async function fetchDashboardData(token) {
  const response = await fetch("/api/admin/dashboard", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    throw new Error("UNAUTHORIZED");
  }

  if (response.status === 403) {
    throw new Error("FORBIDDEN");
  }

  if (!response.ok) {
    throw new Error("取得 Dashboard 統計失敗");
  }

  const result = await response.json();

  return result.data;
}

function renderAdminInformation(admin) {
  const displayName =
    admin.display_name ||
    admin.displayName ||
    admin.username ||
    "管理員";

  const username = admin.username || "—";
  const role = admin.role || "staff";
  const roleText = roleNames[role] || role;

  setText("headerAdminName", displayName);
  setText("headerAdminRole", roleText);
  setText("welcomeAdminName", displayName);
  setText("systemUsername", username);
  setText("systemRole", roleText);

  const avatarText = displayName.trim().charAt(0) || "管";
  setText("profileAvatar", avatarText);
}

function renderDashboardStatistics(data) {
  setText("totalProducts", formatNumber(data.total_products));
  setText(
    "availableProducts",
    formatNumber(data.available_products),
  );
  setText(
    "unavailableProducts",
    formatNumber(data.unavailable_products),
  );
  setText(
    "lowStockProducts",
    formatNumber(data.low_stock_products),
  );
  setText("activeAdmins", formatNumber(data.active_admins));
  setText(
    "outOfStockProducts",
    formatNumber(data.out_of_stock_products),
  );
}

function applyRolePermissions(role) {
  if (role === "owner") {
    return;
  }

  document.querySelectorAll(".owner-only").forEach((element) => {
    element.classList.add("hidden");
  });
}

function setupLogout() {
  const logoutButton = document.getElementById("logoutButton");

  if (!logoutButton) {
    return;
  }

  logoutButton.addEventListener("click", () => {
    const confirmed = confirm("確定要登出後台嗎？");

    if (!confirmed) {
      return;
    }

    localStorage.removeItem(TOKEN_KEY);
    redirectToLogin();
  });
}

function setupMobileMenu() {
  const menuButton = document.getElementById("mobileMenuButton");
  const overlay = document.getElementById("sidebarOverlay");

  if (menuButton) {
    menuButton.addEventListener("click", () => {
      document.body.classList.toggle("sidebar-open");
    });
  }

  if (overlay) {
    overlay.addEventListener("click", closeMobileMenu);
  }

  document.querySelectorAll(".sidebar a").forEach((link) => {
    link.addEventListener("click", closeMobileMenu);
  });
}

function closeMobileMenu() {
  document.body.classList.remove("sidebar-open");
}

function showDashboardError() {
  const ids = [
    "totalProducts",
    "availableProducts",
    "unavailableProducts",
    "lowStockProducts",
    "activeAdmins",
    "outOfStockProducts",
  ];

  ids.forEach((id) => {
    setText(id, "讀取失敗");
  });
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return number.toLocaleString("zh-TW");
}

function redirectToLogin() {
  window.location.href = "/admin/login.html";
}