/* =========================================
   CART.JS - LÕI GIỎ HÀNG HEALTHYFOOD
   - Lưu giỏ hàng bằng localStorage => giữ nguyên khi chuyển trang / tải lại
   - Tự cập nhật chữ "Giỏ hàng (n)" ở header mọi trang có nạp file này
========================================= */
(function () {
    const KEY = "healthyfood_cart_v1";
    const inPages = window.location.pathname.indexOf("/pages/") !== -1;
    const CART_URL = inPages ? "cart.html" : "pages/cart.html";

    function read() {
        try {
            const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
            return Array.isArray(raw) ? raw : [];
        } catch (e) {
            return [];
        }
    }

    function write(items) {
        try {
            localStorage.setItem(KEY, JSON.stringify(items));
        } catch (e) {
            console.error("Không lưu được giỏ hàng:", e);
        }
        refreshHeader();
        document.dispatchEvent(new CustomEvent("cart:change"));
    }

    function maxQty(item) {
        const stock = Number(item.inStock);
        return stock > 0 ? Math.min(stock, 99) : 99;
    }

    const Cart = {
        url: CART_URL,

        items: read,

        count() {
            return read().reduce((sum, i) => sum + i.qty, 0);
        },

        subtotal() {
            return read().reduce((sum, i) => sum + i.price * i.qty, 0);
        },

        saved() {
            return read().reduce((sum, i) => {
                const gap = Number(i.comparePrice || 0) - i.price;
                return sum + (gap > 0 ? gap * i.qty : 0);
            }, 0);
        },

        // Thêm sản phẩm; trả về { ok, qty, limited }
        add(product, qty) {
            qty = Math.max(1, Number(qty) || 1);
            const items = read();
            let item = items.find(i => String(i.id) === String(product.id));

            if (!item) {
                item = {
                    id: product.id,
                    name: product.name,
                    image: product.image || "",
                    price: Number(product.price || 0),
                    comparePrice: Number(product.comparePrice || 0),
                    unit: product.unit || "",
                    weight: product.weight || "",
                    weightUnit: product.weightUnit || "",
                    inStock: Number(product.inStock || 0),
                    qty: 0
                };
                items.push(item);
            }

            const limit = maxQty(item);
            const wanted = item.qty + qty;
            item.qty = Math.min(wanted, limit);
            write(items);
            return { ok: true, qty: item.qty, limited: wanted > limit };
        },

        setQty(id, qty) {
            const items = read();
            const item = items.find(i => String(i.id) === String(id));
            if (!item) return;
            item.qty = Math.max(1, Math.min(Number(qty) || 1, maxQty(item)));
            write(items);
        },

        remove(id) {
            write(read().filter(i => String(i.id) !== String(id)));
        },

        clear() {
            write([]);
        },

        maxQty,

        toast(message) {
            let box = document.getElementById("cartToast");
            if (!box) {
                box = document.createElement("div");
                box.id = "cartToast";
                box.setAttribute("role", "status");
                box.setAttribute("aria-live", "polite");
                document.body.appendChild(box);
            }
            box.innerHTML = message;
            box.classList.add("show");
            clearTimeout(box._timer);
            box._timer = setTimeout(() => box.classList.remove("show"), 2600);
        },

        formatVND(n) {
            return Number(n || 0).toLocaleString("vi-VN") + " ₫";
        }
    };

    // Các nút "Giỏ hàng (0)" ở header của từng trang
    function cartButtons() {
        const nodes = document.querySelectorAll("header button, header a, .btn-cart, .cart-button");
        return Array.from(nodes).filter(el => /^\s*Giỏ hàng/.test(el.textContent));
    }

    function refreshHeader() {
        const n = Cart.count();
        cartButtons().forEach(el => {
            el.textContent = "Giỏ hàng (" + n + ")";
            el.setAttribute("aria-label", "Xem giỏ hàng, " + n + " sản phẩm");
        });
    }

    function bindHeader() {
        cartButtons().forEach(el => {
            if (el.dataset.cartBound) return;
            el.dataset.cartBound = "1";
            el.addEventListener("click", function (e) {
                e.preventDefault();
                window.location.href = CART_URL;
            });
        });
        refreshHeader();
    }

    // Style cho thông báo nhanh (tự chèn để trang nào cũng dùng được)
    const style = document.createElement("style");
    style.textContent =
        "#cartToast{position:fixed;left:50%;bottom:28px;z-index:9999;max-width:calc(100% - 32px);" +
        "padding:12px 20px;border-radius:10px;background:#205c32;color:#fff;font-size:15px;" +
        "box-shadow:0 8px 22px rgba(35,75,45,.25);opacity:0;pointer-events:none;" +
        "transform:translate(-50%,12px);transition:opacity .2s,transform .2s}" +
        "#cartToast.show{opacity:1;transform:translate(-50%,0)}" +
        "#cartToast a{color:#fff;font-weight:bold;margin-left:10px;text-decoration:underline}";
    document.head.appendChild(style);

    // Đồng bộ khi mở giỏ ở tab khác
    window.addEventListener("storage", function (e) {
        if (e.key === KEY) {
            refreshHeader();
            document.dispatchEvent(new CustomEvent("cart:change"));
        }
    });

    document.addEventListener("DOMContentLoaded", bindHeader);
    window.HFCart = Cart;
})();