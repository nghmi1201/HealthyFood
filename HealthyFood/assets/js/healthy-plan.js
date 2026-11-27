// =========================================
// HEALTHY PLAN + DIFY AI COACH (CLOUD SYNC)
// =========================================

const DIFY_API_URL = "https://api.dify.ai/v1/completion-messages";
const DIFY_API_KEY = "app-6P6Xgx0Mif1CDi32wrU2l9VX";
const API_BASE_URL = "http://127.0.0.1:3000";
const AUTH_ME_URL = `${API_BASE_URL}/api/me`;
const HEALTHY_PLAN_API_URL = `${API_BASE_URL}/api/healthy-plan`;

let hpCurrentUserId = null;
let hpCurrentStep = 0;
let hpPlanMeals = [];
let hpStoreProducts = [];
let hpOrderInfo = {
    dietLabel: "Eat Clean Cân Bằng",
    pkg: "full_day",
    days: 7,
    unitPrice: 42500,
    slots: ["Bữa Sáng", "Bữa Trưa", "Bữa Phụ", "Bữa Tối"]
};

const hpStepTitles = [
    "01. Xác định mục tiêu & thời gian",
    "02. Chỉ số cơ thể",
    "03. Khẩu vị & Ngân sách",
    "04. Lịch tập luyện",
    "05. Lộ trình cá nhân hóa từ AI"
];

async function hpResolveCurrentUser() {
    try {
        const res = await fetch(AUTH_ME_URL, {
            credentials: "include",
            cache: "no-store"
        });
        if (!res.ok) {
            hpCurrentUserId = null;
            return null;
        }
        const data = await res.json();
        if (data && data.loggedIn && data.user) {
            const rawId = data.user.id ?? data.user.email ?? data.user.username ?? data.user.phone;
            hpCurrentUserId = rawId != null ? String(rawId).trim().toLowerCase() : null;
        } else {
            hpCurrentUserId = null;
        }
    } catch (e) {
        console.warn("Không kiểm tra được phiên đăng nhập:", e);
        hpCurrentUserId = null;
    }
    return hpCurrentUserId;
}

function hpGetPlanStorageKey() {
    return hpCurrentUserId ? `hf_saved_ai_plan_${hpCurrentUserId}` : null;
}

function hpGetWorkoutDoneKey() {
    return hpCurrentUserId ? `hf_workout_done_${hpCurrentUserId}` : null;
}

function hpGetBasePrefix() {
    return window.location.pathname.indexOf("/pages/") !== -1 ? "../" : "";
}

async function hpLoadStoreProducts() {
    if (hpStoreProducts.length) return hpStoreProducts;
    const prefix = hpGetBasePrefix();
    try {
        const res = await fetch(`${prefix}assets/data/products.json`);
        if (!res.ok) return [];
        const data = await res.json();
        hpStoreProducts = (Array.isArray(data) ? data : []).filter(
            p => String(p.visible || "Có").toLowerCase() === "có" && Number(p.inStock || 1) > 0
        );
    } catch (e) {
        console.warn("Không tải được products.json:", e);
    }
    return hpStoreProducts;
}

function hpNormalizeText(str) {
    return String(str || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function hpMatchStoreProduct(dishName, slotName) {
    if (!hpStoreProducts.length) return null;

    const cleanDish = String(dishName || "")
        .replace(/\([^)]*kcal[^)]*\)/gi, "")
        .replace(/^(Sáng|Bữa Sáng|Trưa|Bữa Trưa|Tối|Bữa Tối|Phụ|Bữa Phụ)\s*:\s*/i, "")
        .trim();

    const targetNorm = hpNormalizeText(cleanDish);
    const words = targetNorm.split(" ").filter(w => w.length >= 2);

    let bestProduct = null;
    let bestScore = 0;

    for (const p of hpStoreProducts) {
        const pNameNorm = hpNormalizeText(p.name);
        const pTagsNorm = hpNormalizeText(`${p.name} ${p.tags || ""} ${p.shortDescription || ""}`);

        let score = 0;
        if (pNameNorm === targetNorm) score += 100;
        else if (pNameNorm.includes(targetNorm) || targetNorm.includes(pNameNorm)) score += 45;

        for (const w of words) {
            if (pNameNorm.includes(w)) score += 6;
            else if (pTagsNorm.includes(w)) score += 2;
        }

        if (score > bestScore) {
            bestScore = score;
            bestProduct = p;
        }
    }

    if (bestProduct && bestScore >= 6) return bestProduct;

    const foodPool = hpStoreProducts.filter(p => {
        const cat = hpNormalizeText(p.category);
        if (slotName === "Bữa Phụ") return cat.includes("an vat") || cat.includes("do uong") || cat.includes("kho");
        if (slotName === "Bữa Sáng") return cat.includes("kho") || cat.includes("an vat") || cat.includes("do an");
        return cat.includes("do an") || !cat;
    });

    const pool = foodPool.length ? foodPool : hpStoreProducts;
    const hash = Array.from(cleanDish).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return pool[hash % pool.length];
}

