
(() => {
    // Xác định đường dẫn dựa trên vị trí file JS
    const scriptURL = new URL(document.currentScript.src);
    const dataURL = new URL("../data/products.json", scriptURL);

    // Tạo giao diện chat
    const chat = document.createElement("div");
    chat.className = "hf-chat";

    chat.innerHTML = `
        <button class="hf-chat-toggle" type="button">
            💬 Tư vấn món ăn
        </button>

        <section class="hf-chat-panel" hidden>
            <div class="hf-chat-header">
                <strong>🌿 Trợ lý HealthyFood</strong>
                <button class="hf-chat-close" type="button"
                        aria-label="Đóng">×</button>
            </div>

            <div class="hf-chat-messages" aria-live="polite"></div>

            <form class="hf-chat-form">
                <input class="hf-chat-input"
                       placeholder="Bạn muốn tìm món gì?"
                       maxlength="300"
                       aria-label="Câu hỏi tư vấn"
                       required>
                <button class="hf-chat-send" type="submit">
                    Gửi
                </button>
            </form>
        </section>
    `;

    document.body.appendChild(chat);

    const toggle = chat.querySelector(".hf-chat-toggle");
    const panel = chat.querySelector(".hf-chat-panel");
    const close = chat.querySelector(".hf-chat-close");
    const form = chat.querySelector(".hf-chat-form");
    const input = chat.querySelector(".hf-chat-input");
    const messages = chat.querySelector(".hf-chat-messages");

    toggle.addEventListener("click", () => {
        panel.hidden = !panel.hidden;
        toggle.setAttribute("aria-expanded", String(!panel.hidden));
        if (!panel.hidden) input.focus();
    });

    close.addEventListener("click", () => {
        panel.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
    });

    // Hiển thị tin nhắn, không chèn HTML từ người dùng
    function addMessage(text, type = "bot") {
        const bubble = document.createElement("div");
        bubble.className = "hf-chat-message hf-chat-" + type;
        bubble.textContent = text;
        messages.appendChild(bubble);
        messages.scrollTop = messages.scrollHeight;
    }

    // Chuyển tiếng Việt thành dạng dễ so sánh
    function normalize(text) {
        return String(text || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d");
    }

    // Đọc ngân sách: dưới 60k, dưới 60.000đ...
    function getBudget(text) {
        const match = text.match(
            /(?:duoi|toi da|khong qua|ngan sach|tam|khoang|gia)[^\d]{0,15}(\d[\d.,]*)\s*(k|nghin|ngan|trieu)?/
        );

        if (!match) return null;

        let value = Number(match[1].replace(/[.,]/g, ""));

        if (match[2] === "trieu") {
            value *= 1000000;
        } else if (
            ["k", "nghin", "ngan"].includes(match[2]) ||
            (value < 1000 && !match[2])
        ) {
            value *= 1000;
        }

        return Number.isFinite(value) && value > 0
            ? value
            : null;
    }

    // Đọc danh sách sản phẩm từ JSON
    const productPromise = fetch(dataURL)
        .then(response => {
            if (!response.ok) {
                throw new Error("Không tải được sản phẩm");
            }
            return response.json();
        });

    function addProduct(product) {
        const link = document.createElement("a");
        link.className = "hf-chat-product";

        const url = new URL(
            "../../pages/product-detail.html",
            scriptURL
        );
        url.searchParams.set("id", product.id);

        link.href = url.href;
        link.textContent =
            `${product.name} — ${Number(product.price).toLocaleString("vi-VN")}đ`;

        messages.appendChild(link);
        messages.scrollTop = messages.scrollHeight;
    }

    // Xử lý câu hỏi tư vấn
    async function answer(question) {
        const q = normalize(question);

        // Không khẳng định an toàn với bệnh lý hoặc dị ứng
        if (/di ung|khong an duoc|tieu duong|benh than/.test(q)) {
            addMessage(
                "Mình chưa có đủ dữ liệu thành phần và chất gây dị ứng " +
                "để xác nhận món nào an toàn. Bạn nên kiểm tra nhãn " +
                "sản phẩm hoặc hỏi nhân viên trước khi lựa chọn."
            );
            return;
        }

        let products;

        try {
            products = await productPromise;
        } catch (error) {
            addMessage("Không tải được products.json. Hãy kiểm tra Live Server.");
            return;
        }

        const budget = getBudget(q);

        const wantsDrink = /do uong|nuoc ep|sinh to|tra xanh/.test(q);
        const wantsSnack = /an vat|snack/.test(q);
        const wantsLowCal = /giam can|it calo|an kieng/.test(q);
        const wantsEatClean = /eat clean/.test(q);

        const wantsProtein = /protein|tang co|giau dam/.test(q);

        // Lọc sản phẩm đang hiển thị và còn hàng
        let results = products.filter(p =>
            normalize(p.visible) === "co" &&
            Number(p.inStock) > 0 &&
            Number(p.price) > 0
        );

        // Lọc theo mức giá
        if (budget !== null) {
            results = results.filter(p => Number(p.price) <= budget);
        }

        // Lọc theo loại sản phẩm
        if (wantsDrink) {
            results = results.filter(p =>
                normalize(p.category).includes("do uong")
            );
        } else if (wantsSnack) {
            results = results.filter(p =>
                normalize(p.category).includes("an vat")
            );
        }

        // Lọc theo nhãn chế độ ăn trong JSON
        if (wantsLowCal) {
            results = results.filter(p =>
                normalize(p.dietType).includes("it calo")
            );
        } else if (wantsEatClean) {
            results = results.filter(p =>
                normalize(p.dietType).includes("eat clean")
            );
        }

        // Tìm kiếm theo tên món nếu người dùng hỏi cụ thể
        const keywords = [
            "ga", "ca hoi", "gao lut", "com", "yen mach",
            "granola", "salad", "sua hat"
        ];

        const keyword = keywords.find(word => q.includes(word));

        if (keyword) {
            results = results.filter(p =>
                normalize(p.name + " " + p.description).includes(keyword)
            );
        }

        // Sắp xếp theo giá tăng dần, ưu tiên món hợp túi tiền
        results.sort((a, b) => Number(a.price) - Number(b.price));

        if (wantsProtein) {
            addMessage(
                "Dữ liệu cửa hàng chưa có số gram protein cho từng món. " +
                "Mình chỉ có thể gợi ý sản phẩm để bạn xem thêm thành phần."
            );
        }

        if (results.length === 0) {
            addMessage(
                "Mình chưa tìm thấy món phù hợp với các tiêu chí đó. " +
                "Bạn có thể thử tăng ngân sách hoặc đổi loại món nhé!"
            );
            return;
        }

        addMessage(
            "Mình tìm được một số sản phẩm phù hợp trong HealthyFood. " +
            "Bạn có thể bấm vào từng món để xem chi tiết:"
        );

        results.slice(0, 3).forEach(addProduct);

        if (wantsLowCal) {
            addMessage(
                "Các món này được gắn nhãn Ít calo trong dữ liệu cửa hàng; " +
                "chưa có số calo cụ thể để đánh giá khẩu phần."
            );
        }
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const question = input.value.trim();
        if (!question) return;

        addMessage(question, "user");
        input.value = "";

        try {
            await answer(question);
        } catch (error) {
            console.error(error);
            addMessage("Có lỗi xảy ra khi tư vấn. Bạn hãy thử lại.");
        }
    });

    addMessage(
        "Xin chào! 🌿 Mình là trợ lý HealthyFood.\n" +
        "Bạn muốn tìm món Eat Clean, món ít calo, " +
        "đồ uống hay thực phẩm theo ngân sách?\n" +
        "Ví dụ: Gợi ý món Eat Clean dưới 60k."
    );
})();
