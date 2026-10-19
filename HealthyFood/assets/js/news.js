let newsList = [];

$(document).ready(function () {
    $.ajax({
        url: "assets/data/News.json",
        method: "GET",
        dataType: "json",

        success: function (data) {
            // Bài mới nhất lên đầu
            newsList = data.sort(function (a, b) {
                return b.date.localeCompare(a.date) || a.id - b.id;
            });

            buildCategoryOptions();
            applyFilters();
            route();
        },

        error: function (xhr, status, error) {
            console.error("Lỗi tải News.json:", error);
            $("#newsCount").text("Không tải được dữ liệu tin tức.");
            $("#newsContainer").html(
                "<p class='news-empty'>Hãy kiểm tra đường dẫn JSON và chạy trang bằng Live Server.</p>"
            );
        }
    });

    $("#newsSearch, #newsCategory").on("input change", applyFilters);
    $(window).on("hashchange", route);
});

/* ---------- Tiện ích ---------- */

function formatDate(iso) {
    const p = iso.split("-");
    return p[2] + "/" + p[1] + "/" + p[0];
}

function buildCategoryOptions() {
    const cats = [];
    newsList.forEach(function (n) {
        if (cats.indexOf(n.category) === -1) cats.push(n.category);
    });
    cats.forEach(function (c) {
        $("#newsCategory").append($("<option>").val(c).text(c));
    });
}

/* ---------- Danh sách ---------- */

function createCard(n) {
    const $card = $("<article>")
        .addClass("news-card")
        .attr({ tabindex: 0, role: "link" })
        .on("click", function () { openArticle(n.id); })
        .on("keydown", function (e) {
            if (e.key === "Enter") openArticle(n.id);
        });

    const $info = $("<div>").addClass("news-info")
        .append($("<p>").addClass("news-category").text(n.category))
        .append($("<h3>").text(n.title))
        .append($("<p>").addClass("news-summary").text(n.summary))
        .append($("<p>").addClass("news-date").text(formatDate(n.date) + " · " + n.author));

    return $card
        .append($("<div>").addClass("news-thumb").text(n.icon || "🥗"))
        .append($info);
}

function applyFilters() {
    const keyword = String($("#newsSearch").val() || "").toLowerCase().trim();
    const category = $("#newsCategory").val();

    const result = newsList.filter(function (n) {
        const text = [n.title, n.summary, n.lead, n.category].join(" ").toLowerCase();
        return text.indexOf(keyword) !== -1 &&
            (category === "all" || n.category === category);
    });

    const $box = $("#newsContainer").empty();
    $("#newsCount").text("Hiển thị " + result.length + " / " + newsList.length + " bài viết");

    if (result.length === 0) {
        $box.append($("<p>").addClass("news-empty").text("Không tìm thấy bài viết phù hợp."));
        return;
    }
    result.forEach(function (n) { $box.append(createCard(n)); });
}

/* ---------- Chi tiết ---------- */

function openArticle(id) {
    window.location.hash = "bai-" + id;
}

function route() {
    const m = /^#bai-(\d+)$/.exec(window.location.hash);
    const article = m && newsList.find(function (n) { return n.id === Number(m[1]); });

    if (!article) {
        $("#news-detail-view").prop("hidden", true);
        $("#news-list-view").prop("hidden", false);
        return;
    }
    renderArticle(article);
    $("#news-list-view").prop("hidden", true);
    $("#news-detail-view").prop("hidden", false);
    window.scrollTo(0, 0);
}

function renderList(items) {
    const $ul = $("<ul>");
    items.forEach(function (it) {
        const $li = $("<li>");
        if (it.label) $li.append($("<strong>").text(it.label + (it.text ? " " : "")));
        if (it.text) $li.append(document.createTextNode(it.text));
        if (it.sub) $li.append(renderList(it.sub));
        $ul.append($li);
    });
    return $ul;
}

function renderArticle(n) {
    document.title = n.title + " - HealthyFood";
    $("#articleBreadcrumb").text("Tin tức / " + n.category);
    $("#articleTitle").text(n.title);
    $("#articleMeta").text("Đăng bởi: " + n.author + " | Ngày: " + formatDate(n.date));
    $("#articleLead").text(n.lead);
    $("#articleSignature").text(n.signature);

    const $body = $("#articleBody").empty();
    n.content.forEach(function (b) {
        if (b.type === "p") {
            $body.append($("<p>").text(b.text));
        } else if (b.type === "list") {
            $body.append(renderList(b.items));
        } else if (b.type === "quote") {
            $body.append(
                $("<blockquote>")
                    .append($("<strong>").text(b.by))
                    .append($("<em>").text("\u201C" + b.text + "\u201D"))
            );
        }
    });

    const $rel = $("#relatedContainer").empty();
    newsList.filter(function (x) { return x.id !== n.id; })
        .slice(0, 3)
        .forEach(function (x) { $rel.append(createCard(x)); });
}

$(document).on("click", "#backToList", function (e) {
    e.preventDefault();
    history.pushState("", document.title, window.location.pathname);
    document.title = "HealthyFood - Tin Tức";
    route();
});