function hpParseDayMeals(menuStr) {
    const slotMap = {};
    const ordered = [];

    String(menuStr || "").split("|").forEach(rawPart => {
        const trimmed = rawPart.trim();
        if (!trimmed) return;
        const match = trimmed.match(/^(Bữa\s*)?(Sáng|Trưa|Tối|Phụ)\s*:\s*(.+)$/i);
        if (match) {
            const key = match[2].toLowerCase();
            const dish = match[3].trim();
            slotMap[key] = dish;
            ordered.push(dish);
        } else {
            ordered.push(trimmed);
        }
    });

    return {
        "Bữa Sáng": slotMap["sáng"] || ordered[0] || "",
        "Bữa Trưa": slotMap["trưa"] || ordered[1] || ordered[0] || "",
        "Bữa Tối": slotMap["tối"] || ordered[2] || ordered[1] || ordered[0] || "",
        "Bữa Phụ": slotMap["phụ"] || ordered[3] || ordered[0] || ""
    };
}

function hpSyncCartButton() {
    const count = window.HFCart
        ? window.HFCart.count()
        : JSON.parse(localStorage.getItem("healthyfood_cart_v1") || "[]").reduce((s, i) => s + (Number(i.qty) || 1), 0);

    document.querySelectorAll("header button, header a, .btn-cart, .cart-button").forEach(el => {
        if (/^\s*Giỏ hàng/.test(el.textContent)) {
            el.textContent = `Giỏ hàng (${count})`;
        }
    });
}

function hpCollectRawFormInputs() {
    return {
        goal: document.querySelector('input[name="goal"]:checked')?.value || "",
        planDuration: document.querySelector('input[name="planDuration"]:checked')?.value || "7",
        goalDetail: document.getElementById("hp-goal-detail")?.value || "",
        gender: document.querySelector('input[name="gender"]:checked')?.value || "",
        age: document.getElementById("hp-age")?.value || "",
        height: document.getElementById("hp-height")?.value || "",
        weight: document.getElementById("hp-weight")?.value || "",
        activity: document.getElementById("hp-activity")?.value || "",
        limitations: document.getElementById("hp-limitations")?.value || "",
        diet: document.querySelector('input[name="diet"]:checked')?.value || "eatclean",
        budget: document.getElementById("hp-budget")?.value || "120000",
        allergy: document.getElementById("hp-allergy")?.value || "",
        workoutPlace: document.querySelector('input[name="workoutPlace"]:checked')?.value || "home",
        duration: document.querySelector('input[name="duration"]:checked')?.value || "45"
    };
}

function hpApplyRawFormInputs(inputs) {
    if (!inputs) return;

    const setRadio = (name, val) => {
        if (!val) return;
        const r = document.querySelector(`input[name="${name}"][value="${CSS.escape(val)}"]`);
        if (r) r.checked = true;
    };

    setRadio("goal", inputs.goal);
    setRadio("planDuration", inputs.planDuration);
    setRadio("gender", inputs.gender);
    setRadio("diet", inputs.diet);
    setRadio("workoutPlace", inputs.workoutPlace);
    setRadio("duration", inputs.duration);

    if (inputs.goalDetail !== undefined) document.getElementById("hp-goal-detail").value = inputs.goalDetail;
    if (inputs.age !== undefined) document.getElementById("hp-age").value = inputs.age;
    if (inputs.height !== undefined) document.getElementById("hp-height").value = inputs.height;
    if (inputs.weight !== undefined) document.getElementById("hp-weight").value = inputs.weight;
    if (inputs.activity !== undefined) document.getElementById("hp-activity").value = inputs.activity;
    if (inputs.limitations !== undefined) document.getElementById("hp-limitations").value = inputs.limitations;
    if (inputs.budget !== undefined) document.getElementById("hp-budget").value = inputs.budget;
    if (inputs.allergy !== undefined) document.getElementById("hp-allergy").value = inputs.allergy;

    hpCalcMetrics();
}

