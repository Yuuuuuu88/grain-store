const TOKEN_KEY = "adminToken";

const roleNames = {
  owner: "最高管理員",
  manager: "主管",
  staff: "一般店員"
};

let currentAdmin = null;
let searchTimer = null;

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    redirectToLogin();
    return;
  }

  setupMobileMenu();
  setupLogout();

  try {
    currentAdmin = await fetchCurrentAdmin(token);

    renderAdmin(currentAdmin);
    applyCommonPermissions(currentAdmin.role);

    if (document.getElementById("productForm")) {
      setupProductPreview();
      setupProductForm(token);
      applyProductFormPermissions(currentAdmin.role);
    }

    if (document.getElementById("productTableBody")) {
      setupProductList(token);
      await loadProducts(token);
    }
  } catch (error) {
    console.error(error);

    localStorage.removeItem(TOKEN_KEY);
    redirectToLogin();
  }
});

async function fetchCurrentAdmin(token) {
  const response = await fetch("/api/admin/me", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error("登入狀態失效");
  }

  const result = await response.json();

  return result.admin;
}

function renderAdmin(admin) {
  const displayName =
    admin.displayName ||
    admin.display_name ||
    admin.username ||
    "管理員";

  const role = admin.role || "staff";

  setText("adminName", displayName);
  setText("adminRole", roleNames[role] || role);
  setText(
    "adminAvatar",
    displayName.trim().charAt(0) || "管"
  );
}

function applyCommonPermissions(role) {
  if (role !== "owner") {
    document
      .querySelectorAll(".owner-only")
      .forEach((element) => {
        element.classList.add("hidden");
      });
  }

  if (role === "staff") {
    document
      .querySelectorAll(".editable-only")
      .forEach((element) => {
        element.classList.add("hidden");
      });
  }
}

function applyProductFormPermissions(role) {
  if (role !== "staff") {
    return;
  }

  alert("一般店員只能查看商品，無法新增商品。");

  window.location.href = "/admin/products.html";
}

// ==============================
// 商品列表
// ==============================

function setupProductList(token) {
  const searchInput =
    document.getElementById("searchInput");

  const categoryFilter =
    document.getElementById("categoryFilter");

  const statusFilter =
    document.getElementById("statusFilter");

  const refreshButton =
    document.getElementById("refreshButton");

  searchInput?.addEventListener("input", () => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => {
      loadProducts(token);
    }, 350);
  });

  categoryFilter?.addEventListener("change", () => {
    loadProducts(token);
  });

  statusFilter?.addEventListener("change", () => {
    loadProducts(token);
  });

  refreshButton?.addEventListener("click", () => {
    loadProducts(token);
  });
}

async function loadProducts(token) {
  showLoadingState();
  clearPageMessage();

  const params = new URLSearchParams();

  const keyword = getValue("searchInput");
  const category = getValue("categoryFilter");
  const status = getValue("statusFilter");

  if (keyword) {
    params.set("q", keyword);
  }

  if (category) {
    params.set("category", category);
  }

  if (status) {
    params.set("status", status);
  }

  try {
    const queryString = params.toString();

    const response = await fetch(
      `/api/admin/products${
        queryString ? `?${queryString}` : ""
      }`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message || "取得商品列表失敗"
      );
    }

    renderProductList(result.products, token);

    setText(
      "lastUpdated",
      `最後更新：${new Date().toLocaleString("zh-TW")}`
    );
  } catch (error) {
    console.error(error);

    showEmptyState();
    showPageMessage(error.message, "error");
  }
}

function renderProductList(products, token) {
  const tbody =
    document.getElementById("productTableBody");

  if (!tbody) {
    return;
  }

  tbody.innerHTML = "";

  setText("productCount", products.length);

  if (products.length === 0) {
    showEmptyState();
    return;
  }

  products.forEach((product) => {
    const row = document.createElement("tr");

    row.innerHTML = createProductRow(product);

    tbody.appendChild(row);
  });

  setupRowActions(token);
  showTableState();
}

