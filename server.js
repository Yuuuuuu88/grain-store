require("dotenv").config();

console.log("========== 新版 server.js ==========");

const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const pool = require("./db");
const { authenticateAdmin } = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 3000;

// ==============================
// 檢查環境變數
// ==============================

if (!process.env.JWT_SECRET) {
  throw new Error("缺少 JWT_SECRET 環境變數");
}

// ==============================
// Middleware
// ==============================

// 解析 JSON
app.use(express.json());

// 解析表單資料
app.use(
  express.urlencoded({
    extended: true
  })
);

// 先提供 admin 靜態檔案
// 例如：
// /admin/login.html
// /admin/css/admin.css
// /admin/js/login.js
app.use(
  "/admin",
  express.static(path.join(__dirname, "admin"))
);

// 再提供前台 public 靜態檔案
app.use(express.static(path.join(__dirname, "public")));

// ==============================
// API：健康檢查
// ==============================

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT NOW() AS now"
    );

    return res.json({
      success: true,
      message: "伺服器與資料庫連線正常",
      databaseTime: result.rows[0].now
    });
  } catch (error) {
    console.error("資料庫測試失敗：", error);

    return res.status(500).json({
      success: false,
      message: "資料庫連線失敗"
    });
  }
});

// ==============================
// API：管理員登入
// ==============================

app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !password.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "請輸入帳號和密碼"
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        username,
        password_hash,
        display_name,
        role,
        is_active
      FROM admins
      WHERE username = $1
      LIMIT 1
      `,
      [username.trim()]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        success: false,
        message: "帳號或密碼錯誤"
      });
    }

    const admin = result.rows[0];

    if (!admin.is_active) {
      return res.status(403).json({
        success: false,
        message: "此管理員帳號已被停用"
      });
    }

    const passwordCorrect = await bcrypt.compare(
      password,
      admin.password_hash
    );

    if (!passwordCorrect) {
      return res.status(401).json({
        success: false,
        message: "帳號或密碼錯誤"
      });
    }

    const token = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
        displayName: admin.display_name,
        role: admin.role
      },
      process.env.JWT_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "8h"
      }
    );

    return res.json({
      success: true,
      message: "登入成功",
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        displayName: admin.display_name,
        role: admin.role
      }
    });
  } catch (error) {
    console.error("管理員登入失敗：", error);

    return res.status(500).json({
      success: false,
      message: "伺服器發生錯誤"
    });
  }
});

// ==============================
// API：取得目前登入管理員
// ==============================

app.get(
  "/api/admin/me",
  authenticateAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          id,
          username,
          display_name,
          role,
          is_active
        FROM admins
        WHERE id = $1
        LIMIT 1
        `,
        [req.admin.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "找不到管理員帳號"
        });
      }

      const admin = result.rows[0];

      if (!admin.is_active) {
        return res.status(403).json({
          success: false,
          message: "此帳號已被停用"
        });
      }

      return res.json({
        success: true,
        admin: {
          id: admin.id,
          username: admin.username,
          displayName: admin.display_name,
          display_name: admin.display_name,
          role: admin.role,
          is_active: admin.is_active
        }
      });
    } catch (error) {
      console.error("讀取管理員資料失敗：", error);

      return res.status(500).json({
        success: false,
        message: "讀取管理員資料失敗"
      });
    }
  }
);

// ==============================
// API：Dashboard 統計
// ==============================

app.get(
  "/api/admin/dashboard",
  authenticateAdmin,
  async (req, res) => {
    try {
      const productStatsResult = await pool.query(`
        SELECT
          COUNT(*)::int AS total_products,

          COUNT(*) FILTER (
            WHERE is_available = true
          )::int AS available_products,

          COUNT(*) FILTER (
            WHERE is_available = false
          )::int AS unavailable_products,

          COUNT(*) FILTER (
            WHERE stock <= 10
          )::int AS low_stock_products,

          COUNT(*) FILTER (
            WHERE stock = 0
          )::int AS out_of_stock_products
        FROM products
      `);

      const adminStatsResult = await pool.query(`
        SELECT
          COUNT(*)::int AS total_admins,

          COUNT(*) FILTER (
            WHERE is_active = true
          )::int AS active_admins
        FROM admins
      `);

      return res.json({
        success: true,
        data: {
          ...productStatsResult.rows[0],
          ...adminStatsResult.rows[0]
        }
      });
    } catch (error) {
      console.error(
        "取得 Dashboard 統計失敗：",
        error
      );

      return res.status(500).json({
        success: false,
        message: "取得 Dashboard 統計失敗"
      });
    }
  }
);

// ==============================
// API：新增商品
// owner、manager 可以新增
// ==============================

