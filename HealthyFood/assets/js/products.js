let products = [];

$(document).ready(function () {
    $.ajax({
        url: "../assets/data/products.json",
        method: "GET",
        dataType: "json",

        success: function (data) {
            // Chỉ hiển thị sản phẩm được đánh dấu là nhìn thấy 
            products = data.filter(function (p) {
                return String(p.visible || "Có").toLowerCase() === "có";
             });

            applyFilters();
        },

        error: function (xhr, status, error) {
            console.error("Lỗi tải products.json:", error);
            $("#productCount").text("Không tải được dữ liệu sản phẩm.");
            $("#productContainer").html(
                "<p>Hãy kiểm tra đường dẫn JSON và chạy trang bằng Live Server.</p>"
            );
        }
    });

    $("#search, #category, #sort").on("input change", applyFilters);
});

function getCategoryGroup(product) {
    // Ưu tiên danh mục đã có trong file JSON
    const category = String(product.category || "")
        .toLowerCase()
        .trim();

    if (category.includes("đồ ăn tốt cho sức khỏe")) return "food";
    if (category.includes("đồ uống tốt cho sức khỏe")) return "drink";
    if (category.includes("đồ khô tốt cho sức khỏe")) return "dry-food";
    if (category.includes("đồ ăn vặt tốt cho sức khỏe")) return "snack";

    // Dự phòng cho dữ liệu chưa có danh mục chuẩn
    const text = [
        product.name,
        product.tags,
        product.category
    ].join(" ").toLowerCase();

    if (/nước|trà|sữa|nước ép|đồ uống/.test(text)) return "drink";
    if (/granola|hạt dinh dưỡng|bánh quy|thanh protein|snack|ăn vặt/.test(text)) return "snack";
    if (/yến mạch|gạo lứt|bún khô|mì khô|ngũ cốc|đồ khô/.test(text)) return "dry-food";
    if (category) return "food";

    return "other";
}

function applyFilters() {
    const keyword = String($("#search").val() || "")
        .toLowerCase()
        .trim();

    const selectedCategory = $("#category").val();
    const sortType = $("#sort").val();

    let result = products.filter(function (product) {
        const searchableText = [
            product.name,
            product.shortDescription,
            product.description,
            product.brand,
            product.category,
            product.tags
        ].join(" ").toLowerCase();

        const matchesKeyword = searchableText.includes(keyword);

        const matchesCategory =
            selectedCategory === "all" ||
            getCategoryGroup(product) === selectedCategory;

        return matchesKeyword && matchesCategory;
    });

    if (sortType === "price-asc") {
        result.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sortType === "price-desc") {
        result.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    }

    displayProducts(result);
}

