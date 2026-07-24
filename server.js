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