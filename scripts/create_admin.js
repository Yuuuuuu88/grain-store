require("dotenv").config();

const bcrypt = require("bcrypt");
const pool = require("../db");

async function createAdmin() {
  const username = "kyle";
  const password = "Aa521385";
  const displayName = "店家管理員";
  const role = "owner";

  try {
    const existingAdmin = await pool.query(
      `
      SELECT id
      FROM admins
      WHERE username = $1
      `,
      [username]
    );

    if (existingAdmin.rowCount > 0) {
      console.log("這個管理員帳號已經存在");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `
      INSERT INTO admins (
        username,
        password_hash,
        display_name,
        role
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, display_name, role
      `,
      [username, passwordHash, displayName, role]
    );

    console.log("管理員建立成功：");
    console.log(result.rows[0]);
    console.log("");
    console.log(`登入帳號：${username}`);
    console.log(`登入密碼：${password}`);
  } catch (error) {
    console.error("建立管理員失敗：", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

createAdmin();