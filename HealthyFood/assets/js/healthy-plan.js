// =========================================
// HEALTHY PLAN + GOOGLE GEMINI AI COACH
// =========================================

let hpCurrentStep = 0;
let hpPlanMeals = [];
let hpOrderInfo = {
    dietLabel: "Eat Clean Cân Bằng",
    pkg: "lunch_dinner",
    days: 7,
    unitPrice: 55000,
    slots: ["Bữa Trưa", "Bữa Tối"]
};

const hpStepTitles = [
    "01. Xác định mục tiêu & thời gian",
    "02. Chỉ số cơ thể",
    "03. Khẩu vị & Suất ăn",
    "04. Lịch tập luyện",
    "05. Lộ trình cá nhân hóa từ AI"
];

function hpGetApiKey() {
    return (window.GEMINI_API_KEY || "").trim();
}

function hpSyncCartButton() {
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    const totalQty = cart.reduce((s, i) => s + (i.quantity || 1), 0);
    const cartBtn = document.querySelector(".btn-cart");
    if (cartBtn) {
        cartBtn.textContent = `Giỏ hàng (${totalQty})`;
    }
}

function hpUpdateUI() {
    const steps = document.querySelectorAll(".hp-step");
    const pSteps = document.querySelectorAll("[data-progress-step]");
    const fill = document.getElementById("hp-progress-fill");
    const nameEl = document.getElementById("hp-step-name");
    const labelEl = document.getElementById("hp-step-label");
    const prevBtn = document.getElementById("hp-prev-btn");
    const nextBtn = document.getElementById("hp-next-btn");

    steps.forEach((el, i) => {
        el.classList.toggle("active", i === hpCurrentStep);
        el.style.display = i === hpCurrentStep ? "block" : "none";
    });

    pSteps.forEach((el, i) => {
        el.classList.remove("current", "completed");
        if (i < hpCurrentStep) el.classList.add("completed");
        if (i === hpCurrentStep) el.classList.add("current");
    });

    if (fill) fill.style.width = ((hpCurrentStep + 1) / steps.length) * 100 + "%";
    if (nameEl) nameEl.textContent = hpStepTitles[hpCurrentStep];
    if (labelEl) labelEl.textContent = `Bước ${hpCurrentStep + 1} / ${steps.length}`;

    if (prevBtn) prevBtn.hidden = hpCurrentStep === 0;
    if (nextBtn) {
        if (hpCurrentStep === steps.length - 1) {
            nextBtn.style.display = "none";
        } else {
            nextBtn.style.display = "inline-flex";
            nextBtn.textContent = hpCurrentStep === steps.length - 2 ? "Nhận lộ trình AI miễn phí →" : "Tiếp tục →";
        }
    }

    if (hpCurrentStep === steps.length - 1) {
        hpGenerateSummary();
        hpRunAIPlanner();
    }
}

function hpNextStep() {
    const steps = document.querySelectorAll(".hp-step");

    if (hpCurrentStep === 0) {
        const goal = document.querySelector('input[name="goal"]:checked');
        if (!goal) {
            alert("Vui lòng chọn 1 mục tiêu vóc dáng trước khi tiếp tục!");
            return;
        }
    }

    if (hpCurrentStep === 1) {
        const metrics = hpCalcMetrics();
        if (!metrics) {
            alert("Vui lòng nhập đầy đủ giới tính, tuổi, chiều cao và cân nặng!");
            return;
        }
    }

    if (hpCurrentStep < steps.length - 1) {
        hpCurrentStep++;
        hpUpdateUI();
        document.querySelector(".hp-progress-area")?.scrollIntoView({ behavior: "smooth" });
    }
}

function hpPrevStep() {
    if (hpCurrentStep > 0) {
        hpCurrentStep--;
        hpUpdateUI();
        document.querySelector(".hp-progress-area")?.scrollIntoView({ behavior: "smooth" });
    }
}