function createProductRow(product) {
  const isAvailable = Boolean(product.is_available);
  const stock = Number(product.stock) || 0;

  const stockClass =
    stock === 0
      ? "empty"
      : stock <= 10
        ? "low"
        : "normal";

  const stockText =
    stock === 0
      ? "缺貨"
      : stock <= 10
        ? `低庫存 ${stock}`
        : `${stock}`;

  const imageContent = product.image_url
    ? `
      <img
        src="${escapeAttribute(product.image_url)}"
        alt="${escapeAttribute(product.name)}"
        onerror="this.parentElement.innerHTML='🥚'"
      />
    `
    : "🥚";

  const editButton =
    currentAdmin.role === "staff"
      ? ""
      : `
        <a
          href="/admin/product-form.html?id=${product.id}"
          class="action-button"
        >
          編輯
        </a>
      `;

  const toggleButton =
    currentAdmin.role === "staff"
      ? ""
      : `
        <button
          type="button"
          class="action-button toggle availability-button"
          data-id="${product.id}"
          data-available="${isAvailable}"
        >
          ${isAvailable ? "下架" : "上架"}
        </button>
      `;

  const deleteButton =
    currentAdmin.role === "owner"
      ? `
        <button
          type="button"
          class="action-button delete delete-button"
          data-id="${product.id}"
          data-name="${escapeAttribute(product.name)}"
        >
          刪除
        </button>
      `
      : "";

  const actionContent =
    editButton || toggleButton || deleteButton
      ? `${editButton}${toggleButton}${deleteButton}`
      : `<span style="color:#92877e;">僅供查看</span>`;

  return `
    <td>
      <div class="product-cell">
        <div class="product-image">
          ${imageContent}
        </div>

        <div>
          <div class="product-name">
            ${escapeHtml(product.name)}
          </div>

          <div class="product-description">
            ${escapeHtml(
              product.description || "尚無商品介紹"
            )}
          </div>
        </div>
      </div>
    </td>

    <td>
      <span class="category-badge">
        ${escapeHtml(product.category)}
      </span>
    </td>

    <td>
      <div class="price-main">
        NT$ ${formatNumber(product.sale_price)}
      </div>

      <div class="price-cost">
        成本 NT$ ${formatNumber(product.cost_price)}
      </div>
    </td>

    <td>
      <span class="stock-badge ${stockClass}">
        ${stockText}
      </span>
    </td>

    <td>
      ${escapeHtml(product.unit)}
    </td>

    <td>
      <span
        class="status-badge ${
          isAvailable ? "available" : "unavailable"
        }"
      >
        ${isAvailable ? "● 上架" : "● 下架"}
      </span>
    </td>

    <td>
      ${formatDate(product.updated_at)}
    </td>

    <td>
      <div class="actions">
        ${actionContent}
      </div>
    </td>
  `;
}

function setupRowActions(token) {
  document
    .querySelectorAll(".availability-button")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const productId = button.dataset.id;
        const currentlyAvailable =
          button.dataset.available === "true";

        await updateAvailability(
          token,
          productId,
          !currentlyAvailable,
          button
        );
      });
    });

  document
    .querySelectorAll(".delete-button")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const productId = button.dataset.id;
        const productName = button.dataset.name;

        await deleteProduct(
          token,
          productId,
          productName,
          button
        );
      });
    });
}

async function updateAvailability(
  token,
  productId,
  isAvailable,
  button
) {
  const confirmed = confirm(
    isAvailable
      ? "確定要上架這項商品嗎？"
      : "確定要下架這項商品嗎？"
  );

  if (!confirmed) {
    return;
  }

  button.disabled = true;
  button.textContent = "處理中";

  try {
    const response = await fetch(
      `/api/admin/products/${productId}/availability`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          isAvailable
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message || "修改商品狀態失敗"
      );
    }

    showPageMessage(result.message, "success");

    await loadProducts(token);
  } catch (error) {
    console.error(error);

    showPageMessage(error.message, "error");

    button.disabled = false;
    button.textContent = isAvailable
      ? "上架"
      : "下架";
  }
}

