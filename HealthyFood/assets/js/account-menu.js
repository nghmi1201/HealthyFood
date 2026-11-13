
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
        const username = document.createElement("span");
        username.className = "account-name";
        username.textContent = "👤 " + data.user.fullName;

     

        // Nút đăng xuất
        const logoutBtn = document.createElement("button");
        logoutBtn.type = "button";
        logoutBtn.className = "account-btn";
        logoutBtn.textContent = "Đăng xuất";

        // Thay nút Đăng nhập bằng tên và hai nút mới
        accountLink.replaceWith(username, logoutBtn);

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