function hpCalcMetrics() {
    const gender = document.querySelector('input[name="gender"]:checked')?.value;
    const age = parseFloat(document.getElementById("hp-age")?.value);
    const height = parseFloat(document.getElementById("hp-height")?.value);
    const weight = parseFloat(document.getElementById("hp-weight")?.value);
    const activity = parseFloat(document.getElementById("hp-activity")?.value);

    if (!gender || !age || !height || !weight) return null;

    const bmi = (weight / ((height / 100) ** 2)).toFixed(1);
    const bmr = Math.round(10 * weight + 6.25 * height - 5 * age + (gender === "male" ? 5 : -161));
    const tdee = activity ? Math.round(bmr * activity) : Math.round(bmr * 1.375);

    const bmiEl = document.getElementById("hp-bmi");
    const bmrEl = document.getElementById("hp-bmr");
    const tdeeEl = document.getElementById("hp-tdee");

    if (bmiEl) bmiEl.textContent = bmi;
    if (bmrEl) bmrEl.textContent = bmr.toLocaleString("vi-VN") + " kcal";
    if (tdeeEl) tdeeEl.textContent = tdee.toLocaleString("vi-VN") + " kcal";

    return { bmi, bmr, tdee };
}

function hpAutoFillFromCalculator() {
    const raw = localStorage.getItem("healthyfood_calculator");
    if (!raw) return;

    let data;
    try {
        data = JSON.parse(raw);
    } catch (e) {
        return;
    }

    if (data.gender) {
        const radio = document.querySelector(`input[name="gender"][value="${data.gender}"]`);
        if (radio) radio.checked = true;
    }
    if (data.age) document.getElementById("hp-age").value = data.age;
    if (data.height) document.getElementById("hp-height").value = data.height;
    if (data.weight) document.getElementById("hp-weight").value = data.weight;
    if (data.activity) document.getElementById("hp-activity").value = data.activity;

    hpCalcMetrics();

    const notice = document.getElementById("hp-calculator-notice");
    const syncText = document.getElementById("hp-sync-summary");
    if (notice) {
        notice.style.display = "flex";
        if (syncText && data.tdee) {
            syncText.textContent = `Đã đồng bộ chỉ số từ trang Tính Calo (BMI: ${data.bmi} · TDEE: ${Number(data.tdee).toLocaleString("vi-VN")} kcal/ngày). Bạn có thể bấm Tiếp tục ngay!`;
        }
    }
}

function hpPreselectGoalFromURL() {
    const goal = new URLSearchParams(window.location.search).get("goal");
    if (!goal) return;

    const radio = document.querySelector(`input[name="goal"][value="${CSS.escape(goal)}"]`);
    if (radio) radio.checked = true;
}

function hpGetFormPayload() {
    const metrics = hpCalcMetrics() || { bmi: 21, bmr: 1450, tdee: 1800 };
    const goal = document.querySelector('input[name="goal"]:checked')?.value || "healthy";
    const planDays = parseInt(document.querySelector('input[name="planDuration"]:checked')?.value || "7", 10);
    const goalDetail = document.getElementById("hp-goal-detail")?.value.trim() || "Không có";
    const gender = document.querySelector('input[name="gender"]:checked')?.value === "male" ? "Nam" : "Nữ";
    const age = document.getElementById("hp-age")?.value || 25;
    const height = document.getElementById("hp-height")?.value || 165;
    const weight = document.getElementById("hp-weight")?.value || 55;
    const limitations = document.getElementById("hp-limitations")?.value.trim() || "Không có";
    const diet = document.querySelector('input[name="diet"]:checked')?.value || "eatclean";
    const pkg = document.getElementById("hp-meal-package")?.value || "lunch_dinner";
    const budget = document.getElementById("hp-budget")?.value || "120000";
    const allergy = document.getElementById("hp-allergy")?.value.trim() || "Không có";
    const place = document.querySelector('input[name="workoutPlace"]:checked')?.value || "home";
    const duration = document.querySelector('input[name="duration"]:checked')?.value || "45";

    let cal = metrics.tdee;
    if (goal === "lose") cal = Math.max(1200, metrics.tdee - 400);
    if (goal === "gain") cal = metrics.tdee + 350;
    if (goal === "muscle") cal = metrics.tdee + 250;

    let pRatio = 0.3, cRatio = 0.4, fRatio = 0.3;
    if (diet === "low_carb") {
        pRatio = 0.35;
        cRatio = 0.15;
        fRatio = 0.5;
    }

    return {
        metrics,
        goal,
        planDays,
        goalDetail,
        gender,
        age,
        height,
        weight,
        limitations,
        diet,
        pkg,
        budget,
        allergy,
        place,
        duration,
        cal,
        p: Math.round((cal * pRatio) / 4),
        c: Math.round((cal * cRatio) / 4),
        f: Math.round((cal * fRatio) / 9)
    };
}

