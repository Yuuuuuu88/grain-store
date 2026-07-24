const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("缺少 DATABASE_URL 環境變數");
}

const isProduction = process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // Render PostgreSQL 外部連線通常需要 SSL
  ssl: isProduction
    ? {
        rejectUnauthorized: false
      }
    : {
        rejectUnauthorized: false
      }
});

pool.on("error", (error) => {
  console.error("PostgreSQL 連線池發生錯誤：", error);
});

module.exports = pool;