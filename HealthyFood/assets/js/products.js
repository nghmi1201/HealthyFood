
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

                    <button
                        type="button"
                        class="detail-button"
                        data-product-id="${id}"
                    >
                        Xem chi tiết
                    </button>
                </div>
            </article>
        `;
    }).join("");

    $("#productContainer").html(cards);
}

// Xem chi tiết sản phẩm khi nhấn nút
$("#productContainer").on("click", ".detail-button", function () {
    const id = String($(this).attr("data-product-id"));
    const product = products.find(p => String(p.id) === id);

    if (!product) return;

    const name = escapeHTML(product.name || "Sản phẩm");
    const image = escapeHTML(product.image || "");
    const description = escapeHTML(product.description || product.shortDescription || "Chưa có mô tả.");
    const price = Number(product.price || 0);
    const weight = [product.weight, product.weightUnit].filter(Boolean).join(" ");

    $("#productDetailContainer").html(`
        <div class="detail-layout">
            <img src="${image}" alt="${name}" onerror="this.style.display='none'">
            <div>
                <h3>${name}</h3>
                <p>${description}</p>
                <p><strong>Danh mục:</strong> ${escapeHTML(product.category || "Chưa phân loại")}</p>
                <p><strong>Giá:</strong> ${price.toLocaleString("vi-VN")} ₫</p>
                ${weight ? `<p><strong>Trọng lượng:</strong> ${escapeHTML(weight)}</p>` : ""}
                <button type="button" id="closeDetail">Đóng chi tiết</button>
            </div>
        </div>
    `);

    $("#product-detail").prop("hidden", false);
    $("#product-detail")[0].scrollIntoView({ behavior: "smooth" });
});

$("#productDetailContainer").on("click", "#closeDetail", function () {
    $("#product-detail").prop("hidden", true);
});

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
