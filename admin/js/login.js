"use strict";

const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");
const togglePasswordButton =
  document.getElementById("togglePasswordButton");

function showMessage(message, type = "error") {
  loginMessage.textContent = message;
  loginMessage.className = `message ${type}`;
}

function clearMessage() {
  loginMessage.textContent = "";
  loginMessage.className = "message";
}

togglePasswordButton.addEventListener("click", () => {
  const isPassword =
    passwordInput.type === "password";

  passwordInput.type =
    isPassword ? "text" : "password";

  togglePasswordButton.textContent =
    isPassword ? "隱藏" : "顯示";
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showMessage("請輸入帳號和密碼");
    return;
  }

  loginButton.disabled = true;
  loginButton.textContent = "登入中...";

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        username,
        password
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "登入失敗，請稍後再試"
      );
    }

    localStorage.setItem(
      "adminToken",
      data.token
    );

    localStorage.setItem(
      "admin",
      JSON.stringify(data.admin)
    );

    showMessage("登入成功，正在進入後台……", "success");

    setTimeout(() => {
      window.location.href = "/admin/dashboard.html";
    }, 700);
  } catch (error) {
    console.error("登入失敗：", error);

    showMessage(
      error.message || "無法連線到伺服器"
    );
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "登入";
  }
});

// 已登入時直接進入後台
const existingToken =
  localStorage.getItem("adminToken");

if (existingToken) {
  fetch("/api/admin/me", {
    headers: {
      Authorization: `Bearer ${existingToken}`
    }
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("登入已失效");
      }

      return response.json();
    })
    .then((data) => {
      if (data.success) {
        localStorage.setItem(
          "admin",
          JSON.stringify(data.admin)
        );

        window.location.href =
          "/admin/dashboard.html";
      }
    })
    .catch(() => {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("admin");
    });
}