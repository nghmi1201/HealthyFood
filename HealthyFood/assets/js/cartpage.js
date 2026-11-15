/* =========================================
   CART-PAGE.JS - TRANG GIỎ HÀNG
   Hiển thị giỏ, form khách hàng, đặt hàng,
   xuất báo giá (Excel / ảnh / in), 
========================================= */
(function () {
    const Cart = window.HFCart;
    const API_ORDERS = "http://127.0.0.1:3000/api/orders";
    const API_ME = "http://127.0.0.1:3000/api/me";
    const PENDING_KEY = "healthyfood_pending_orders";

    const $ = (id) => document.getElementById(id);
    const money = Cart.formatVND;
    let orderPlaced = false;

    // Danh sách rút gọn; chọn "Tỉnh/thành khác" thì nhập thẳng vào ô địa chỉ
    const LOCATIONS = {
        "Hà Nội": ["Ba Đình", "Hoàn Kiếm", "Hai Bà Trưng", "Đống Đa", "Tây Hồ", "Cầu Giấy", "Thanh Xuân", "Hoàng Mai", "Long Biên", "Nam Từ Liêm", "Bắc Từ Liêm", "Hà Đông"],
        "TP. Hồ Chí Minh": ["Quận 1", "Quận 3", "Quận 5", "Quận 7", "Bình Thạnh", "Phú Nhuận", "Tân Bình", "Thủ Đức"],
        "Đà Nẵng": ["Hải Châu", "Thanh Khê", "Sơn Trà", "Ngũ Hành Sơn", "Liên Chiểu", "Cẩm Lệ"],
        "Hải Phòng": ["Hồng Bàng", "Ngô Quyền", "Lê Chân", "Hải An"],
        "Cần Thơ": ["Ninh Kiều", "Bình Thủy", "Cái Răng"]
    };

    function esc(value) {
        return String(value)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    /* ---------- Hiển thị giỏ hàng ---------- */

    const trashIcon =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/>' +
        '<path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>';

    function itemHTML(item) {
        const max = Cart.maxQty(item);
        const gap = item.comparePrice - item.price;
        const percent = gap > 0 ? Math.round((gap / item.comparePrice) * 100) : 0;
        const meta = [item.weight ? item.weight + (item.weightUnit || "") : "", item.unit]
            .filter(Boolean).join(" · ");

        return `
        <div class="cart-item" data-id="${esc(item.id)}">
            <img src="${esc(item.image)}" alt="${esc(item.name)}" onerror="this.style.visibility='hidden'">
            <div>
                <a class="cart-item-name" href="product-detail.html?id=${encodeURIComponent(item.id)}">${esc(item.name)}</a>
                ${meta ? `<p class="cart-item-meta">${esc(meta)}</p>` : ""}
                ${percent > 0 ? `<p class="cart-promo">Khuyến mại: giảm ${percent}% so với giá gốc</p>` : ""}
            </div>
            <div class="qty">
                <button type="button" data-act="dec" aria-label="Giảm số lượng" ${item.qty <= 1 ? "disabled" : ""}>&minus;</button>
                <input type="number" min="1" max="${max}" value="${item.qty}" data-act="qty" aria-label="Số lượng">
                <button type="button" data-act="inc" aria-label="Tăng số lượng" ${item.qty >= max ? "disabled" : ""}>+</button>
            </div>
            <div class="cart-item-price">
                <strong>${money(item.price * item.qty)}</strong>
                ${gap > 0 ? `<del>${money(item.comparePrice * item.qty)}</del>` : ""}
            </div>
            <button type="button" class="cart-remove" data-act="remove" aria-label="Xóa ${esc(item.name)} khỏi giỏ">${trashIcon}</button>
        </div>`;
    }

    function render() {
        if (orderPlaced) return;
        const items = Cart.items();
        const empty = items.length === 0;

        $("cartEmpty").hidden = !empty;
        $("cartLayout").hidden = empty;
        if (empty) return;

        $("cartItems").innerHTML = items.map(itemHTML).join("");

        const saved = Cart.saved();
        $("sumSubtotal").textContent = money(Cart.subtotal());
        $("sumTotal").textContent = money(Cart.subtotal());
        $("sumSaved").textContent = money(saved);
        $("sumSaveRow").hidden = saved <= 0;
    }

    $("cartItems").addEventListener("click", function (e) {
        const btn = e.target.closest("[data-act]");
        if (!btn || btn.dataset.act === "qty") return;
        const id = btn.closest(".cart-item").dataset.id;
        const item = Cart.items().find(i => String(i.id) === id);
        if (!item) return;

        if (btn.dataset.act === "remove") Cart.remove(id);
        if (btn.dataset.act === "dec") Cart.setQty(id, item.qty - 1);
        if (btn.dataset.act === "inc") {
            if (item.qty >= Cart.maxQty(item)) {
                Cart.toast("Chỉ còn " + Cart.maxQty(item) + " sản phẩm trong kho.");
                return;
            }
            Cart.setQty(id, item.qty + 1);
        }
    });

    $("cartItems").addEventListener("change", function (e) {
        if (e.target.dataset.act !== "qty") return;
        const id = e.target.closest(".cart-item").dataset.id;
        const item = Cart.items().find(i => String(i.id) === id);
        const wanted = Number(e.target.value) || 1;
        if (item && wanted > Cart.maxQty(item)) {
            Cart.toast("Chỉ còn " + Cart.maxQty(item) + " sản phẩm trong kho.");
        }
        Cart.setQty(id, wanted);
        render();
    });

    $("clearCart").addEventListener("click", function () {
        if (confirm("Xóa toàn bộ sản phẩm trong giỏ hàng?")) Cart.clear();
    });

    document.addEventListener("cart:change", render);

    /* ---------- Tỉnh / Quận ---------- */

    function fillProvinces() {
        const sel = $("province");
        sel.innerHTML = '<option value="">Tỉnh/Thành phố</option>' +
            Object.keys(LOCATIONS).map(p => `<option>${esc(p)}</option>`).join("") +
            '<option value="other">Tỉnh/thành khác</option>';
    }

    $("province").addEventListener("change", function () {
        const sel = $("district");
        const list = LOCATIONS[this.value];
        if (list) {
            sel.disabled = false;
            sel.innerHTML = '<option value="">Quận/Huyện</option>' +
                list.map(d => `<option>${esc(d)}</option>`).join("");
        } else {
            sel.disabled = true;
            sel.innerHTML = '<option value="">' +
                (this.value === "other" ? "Nhập trong ô địa chỉ" : "Quận/Huyện") + "</option>";
        }
    });

    $("needInvoice").addEventListener("change", function () {
        $("companyFields").hidden = !this.checked;
    });

    /* ---------- Kiểm tra form ---------- */

    function setInvalid(inputId, bad) {
        $(inputId).closest(".field").classList.toggle("invalid", bad);
        return bad;
    }

    function validate() {
        const phone = $("phone").value.replace(/[\s.]/g, "");
        const email = $("email").value.trim();
        const checks = [
            ["fullName", !$("fullName").value.trim()],
            ["phone", !/^(0|\+84)\d{9}$/.test(phone)],
            ["email", email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)],
            ["address", !$("address").value.trim()]
        ];
        if ($("needInvoice").checked) {
            checks.push(["company", !$("company").value.trim()]);
            checks.push(["taxCode", !/^\d{10}(-?\d{3})?$/.test($("taxCode").value.trim())]);
        }

        let firstBad = null;
        checks.forEach(([id, bad]) => {
            setInvalid(id, bad);
            if (bad && !firstBad) firstBad = id;
        });
        if (firstBad) $(firstBad).focus();
        return !firstBad;
    }

    $("orderForm").addEventListener("input", function (e) {
        const field = e.target.closest(".field");
        if (field) field.classList.remove("invalid");
    });

    /* ---------- Đặt hàng ---------- */

    function buildOrder() {
        const invoice = $("needInvoice").checked ? {
            company: $("company").value.trim(),
            taxCode: $("taxCode").value.trim(),
            companyAddress: $("companyAddress").value.trim()
        } : null;

        return {
            customer: {
                fullName: $("fullName").value.trim(),
                phone: $("phone").value.replace(/[\s.]/g, ""),
                email: $("email").value.trim(),
                address: $("address").value.trim(),
                province: $("province").selectedOptions[0].value === "other" ? "Tỉnh/thành khác" : $("province").value,
                district: $("district").disabled ? "" : $("district").value,
                note: $("note").value.trim()
            },
            invoice: invoice,
            items: Cart.items().map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
            paymentMethod: "cod",
            total: Cart.subtotal()
        };
    }

    function showMessage(text) {
        const box = $("formMessage");
        box.textContent = text || "";
        box.hidden = !text;
    }

    async function sendOrder(order) {
        try {
            const res = await fetch(API_ORDERS, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(order)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                // Máy chủ từ chối (dữ liệu sai): báo lại cho khách, không lưu tạm
                return { rejected: true, message: data.message || "Không thể đặt hàng, vui lòng thử lại." };
            }
            return { orderId: data.orderId, local: false };
        } catch (e) {
            // Chưa bật server: lưu tạm trên trình duyệt để không mất đơn
            const orderId = "HF" + Date.now().toString(36).toUpperCase();
            try {
                const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
                pending.push(Object.assign({ orderId: orderId, createdAt: new Date().toISOString() }, order));
                localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
            } catch (err) { /* bỏ qua */ }
            return { orderId: orderId, local: true };
        }
    }

    async function placeOrder() {
        showMessage("");
        if (Cart.items().length === 0) return;
        if (!validate()) return;

        const btn = $("btnOrder");
        btn.disabled = true;
        btn.textContent = "Đang gửi đơn...";

        const order = buildOrder();
        const result = await sendOrder(order);

        btn.disabled = false;
        btn.textContent = "Đặt hàng";

        if (result.rejected) {
            showMessage(result.message);
            return;
        }
        showDone(result, order);
    }

    function showDone(result, order) {
        orderPlaced = true;
        Cart.clear();
        $("cartLayout").hidden = true;
        $("cartEmpty").hidden = true;

        const localNote = result.local
            ? `<p class="cart-item-meta">Đơn đang được lưu tạm trên trình duyệt vì chưa kết nối được máy chủ.</p>` : "";

        const box = $("orderDone");
        box.innerHTML = `
            <h1>Đặt hàng thành công</h1>
            <p>Cảm ơn ${esc(order.customer.fullName)}. HealthyFood sẽ gọi đến số ${esc(order.customer.phone)} để xác nhận đơn.</p>
            <span class="order-code">Mã đơn: ${esc(result.orderId)}</span>
            <p>Thành tiền: <strong>${money(order.total)}</strong></p>
            ${localNote}
            <p><a class="cart-back" href="product.html">&lsaquo; Tiếp tục mua sắm</a></p>`;
        box.hidden = false;
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    $("orderForm").addEventListener("submit", function (e) {
        e.preventDefault();
        placeOrder();
    });

    /* ---------- Báo giá: dữ liệu chung ---------- */

    function quoteData() {
        const now = new Date();
        return {
            date: now.toLocaleDateString("vi-VN") + " " + now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
            fileStamp: now.toISOString().slice(0, 10),
            name: $("fullName").value.trim(),
            phone: $("phone").value.trim(),
            items: Cart.items(),
            total: Cart.subtotal()
        };
    }

    function requireItems() {
        if (Cart.items().length === 0) {
            Cart.toast("Giỏ hàng đang trống.");
            return false;
        }
        return true;
    }

    function download(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /* ---------- Tải file Excel (SpreadsheetML, mở trực tiếp bằng Excel) ---------- */

    function exportExcel() {
        if (!requireItems()) return;
        const q = quoteData();
        const str = (v, style) => `<Cell${style ? ` ss:StyleID="${style}"` : ""}><Data ss:Type="String">${esc(v)}</Data></Cell>`;
        const num = (v, style) => `<Cell${style ? ` ss:StyleID="${style}"` : ""}><Data ss:Type="Number">${v}</Data></Cell>`;
        const row = (cells) => `<Row>${cells.join("")}</Row>`;

        const rows = [
            row([str("BÁO GIÁ HEALTHYFOOD", "title")]),
            row([str("Ngày lập: " + q.date)]),
            row([str("Khách hàng: " + (q.name || "...") + (q.phone ? " - " + q.phone : ""))]),
            row([]),
            row(["STT", "Sản phẩm", "Đơn vị", "Đơn giá (₫)", "Số lượng", "Thành tiền (₫)"].map(h => str(h, "head")))
        ];
        q.items.forEach((i, idx) => {
            rows.push(row([num(idx + 1), str(i.name), str(i.unit || ""), num(i.price, "money"), num(i.qty), num(i.price * i.qty, "money")]));
        });
        rows.push(row([str(""), str(""), str(""), str(""), str("Thành tiền (đã gồm VAT)", "head"), num(q.total, "moneyBold")]));

        const xml = '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>' +
            '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
            '<Styles>' +
            '<Style ss:ID="title"><Font ss:Bold="1" ss:Size="14" ss:Color="#205C32"/></Style>' +
            '<Style ss:ID="head"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#287943" ss:Pattern="Solid"/></Style>' +
            '<Style ss:ID="money"><NumberFormat ss:Format="#,##0"/></Style>' +
            '<Style ss:ID="moneyBold"><Font ss:Bold="1"/><NumberFormat ss:Format="#,##0"/></Style>' +
            '</Styles><Worksheet ss:Name="Bao gia"><Table>' +
            '<Column ss:Width="40"/><Column ss:Width="280"/><Column ss:Width="60"/><Column ss:Width="90"/><Column ss:Width="70"/><Column ss:Width="110"/>' +
            rows.join("") + '</Table></Worksheet></Workbook>';

        download(new Blob([xml], { type: "application/vnd.ms-excel" }), "bao-gia-healthyfood-" + q.fileStamp + ".xls");
    }

    /* ---------- Tải ảnh báo giá (vẽ bằng canvas) ---------- */

    function fitText(ctx, text, maxWidth) {
        if (ctx.measureText(text).width <= maxWidth) return text;
        while (text.length > 1 && ctx.measureText(text + "…").width > maxWidth) text = text.slice(0, -1);
        return text + "…";
    }

    function exportImage() {
        if (!requireItems()) return;
        const q = quoteData();
        const W = 900, ROW = 46, scale = 2;
        const H = 250 + q.items.length * ROW + 120;

        const canvas = document.createElement("canvas");
        canvas.width = W * scale;
        canvas.height = H * scale;
        const ctx = canvas.getContext("2d");
        ctx.scale(scale, scale);

        const font = (size, weight) => `${weight || "normal"} ${size}px Arial, Helvetica, sans-serif`;
        const text = (t, x, y, align) => { ctx.textAlign = align || "left"; ctx.fillText(t, x, y); };

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, W, H);

        // Dải tiêu đề
        ctx.fillStyle = "#287943";
        ctx.fillRect(0, 0, W, 86);
        ctx.fillStyle = "#ffffff";
        ctx.font = font(30, "bold");
        text("HealthyFood", 40, 54);
        ctx.font = font(20, "bold");
        text("BÁO GIÁ", W - 40, 52, "right");

        // Thông tin chung
        ctx.fillStyle = "#34483a";
        ctx.font = font(15);
        text("Ngày lập: " + q.date, 40, 124);
        text("Khách hàng: " + (q.name || "...") + (q.phone ? " - " + q.phone : ""), 40, 148);

        // Tiêu đề bảng
        const top = 176;
        const cols = { name: 40, price: 600, qty: 680, total: W - 40 };
        ctx.fillStyle = "#eaf3e8";
        ctx.fillRect(30, top, W - 60, 38);
        ctx.fillStyle = "#205c32";
        ctx.font = font(14, "bold");
        text("Sản phẩm", cols.name, top + 24);
        text("Đơn giá", cols.price, top + 24, "right");
        text("SL", cols.qty + 20, top + 24, "center");
        text("Thành tiền", cols.total, top + 24, "right");

        // Dòng sản phẩm
        let y = top + 38;
        q.items.forEach(function (i) {
            ctx.fillStyle = "#34483a";
            ctx.font = font(15);
            text(fitText(ctx, i.name, 500), cols.name, y + 29);
            text(money(i.price), cols.price, y + 29, "right");
            text(String(i.qty), cols.qty + 20, y + 29, "center");
            ctx.font = font(15, "bold");
            text(money(i.price * i.qty), cols.total, y + 29, "right");
            ctx.fillStyle = "#dce5d9";
            ctx.fillRect(30, y + ROW - 1, W - 60, 1);
            y += ROW;
        });

        // Tổng tiền
        ctx.fillStyle = "#34483a";
        ctx.font = font(16);
        text("Thành tiền (đã gồm VAT)", cols.total - 220, y + 42, "right");
        ctx.fillStyle = "#d9534f";
        ctx.font = font(24, "bold");
        text(money(q.total), cols.total, y + 44, "right");
        ctx.fillStyle = "#657568";
        ctx.font = font(13);
        text("Báo giá mang tính tham khảo tại thời điểm lập.", 40, y + 90);

        canvas.toBlob(function (blob) {
            if (blob) download(blob, "bao-gia-healthyfood-" + q.fileStamp + ".png");
        }, "image/png");
    }

    /* ---------- In báo giá ---------- */

    function printQuote() {
        if (!requireItems()) return;
        const q = quoteData();
        $("printArea").innerHTML = `
            <h1>HealthyFood - Báo giá</h1>
            <div>Ngày lập: ${esc(q.date)}</div>
            <div>Khách hàng: ${esc(q.name || "...")}${q.phone ? " - " + esc(q.phone) : ""}</div>
            <table>
                <thead><tr><th>STT</th><th>Sản phẩm</th><th class="num">Đơn giá</th><th class="num">SL</th><th class="num">Thành tiền</th></tr></thead>
                <tbody>${q.items.map((i, idx) => `
                    <tr><td>${idx + 1}</td><td>${esc(i.name)}</td><td class="num">${money(i.price)}</td>
                    <td class="num">${i.qty}</td><td class="num">${money(i.price * i.qty)}</td></tr>`).join("")}
                </tbody>
            </table>
            <div class="print-total">Thành tiền (đã gồm VAT): ${money(q.total)}</div>`;
        window.print();
    }

    $("btnExcel").addEventListener("click", exportExcel);
    $("btnImage").addEventListener("click", exportImage);
    $("btnPrint").addEventListener("click", printQuote);

    /* ---------- Điền sẵn thông tin nếu khách đã đăng nhập ---------- */

    async function prefill() {
        try {
            const res = await fetch(API_ME, { credentials: "include" });
            if (!res.ok) return;
            const data = await res.json();
            if (!data.loggedIn || !data.user) return;
            if (data.user.fullName && !$("fullName").value) $("fullName").value = data.user.fullName;
            if (data.user.phone && !$("phone").value) $("phone").value = data.user.phone;
            if (data.user.email && !$("email").value) $("email").value = data.user.email;
        } catch (e) { /* chưa bật server: bỏ qua */ }
    }

    fillProvinces();
    render();
    prefill();
})();