async function hpSyncPlanToServer(planPayload = null) {
    if (!hpCurrentUserId) return;

    const doneKey = hpGetWorkoutDoneKey();
    const workoutDone = doneKey ? JSON.parse(localStorage.getItem(doneKey) || "{}") : {};

    try {
        await fetch(HEALTHY_PLAN_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                plan: planPayload,
                workoutDone
            })
        });
    } catch (e) {
        console.warn("Không đồng bộ được lộ trình lên máy chủ:", e);
    }
}

async function hpSavePlanToStorage(advice, meals, workouts, planDays) {
    const storageKey = hpGetPlanStorageKey();
    if (!storageKey) return;

    const payload = {
        savedAt: Date.now(),
        advice,
        meals,
        workouts,
        planDays,
        orderInfo: hpOrderInfo,
        formInputs: hpCollectRawFormInputs(),
        summary: {
            targetCalories: document.getElementById("hp-target-calories")?.textContent || "",
            macroProtein: document.getElementById("hp-macro-protein")?.textContent || "",
            macroCarb: document.getElementById("hp-macro-carb")?.textContent || "",
            packageTitle: document.getElementById("hp-rec-package-title")?.textContent || "",
            packageDesc: document.getElementById("hp-rec-package-desc")?.textContent || "",
            revDuration: document.getElementById("rev-duration")?.textContent || "",
            revDiet: document.getElementById("rev-diet")?.textContent || "",
            revPackage: document.getElementById("rev-package")?.textContent || "",
            revWorkout: document.getElementById("rev-workout")?.textContent || "",
            revAllergy: document.getElementById("rev-allergy")?.textContent || ""
        }
    };

    try {
        localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (e) {
        console.warn("Không thể lưu lộ trình vào localStorage:", e);
    }

    // Đẩy lên database backend để đồng bộ đa thiết bị (máy tính / điện thoại khác)
    await hpSyncPlanToServer(payload);
}

async function hpRestoreSavedPlan() {
    const storageKey = hpGetPlanStorageKey();
    const doneKey = hpGetWorkoutDoneKey();
    if (!storageKey) return false;

    let saved = null;

    // 1. Ưu tiên lấy dữ liệu mới nhất từ server (để đồng bộ giữa các thiết bị)
    try {
        const res = await fetch(HEALTHY_PLAN_API_URL, {
            credentials: "include",
            cache: "no-store"
        });
        if (res.ok) {
            const serverData = await res.json();
            if (serverData && serverData.plan && Array.isArray(serverData.plan.meals) && serverData.plan.meals.length) {
                saved = serverData.plan;
                localStorage.setItem(storageKey, JSON.stringify(saved));
            }
            if (serverData && serverData.workoutDone && doneKey) {
                localStorage.setItem(doneKey, JSON.stringify(serverData.workoutDone));
            }
        }
    } catch (e) {
        console.warn("Không tải được lộ trình từ máy chủ, dùng bản đệm localStorage:", e);
    }

    // 2. Nếu server chưa có hoặc mất mạng, fallback sang bản lưu tạm trên trình duyệt
    if (!saved) {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return false;
        try {
            saved = JSON.parse(raw);
        } catch (e) {
            return false;
        }
    }

    if (!saved || !Array.isArray(saved.meals) || !saved.meals.length) return false;

    await hpLoadStoreProducts();

    if (saved.orderInfo) hpOrderInfo = saved.orderInfo;
    if (saved.formInputs) hpApplyRawFormInputs(saved.formInputs);

    const s = saved.summary || {};
    if (s.targetCalories) document.getElementById("hp-target-calories").textContent = s.targetCalories;
    if (s.macroProtein) document.getElementById("hp-macro-protein").textContent = s.macroProtein;
    if (s.macroCarb) document.getElementById("hp-macro-carb").textContent = s.macroCarb;
    if (s.packageTitle) document.getElementById("hp-rec-package-title").textContent = s.packageTitle;
    if (s.packageDesc) document.getElementById("hp-rec-package-desc").textContent = s.packageDesc;
    if (s.revDuration) document.getElementById("rev-duration").textContent = s.revDuration;
    if (s.revDiet) document.getElementById("rev-diet").textContent = s.revDiet;
    if (s.revPackage) document.getElementById("rev-package").textContent = s.revPackage;
    if (s.revWorkout) document.getElementById("rev-workout").textContent = s.revWorkout;
    if (s.revAllergy) document.getElementById("rev-allergy").textContent = s.revAllergy;

    const steps = document.querySelectorAll(".hp-step");
    hpCurrentStep = steps.length - 1;
    hpUpdateUI(true);

    const loadingEl = document.getElementById("hp-ai-loading");
    const resultEl = document.getElementById("hp-ai-result");
    if (loadingEl) loadingEl.style.display = "none";
    if (resultEl) resultEl.style.display = "block";

    hpRenderAIResult(saved.advice, saved.meals, saved.workouts, saved.planDays || 7);
    return true;
}

function hpUpdateUI(skipAutoRun = false) {
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

    if (hpCurrentStep === steps.length - 1 && !skipAutoRun) {
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
        pkg: "full_day",
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

    const selectedPkg = {
        label: `Trọn ngày (3 bữa + Snack · ${data.planDays} ngày)`,
        unitPrice: 42500,
        slots: ["Bữa Sáng", "Bữa Trưa", "Bữa Phụ", "Bữa Tối"]
    };

    const totalMeals = selectedPkg.slots.length * data.planDays;
    const title = `Gói ${dietMap[data.diet]} - ${goalMap[data.goal]} ${data.planDays} Ngày`;

    hpOrderInfo = {
        dietLabel: dietMap[data.diet],
        pkg: "full_day",
        days: data.planDays,
        unitPrice: selectedPkg.unitPrice,
        slots: selectedPkg.slots
    };

    document.getElementById("hp-rec-package-title").textContent = title;
    document.getElementById("hp-rec-package-desc").textContent =
        `Gồm ${totalMeals} suất ăn trọn ngày từ thực đơn HealthyFood (${selectedPkg.slots.join(", ")}). Bạn hãy bấm "+ Thêm vào giỏ" ở từng bữa muốn đặt bên dưới nhé.`;

    document.getElementById("rev-duration").textContent = `${data.planDays} ngày`;
    document.getElementById("rev-diet").textContent = dietMap[data.diet];
    document.getElementById("rev-package").textContent = selectedPkg.label;
    document.getElementById("rev-workout").textContent = `${placeMap[data.place]} · ${data.duration === "60" ? "60+" : data.duration} phút/buổi`;
    document.getElementById("rev-allergy").textContent = data.allergy;
}

function hpRenderAIResult(advice, meals, workouts, planDays) {
    hpPlanMeals = meals || [];
    const workoutList = workouts || [];
    const doneKey = hpGetWorkoutDoneKey();
    const doneMap = doneKey ? JSON.parse(localStorage.getItem(doneKey) || "{}") : {};

    document.getElementById("hp-ai-advice").innerHTML =
        `<strong>🩺 Tư vấn lộ trình ${planDays} ngày từ Chuyên gia AI:</strong> ${advice}`;

    const mealsContainer = document.getElementById("hp-ai-meals");
    mealsContainer.style.display = "flex";
    mealsContainer.style.flexDirection = "column";
    mealsContainer.style.gap = "18px";

    const renderWorkoutBox = (w, idx) => {
        if (!w) return "";
        const key = `hp_done_${planDays}_${idx}`;
        const checked = !!doneMap[key];
        const focusBadge = w.burn ? `${w.focus} (${w.burn})` : w.focus;
        const formattedWorkout = (w.detail || "")
            .split("->")
            .map(part => part.trim())
            .filter(Boolean)
            .map(part => `<div style="margin-bottom:4px;">• ${part}</div>`)
            .join("");

        return `
        <div class="hp-workout-box" style="margin-top:12px;padding:12px 14px;border-radius:10px;border:1px solid ${checked ? "#9ec9a2" : "#cfe0f5"};background:${checked ? "#eef6ef" : "#f5f9ff"};">
            <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
                <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-weight:700;color:#1d4e89;font-size:13.5px;">
                    <input type="checkbox" ${checked ? "checked" : ""} onchange="hpToggleDone('${key}', this)">
                    <span>🏋️ Lịch tập ${w.day} (Đánh dấu hoàn thành)</span>
                </label>
                <span class="hp-ai-badge-blue" style="line-height:1.35;">${focusBadge}</span>
            </div>
            <div class="hp-workout-detail" style="font-size:13.5px;line-height:1.55;color:var(--hp-ink);${checked ? "text-decoration:line-through;opacity:0.7;" : ""}">
                ${formattedWorkout || w.detail}
            </div>
        </div>`;
    };

    const cardsHTML = hpPlanMeals.map((m, dayIdx) => {
        const parsedSlots = hpParseDayMeals(m.menu);
        const slotList = ["Bữa Sáng", "Bữa Trưa", "Bữa Tối", "Bữa Phụ"];

        const mealRowsHTML = slotList.map(slotName => {
            const rawDish = parsedSlots[slotName];
            if (!rawDish) return "";

            const cleanDish = rawDish
                .replace(/\([^)]*kcal[^)]*\)/gi, "")
                .replace(/^(Bữa\s*)?(Sáng|Trưa|Tối|Phụ)\s*:\s*/i, "")
                .trim();

            const matched = hpMatchStoreProduct(cleanDish, slotName);
            const displayName = matched ? matched.name : cleanDish;
            const displayPrice = matched ? Number(matched.price || 0) : hpOrderInfo.unitPrice;
            const safeDishArg = encodeURIComponent(cleanDish);
            const safeSlotArg = encodeURIComponent(slotName);

            return `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px dashed rgba(91,0,21,0.14);">
                <div style="flex:1;min-width:0;">
                    <span style="display:inline-block;font-size:11.5px;font-weight:700;color:#5B0015;background:rgba(91,0,21,0.08);padding:2px 8px;border-radius:6px;margin-bottom:4px;">${slotName}</span>
                    <div style="font-size:14px;font-weight:600;color:var(--hp-ink);line-height:1.4;">${displayName}</div>
                    <div style="font-size:13px;color:#205c32;font-weight:700;margin-top:2px;">${displayPrice.toLocaleString("vi-VN")} ₫</div>
                </div>

                <button type="button"
                    onclick="hpAddSingleMealToCart(decodeURIComponent('${safeDishArg}'), decodeURIComponent('${safeSlotArg}'), this)"
                    style="flex-shrink:0;height:36px;padding:0 14px;border-radius:8px;border:1px solid #5B0015;background:#fff;color:#5B0015;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap;">
                    + Thêm vào giỏ
                </button>
            </div>`;
        }).join("");

        const pairedWorkoutHTML = renderWorkoutBox(workoutList[dayIdx], dayIdx);

        return `
        <div class="hp-ai-card" style="width:100%;box-sizing:border-box;">
            <div class="hp-ai-card-top" style="border-bottom:1px solid rgba(91,0,21,0.12);padding-bottom:8px;margin-bottom:4px;">
                <strong style="font-size:16px;color:#5B0015;">${m.day}</strong>
                <span class="hp-ai-badge-green">${m.calories}</span>
            </div>

            <div>
                ${mealRowsHTML}
            </div>

            ${pairedWorkoutHTML}
        </div>`;
    });

    if (workoutList.length > hpPlanMeals.length) {
        for (let i = hpPlanMeals.length; i < workoutList.length; i++) {
            cardsHTML.push(`
            <div class="hp-ai-card" style="width:100%;box-sizing:border-box;">
                ${renderWorkoutBox(workoutList[i], i)}
            </div>`);
        }
    }

    mealsContainer.innerHTML = cardsHTML.join("");
}

