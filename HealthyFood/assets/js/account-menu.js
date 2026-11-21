
async function updateAccountMenu() {
    const accountLink = document.getElementById("accountLink");

    if (!accountLink) return;

    try {
        // Kiểm tra khách hàng đã đăng nhập chưa
        const response = await fetch(
            "http://127.0.0.1:3000/api/me",
            { credentials: "include" }
        );

        if (!response.ok) return;

        const data = await response.json();

        // Chưa đăng nhập thì giữ nguyên nút Đăng nhập
        if (!data.loggedIn || !data.user) return;

        // Lưu đường dẫn trang đăng nhập
        const loginUrl = accountLink.href;

        // Hiển thị tên khách hàng
       const username = document.createElement("button");
username.type = "button";
username.className = "account-avatar";
username.title = "Mở menu tài khoản";
username.setAttribute("aria-label", "Mở menu tài khoản");

// Ví dụ: "Duy Anh Nguyễn" sẽ hiện chữ D khi chưa có ảnh.
username.textContent = data.user.fullName.trim().charAt(0).toUpperCase() || "👤";
     

        // Nút đăng xuất
        const logoutBtn = document.createElement("button");
        logoutBtn.type = "button";
        logoutBtn.className = "account-btn";
        logoutBtn.textContent = "Đăng xuất";

       // Khung chứa avatar và menu xổ xuống
const accountBox = document.createElement("div");
accountBox.className = "account-box";

const menu = document.createElement("div");
menu.className = "account-dropdown";
menu.id = "accountDropdown";
menu.hidden = true;

// Mục 1: Xem thông tin cá nhân
const profileBtn = document.createElement("button");
profileBtn.type = "button";
profileBtn.textContent = "Xem thông tin cá nhân";

profileBtn.addEventListener("click", () => {
    window.location.href = new URL("profile.html", accountLink.href).href;
});

// Mục 2: Góp ý, mở thẳng đến biểu mẫu ở trang Liên hệ
const feedbackLink = document.createElement("a");
feedbackLink.textContent = "Góp ý";
feedbackLink.href = new URL("contact.html#contactForm", accountLink.href);
feedbackLink.addEventListener("click", () => setMenuOpen(false));

// Mục 3: Đưa nút Đăng xuất hiện có vào trong menu
menu.append(profileBtn, feedbackLink, logoutBtn);
accountBox.append(username, menu);
accountLink.replaceWith(accountBox);

// Bấm avatar để mở, bấm lần nữa để đóng
username.setAttribute("aria-controls", menu.id);
username.setAttribute("aria-expanded", "false");

function setMenuOpen(open) {
    menu.hidden = !open;
    username.setAttribute("aria-expanded", String(open));
}

username.addEventListener("click", () => setMenuOpen(menu.hidden));

// Bấm ra ngoài hoặc nhấn Esc để đóng menu
document.addEventListener("click", (event) => {
    if (!accountBox.contains(event.target)) setMenuOpen(false);
});

accountBox.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        setMenuOpen(false);
        username.focus();
    }
});

        // Hàm đăng xuất
        async function logout(changeAccount = false) {
            try {
                const result = await fetch(
                    "http://127.0.0.1:3000/api/logout",
                    {
                        method: "POST",
                        credentials: "include"
                    }
                );

                if (!result.ok) {
                    throw new Error("Đăng xuất thất bại");
                }

                if (changeAccount) {
                    // Quay về trang đăng nhập tài khoản khác
                    window.location.href = loginUrl;
                } else {
                    // Tải lại trang, hiện nút Đăng nhập
                    window.location.reload();
                }

            } catch (error) {
                alert(error.message);
            }
        }

        // Xử lý nút
        logoutBtn.addEventListener("click", () => logout(false));
     

    } catch (error) {
        console.error("Lỗi kiểm tra tài khoản:", error);
    }
}

document.addEventListener("DOMContentLoaded", updateAccountMenu);
