let selectedCategory = "";
let searchTimer = null;

document.addEventListener("DOMContentLoaded", () => {
  setupSearch();
  setupCategories();
  setupRetry();

  loadProducts();
});

// ==============================
// 載入商品
// ==============================

async function loadProducts() {
  showState("loading");

  const params = new URLSearchParams();

  const keyword =
    document
      .getElementById("searchInput")
      ?.value.trim() || "";

  if (keyword) {
    params.set("q", keyword);
  }

  if (selectedCategory) {
    params.set("category", selectedCategory);
  }

  try {
    const queryString = params.toString();

    const response = await fetch(
      `/api/products${
        queryString ? `?${queryString}` : ""
      }`
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message || "取得商品資料失敗"
      );
    }

    renderProducts(result.products);
  } catch (error) {
    console.error("商品載入失敗：", error);

    const errorMessage =
      document.getElementById("errorMessage");

    if (errorMessage) {
      errorMessage.textContent =
        error.message || "請稍後再試。";
    }

    showState("error");
  }
}

// ==============================
// 顯示商品
// ==============================

function renderProducts(products) {
  const productList =
    document.getElementById("productList");

  if (!productList) {
    return;
  }

  productList.innerHTML = "";

  setText("productCount", products.length);

  if (products.length === 0) {
    showState("empty");
    return;
  }

  products.forEach((product) => {
    const item = document.createElement("article");

    item.className = "product-item";
    item.innerHTML = createProductHtml(product);

    productList.appendChild(item);
  });

  showState("products");
}

function createProductHtml(product) {
  const stock = Number(product.stock) || 0;

  let stockClass = "available";
  let stockText = "供應中";

  if (stock === 0) {
    stockClass = "empty";
    stockText = "目前缺貨";
  } else if (stock <= 10) {
    stockClass = "low";
    stockText = "庫存較少";
  }

  const imageHtml = product.image_url
    ? `
      <img
        src="${escapeAttribute(product.image_url)}"
        alt="${escapeAttribute(product.name)}"
        loading="lazy"
        onerror="this.parentElement.innerHTML='🥚'"
      />
    `
    : "🥚";

  const description =
    product.description?.trim() ||
    "尚無商品介紹";

  return `
    <div class="product-image">
      ${imageHtml}
    </div>

    <div class="product-main">
      <span class="product-category">
        ${escapeHtml(product.category || "其他")}
      </span>

      <h3 class="product-name">
        ${escapeHtml(product.name)}
      </h3>

      <p class="product-description">
        ${escapeHtml(description)}
      </p>

      <div class="product-meta">
        <span>
          📦 單位：
          ${escapeHtml(product.unit || "未設定")}
        </span>
      </div>
    </div>

    <div class="product-status">
      <span class="status-badge ${stockClass}">
        ● ${stockText}
      </span>
    </div>
  `;
}

// ==============================
// 搜尋
// ==============================

function setupSearch() {
  const searchInput =
    document.getElementById("searchInput");

  const clearButton =
    document.getElementById(
      "clearSearchButton"
    );

  searchInput?.addEventListener("input", () => {
    updateClearButton();

    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => {
      loadProducts();
    }, 300);
  });

  clearButton?.addEventListener("click", () => {
    if (!searchInput) {
      return;
    }

    searchInput.value = "";
    searchInput.focus();

    updateClearButton();
    loadProducts();
  });

  updateClearButton();
}

function updateClearButton() {
  const searchInput =
    document.getElementById("searchInput");

  const clearButton =
    document.getElementById(
      "clearSearchButton"
    );

  if (!searchInput || !clearButton) {
    return;
  }

  clearButton.classList.toggle(
    "visible",
    Boolean(searchInput.value.trim())
  );
}

// ==============================
// 商品分類
// ==============================

function setupCategories() {
  document
    .querySelectorAll(".category-button")
    .forEach((button) => {
      button.addEventListener("click", () => {
        selectedCategory =
          button.dataset.category || "";

        document
          .querySelectorAll(".category-button")
          .forEach((categoryButton) => {
            categoryButton.classList.remove(
              "active"
            );
          });

        button.classList.add("active");

        loadProducts();
      });
    });
}

// ==============================
// 重新載入
// ==============================

function setupRetry() {
  document
    .getElementById("retryButton")
    ?.addEventListener("click", loadProducts);
}

// ==============================
// 畫面狀態
// ==============================

function showState(state) {
  const loadingState =
    document.getElementById("loadingState");

  const emptyState =
    document.getElementById("emptyState");

  const errorState =
    document.getElementById("errorState");

  const productList =
    document.getElementById("productList");

  loadingState?.classList.add("hidden");
  emptyState?.classList.add("hidden");
  errorState?.classList.add("hidden");
  productList?.classList.add("hidden");

  if (state === "loading") {
    loadingState?.classList.remove("hidden");
    return;
  }

  if (state === "empty") {
    emptyState?.classList.remove("hidden");
    return;
  }

  if (state === "error") {
    errorState?.classList.remove("hidden");
    return;
  }

  if (state === "products") {
    productList?.classList.remove("hidden");
  }
}

// ==============================
// 共用工具
// ==============================

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
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