async function hpAddSingleMealToCart(dishName, slotName, btnEl) {
    await hpLoadStoreProducts();
    const prefix = hpGetBasePrefix();
    const defaultImg = `${prefix}assets/images/menu-1.jpg`;
    const cartUrl = window.HFCart ? window.HFCart.url : `${prefix}pages/cart.html`;
    const matched = hpMatchStoreProduct(dishName, slotName);

    const product = matched
        ? {
            id: matched.id,
            name: matched.name,
            image: matched.image || defaultImg,
            price: Number(matched.price || hpOrderInfo.unitPrice),
            comparePrice: Number(matched.comparePrice || 0),
            unit: matched.unit || "suất",
            weight: matched.weight || "",
            weightUnit: matched.weightUnit || "",
            inStock: Number(matched.inStock || 99)
        }
        : {
            id: `hp-${hpNormalizeText(dishName).replace(/\s+/g, "-")}`,
            name: dishName,
            image: defaultImg,
            price: hpOrderInfo.unitPrice,
            comparePrice: 0,
            unit: "suất",
            weight: "",
            weightUnit: "",
            inStock: 99
        };

    if (window.HFCart) {
        window.HFCart.add(product, 1);
        if (btnEl) {
            window.HFCart.toast(`Đã thêm "${product.name}" vào giỏ! <a href="${cartUrl}">Xem giỏ hàng</a>`);
        }
    } else {
        const CART_KEY = "healthyfood_cart_v1";
        const cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
        const exist = cart.find(i => String(i.id) === String(product.id));
        if (exist) exist.qty = Math.min(99, (Number(exist.qty) || 1) + 1);
        else cart.push({ ...product, qty: 1 });
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
    }

    hpSyncCartButton();

    if (btnEl) {
        const oldText = btnEl.textContent;
        btnEl.textContent = "✓ Đã thêm";
        btnEl.style.background = "#205c32";
        btnEl.style.color = "#fff";
        btnEl.style.borderColor = "#205c32";
        setTimeout(() => {
            btnEl.textContent = oldText;
            btnEl.style.background = "#fff";
            btnEl.style.color = "#5B0015";
            btnEl.style.borderColor = "#5B0015";
        }, 1200);
    }
}