app.post(
  "/api/admin/products",
  authenticateAdmin,
  async (req, res) => {
    try {
      const role = req.admin.role;

      if (role !== "owner" && role !== "manager") {
        return res.status(403).json({
          success: false,
          message: "你的權限無法新增商品"
        });
      }

      const {
        name,
        category,
        description,
        salePrice,
        costPrice,
        unit,
        stock,
        imageUrl,
        isAvailable
      } = req.body;

      const trimmedName =
        typeof name === "string" ? name.trim() : "";

      const trimmedCategory =
        typeof category === "string"
          ? category.trim()
          : "";

      const trimmedDescription =
        typeof description === "string"
          ? description.trim()
          : "";

      const trimmedUnit =
        typeof unit === "string"
          ? unit.trim()
          : "";

      const trimmedImageUrl =
        typeof imageUrl === "string"
          ? imageUrl.trim()
          : "";

      if (!trimmedName) {
        return res.status(400).json({
          success: false,
          message: "請輸入商品名稱"
        });
      }

      if (!trimmedCategory) {
        return res.status(400).json({
          success: false,
          message: "請選擇商品分類"
        });
      }

      if (!trimmedUnit) {
        return res.status(400).json({
          success: false,
          message: "請輸入商品單位"
        });
      }

      const parsedSalePrice = Number(salePrice);
      const parsedCostPrice = Number(costPrice);
      const parsedStock = Number(stock);

      if (
        !Number.isFinite(parsedSalePrice) ||
        parsedSalePrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "售價格式不正確"
        });
      }

      if (
        !Number.isFinite(parsedCostPrice) ||
        parsedCostPrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "成本格式不正確"
        });
      }

      if (
        !Number.isInteger(parsedStock) ||
        parsedStock < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "庫存必須是大於或等於 0 的整數"
        });
      }

      const available =
        typeof isAvailable === "boolean"
          ? isAvailable
          : true;

      const result = await pool.query(
        `
        INSERT INTO products (
          name,
          category,
          description,
          sale_price,
          cost_price,
          unit,
          stock,
          image_url,
          is_available,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          NOW(),
          NOW()
        )
        RETURNING
          id,
          name,
          category,
          description,
          sale_price,
          cost_price,
          unit,
          stock,
          image_url,
          is_available,
          created_at,
          updated_at
        `,
        [
          trimmedName,
          trimmedCategory,
          trimmedDescription || null,
          parsedSalePrice,
          parsedCostPrice,
          trimmedUnit,
          parsedStock,
          trimmedImageUrl || null,
          available
        ]
      );

      return res.status(201).json({
        success: true,
        message: "商品新增成功",
        product: result.rows[0]
      });
    } catch (error) {
      console.error("新增商品失敗：", error);

      return res.status(500).json({
        success: false,
        message: "新增商品失敗"
      });
    }
  }
);

// ==============================
// API：取得商品列表
// ==============================

app.get(
  "/api/admin/products",
  authenticateAdmin,
  async (req, res) => {
    try {
      const keyword =
        typeof req.query.q === "string"
          ? req.query.q.trim()
          : "";

      const category =
        typeof req.query.category === "string"
          ? req.query.category.trim()
          : "";

      const status =
        typeof req.query.status === "string"
          ? req.query.status.trim()
          : "";

      const values = [];
      const conditions = [];

      if (keyword) {
        values.push(`%${keyword}%`);

        conditions.push(`
          (
            name ILIKE $${values.length}
            OR category ILIKE $${values.length}
            OR description ILIKE $${values.length}
          )
        `);
      }

      if (category) {
        values.push(category);

        conditions.push(
          `category = $${values.length}`
        );
      }

      if (status === "available") {
        conditions.push("is_available = true");
      }

      if (status === "unavailable") {
        conditions.push("is_available = false");
      }

      if (status === "low_stock") {
        conditions.push("stock <= 10");
      }

      if (status === "out_of_stock") {
        conditions.push("stock = 0");
      }

      const whereClause =
        conditions.length > 0
          ? `WHERE ${conditions.join(" AND ")}`
          : "";

      const result = await pool.query(
        `
        SELECT
          id,
          name,
          category,
          description,
          sale_price,
          cost_price,
          unit,
          stock,
          image_url,
          is_available,
          created_at,
          updated_at
        FROM products
        ${whereClause}
        ORDER BY
          is_available DESC,
          updated_at DESC,
          id DESC
        `,
        values
      );

      return res.json({
        success: true,
        products: result.rows
      });
    } catch (error) {
      console.error("取得商品列表失敗：", error);

      return res.status(500).json({
        success: false,
        message: "取得商品列表失敗"
      });
    }
  }
);

// ==============================
// API：切換商品上下架
// owner、manager 可以操作
// ==============================

