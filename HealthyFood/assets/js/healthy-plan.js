// =========================================
// HEALTHY PLAN + GOOGLE GEMINI AI COACH
// =========================================

// Không dán trực tiếp API Key vào đây để tránh bị GitHub chặn; dùng config.js hoặc nút nhập Key trên web
const GEMINI_API_KEY = "";
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
    if (GEMINI_API_KEY && !GEMINI_API_KEY.includes("DÁN_API_KEY")) return GEMINI_API_KEY;
    return window.GEMINI_API_KEY || localStorage.getItem("hf_gemini_key") || "";
}

function hpPromptApiKey() {
    const k = prompt("Dán Google Gemini API Key của bạn vào đây (lưu trên trình duyệt, không đẩy lên GitHub):", hpGetApiKey());
    if (k && k.trim()) {
        localStorage.setItem("hf_gemini_key", k.trim());
        hpRunAIPlanner();
    }
}

function hpSyncCartButton() {
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    const totalQty = cart.reduce((s, i) => s + (i.quantity || 1), 0);
    const cartBtn = document.querySelector(".btn-cart");
    if (cartBtn) {
        cartBtn.textContent = `Giỏ hàng (${totalQty})`;
        cartBtn.onclick = () => {
            if (typeof window.openCart === "function") {
                window.openCart();
            } else {
                window.location.href = "product.html";
            }
        };
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

function hpRenderAIResult(advice, meals, workouts) {
    hpPlanMeals = meals || [];
    const doneMap = JSON.parse(localStorage.getItem("hf_workout_done") || "{}");

    document.getElementById("hp-ai-advice").innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
            <span><strong>🩺 Tư vấn từ Trợ lý Chuyên gia Sức khỏe AI:</strong> ${advice}</span>
            <button type="button" onclick="hpPromptApiKey()" class="hp-ai-refresh-btn">🔑 Đổi / Nhập API Key</button>
        </div>`;

    document.getElementById("hp-ai-meals").innerHTML = hpPlanMeals.map(m => `
        <div class="hp-ai-card">
            <div class="hp-ai-card-top">
                <strong>${m.day}</strong>
                <span class="hp-ai-badge-green">${m.calories}</span>
            </div>
            <p>${m.menu}</p>
            <a href="product.html?search=${encodeURIComponent(m.keyword || "Eat Clean")}" style="display:inline-block;margin-top:8px;font-size:12.5px;font-weight:700;color:#5B0015;text-decoration:underline;">
                🍱 Xem & đặt lẻ món tại bếp →
            </a>
        </div>
    `).join("");

    document.getElementById("hp-ai-workouts").innerHTML = (workouts || []).map((w, i) => {
        const key = `hp_done_${i}`;
        const checked = !!doneMap[key];
        return `
        <div class="hp-ai-card" style="${checked ? "background:#eef6ef;border-color:#9ec9a2;" : ""}">
            <div class="hp-ai-card-top">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:700;color:#5B0015;">
                    <input type="checkbox" ${checked ? "checked" : ""} onchange="hpToggleDone('${key}', this)">
                    <span>${w.day}</span>
                </label>
                <span class="hp-ai-badge-blue">${w.focus}</span>
            </div>
            <p style="${checked ? "text-decoration:line-through;opacity:0.7;" : ""}">${w.detail}</p>
        </div>`;
    }).join("");
}

function hpToggleDone(key, el) {
    const doneMap = JSON.parse(localStorage.getItem("hf_workout_done") || "{}");
    doneMap[key] = el.checked;
    localStorage.setItem("hf_workout_done", JSON.stringify(doneMap));
    const card = el.closest(".hp-ai-card");
    const p = card?.querySelector("p");
    if (card) card.style.background = el.checked ? "#eef6ef" : "";
    if (p) {
        p.style.textDecoration = el.checked ? "line-through" : "none";
        p.style.opacity = el.checked ? "0.7" : "1";
    }
}

async function hpRunAIPlanner() {
    const loadingEl = document.getElementById("hp-ai-loading");
    const resultEl = document.getElementById("hp-ai-result");
    if (!loadingEl || !resultEl) return;

    const data = hpGetFormPayload();
    const goalNames = { lose: "Giảm cân & siết mỡ", gain: "Tăng cân lành mạnh", muscle: "Tăng cơ bắp", maintain: "Giữ dáng", healthy: "Ăn sạch & thanh lọc" };
    const dietNames = { eatclean: "Eat Clean", high_protein: "High-Protein", low_carb: "Low-Carb/Keto", vegetarian: "Thuần chay" };
    const placeNames = { home: "Tại nhà", gym: "Phòng Gym", outdoor: "Ngoài trời" };

    loadingEl.style.display = "block";
    resultEl.style.display = "none";

    const promptText = `Bạn là Trợ lý Chuyên gia Dinh dưỡng & PT của HealthyFood. Hãy thiết kế lộ trình ${data.planDays} ngày thật đa dạng, sáng tạo và cá nhân hóa cao cho khách hàng:
- Giới tính: ${data.gender}, ${data.age} tuổi, cao ${data.height}cm, nặng ${data.weight}kg (BMI: ${data.metrics.bmi}, TDEE: ${data.metrics.tdee} kcal).
- Mục tiêu: ${goalNames[data.goal]} (${data.goalDetail}).
- Định mức: ${data.cal} kcal/ngày (${data.p}g Protein · ${data.c}g Carbs · ${data.f}g Fat).
- Chế độ ăn: ${dietNames[data.diet]}.
- Dị ứng / kiêng khem (loại bỏ 100%): ${data.allergy}.
- Chấn thương / bệnh lý (điều chỉnh bài tập an toàn): ${data.limitations}.
- Tập luyện: ${placeNames[data.place]}, ${data.duration} phút/buổi.

Chỉ trả về JSON hợp lệ đúng cấu trúc sau:
{
  "advice": "Lời khuyên chuyên môn 2-3 câu cá nhân hóa theo chỉ số, chấn thương và dị ứng.",
  "meals": [
    { "day": "Ngày 1", "menu": "Sáng: ... | Trưa: ... | Tối: ...", "calories": "${data.cal} kcal", "keyword": "Tên món chính 2-3 từ" },
    { "day": "Ngày 2", "menu": "Sáng: ... | Trưa: ... | Tối: ...", "calories": "${data.cal} kcal", "keyword": "Tên món chính 2-3 từ" },
    { "day": "Ngày 3", "menu": "Sáng: ... | Trưa: ... | Tối: ...", "calories": "${data.cal} kcal", "keyword": "Tên món chính 2-3 từ" }
  ],
  "workouts": [
    { "day": "Thứ 2", "focus": "Trọng tâm", "detail": "Chi tiết bài tập an toàn" },
    { "day": "Thứ 3", "focus": "Trọng tâm", "detail": "Chi tiết bài tập an toàn" },
    { "day": "Thứ 4", "focus": "Trọng tâm", "detail": "Chi tiết bài tập an toàn" },
    { "day": "Thứ 5", "focus": "Trọng tâm", "detail": "Chi tiết bài tập an toàn" },
    { "day": "Thứ 6", "focus": "Trọng tâm", "detail": "Chi tiết bài tập an toàn" },
    { "day": "Thứ 7", "focus": "Trọng tâm", "detail": "Chi tiết bài tập an toàn" },
    { "day": "Chủ Nhật", "focus": "Nghỉ ngơi phục hồi", "detail": "Thư giãn & giãn cơ nhẹ" }
  ]
}`;

    try {
        const apiKey = hpGetApiKey();
        if (!apiKey) throw new Error("Chưa nhập API Key");

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    generationConfig: { responseMimeType: "application/json", temperature: 0.7 }
                })
            }
        );

        const resJson = await response.json();
        if (!response.ok) {
            throw new Error(resJson.error?.message || `Lỗi HTTP ${response.status}`);
        }

        let rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        rawText = rawText.replace(/```json|```/gi, "").trim();
        const plan = JSON.parse(rawText);

        hpRenderAIResult(plan.advice, plan.meals, plan.workouts);
    } catch (err) {
        console.error("Lỗi gọi Gemini AI:", err);
        hpRenderAIResult(
            `<span style="color:#b42318;">(Đang dùng thực đơn mẫu do: ${err.message} — bấm <strong>🔑 Đổi / Nhập API Key</strong> để kiểm tra lại key)</span><br>Với chỉ số BMI <strong>${data.metrics.bmi}</strong> và mục tiêu <strong>${data.cal.toLocaleString("vi-VN")} kcal/ngày</strong>, bạn nên duy trì nạp đủ <strong>${data.p}g đạm sạch</strong> mỗi ngày kết hợp tập luyện ${data.duration} phút/buổi.`,
            [
                { day: "Ngày 1", menu: "Sáng: Yến mạch sữa hạt + 2 trứng luộc | Trưa: Ức gà nướng mật ong + cơm gạo lứt + bông cải xanh | Tối: Salad cá hồi áp chảo sốt chanh dây.", calories: `${data.cal} kcal`, keyword: "Ức gà nướng mật ong" },
                { day: "Ngày 2", menu: "Sáng: Bánh mì nguyên cám + bơ nghiền + trứng ốp la | Trưa: Bò lúc lắc tiêu đen + khoai lang hấp | Tối: Tôm hấp sả + rau củ luộc.", calories: `${data.cal} kcal`, keyword: "Cá hồi áp chảo" },
                { day: "Ngày 3", menu: "Sáng: Sinh tố chuối bơ đậu phộng + hạt chia | Trưa: Phi lê cá diêu hồng áp chảo + gạo lứt | Tối: Ức gà xé phay trộn bắp cải tím.", calories: `${data.cal} kcal`, keyword: "Salad Eat Clean" }
            ],
            [
                { day: "Thứ 2", focus: "Toàn thân & Đốt mỡ", detail: `Khởi động 5p + Squat, Push-up, Plank, Jumping Jacks (${data.duration} phút).` },
                { day: "Thứ 3", focus: "Thân dưới & Bụng", detail: `Lunges, Glute Bridge, Crunches, Mountain Climbers (${data.duration} phút).` },
                { day: "Thứ 4", focus: "Cardio nhẹ & Giãn cơ", detail: "Đi bộ nhanh hoặc Yoga phục hồi cơ bắp 25-30 phút." },
                { day: "Thứ 5", focus: "Thân trên & Core", detail: `Incline Push-up, Tricep Dips, Superman, Plank nghiêng (${data.duration} phút).` },
                { day: "Thứ 6", focus: "HIIT Đốt Calo", detail: `40s tập / 20s nghỉ × 5 tổ liên hoàn (${data.duration} phút).` },
                { day: "Thứ 7", focus: "Vận động linh hoạt", detail: "Core nhẹ nhàng & kéo giãn toàn thân 30 phút." },
                { day: "Chủ Nhật", focus: "Nghỉ ngơi phục hồi", detail: "Thư giãn hoàn toàn để cơ bắp tái tạo." }
            ]
        );
    } finally {
        loadingEl.style.display = "none";
        resultEl.style.display = "block";
    }
}

document.addEventListener("DOMContentLoaded", () => {
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
                ? hpPlanMeals.map(m => m.menu.split("|").map(s => s.replace(/^(Sáng|Trưa|Tối):\s*/i, "").trim()))
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