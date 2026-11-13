
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const message = document.getElementById("authMessage");

// Hiển thị thông báo
function showMessage(text, success = false) {
    message.textContent = text;
    message.style.color = success ? "#287943" : "#c0392b";
}

// Chuyển đổi giữa đăng nhập và đăng ký
function showTab(tab) {
    const isLogin = tab === "login";

    loginForm.hidden = !isLogin;
    registerForm.hidden = isLogin;

    tabLogin.classList.toggle("active", isLogin);
    tabRegister.classList.toggle("active", !isLogin);

    showMessage("");
}

tabLogin.addEventListener("click", () => showTab("login"));
tabRegister.addEventListener("click", () => showTab("register"));

// Hàm gọi API Backend

async function sendRequest(url, data) {
    const response = await fetch(
        "http://127.0.0.1:3000" + url,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify(data)
        }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(result.message || "Yêu cầu thất bại");
    }

    return result;
}


// XỬ LÝ ĐĂNG KÝ
registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const password = document.getElementById("registerPassword").value;
    const confirm = document.getElementById("confirmPassword").value;

    if (password !== confirm) {
        showMessage("Hai mật khẩu không khớp!");
        return;
    }

    try {
        const result = await sendRequest("/api/register", {
            fullName,
            email,
            phone,
            password
        });

        registerForm.reset();
        showTab("login");

        document.getElementById("loginEmail").value = email;
        showMessage(result.message + ". Hãy đăng nhập.", true);

    } catch (error) {
        showMessage(error.message);
    }
});

// XỬ LÝ ĐĂNG NHẬP
loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    try {
        const result = await sendRequest("/api/login", {
            email,
            password
        });

        showMessage(result.message, true);

        // Quay về trang chủ sau khi đăng nhập
        window.location.href = "../index.html";

    } catch (error) {
        showMessage(error.message);
    }
});
