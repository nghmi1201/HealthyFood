document.addEventListener("DOMContentLoaded", () => {
    const copyBtn = document.getElementById("chCopyHashtagBtn");
    const hashtagEl = document.getElementById("chHashtagText");

    if (copyBtn && hashtagEl) {
        copyBtn.addEventListener("click", async () => {
            const text = hashtagEl.textContent.trim();
            try {
                await navigator.clipboard.writeText(text);
                copyBtn.textContent = "Đã sao chép ✓";
                setTimeout(() => {
                    copyBtn.textContent = "Sao chép hashtag";
                }, 2000);
            } catch {
                const tempInput = document.createElement("input");
                tempInput.value = text;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand("copy");
                document.body.removeChild(tempInput);
                copyBtn.textContent = "Đã sao chép ✓";
                setTimeout(() => {
                    copyBtn.textContent = "Sao chép hashtag";
                }, 2000);
            }
        });
    }
});