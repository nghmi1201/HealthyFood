// =========================================
// HEALTHY PLAN + GOOGLE GEMINI AI COACH
// =========================================

// DÁN GOOGLE GEMINI API KEY CỦA BẠN VÀO DÒNG DƯỚI ĐÂY:
const GEMINI_API_KEY = "DÁN_API_KEY_CỦA_BẠN_VÀO_ĐÂY";
let hpCurrentStep = 0;
let hpRecommendedPackage = {
    id: "hp-eatclean-lunch_dinner-7d",
    name: "Gói Eat Clean Cân Bằng - Thanh Lọc 7 Ngày",
    price: 770000
};

const hpStepTitles = [
    "01. Xác định mục tiêu & thời gian",
    "02. Chỉ số cơ thể",
    "03. Khẩu vị & Suất ăn",
    "04. Lịch tập luyện",
    "05. Lộ trình cá nhân hóa từ AI"
];

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

    // Tư vấn lộ trình AI hoàn toàn miễn phí (0đ), chỉ tính tiền suất ăn đặt từ bếp
    const pkgConfig = {
        self_cook: {
            label: `Tự nấu theo công thức ${data.planDays} ngày (Miễn phí 0đ)`,
            price: 0,
            desc: `Nhận miễn phí lộ trình AI & bảng định lượng nguyên liệu chi tiết theo mức ${data.cal.toLocaleString("vi-VN")} kcal/ngày để bạn tự chế biến tại nhà suốt ${data.planDays} ngày.`
        },
        lunch_only: {
            label: `Bữa Trưa (1 bữa/ngày · ${data.planDays} ngày)`,
            price: 60000 * 1 * data.planDays,
            desc: `Gồm ${1 * data.planDays} suất ăn trưa chuẩn ${dietMap[data.diet]} (~${Math.round(data.cal * 0.4)} kcal/suất). Tư vấn AI 0đ, chỉ tính tiền suất ăn giao tận nơi.`
        },
        lunch_dinner: {
            label: `Trưa + Tối (2 bữa/ngày · ${data.planDays} ngày)`,
            price: 55000 * 2 * data.planDays,
            desc: `Gồm ${2 * data.planDays} suất ăn tươi chế biến trong ngày chuẩn ${dietMap[data.diet]}, giao tận nơi 2 khung giờ suốt ${data.planDays} ngày.`
        },
        full_day: {
            label: `Trọn gói cả ngày (3 bữa + Snack · ${data.planDays} ngày)`,
            price: 170000 * data.planDays,
            desc: `Trọn bộ ${4 * data.planDays} bữa ăn thiết kế đúng mức ${data.cal.toLocaleString("vi-VN")} kcal/ngày theo chế độ ${dietMap[data.diet]} trong ${data.planDays} ngày.`
        }
    };
    const placeMap = { home: "Tại nhà", gym: "Phòng Gym", outdoor: "Ngoài trời" };

    const selectedPkg = pkgConfig[data.pkg] || pkgConfig.lunch_dinner;
    const title = `Gói ${dietMap[data.diet]} - ${goalMap[data.goal]} ${data.planDays} Ngày`;

    hpRecommendedPackage = {
        id: `hp-${data.diet}-${data.pkg}-${data.planDays}d`,
        name: `${title} (${selectedPkg.label})`,
        price: selectedPkg.price
    };

    document.getElementById("hp-rec-package-title").textContent = title;
    document.getElementById("hp-rec-package-desc").textContent = selectedPkg.desc;

    const addBtn = document.getElementById("hp-add-plan-to-cart");
    if (addBtn) {
        addBtn.innerHTML = selectedPkg.price > 0
            ? `Đặt suất ăn (${data.planDays} ngày) · ${selectedPkg.price.toLocaleString("vi-VN")}đ <span>🛒</span>`
            : `Lưu lộ trình miễn phí (0đ) <span>📥</span>`;
    }

    document.getElementById("rev-duration").textContent = `${data.planDays} ngày`;
    document.getElementById("rev-diet").textContent = dietMap[data.diet];
    document.getElementById("rev-package").textContent = selectedPkg.label;
    document.getElementById("rev-workout").textContent = `${placeMap[data.place]} · ${data.duration === "60" ? "60+" : data.duration} phút/buổi`;
    document.getElementById("rev-allergy").textContent = data.allergy;
}