app.patch(
  "/api/admin/products/:id/availability",
  authenticateAdmin,
  async (req, res) => {
    try {
      if (
        req.admin.role !== "owner" &&
        req.admin.role !== "manager"
      ) {
        return res.status(403).json({
          success: false,
          message: "你的權限無法修改商品狀態"
        });
      }

      const productId = Number(req.params.id);
      const { isAvailable } = req.body;

      if (
        !Number.isInteger(productId) ||
        productId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "商品編號不正確"
        });
      }

      if (typeof isAvailable !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "商品狀態格式不正確"
        });
      }

      const result = await pool.query(
        `
        UPDATE products
        SET
          is_available = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING
          id,
          name,
          is_available,
          updated_at
        `,
        [isAvailable, productId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "找不到商品"
        });
      }

      return res.json({
        success: true,
        message: isAvailable
          ? "商品已上架"
          : "商品已下架",
        product: result.rows[0]
      });
    } catch (error) {
      console.error("修改商品狀態失敗：", error);

      return res.status(500).json({
        success: false,
        message: "修改商品狀態失敗"
      });
    }
  }
);

// ==============================
// API：切換商品上下架
// owner、manager 可以操作
// ==============================

app.patch(
  "/api/admin/products/:id/availability",
  authenticateAdmin,
  async (req, res) => {
    try {
      if (
        req.admin.role !== "owner" &&
        req.admin.role !== "manager"
      ) {
        return res.status(403).json({
          success: false,
          message: "你的權限無法修改商品狀態"
        });
      }

      const productId = Number(req.params.id);
      const { isAvailable } = req.body;

      if (
        !Number.isInteger(productId) ||
        productId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "商品編號不正確"
        });
      }

      if (typeof isAvailable !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "商品狀態格式不正確"
        });
      }

      const result = await pool.query(
        `
        UPDATE products
        SET
          is_available = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING
          id,
          name,
          is_available,
          updated_at
        `,
        [isAvailable, productId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "找不到商品"
        });
      }

      return res.json({
        success: true,
        message: isAvailable
          ? "商品已上架"
          : "商品已下架",
        product: result.rows[0]
      });
    } catch (error) {
      console.error("修改商品狀態失敗：", error);

      return res.status(500).json({
        success: false,
        message: "修改商品狀態失敗"
      });
    }
  }
);

// ==============================
// API：前台商品總覽
// 不需要登入
// 只顯示已上架商品
// 不回傳成本與售價
// ==============================

app.get("/api/products", async (req, res) => {
  try {
    const keyword =
      typeof req.query.q === "string"
        ? req.query.q.trim()
        : "";

    const category =
      typeof req.query.category === "string"
        ? req.query.category.trim()
        : "";

    const values = [];
    const conditions = [
      "is_available = true"
    ];

    if (keyword) {
      values.push(`%${keyword}%`);

      conditions.push(`
        (
          name ILIKE $${values.length}
          OR category ILIKE $${values.length}
          OR description ILIKE $${values.length}
          OR unit ILIKE $${values.length}
        )
      `);
    }

    if (category) {
      values.push(category);

      conditions.push(
        `category = $${values.length}`
      );
    }

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        category,
        description,
        unit,
        stock,
        image_url,
        updated_at
      FROM products
      WHERE ${conditions.join(" AND ")}
      ORDER BY
        CASE
          WHEN stock > 0 THEN 0
          ELSE 1
        END,
        category ASC,
        name ASC
      `,
      values
    );

    return res.json({
      success: true,
      products: result.rows
    });
  } catch (error) {
    console.error("取得前台商品失敗：", error);

    return res.status(500).json({
      success: false,
      message: "取得商品資料失敗"
    });
  }
});

// ==============================
// API 找不到時回傳 JSON
// 必須放在所有 /api 路由後面
// ==============================

app.use("/api", (req, res) => {
  return res.status(404).json({
    success: false,
    message: "找不到此 API"
  });
});

// ==============================
// 一般頁面路由
// ==============================

// 首頁
app.get("/", (req, res) => {
  return res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

// 測試 admin 路由
app.get("/admin-test", (req, res) => {
  return res.send("admin 路由正常");
});

// 進入 /admin 時跳到登入頁
app.get("/admin", (req, res) => {
  return res.redirect("/admin/login.html");
});

// ==============================
// Express 5 萬用路由
// 一定要放在最後
// ==============================

app.get("/{*splat}", (req, res) => {
  return res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

// ==============================
// 啟動伺服器
// ==============================

const server = app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `國宏蛋行網站已啟動：http://localhost:${PORT}`
    );
  }
);

server.on("error", (error) => {
  console.error("伺服器啟動失敗：", error);
});