function hpGenerateSummary() {
    const data = hpGetFormPayload();

    document.getElementById("hp-target-calories").textContent = data.cal.toLocaleString("vi-VN") + " kcal";
    document.getElementById("hp-macro-protein").textContent = data.p + "g / ngày";
    document.getElementById("hp-macro-carb").textContent = `${data.c}g C · ${data.f}g F`;

    const dietMap = {
        eatclean: "Eat Clean Cân Bằng",
        high_protein: "High-Protein Tăng Cơ",
        low_carb: "Low-Carb / Keto",
        vegetarian: "Thuần Chay Healthy"
    };
    const goalMap = {
        lose: "Giảm Cân",
        gain: "Tăng Cân",
        muscle: "Tăng Cơ",
        maintain: "Giữ Dáng",
        healthy: "Thanh Lọc"
    };
    const placeMap = { home: "Tại nhà", gym: "Phòng Gym", outdoor: "Ngoài trời" };

    const pkgConfig = {
        self_cook: { label: `Tự nấu theo công thức ${data.planDays} ngày (Miễn phí 0đ)`, unitPrice: 0, slots: [] },
        lunch_only: { label: `Bữa Trưa (1 bữa/ngày · ${data.planDays} ngày)`, unitPrice: 60000, slots: ["Bữa Trưa"] },
        lunch_dinner: { label: `Trưa + Tối (2 bữa/ngày · ${data.planDays} ngày)`, unitPrice: 55000, slots: ["Bữa Trưa", "Bữa Tối"] },
        full_day: { label: `Trọn gói cả ngày (3 bữa + Snack · ${data.planDays} ngày)`, unitPrice: 42500, slots: ["Bữa Sáng", "Bữa Trưa", "Bữa Phụ", "Bữa Tối"] }
    };

    const selectedPkg = pkgConfig[data.pkg] || pkgConfig.lunch_dinner;
    const totalMeals = selectedPkg.slots.length * data.planDays;
    const totalPrice = selectedPkg.unitPrice * totalMeals;
    const title = `Gói ${dietMap[data.diet]} - ${goalMap[data.goal]} ${data.planDays} Ngày`;

    hpOrderInfo = {
        dietLabel: dietMap[data.diet],
        pkg: data.pkg,
        days: data.planDays,
        unitPrice: selectedPkg.unitPrice,
        slots: selectedPkg.slots
    };

    document.getElementById("hp-rec-package-title").textContent = title;
    document.getElementById("hp-rec-package-desc").textContent = totalMeals > 0
        ? `Gồm đầy đủ ${totalMeals} suất ăn tươi chế biến theo ngày (${selectedPkg.slots.join(", ")}). Hiển thị chi tiết từng suất trong giỏ hàng.`
        : `Nhận miễn phí lộ trình AI & thực đơn ${data.planDays} ngày chuẩn ${data.cal.toLocaleString("vi-VN")} kcal/ngày để tự chế biến.`;

    const addBtn = document.getElementById("hp-add-plan-to-cart");
    if (addBtn) {
        addBtn.innerHTML = totalMeals > 0
            ? `Đặt ${totalMeals} suất ăn (${data.planDays} ngày) · ${totalPrice.toLocaleString("vi-VN")}đ <span>🛒</span>`
            : `Lưu lộ trình miễn phí (0đ) <span>📥</span>`;
    }

    document.getElementById("rev-duration").textContent = `${data.planDays} ngày`;
    document.getElementById("rev-diet").textContent = dietMap[data.diet];
    document.getElementById("rev-package").textContent = selectedPkg.label;
    document.getElementById("rev-workout").textContent = `${placeMap[data.place]} · ${data.duration === "60" ? "60+" : data.duration} phút/buổi`;
    document.getElementById("rev-allergy").textContent = data.allergy;
}