async function hpRunAIPlanner() {
    const loadingEl = document.getElementById("hp-ai-loading");
    const resultEl = document.getElementById("hp-ai-result");
    const adviceEl = document.getElementById("hp-ai-advice");
    const mealsEl = document.getElementById("hp-ai-meals");
    const workoutsEl = document.getElementById("hp-ai-workouts");

    if (!loadingEl || !resultEl) return;

    const data = hpGetFormPayload();
    const goalNames = { lose: "Giảm cân & siết mỡ", gain: "Tăng cân lành mạnh", muscle: "Tăng cơ bắp", maintain: "Giữ dáng", healthy: "Ăn sạch & thanh lọc" };
    const dietNames = { eatclean: "Eat Clean", high_protein: "High-Protein", low_carb: "Low-Carb/Keto", vegetarian: "Thuần chay" };
    const placeNames = { home: "Tại nhà", gym: "Phòng Gym", outdoor: "Ngoài trời" };

    loadingEl.style.display = "block";
    resultEl.style.display = "none";

    // 1. ĐỊNH RÕ VAI TRÒ & QUY TẮC CHUYÊN MÔN CỦA AI (SYSTEM INSTRUCTION)
    const systemRolePrompt = `
Bạn là **Trợ lý Chuyên gia Dinh dưỡng Lâm sàng & Huấn luyện viên Sức khỏe (AI Health & Nutrition Coach)** của hệ thống bếp thực dưỡng HealthyFood.
Nguyên tắc tư vấn bắt buộc:
1. **Vai trò**: Giao tiếp tận tâm, khoa học, chuẩn xác như một bác sĩ dinh dưỡng và huấn luyện viên cá nhân (PT) chuyên nghiệp đang tư vấn miễn phí 1-1 cho khách hàng.
2. **An toàn y tế lên hàng đầu**:
   - Tuyệt đối loại bỏ 100% nguyên liệu khách hàng bị dị ứng hoặc kiêng khem.
   - Nếu khách hàng khai báo bệnh lý nền (đau dạ dày, tiểu đường, huyết áp...) hoặc chấn thương xương khớp (đau khớp gối, đau lưng...), BẮT BUỘC điều chỉnh thực đơn êm dịu và loại bỏ các động tác gây áp lực lên vùng chấn thương đó, đồng thời nhắc nhở lưu ý an toàn trong phần tư vấn.
3. **Tính thực tế & định lượng**: Thực đơn sử dụng các nguyên liệu Eat Clean quen thuộc tại Việt Nam (ức gà, cá hồi, thịt bò thăn, gạo lứt, khoai lang, yến mạch, rau xanh...), chia tỷ lệ Macro khớp với mức Calo mục tiêu và thời gian theo đuổi lộ trình.
4. **Định dạng đầu ra**: Luôn trả về đúng đối tượng JSON được yêu cầu, văn phong súc tích, dễ hiểu.
`;

    // 2. DỮ LIỆU HỒ SƠ KHÁCH HÀNG CẦN PHÂN TÍCH (USER PROMPT)
    const userPrompt = `
Hãy phân tích hồ sơ sức khỏe sau và thiết kế lộ trình cá nhân hóa kéo dài ${data.planDays} ngày cho khách hàng:
- Mục tiêu vóc dáng: ${goalNames[data.goal]} (Mong muốn cụ thể: ${data.goalDetail})
- Thời gian theo đuổi lộ trình: ${data.planDays} ngày.
- Chỉ số sinh học: Giới tính ${data.gender}, ${data.age} tuổi, cao ${data.height}cm, nặng ${data.weight}kg | BMI: ${data.metrics.bmi} | TDEE: ${data.metrics.tdee} kcal/ngày.
- Định mức dinh dưỡng mục tiêu: ${data.cal} kcal/ngày (${data.p}g Protein · ${data.c}g Carbs · ${data.f}g Fat).
- Chế độ ăn lựa chọn: ${dietNames[data.diet]}.
- Dị ứng / Thực phẩm loại trừ: ${data.allergy}.
- Tình trạng sức khỏe / Chấn thương cần lưu ý: ${data.limitations}.
- Điều kiện tập luyện: ${placeNames[data.place]}, thời lượng ${data.duration} phút/buổi.

Trả về DUY NHẤT đối tượng JSON theo mẫu sau (không bọc markdown):
{
  "advice": "Lời khuyên chuyên môn 2-3 câu dưới góc nhìn bác sĩ dinh dưỡng & PT (nhận xét chỉ số BMI/TDEE, chiến lược cho lộ trình ${data.planDays} ngày và lưu ý tránh chấn thương/dị ứng của khách).",
  "meals": [
    { "day": "Ngày 1", "menu": "Sáng: ... | Trưa: ... | Tối: ...", "calories": "${data.cal} kcal" },
    { "day": "Ngày 2", "menu": "Sáng: ... | Trưa: ... | Tối: ...", "calories": "${data.cal} kcal" },
    { "day": "Ngày 3", "menu": "Sáng: ... | Trưa: ... | Tối: ...", "calories": "${data.cal} kcal" }
  ],
  "workouts": [
    { "day": "Thứ 2", "focus": "Trọng tâm buổi tập", "detail": "Chi tiết bài tập phù hợp địa điểm, thời lượng và an toàn với chấn thương" },
    { "day": "Thứ 3", "focus": "...", "detail": "..." },
    { "day": "Thứ 4", "focus": "...", "detail": "..." },
    { "day": "Thứ 5", "focus": "...", "detail": "..." },
    { "day": "Thứ 6", "focus": "...", "detail": "..." },
    { "day": "Thứ 7", "focus": "...", "detail": "..." },
    { "day": "Chủ Nhật", "focus": "Nghỉ ngơi phục hồi", "detail": "..." }
  ]
}
`;

    try {
        if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("DÁN_API_KEY")) {
            throw new Error("Chưa cấu hình GEMINI_API_KEY");
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{ text: systemRolePrompt }]
                    },
                    contents: [
                        {
                            role: "user",
                            parts: [{ text: userPrompt }]
                        }
                    ],
                    generationConfig: {
                        responseMimeType: "application/json",
                        temperature: 0.6
                    }
                })
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const resJson = await response.json();
        const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const plan = JSON.parse(rawText);

        adviceEl.innerHTML = `<strong>🩺 Tư vấn từ Trợ lý Chuyên gia Sức khỏe AI (Lộ trình ${data.planDays} ngày):</strong> ${plan.advice}`;

        mealsEl.innerHTML = (plan.meals || []).map(m => `
            <div class="hp-ai-card">
                <div class="hp-ai-card-top">
                    <strong>${m.day}</strong>
                    <span class="hp-ai-badge-green">${m.calories}</span>
                </div>
                <p>${m.menu}</p>
            </div>
        `).join("");

        workoutsEl.innerHTML = (plan.workouts || []).map(w => `
            <div class="hp-ai-card">
                <div class="hp-ai-card-top">
                    <strong>${w.day}</strong>
                    <span class="hp-ai-badge-blue">${w.focus}</span>
                </div>
                <p>${w.detail}</p>
            </div>
        `).join("");

    } catch (err) {
        console.warn("AI fallback:", err);
        adviceEl.innerHTML = `<strong>🩺 Tư vấn từ Trợ lý Sức khỏe HealthyFood (Lộ trình ${data.planDays} ngày):</strong> Với chỉ số BMI <strong>${data.metrics.bmi}</strong> và mục tiêu <strong>${data.cal.toLocaleString("vi-VN")} kcal/ngày</strong>, bạn nên duy trì nạp đủ <strong>${data.p}g đạm sạch</strong> mỗi ngày kết hợp tập luyện đều đặn ${data.duration} phút/buổi suốt ${data.planDays} ngày để đạt kết quả bền vững.`;

        mealsEl.innerHTML = [
            { day: "Ngày 1", menu: "Sáng: Yến mạch sữa hạt + 2 trứng luộc | Trưa: Ức gà nướng mật ong + cơm gạo lứt + bông cải xanh | Tối: Salad cá hồi áp chảo sốt chanh dây.", calories: `${data.cal} kcal` },
            { day: "Ngày 2", menu: "Sáng: Bánh mì nguyên cám + bơ nghiền + trứng ốp la | Trưa: Bò lúc lắc tiêu đen + khoai lang hấp | Tối: Tôm hấp sả + rau củ luộc.", calories: `${data.cal} kcal` },
            { day: "Ngày 3", menu: "Sáng: Sinh tố chuối bơ đậu phộng + hạt chia | Trưa: Phi lê cá diêu hồng áp chảo + gạo lứt | Tối: Ức gà xé phay trộn bắp cải tím.", calories: `${data.cal} kcal` }
        ].map(m => `
            <div class="hp-ai-card">
                <div class="hp-ai-card-top">
                    <strong>${m.day}</strong>
                    <span class="hp-ai-badge-green">${m.calories}</span>
                </div>
                <p>${m.menu}</p>
            </div>
        `).join("");

        workoutsEl.innerHTML = [
            { day: "Thứ 2", focus: "Toàn thân & Đốt mỡ", detail: `Khởi động 5p + Squat, Push-up, Plank, Jumping Jacks (${data.duration} phút).` },
            { day: "Thứ 3", focus: "Thân dưới & Bụng", detail: `Lunges, Glute Bridge, Crunches, Mountain Climbers (${data.duration} phút).` },
            { day: "Thứ 4", focus: "Cardio nhẹ & Giãn cơ", detail: "Đi bộ nhanh hoặc Yoga phục hồi cơ bắp 25-30 phút." },
            { day: "Thứ 5", focus: "Thân trên & Core", detail: `Incline Push-up, Tricep Dips, Superman, Plank nghiêng (${data.duration} phút).` },
            { day: "Thứ 6", focus: "HIIT Đốt Calo", detail: `40s tập / 20s nghỉ × 5 tổ liên hoàn (${data.duration} phút).` },
            { day: "Thứ 7", focus: "Vận động linh hoạt", detail: "Core nhẹ nhàng & kéo giãn toàn thân 30 phút." },
            { day: "Chủ Nhật", focus: "Nghỉ ngơi phục hồi", detail: "Thư giãn hoàn toàn để cơ bắp tái tạo." }
        ].map(w => `
            <div class="hp-ai-card">
                <div class="hp-ai-card-top">
                    <strong>${w.day}</strong>
                    <span class="hp-ai-badge-blue">${w.focus}</span>
                </div>
                <p>${w.detail}</p>
            </div>
        `).join("");
    } finally {
        loadingEl.style.display = "none";
        resultEl.style.display = "block";
    }
}

document.addEventListener("DOMContentLoaded", () => {
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
            if (hpRecommendedPackage.price === 0) {
                alert(`Đã lưu "${hpRecommendedPackage.name}" miễn phí vào hồ sơ của bạn!`);
                return;
            }
            if (typeof window.addToCart === "function") {
                window.addToCart({
                    id: hpRecommendedPackage.id,
                    name: hpRecommendedPackage.name,
                    price: hpRecommendedPackage.price,
                    quantity: 1
                });
            } else {
                const cart = JSON.parse(localStorage.getItem("cart") || "[]");
                const exist = cart.find((item) => item.id === hpRecommendedPackage.id);
                if (exist) exist.quantity += 1;
                else cart.push({ ...hpRecommendedPackage, quantity: 1 });
                localStorage.setItem("cart", JSON.stringify(cart));

                const totalQty = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
                const cartBtn = document.querySelector(".btn-cart");
                if (cartBtn) cartBtn.textContent = `Giỏ hàng (${totalQty})`;
            }
            alert(`Đã thêm "${hpRecommendedPackage.name}" vào giỏ hàng!`);
        });
    }

    hpAutoFillFromCalculator();
    hpUpdateUI();
});