async function hpToggleDone(key, el) {
    const doneKey = hpGetWorkoutDoneKey();
    if (doneKey) {
        const doneMap = JSON.parse(localStorage.getItem(doneKey) || "{}");
        doneMap[key] = el.checked;
        localStorage.setItem(doneKey, JSON.stringify(doneMap));
    }

    const box = el.closest(".hp-workout-box");
    const detail = box?.querySelector(".hp-workout-detail");
    if (box) {
        box.style.background = el.checked ? "#eef6ef" : "#f5f9ff";
        box.style.borderColor = el.checked ? "#9ec9a2" : "#cfe0f5";
    }
    if (detail) {
        detail.style.textDecoration = el.checked ? "line-through" : "none";
        detail.style.opacity = el.checked ? "0.7" : "1";
    }

    // Đồng bộ trạng thái tick bài tập lên server
    await hpSyncPlanToServer(null);
}

function hpBuildDurationInstruction(planDays, cal, duration) {
    if (planDays === 7) {
        return {
            scopeDesc: "trọn vẹn 7 ngày chi tiết từng ngày (Ngày 1 đến Ngày 7)",
            mealSchema: `[
    { "day": "Ngày 1", "menu": "Sáng: Tên món trên web | Trưa: Tên món trên web | Tối: Tên món trên web | Phụ: Tên món trên web", "calories": "${cal} kcal", "keyword": "Tên món chính" },
    ... (đủ 7 phần tử từ Ngày 1 đến Ngày 7)
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
    { "day": "Ngày 1", "menu": "Sáng: Tên món trên web | Trưa: Tên món trên web | Tối: Tên món trên web | Phụ: Tên món trên web", "calories": "${cal} kcal", "keyword": "Tên món chính" },
    ... (đủ 14 phần tử từ Ngày 1 đến Ngày 14)
  ]`,
            workoutSchema: `[
    { "day": "Ngày 1", "focus": "Nhóm cơ / Trọng tâm", "burn": "~300 kcal", "detail": "Khởi động 5p -> Bài 1 (3x12) -> Bài 2 (3x15) -> Giãn cơ 5p (${duration} phút)" },
    ... (đủ 14 phần tử từ Ngày 1 đến Ngày 14, Ngày 7 và Ngày 14 nghỉ phục hồi)
  ]`
        };
    }

    if (planDays === 30) {
        return {
            scopeDesc: "lộ trình 30 ngày chia làm 4 Tuần tiến triển rõ rệt + thực đơn tiêu biểu 7 ngày xoay vòng từ menu của web",
            mealSchema: `[
    { "day": "Tuần 1 · Mẫu 1", "menu": "Sáng: Tên món trên web | Trưa: Tên món trên web | Tối: Tên món trên web | Phụ: Tên món trên web", "calories": "${cal} kcal", "keyword": "Tên món chính" },
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

    return {
        scopeDesc: "lộ trình chuyển hóa chuyên sâu 90 ngày (3 Tháng) chia theo 6 Chặng 15 ngày + thực đơn 7 ngày xoay vòng từ menu của web",
        mealSchema: `[
    { "day": "Tháng 1 · Mẫu 1", "menu": "Sáng: Tên món trên web | Trưa: Tên món trên web | Tối: Tên món trên web | Phụ: Tên món trên web", "calories": "${cal} kcal", "keyword": "Tên món chính" },
    ... (đủ 7 phần tử thực đơn 7 ngày đa dạng xoay vòng cho cả 3 tháng)
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

    await hpResolveCurrentUser();
    await hpLoadStoreProducts();
    const storeMenuNames = hpStoreProducts.map(p => p.name).join(", ");

    const data = hpGetFormPayload();
    const goalNames = { lose: "Giảm cân & siết mỡ", gain: "Tăng cân lành mạnh", muscle: "Tăng cơ bắp", maintain: "Giữ dáng", healthy: "Ăn sạch & thanh lọc" };
    const dietNames = { eatclean: "Eat Clean", high_protein: "High-Protein", low_carb: "Low-Carb/Keto", vegetarian: "Thuần chay" };
    const placeNames = { home: "Tại nhà", gym: "Phòng Gym", outdoor: "Ngoài trời" };
    const durationSpec = hpBuildDurationInstruction(data.planDays, data.cal, data.duration);

    loadingEl.style.display = "block";
    resultEl.style.display = "none";

    const promptText = `Hãy thiết kế ${durationSpec.scopeDesc} đồng bộ chặt chẽ giữa ăn uống VÀ tập luyện cho khách hàng:
- Thời gian cam kết: ${data.planDays} ngày.
- Thể trạng: ${data.gender}, ${data.age} tuổi, cao ${data.height}cm, nặng ${data.weight}kg (BMI: ${data.metrics.bmi}, TDEE: ${data.metrics.tdee} kcal).
- Mục tiêu: ${goalNames[data.goal]} (${data.goalDetail}).
- Định mức dinh dưỡng: ${data.cal} kcal/ngày (${data.p}g Protein · ${data.c}g Carbs · ${data.f}g Fat).
- Chế độ ăn: ${dietNames[data.diet]} · Ngân sách dự kiến: ~${Number(data.budget).toLocaleString("vi-VN")}đ/ngày.
- Gói suất ăn khách đặt từ bếp: Trọn ngày (Sáng + Trưa + Tối + Phụ) (đảm bảo tất cả các bữa đều có món thật trên web để khách đặt ngay).
- Dị ứng / kiêng khem (loại bỏ 100% khỏi thực đơn): ${data.allergy}.
- Chấn thương / bệnh lý (bắt buộc né hoàn toàn các động tác gây áp lực/hại): ${data.limitations}.
- Tập luyện: ${placeNames[data.place]}, ${data.duration} phút/buổi.


QUY TẮC BẮT BUỘC VỀ THỰC ĐƠN:
Chỉ được chọn và sử dụng CHÍNH XÁC tên các sản phẩm có sẵn trong danh mục cửa hàng HealthyFood dưới đây cho các bữa Sáng, Trưa, Tối, Phụ (tuyệt đối không tự bịa tên món bên ngoài danh sách này):
[${storeMenuNames}]

Chỉ trả về JSON hợp lệ đúng cấu trúc sau:
{
  "advice": "Phân tích chuyên môn 2-3 câu về chiến lược dinh dưỡng & tập luyện cho cả chặng đường ${data.planDays} ngày.",
  "meals": ${durationSpec.mealSchema},
  "workouts": ${durationSpec.workoutSchema}
}`;

    try {
        if (!DIFY_API_KEY || DIFY_API_KEY.includes("DAN_KEY")) {
            throw new Error("Chưa dán DIFY_API_KEY vào đầu file healthy-plan.js");
        }

        const response = await fetch(DIFY_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${DIFY_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                inputs: { query: promptText },
                response_mode: "blocking",
                user: hpCurrentUserId || "healthyfood-guest"
            })
        });

        const resJson = await response.json();
        if (!response.ok) {
            throw new Error(resJson.message || `Lỗi Dify HTTP ${response.status}`);
        }

        let rawText = (resJson.answer || "{}").replace(/```json|```/gi, "").trim();
        const plan = JSON.parse(rawText);

        hpRenderAIResult(plan.advice, plan.meals, plan.workouts, data.planDays);
        await hpSavePlanToStorage(plan.advice, plan.meals, plan.workouts, data.planDays);
    } catch (err) {
        console.error("Lỗi gọi Dify AI:", err);
        const fallbackDishes = hpStoreProducts.length
            ? hpStoreProducts.slice(0, 12).map(p => p.name)
            : ["Ức gà nướng mật ong", "Salad cá hồi áp chảo", "Cơm gạo lứt ức gà", "Yến mạch granola"];
        const pick = (idx) => fallbackDishes[idx % fallbackDishes.length];

        const fallbackAdvice = `<span style="color:#b42318;">(Đang dùng thực đơn mẫu từ bếp do: ${err.message})</span><br>Với lộ trình <strong>${data.planDays} ngày</strong>, chỉ số BMI <strong>${data.metrics.bmi}</strong> và mục tiêu <strong>${data.cal.toLocaleString("vi-VN")} kcal/ngày</strong>, bạn nên duy trì nạp đủ <strong>${data.p}g đạm sạch</strong> mỗi ngày kết hợp tập luyện ${data.duration} phút/buổi.`;
        const fallbackMeals = Array.from({ length: 7 }, (_, i) => ({
            day: `Ngày ${i + 1}`,
            menu: `Sáng: ${pick(i)} | Trưa: ${pick(i + 2)} | Tối: ${pick(i + 4)} | Phụ: ${pick(i + 6)}`,
            calories: `${data.cal} kcal`,
            keyword: pick(i + 2)
        }));
        const fallbackWorkouts = [
            { day: "Ngày 1", focus: "Toàn thân & Đốt mỡ", burn: "~300 kcal", detail: `Khởi động 5p -> Squat (3x15), Push-up (3x12), Plank (3x45s), Jumping Jacks (3x30s) -> Giãn cơ 5p (${data.duration} phút).` },
            { day: "Ngày 2", focus: "Thân dưới & Bụng", burn: "~280 kcal", detail: `Khởi động 5p -> Lunges (3x12/chân), Glute Bridge (3x15), Crunches (3x20), Mountain Climbers (3x30s) -> Giãn cơ 5p (${data.duration} phút).` },
            { day: "Ngày 3", focus: "Cardio nhẹ & Giãn cơ", burn: "~220 kcal", detail: "Đi bộ nhanh hoặc đạp xe nhẹ 20p -> Yoga giãn cơ phục hồi 15p." },
            { day: "Ngày 4", focus: "Thân trên & Core", burn: "~290 kcal", detail: `Khởi động 5p -> Incline Push-up (3x12), Tricep Dips (3x12), Superman (3x15), Plank nghiêng (3x30s/bên) -> Giãn cơ 5p (${data.duration} phút).` },
            { day: "Ngày 5", focus: "HIIT Đốt Calo", burn: "~340 kcal", detail: `Khởi động 5p -> 40s tập / 20s nghỉ × 5 tổ liên hoàn: Burpees biến thể, High Knees, Squat Pulse -> Hạ nhiệt 5p (${data.duration} phút).` },
            { day: "Ngày 6", focus: "Vận động linh hoạt", burn: "~240 kcal", detail: "Core nhẹ nhàng (Bird-Dog, Dead Bug 3x12) -> Kéo giãn toàn thân 20 phút." },
            { day: "Ngày 7", focus: "Phục hồi chủ động", burn: "~150 kcal", detail: "Thư giãn hoàn toàn, hít thở sâu -> Giãn cơ nhẹ 15 phút để cơ bắp tái tạo." }
        ];

        hpRenderAIResult(fallbackAdvice, fallbackMeals, fallbackWorkouts, data.planDays);
        await hpSavePlanToStorage(fallbackAdvice, fallbackMeals, fallbackWorkouts, data.planDays);
    } finally {
        loadingEl.style.display = "none";
        resultEl.style.display = "block";
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    localStorage.removeItem("hf_gemini_key");
    localStorage.removeItem("cart");
    localStorage.removeItem("hf_saved_ai_plan_v1");
    localStorage.removeItem("hf_workout_done");

    hpLoadStoreProducts();
    hpSyncCartButton();

    ["hp-age", "hp-height", "hp-weight", "hp-activity"].forEach((id) => {
        document.getElementById(id)?.addEventListener("input", hpCalcMetrics);
        document.getElementById(id)?.addEventListener("change", hpCalcMetrics);
    });

    document.querySelectorAll('input[name="gender"]').forEach((r) => {
        r.addEventListener("change", hpCalcMetrics);
    });

    hpPreselectGoalFromURL();
    hpAutoFillFromCalculator();

    await hpResolveCurrentUser();
    const restored = await hpRestoreSavedPlan();
    if (!restored) {
        hpUpdateUI();
    }
});