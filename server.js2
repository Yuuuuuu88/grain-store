const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// 解析 JSON
app.use(express.json());

// 提供 public 資料夾內的靜態檔案
app.use(express.static(path.join(__dirname, "public")));

// 首頁
app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

// 其他網址都回到首頁
// Express 5 必須使用有名稱的萬用路由
app.get("/{*splat}", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

// 啟動伺服器
app.listen(PORT, "0.0.0.0", () => {
  console.log(`國宏蛋行網站已啟動`);
  console.log(`Port：${PORT}`);
});