function hpRenderAIResult(advice, meals, workouts, planDays) {
    hpPlanMeals = meals || [];
    const doneMap = JSON.parse(localStorage.getItem("hf_workout_done") || "{}");

    document.getElementById("hp-ai-advice").innerHTML =
        `<strong>🩺 Tư vấn lộ trình ${planDays} ngày từ Chuyên gia AI:</strong> ${advice}`;

    document.getElementById("hp-ai-meals").innerHTML = hpPlanMeals.map(m => {
        const formattedMenu = (m.menu || "")
            .split("|")
            .map(part => {
                const trimmed = part.trim();
                const colonIdx = trimmed.indexOf(":");
                if (colonIdx > -1) {
                    const label = trimmed.slice(0, colonIdx + 1);
                    const dish = trimmed.slice(colonIdx + 1);
                    return `<div style="margin-bottom:4px;"><strong>${label}</strong>${dish}</div>`;
                }
                return `<div>${trimmed}</div>`;
            })
            .join("");

        return `
        <div class="hp-ai-card" style="display:flex;flex-direction:column;justify-content:space-between;">
            <div>
                <div class="hp-ai-card-top">
                    <strong style="white-space:nowrap;">${m.day}</strong>
                    <span class="hp-ai-badge-green" style="white-space:nowrap;">${m.calories}</span>
                </div>
                <div style="font-size:13.5px;line-height:1.55;color:var(--hp-ink);margin-top:6px;">
                    ${formattedMenu}
                </div>
            </div>
            <a href="product.html?search=${encodeURIComponent(m.keyword || "Eat Clean")}" style="display:inline-block;margin-top:10px;font-size:12.5px;font-weight:700;color:#5B0015;text-decoration:underline;">
                🍱 Xem & đặt lẻ món tại bếp →
            </a>
        </div>`;
    }).join("");

    document.getElementById("hp-ai-workouts").innerHTML = (workouts || []).map((w, i) => {
        const key = `hp_done_${planDays}_${i}`;
        const checked = !!doneMap[key];
        const focusBadge = w.burn ? `${w.focus} (${w.burn})` : w.focus;
        const formattedWorkout = (w.detail || "")
            .split("->")
            .map(part => part.trim())
            .filter(Boolean)
            .map(part => `<div style="margin-bottom:4px;">• ${part}</div>`)
            .join("");

        return `
        <div class="hp-ai-card" style="${checked ? "background:#eef6ef;border-color:#9ec9a2;" : ""}">
            <div class="hp-ai-card-top" style="align-items:flex-start;">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:700;color:#5B0015;white-space:nowrap;flex-shrink:0;">
                    <input type="checkbox" ${checked ? "checked" : ""} onchange="hpToggleDone('${key}', this)">
                    <span>${w.day}</span>
                </label>
                <span class="hp-ai-badge-blue" style="text-align:right;line-height:1.35;">${focusBadge}</span>
            </div>
            <div class="hp-workout-detail" style="margin-top:6px;font-size:13.5px;line-height:1.55;color:var(--hp-ink);${checked ? "text-decoration:line-through;opacity:0.7;" : ""}">
                ${formattedWorkout || w.detail}
            </div>
        </div>`;
    }).join("");
}

function hpToggleDone(key, el) {
    const doneMap = JSON.parse(localStorage.getItem("hf_workout_done") || "{}");
    doneMap[key] = el.checked;
    localStorage.setItem("hf_workout_done", JSON.stringify(doneMap));
    const card = el.closest(".hp-ai-card");
    const detail = card?.querySelector(".hp-workout-detail");
    if (card) card.style.background = el.checked ? "#eef6ef" : "";
    if (detail) {
        detail.style.textDecoration = el.checked ? "line-through" : "none";
        detail.style.opacity = el.checked ? "0.7" : "1";
    }
}

