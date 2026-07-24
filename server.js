require("dotenv").config();

const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const pool = require("./db");

const {
  authenticateAdmin
} = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) {
  throw new Error("缺少 JWT_SECRET 環境變數");
}

// 解析 JSON
app.use(express.json());

// 提供 public 靜態檔案
app.use(express.static(path.join(__dirname, "public")));

// 測試伺服器
app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS now");

    res.json({
      success: true,
      message: "伺服器與資料庫連線正常",
      databaseTime: result.rows[0].now
    });
  } catch (error) {
    console.error("資料庫測試失敗：", error);

    res.status(500).json({
      success: false,
      message: "資料庫連線失敗"
    });
  }
});

// 管理員登入
app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !password
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

// 測試 JWT 是否有效
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
          role: admin.role
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

// 首頁
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Express 5 萬用路由
app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`國宏蛋行網站已啟動：http://localhost:${PORT}`);
});