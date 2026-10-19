
$(document).ready(function () {
    $.ajax({
        url: "assets/data/News.json",
        method: "GET",
        dataType: "json",

        success: function (data) {
            const latest = data
                .sort(function (a, b) {
                    return b.date.localeCompare(a.date) || a.id - b.id;
                })
                .slice(0, 3);

            const $box = $("#homeNews").empty();

            latest.forEach(function (n) {
                const $card = $("<article>").addClass("news-card");
                const $link = $("<a>")
                    .addClass("news-link")
                    .attr("href", "News.html#bai-" + n.id);

                $link.append(
                    $("<div>").addClass("news-img").css("font-size", "56px").text(n.icon || "🥗")
                ).append(
                    $("<div>").addClass("news-body")
                        .append($("<h3>").text(n.title))
                        .append($("<p>").text(n.summary))
                );

                $box.append($card.append($link));
            });
        },

        error: function (xhr, status, error) {
            console.error("Lỗi tải News.json:", error);
            $("#homeNews").html("<p>Không tải được tin tức. Hãy chạy trang bằng Live Server.</p>");
        }
    });
});