function hpBuildDurationInstruction(planDays, cal, duration) {
    if (planDays === 7) {
        return {
            scopeDesc: "trọn vẹn 7 ngày chi tiết từng ngày (Ngày 1 đến Ngày 7)",
            mealSchema: `[
    { "day": "Ngày 1", "menu": "Sáng: ... | Trưa: ... | Tối: ... | Phụ: ...", "calories": "${cal} kcal", "keyword": "Tên món chính 2-3 từ" },
    ... (đủ 7 phần tử từ Ngày 1 đến Ngày 7, thực đơn mỗi ngày khác nhau)
  ]`,
            workoutSchema: `[
    { "day": "Ngày 1", "focus": "Nhóm cơ / Trọng tâm", "burn": "~300 kcal", "detail": "Khởi động 5p -> Bài 1 (3x12) -> Bài 2 (3x15) -> Giãn cơ 5p (${duration} phút)" },
    ... (đủ 7 phần tử từ Ngày 1 đến Ngày 7, Ngày 7 nghỉ ngơi phục hồi)
  ]`
        };
    }

    if (planDays === 14) {
        return {
            scopeDesc: "trọn vẹn 14 ngày chi tiết từng ngày (Ngày 1 đến Ngày 14, Tuần 2 tăng nhẹ cường độ so với Tuần 1)",
            mealSchema: `[
    { "day": "Ngày 1", "menu": "Sáng: ... | Trưa: ... | Tối: ... | Phụ: ...", "calories": "${cal} kcal", "keyword": "Tên món chính 2-3 từ" },
    ... (đủ 14 phần tử từ Ngày 1 đến Ngày 14, thực đơn phong phú không trùng lặp)
  ]`,
            workoutSchema: `[
    { "day": "Ngày 1", "focus": "Nhóm cơ / Trọng tâm", "burn": "~300 kcal", "detail": "Khởi động 5p -> Bài 1 (3x12) -> Bài 2 (3x15) -> Giãn cơ 5p (${duration} phút)" },
    ... (đủ 14 phần tử từ Ngày 1 đến Ngày 14, Ngày 7 và Ngày 14 nghỉ phục hồi)
  ]`
        };
    }

    if (planDays === 30) {
        return {
            scopeDesc: "lộ trình 30 ngày chia làm 4 Tuần tiến triển rõ rệt (Tuần 1: Làm quen & Thanh lọc, Tuần 2: Tăng tốc đốt mỡ/xây cơ, Tuần 3: Bứt phá thể lực, Tuần 4: Siết nét & Ổn định) + thực đơn tiêu biểu 7 ngày xoay vòng chuẩn Macro",
            mealSchema: `[
    { "day": "Tuần 1 · Mẫu 1", "menu": "Sáng: ... | Trưa: ... | Tối: ... | Phụ: ...", "calories": "${cal} kcal", "keyword": "Tên món chính 2-3 từ" },
    ... (đủ 7 phần tử thực đơn chuẩn 7 ngày xoay vòng cho suốt 30 ngày)
  ]`,
            workoutSchema: `[
    { "day": "Tuần 1 (Ngày 1-7)", "focus": "Giai đoạn 1: Làm quen", "burn": "~260 kcal/buổi", "detail": "Lịch tập 5 buổi/tuần -> Khởi động 5p -> Bài tập nền tảng (3x12) -> Giãn cơ 5p (${duration} phút)" },
    { "day": "Tuần 2 (Ngày 8-14)", "focus": "Giai đoạn 2: Tăng cường độ", "burn": "~300 kcal/buổi", "detail": "Lịch tập 5 buổi/tuần -> Tăng số hiệp (4x12) -> Kết hợp Cardio cuối buổi (${duration} phút)" },
    { "day": "Tuần 3 (Ngày 15-21)", "focus": "Giai đoạn 3: Bứt phá", "burn": "~340 kcal/buổi", "detail": "Lịch tập 6 buổi/tuần -> Superset / HIIT cường độ cao -> Giãn cơ sâu (${duration} phút)" },
    { "day": "Tuần 4 (Ngày 22-30)", "focus": "Giai đoạn 4: Siết nét & Duy trì", "burn": "~320 kcal/buổi", "detail": "Lịch tập 5 buổi/tuần -> Tối ưu nhóm cơ trọng tâm -> 2 ngày phục hồi (${duration} phút)" }
  ]`
        };
    }

    // 90 ngày
    return {
        scopeDesc: "lộ trình chuyển hóa chuyên sâu 90 ngày (3 Tháng) chia theo 3 Giai đoạn lớn & 6 Chặng 15 ngày (Tháng 1: Thích nghi & Tạo nền tảng, Tháng 2: Tăng tốc chuyển hóa & Đốt mỡ/Tăng cơ sâu, Tháng 3: Định hình vóc dáng & Duy trì bền vững)",
        mealSchema: `[
    { "day": "Tháng 1 · Mẫu 1", "menu": "Sáng: ... | Trưa: ... | Tối: ... | Phụ: ...", "calories": "${cal} kcal", "keyword": "Tên món chính 2-3 từ" },
    ... (đủ 7 phần tử thực đơn 7 ngày đa dạng xoay vòng cho cả 3 tháng, điều chỉnh linh hoạt theo từng giai đoạn)
  ]`,
        workoutSchema: `[
    { "day": "Ngày 1 - 15", "focus": "Tháng 1 · Nền tảng kỹ thuật", "burn": "~250 kcal/buổi", "detail": "Tập 4-5 buổi/tuần -> Làm chủ kỹ thuật chuẩn (3x12) -> Cardio nhẹ 15p -> Giãn cơ (${duration} phút)" },
    { "day": "Ngày 16 - 30", "focus": "Tháng 1 · Tăng sức bền", "burn": "~280 kcal/buổi", "detail": "Tập 5 buổi/tuần -> Tăng dần khối lượng tạ/độ khó (3x15) -> Core 10p (${duration} phút)" },
    { "day": "Ngày 31 - 45", "focus": "Tháng 2 · Bứt phá chuyển hóa", "burn": "~320 kcal/buổi", "detail": "Tập 5-6 buổi/tuần -> Chia nhóm cơ chuyên sâu (4x12) -> HIIT 15p (${duration} phút)" },
    { "day": "Ngày 46 - 60", "focus": "Tháng 2 · Đỉnh cao đốt mỡ/cơ", "burn": "~350 kcal/buổi", "detail": "Tập 6 buổi/tuần -> Áp dụng Superset giảm thời gian nghỉ -> Phục hồi Chủ Nhật (${duration} phút)" },
    { "day": "Ngày 61 - 75", "focus": "Tháng 3 · Siết nét vóc dáng", "burn": "~330 kcal/buổi", "detail": "Tập 5 buổi/tuần -> Tập trung vùng cơ mục tiêu -> Cardio nhịp ổn định (${duration} phút)" },
    { "day": "Ngày 76 - 90", "focus": "Tháng 3 · Hoàn thiện & Duy trì", "burn": "~300 kcal/buổi", "detail": "Tập 5 buổi/tuần -> Cân bằng sức mạnh, độ dẻo dai & thói quen bền vững (${duration} phút)" }
  ]`
    };
}