async function deleteProduct(
  token,
  productId,
  productName,
  button
) {
  const confirmed = confirm(
    `確定要永久刪除「${productName}」嗎？\n\n刪除後無法復原。`
  );

  if (!confirmed) {
    return;
  }

  button.disabled = true;
  button.textContent = "刪除中";

  try {
    const response = await fetch(
      `/api/admin/products/${productId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message || "刪除商品失敗"
      );
    }

    showPageMessage(result.message, "success");

    await loadProducts(token);
  } catch (error) {
    console.error(error);

    showPageMessage(error.message, "error");

    button.disabled = false;
    button.textContent = "刪除";
  }
}

function showLoadingState() {
  document
    .getElementById("loadingState")
    ?.classList.remove("hidden");

  document
    .getElementById("emptyState")
    ?.classList.add("hidden");

  document
    .getElementById("tableContainer")
    ?.classList.add("hidden");
}

function showEmptyState() {
  document
    .getElementById("loadingState")
    ?.classList.add("hidden");

  document
    .getElementById("emptyState")
    ?.classList.remove("hidden");

  document
    .getElementById("tableContainer")
    ?.classList.add("hidden");
}

function showTableState() {
  document
    .getElementById("loadingState")
    ?.classList.add("hidden");

  document
    .getElementById("emptyState")
    ?.classList.add("hidden");

  document
    .getElementById("tableContainer")
    ?.classList.remove("hidden");
}

function showPageMessage(message, type) {
  const element =
    document.getElementById("pageMessage");

  if (!element) {
    return;
  }

  element.textContent = message;
  element.className = `message ${type}`;

  setTimeout(() => {
    clearPageMessage();
  }, 3500);
}

function clearPageMessage() {
  const element =
    document.getElementById("pageMessage");

  if (!element) {
    return;
  }

  element.textContent = "";
  element.className = "message";
}

// ==============================
// 新增商品頁
// ==============================

function setupProductForm(token) {
  const form = document.getElementById("productForm");
  const submitButton =
    document.getElementById("submitButton");

  if (!form || !submitButton) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    clearFormMessage();

    const productData = {
      name: getValue("name"),
      category: getValue("category"),
      unit: getValue("unit"),
      salePrice: getValue("salePrice"),
      costPrice: getValue("costPrice"),
      stock: Number(getValue("stock")),
      imageUrl: getValue("imageUrl"),
      description: getValue("description"),
      isAvailable:
        document.getElementById("isAvailable").checked
    };

    const validationMessage =
      validateProduct(productData);

    if (validationMessage) {
      showFormMessage(validationMessage, "error");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "建立中...";

    try {
      const response = await fetch(
        "/api/admin/products",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(productData)
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "新增商品失敗"
        );
      }

      showFormMessage("商品新增成功！", "success");

      setTimeout(() => {
        window.location.href =
          "/admin/products.html";
      }, 700);
    } catch (error) {
      console.error(error);

      showFormMessage(error.message, "error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "＋ 建立商品";
    }
  });
}

function validateProduct(product) {
  if (!product.name.trim()) {
    return "請輸入商品名稱";
  }

  if (!product.category) {
    return "請選擇商品分類";
  }

  if (!product.unit.trim()) {
    return "請輸入商品單位";
  }

  const salePrice = Number(product.salePrice);
  const costPrice = Number(product.costPrice);

  if (!Number.isFinite(salePrice) || salePrice < 0) {
    return "請輸入正確的商品售價";
  }

  if (!Number.isFinite(costPrice) || costPrice < 0) {
    return "請輸入正確的商品成本";
  }

  if (
    !Number.isInteger(product.stock) ||
    product.stock < 0
  ) {
    return "庫存必須是大於或等於 0 的整數";
  }

  return "";
}

function setupProductPreview() {
  [
    "name",
    "category",
    "salePrice",
    "stock",
    "imageUrl",
    "isAvailable"
  ].forEach((id) => {
    const element = document.getElementById(id);

    if (!element) {
      return;
    }

    element.addEventListener(
      element.type === "checkbox"
        ? "change"
        : "input",
      updatePreview
    );
  });

  document
    .getElementById("category")
    ?.addEventListener("change", updatePreview);

  updatePreview();
}

function updatePreview() {
  setText(
    "previewName",
    getValue("name") || "商品名稱"
  );

  setText(
    "previewCategory",
    getValue("category") || "尚未選擇分類"
  );

  setText(
    "previewPrice",
    `NT$ ${formatNumber(
      Number(getValue("salePrice") || 0)
    )}`
  );

  setText(
    "previewStock",
    `庫存：${formatNumber(
      Number(getValue("stock") || 0)
    )}`
  );

  const isAvailable =
    document.getElementById("isAvailable")?.checked ??
    true;

  setText(
    "previewStatus",
    isAvailable ? "上架" : "下架"
  );

  updateImagePreview();
}

function updateImagePreview() {
  const imageUrl = getValue("imageUrl");
  const previewImage =
    document.getElementById("previewImage");
  const placeholder =
    document.getElementById("imagePlaceholder");

  if (!previewImage || !placeholder) {
    return;
  }

  if (!imageUrl) {
    previewImage.removeAttribute("src");
    previewImage.style.display = "none";
    placeholder.style.display = "block";
    return;
  }

  previewImage.onload = () => {
    previewImage.style.display = "block";
    placeholder.style.display = "none";
  };

  previewImage.onerror = () => {
    previewImage.style.display = "none";
    placeholder.style.display = "block";
  };

  previewImage.src = imageUrl;
}

function showFormMessage(message, type) {
  const element =
    document.getElementById("formMessage");

  if (!element) {
    return;
  }

  element.textContent = message;
  element.className = `form-message ${type}`;
}

function clearFormMessage() {
  const element =
    document.getElementById("formMessage");

  if (!element) {
    return;
  }

  element.textContent = "";
  element.className = "form-message";
}

// ==============================
// 共用功能
// ==============================

function setupLogout() {
  document
    .getElementById("logoutButton")
    ?.addEventListener("click", () => {
      const confirmed = confirm(
        "確定要登出後台嗎？"
      );

      if (!confirmed) {
        return;
      }

      localStorage.removeItem(TOKEN_KEY);
      redirectToLogin();
    });
}

function setupMobileMenu() {
  document
    .getElementById("mobileMenuButton")
    ?.addEventListener("click", () => {
      document.body.classList.toggle(
        "sidebar-open"
      );
    });

  document
    .getElementById("sidebarOverlay")
    ?.addEventListener("click", () => {
      document.body.classList.remove(
        "sidebar-open"
      );
    });
}

function getValue(id) {
  return (
    document.getElementById(id)?.value.trim() || ""
  );
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

  return number.toLocaleString("zh-TW", {
    maximumFractionDigits: 2
  });
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function redirectToLogin() {
  window.location.href = "/admin/login.html";
}