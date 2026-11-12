
// Lấy form liên hệ
const contactForm = document.querySelector("#contactForm");

// Lấy khu vực hiển thị thông báo
const notification = document.querySelector("#notification");

// Xử lý khi người dùng nhấn nút gửi
contactForm.addEventListener("submit", function(event) {

    // Ngăn form tải lại trang
    event.preventDefault();

    // Lấy dữ liệu người dùng nhập
    const name = document.querySelector("#name").value.trim();
    const email = document.querySelector("#email").value.trim();
    const phone = document.querySelector("#phone").value.trim();
    const message = document.querySelector("#message").value.trim();

    // Kiểm tra dữ liệu
    if (name === "" || email === "" || phone === "" || message === "") {

        notification.textContent = "Vui lòng nhập đầy đủ thông tin!";
        notification.style.color = "red";

    } else {

        notification.textContent = "Cảm ơn bạn đã liên hệ HealthyFood!";
        notification.style.color = "green";

        // Xóa dữ liệu trong form
        contactForm.reset();
    }

});
