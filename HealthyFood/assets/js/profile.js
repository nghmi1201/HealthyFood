const $id = id => document.getElementById(id);
const api = "http://127.0.0.1:3000/api/profile/contact";
const form = $id("profileForm");
const fields = $id("editFields");
const fileInput = $id("avatar");
const message = $id("profileMessage");

let saved;
let draftAvatar = "";

function showAvatar(image, name) {
    const preview = $id("avatarPreview");
    $id("avatarLetter").textContent = (name || "?").trim().charAt(0).toUpperCase();
    preview.hidden = !image;

    if (image) preview.src = image;
    else preview.removeAttribute("src");
}

function showSavedValues() {
    $id("fullName").value = saved.fullName;
    $id("birthday").value = saved.birthday || "";
    $id("gender").value = saved.gender || "";
    $id("profileEmail").textContent = saved.email || "Chưa cập nhật";
    $id("profilePhone").textContent = saved.phone || "Chưa cập nhật";

    fileInput.value = "";
    draftAvatar = saved.avatar || "";
    showAvatar(draftAvatar, saved.fullName);
}

function setEditing(editing) {
    fields.disabled = !editing;
    $id("photoRow").hidden = !editing;
    $id("editBtn").hidden = editing;
    $id("cancelBtn").hidden = !editing;
    $id("saveBtn").hidden = !editing;
}

async function loadProfile() {
    $id("editBtn").disabled = true;
    try {
        const res = await fetch(api, { credentials: "include", cache: "no-store" });
        if (res.status === 401) {
            window.location.replace("login.html");
            return;
        }
        if (!res.ok) throw new Error("Không tải được hồ sơ.");

        saved = await res.json();
        showSavedValues();
        setEditing(false);
        $id("editBtn").disabled = false;
    } catch (error) {
        message.textContent = error.message;
    }
}

$id("editBtn").onclick = () => {
    setEditing(true);
    message.textContent = "";
    $id("fullName").focus();
};

$id("cancelBtn").onclick = () => {
    showSavedValues();
    setEditing(false);
    message.textContent = "Đã hủy chỉnh sửa.";
};

// Thu nhỏ ảnh trước khi gửi để server có thể lưu cùng hồ sơ
fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    fields.disabled = true;
    $id("saveBtn").disabled = true;
    $id("cancelBtn").disabled = true;

    try {
        const image = new Image();
        image.src = url;
        await image.decode();

        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 192;
        const side = Math.min(image.naturalWidth, image.naturalHeight);
        const x = (image.naturalWidth - side) / 2;
        const y = (image.naturalHeight - side) / 2;
        canvas.getContext("2d").drawImage(image, x, y, side, side, 0, 0, 192, 192);

        draftAvatar = canvas.toDataURL("image/jpeg", 0.8);
        showAvatar(draftAvatar, $id("fullName").value);
        message.textContent = "Ảnh xem trước. Bấm Lưu thay đổi để lưu.";
    } catch {
        message.textContent = "Không đọc được ảnh. Hãy chọn ảnh khác.";
    } finally {
        URL.revokeObjectURL(url);
        fields.disabled = false;
        $id("saveBtn").disabled = false;
        $id("cancelBtn").disabled = false;
    }
};

form.onsubmit = async event => {
    event.preventDefault();
    if (!saved || fields.disabled || $id("saveBtn").hidden) return;

    const changes = {
        id: saved.id,
        fullName: $id("fullName").value.trim(),
        birthday: $id("birthday").value,
        gender: $id("gender").value,
        avatar: draftAvatar
    };

    fields.disabled = true;
    $id("saveBtn").disabled = true;
    $id("cancelBtn").disabled = true;
    message.textContent = "Đang lưu…";

    try {
        const res = await fetch(api, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(changes)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message || "Chưa lưu được.");

        Object.assign(saved, result);
        showSavedValues();
        setEditing(false);
        message.textContent = "Đã lưu thay đổi.";
    } catch (error) {
        fields.disabled = false;
        message.textContent = error.message;
    } finally {
        $id("saveBtn").disabled = false;
        $id("cancelBtn").disabled = false;
    }
};

loadProfile();