function displayProducts(list) {
    $("#productCount").text("Tìm thấy " + list.length + " sản phẩm");

    if (list.length === 0) {
        $("#productContainer").html(
            "<p>Không tìm thấy sản phẩm phù hợp.</p>"
        );
        return;
    }

    const cards = list.map(function (product) {
        const id = escapeHTML(product.id ?? "");
        const name = escapeHTML(product.name || "Sản phẩm");
        const image = escapeHTML(product.image || "");
        const description = escapeHTML(product.shortDescription || "");
        const price = Number(product.price || 0);
        const inStock = Number(product.inStock || 0);

        return `
            <article class="product-card">
                <img
                    class="product-image"
                    src="${image}"
                    alt="${name}"
                    loading="lazy"
                    onerror="this.style.display='none'"
                >

                <div class="product-info">
                    <p class="product-category">
                        ${escapeHTML(product.category || "HealthyFood")}
                    </p>

                    <h3>${name}</h3>
                    <p class="product-description">${description}</p>

                    <p class="product-price">
                        ${price.toLocaleString("vi-VN")} ₫
                    </p>

                    <p class="stock-status">
                        ${inStock > 0 ? "Còn hàng" : "Tạm hết hàng"}
                    </p>

                    <!-- ĐÃ SỬA: CHUYỂN NÚT THÀNH THẺ A DẪN SANG TRANG MỚI -->
                    <a
                        href="product-detail.html?id=${id}"
                        class="detail-button"
                        style="text-decoration: none; display: inline-block; text-align: center;"
                    >
                        Xem chi tiết
                    </a>
                </div>
            </article>
        `;
    }).join("");

    $("#productContainer").html(cards);
}

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// TỰ ĐỘNG ĐỔ DỮ LIỆU SẢN PHẨM KHI VÀO TRANG PRODUCT-DETAIL.HTML
$(document).ready(function () {
    if (window.location.pathname.includes('product-detail.html')) {
        // Lấy ID sản phẩm từ URL (?id=...)
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');

        // Đọc dữ liệu từ file products.json
        $.getJSON('../assets/data/products.json', function (data) {
            // Tìm sản phẩm theo id
            const product = data.find(item => String(item.id) === String(productId)) || data[0];

            if (product) {
                $('#breadcrumbTitle').text(product.name);

                const detailHTML = `
                    <div class="detail-image-col">
                        <img src="${product.image}" alt="${product.name}">
                    </div>
                    <div class="detail-info-col">
                        <h1>${product.name}</h1>
                        <div class="price">${Number(product.price).toLocaleString('vi-VN')} ₫${Number(product.comparePrice) > Number(product.price) ? `<span class="compare-price">${Number(product.comparePrice).toLocaleString('vi-VN')} ₫</span>` : ''}</div>
                        <div class="meta-info">
                            <p><strong>Danh mục:</strong> ${product.category || 'Đồ ăn tốt cho sức khỏe'}</p>
                            <p><strong>Trọng lượng:</strong> ${product.weight || '400g'}</p>
                            <p><strong>Trạng thái:</strong> ${Number(product.inStock || 0) > 0 ? 'Còn hàng' : 'Tạm hết hàng'}</p>
                        </div>
                        <div class="description">
                            <p><strong>Thông tin chi tiết sản phẩm:</strong></p>
                            <p>${product.description || product.shortDescription || 'Món ăn được chế biến từ những nguyên liệu tươi ngon, lựa chọn kỹ lưỡng nhằm mang đến hương vị hài hòa và giàu dinh dưỡng.'}</p>
                        </div>
                        <div class="buy-row">
                            <div class="qty">
                                <button type="button" id="qtyMinus" aria-label="Giảm số lượng">&minus;</button>
                                <input type="number" id="qtyInput" min="1" value="1" aria-label="Số lượng">
                                <button type="button" id="qtyPlus" aria-label="Tăng số lượng">+</button>
                            </div>
                            <button type="button" class="btn-add-cart" id="btnAddCart">Thêm vào giỏ</button>
                            <button type="button" class="btn-buy-now" id="btnBuyNow">Mua ngay</button>
                        </div>
                    </div>
                `;

                $('#productDetailContainer').html(detailHTML);
                setupCartControls(product);
            }
        });
    }
});

// ===== GIỎ HÀNG TRÊN TRANG CHI TIẾT =====
function setupCartControls(product) {
    const stock = Number(product.inStock || 0);
    const max = stock > 0 ? Math.min(stock, 99) : 1;
    const $qty = $('#qtyInput');

    $qty.attr('max', max);

    if (stock <= 0) {
        // Hết hàng: không cho thêm vào giỏ
        $('#qtyMinus, #qtyPlus, #qtyInput, #btnAddCart, #btnBuyNow').prop('disabled', true);
        return;
    }

    function readQty() {
        const n = parseInt($qty.val(), 10);
        return Math.max(1, Math.min(isNaN(n) ? 1 : n, max));
    }

    $('#qtyMinus').on('click', function () { $qty.val(Math.max(1, readQty() - 1)); });
    $('#qtyPlus').on('click', function () {
        if (readQty() >= max) {
            HFCart.toast('Chỉ còn ' + max + ' sản phẩm trong kho.');
            return;
        }
        $qty.val(readQty() + 1);
    });
    $qty.on('change', function () { $qty.val(readQty()); });

    $('#btnAddCart').on('click', function () {
        const result = HFCart.add(product, readQty());
        const link = '<a href="' + HFCart.url + '">Xem giỏ hàng</a>';
        HFCart.toast(result.limited
            ? 'Giỏ đã có tối đa ' + result.qty + ' sản phẩm (hết hàng trong kho). ' + link
            : 'Đã thêm vào giỏ hàng. ' + link);
    });

    // Mua ngay: thêm vào giỏ rồi sang trang giỏ hàng để đặt
    $('#btnBuyNow').on('click', function () {
        HFCart.add(product, readQty());
        window.location.href = HFCart.url;
    });
}