async function hpRunAIPlanner() {
    const loadingEl = document.getElementById("hp-ai-loading");
    const resultEl = document.getElementById("hp-ai-result");
    if (!loadingEl || !resultEl) return;

    const data = hpGetFormPayload();
    const goalNames = { lose: "Giảm cân & siết mỡ", gain: "Tăng cân lành mạnh", muscle: "Tăng cơ bắp", maintain: "Giữ dáng", healthy: "Ăn sạch & thanh lọc" };
    const dietNames = { eatclean: "Eat Clean", high_protein: "High-Protein", low_carb: "Low-Carb/Keto", vegetarian: "Thuần chay" };
    const placeNames = { home: "Tại nhà", gym: "Phòng Gym", outdoor: "Ngoài trời" };
    const durationSpec = hpBuildDurationInstruction(data.planDays, data.cal, data.duration);

    loadingEl.style.display = "block";
    resultEl.style.display = "none";

    const promptText = `Bạn là Trợ lý Chuyên gia Dinh dưỡng & Huấn luyện viên Cá nhân (PT) của HealthyFood. Hãy thiết kế ${durationSpec.scopeDesc} đồng bộ chặt chẽ giữa ăn uống VÀ tập luyện cho khách hàng:
- Thời gian cam kết: ${data.planDays} ngày.
- Thể trạng: ${data.gender}, ${data.age} tuổi, cao ${data.height}cm, nặng ${data.weight}kg (BMI: ${data.metrics.bmi}, TDEE: ${data.metrics.tdee} kcal).
- Mục tiêu: ${goalNames[data.goal]} (${data.goalDetail}).
- Định mức dinh dưỡng: ${data.cal} kcal/ngày (${data.p}g Protein · ${data.c}g Carbs · ${data.f}g Fat).
- Chế độ ăn: ${dietNames[data.diet]} · Ngân sách dự kiến: ~${Number(data.budget).toLocaleString("vi-VN")}đ/ngày.
- Dị ứng / kiêng khem (loại bỏ 100% khỏi thực đơn): ${data.allergy}.
- Chấn thương / bệnh lý (bắt buộc né hoàn toàn các động tác gây áp lực/hại): ${data.limitations}.
- Tập luyện: ${placeNames[data.place]}, ${data.duration} phút/buổi.

Chỉ trả về JSON hợp lệ đúng cấu trúc sau:
{
  "advice": "Phân tích chuyên môn 2-3 câu về chiến lược dinh dưỡng & tập luyện cho cả chặng đường ${data.planDays} ngày, nêu rõ dự kiến thay đổi vóc dáng sau ${data.planDays} ngày.",
  "meals": ${durationSpec.mealSchema},
  "workouts": ${durationSpec.workoutSchema}
}`;

    try {
        const apiKey = hpGetApiKey();
        if (!apiKey) throw new Error("Chưa cấu hình GEMINI_API_KEY trong config.js");

        const models = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];
        let resJson = null;
        let lastErr = "";

        for (const model of models) {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: promptText }] }],
                        generationConfig: { responseMimeType: "application/json", temperature: 0.7 }
                    })
                }
            );
            resJson = await response.json();
            if (response.ok) {
                lastErr = "";
                break;
            }
            lastErr = resJson.error?.message || `Lỗi HTTP ${response.status}`;
        }

        if (lastErr) throw new Error(lastErr);

        let rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        rawText = rawText.replace(/```json|```/gi, "").trim();
        const plan = JSON.parse(rawText);

        hpRenderAIResult(plan.advice, plan.meals, plan.workouts, data.planDays);
    } catch (err) {
        console.error("Lỗi gọi Gemini AI:", err);
        hpRenderAIResult(
            `<span style="color:#b42318;">(Đang dùng thực đơn mẫu do: ${err.message})</span><br>Với lộ trình <strong>${data.planDays} ngày</strong>, chỉ số BMI <strong>${data.metrics.bmi}</strong> và mục tiêu <strong>${data.cal.toLocaleString("vi-VN")} kcal/ngày</strong>, bạn nên duy trì nạp đủ <strong>${data.p}g đạm sạch</strong> mỗi ngày kết hợp tập luyện ${data.duration} phút/buổi.`,
            [
                { day: "Ngày 1", menu: "Sáng: Yến mạch sữa hạt + 2 trứng luộc | Trưa: Ức gà nướng mật ong + cơm gạo lứt + bông cải xanh | Tối: Salad cá hồi áp chảo sốt chanh dây.", calories: `${data.cal} kcal`, keyword: "Ức gà nướng mật ong" },
                { day: "Ngày 2", menu: "Sáng: Bánh mì nguyên cám + bơ nghiền + trứng ốp la | Trưa: Bò lúc lắc tiêu đen + khoai lang hấp | Tối: Tôm hấp sả + rau củ luộc.", calories: `${data.cal} kcal`, keyword: "Cá hồi áp chảo" },
                { day: "Ngày 3", menu: "Sáng: Sinh tố chuối bơ đậu phộng + hạt chia | Trưa: Phi lê cá diêu hồng áp chảo + gạo lứt | Tối: Ức gà xé phay trộn bắp cải tím.", calories: `${data.cal} kcal`, keyword: "Salad Eat Clean" },
                { day: "Ngày 4", menu: "Sáng: Trứng cuộn rau củ + khoai lang nướng | Trưa: Ức gà sốt teriyaki + cơm gạo lứt | Tối: Đậu hũ non hấp nấm + canh rong biển.", calories: `${data.cal} kcal`, keyword: "Ức gà" },
                { day: "Ngày 5", menu: "Sáng: Sữa chua Hy Lạp + granola + việt quất | Trưa: Cá thu sốt cà chua + bún gạo lứt | Tối: Salad bò trộn dầu giấm.", calories: `${data.cal} kcal`, keyword: "Salad" },
                { day: "Ngày 6", menu: "Sáng: Bánh kếp yến mạch chuối | Trưa: Tôm rim tiêu + bí đỏ hấp + gạo lứt | Tối: Súp gà ngô non ít béo.", calories: `${data.cal} kcal`, keyword: "Eat Clean" },
                { day: "Ngày 7", menu: "Sáng: Phở cuốn gạo lứt ức gà | Trưa: Cá hồi nướng măng tây | Tối: Rau củ luộc chấm kho quẹt healthy.", calories: `${data.cal} kcal`, keyword: "Cá hồi" }
            ],
            [
                { day: "Ngày 1", focus: "Toàn thân & Đốt mỡ", burn: "~300 kcal", detail: `Khởi động 5p -> Squat (3x15), Push-up (3x12), Plank (3x45s), Jumping Jacks (3x30s) -> Giãn cơ 5p (${data.duration} phút).` },
                { day: "Ngày 2", focus: "Thân dưới & Bụng", burn: "~280 kcal", detail: `Khởi động 5p -> Lunges (3x12/chân), Glute Bridge (3x15), Crunches (3x20), Mountain Climbers (3x30s) -> Giãn cơ 5p (${data.duration} phút).` },
                { day: "Ngày 3", focus: "Cardio nhẹ & Giãn cơ", burn: "~220 kcal", detail: "Đi bộ nhanh hoặc đạp xe nhẹ 20p -> Yoga giãn cơ phục hồi 15p." },
                { day: "Ngày 4", focus: "Thân trên & Core", burn: "~290 kcal", detail: `Khởi động 5p -> Incline Push-up (3x12), Tricep Dips (3x12), Superman (3x15), Plank nghiêng (3x30s/bên) -> Giãn cơ 5p (${data.duration} phút).` },
                { day: "Ngày 5", focus: "HIIT Đốt Calo", burn: "~340 kcal", detail: `Khởi động 5p -> 40s tập / 20s nghỉ × 5 tổ liên hoàn: Burpees biến thể, High Knees, Squat Pulse -> Hạ nhiệt 5p (${data.duration} phút).` },
                { day: "Ngày 6", focus: "Vận động linh hoạt", burn: "~240 kcal", detail: "Core nhẹ nhàng (Bird-Dog, Dead Bug 3x12) -> Kéo giãn toàn thân 20 phút." },
                { day: "Ngày 7", focus: "Phục hồi chủ động", burn: "~150 kcal", detail: "Thư giãn hoàn toàn, hít thở sâu -> Giãn cơ nhẹ 15 phút để cơ bắp tái tạo." }
            ],
            data.planDays
        );
    } finally {
        loadingEl.style.display = "none";
        resultEl.style.display = "block";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    localStorage.removeItem("hf_gemini_key");
    hpSyncCartButton();

    ["hp-age", "hp-height", "hp-weight", "hp-activity"].forEach((id) => {
        document.getElementById(id)?.addEventListener("input", hpCalcMetrics);
        document.getElementById(id)?.addEventListener("change", hpCalcMetrics);
    });

    document.querySelectorAll('input[name="gender"]').forEach((r) => {
        r.addEventListener("change", hpCalcMetrics);
    });

    const addBtn = document.getElementById("hp-add-plan-to-cart");
    if (addBtn) {
        addBtn.addEventListener("click", () => {
            if (!hpOrderInfo.slots.length) {
                alert("Đã lưu lộ trình tự nấu miễn phí (0đ) vào hồ sơ của bạn!");
                return;
            }

            const cart = JSON.parse(localStorage.getItem("cart") || "[]");
            const menus = hpPlanMeals.length
                ? hpPlanMeals.map(m => m.menu.split("|").map(s => s.replace(/^(Sáng|Trưa|Tối|Phụ):\s*/i, "").trim()))
                : [["Ức gà nướng mật ong + gạo lứt", "Salad cá hồi áp chảo"]];

            let count = 0;
            for (let d = 1; d <= hpOrderInfo.days; d++) {
                const dayDishes = menus[(d - 1) % menus.length];
                hpOrderInfo.slots.forEach((slot, idx) => {
                    const dish = dayDishes[idx % dayDishes.length] || `Suất ${hpOrderInfo.dietLabel}`;
                    const item = {
                        id: `hp-${hpOrderInfo.pkg}-d${d}-s${idx + 1}`,
                        name: `Ngày ${d} (${slot}): ${dish}`,
                        price: hpOrderInfo.unitPrice,
                        quantity: 1
                    };
                    if (typeof window.addToCart === "function") {
                        window.addToCart(item);
                    } else {
                        const exist = cart.find(c => c.id === item.id);
                        exist ? (exist.quantity += 1) : cart.push(item);
                    }
                    count++;
                });
            }

            if (typeof window.addToCart !== "function") {
                localStorage.setItem("cart", JSON.stringify(cart));
            }
            hpSyncCartButton();
            alert(`Đã thêm đầy đủ ${count} suất ăn chi tiết theo từng ngày/bữa vào giỏ hàng!`);
            if (typeof window.openCart === "function") {
                window.openCart();
            } else {
                window.location.href = "product.html";
            }
        });
    }

    hpPreselectGoalFromURL();
    hpAutoFillFromCalculator();
    hpUpdateUI();
});