// ==============================

    // TÍNH BMI

    // ==============================

    function calculateBMI(weight, height) {

        // Đổi chiều cao từ cm sang m

        let heightMeter = height / 100;

        let bmi = weight / (heightMeter * heightMeter);

        return bmi;

    }

    // ==============================

    // TÍNH BMR

    // ==============================

    function calculateBMR(gender, weight, height, age) {

        let bmr;

        /*

            Công thức Mifflin-St Jeor:

            Nam:

            BMR = 10W + 6.25H - 5A + 5

            Nữ:

            BMR = 10W + 6.25H - 5A - 161

        */

        if (gender === "male") {

            bmr = 10 * weight + 6.25 * height - 5 * age + 5;

        } else {

            bmr = 10 * weight + 6.25 * height - 5 * age - 161;

        }

        return bmr;

    }

    // ==============================

    // TÍNH TDEE

    // ==============================

    function calculateTDEE(bmr, activityLevel) {

        let tdee = bmr * activityLevel;

        return tdee;

    }

    // ==============================

    // TÍNH CÂN NẶNG KHỎE MẠNH

    // ==============================

    function calculateHealthyWeight(height) {

        let heightMeter = height / 100;

        /*

            BMI khỏe mạnh:

            18.5 -> 24.9

            Cân nặng = BMI × chiều cao²

        */

        let minWeight = 18.5 * heightMeter * heightMeter;

        let maxWeight = 24.9 * heightMeter * heightMeter;

        return {

            min: minWeight,

            max: maxWeight

        };

    }

    // ==============================

    // VALIDATION

    // ==============================

    function validateCalculator() {

        let gender = document.getElementById("gender").value;

        let age = Number(document.getElementById("age").value);

        let weight = Number(document.getElementById("weight").value);

        let height = Number(document.getElementById("height").value);

        let activity = document.getElementById("activity").value;

        let error = document.getElementById("error");

        error.innerHTML = "";

        if (gender === "") {

            error.innerHTML = "Vui lòng chọn giới tính!";

            return false;

        }

        if (age <= 0 || age > 120) {

            error.innerHTML = "Tuổi phải lớn hơn 0 và không quá 120!";

            return false;

        }

        if (weight <= 0 || weight > 500) {

            error.innerHTML = "Cân nặng không hợp lệ!";

            return false;

        }

        if (height <= 0 || height > 250) {

            error.innerHTML = "Chiều cao không hợp lệ!";

            return false;

        }

        if (activity === "") {

            error.innerHTML = "Vui lòng chọn mức độ hoạt động!";

            return false;

        }

        return true;

    }

    // ==============================

    // HIỂN THỊ KẾT QUẢ

    // ==============================

    function displayResult(bmi, bmr, tdee, healthyWeight) {

        document.getElementById("bmiResult").innerText =

            bmi.toFixed(2);

        document.getElementById("bmrResult").innerText =

            bmr.toFixed(0);

        document.getElementById("tdeeResult").innerText =

            tdee.toFixed(0);

        document.getElementById("healthyWeightResult").innerText =

            healthyWeight.min.toFixed(1)

            + " - "

            + healthyWeight.max.toFixed(1)

            + " kg";

        // Đánh giá BMI

        let status = "";

        if (bmi < 18.5) {

            status = "Thiếu cân";

        }

        else if (bmi < 25) {

            status = "Bình thường";

        }

        else if (bmi < 30) {

            status = "Thừa cân";

        }

        else {

            status = "Béo phì";

        }

        document.getElementById("bmiStatus").innerText = status;

        // Hiện khu vực kết quả

        document.getElementById("result").style.display = "block";

    }

    // ==============================

    // RESET

    // ==============================

    function resetCalculator() {

        document.getElementById("gender").value = "";

        document.getElementById("age").value = "";

        document.getElementById("weight").value = "";

        document.getElementById("height").value = "";

        document.getElementById("activity").value = "";

        document.getElementById("error").innerHTML = "";

        document.getElementById("result").style.display = "none";

    }

    // ==============================

    // EVENT

    // ==============================

    document.getElementById("calculateBtn").addEventListener("click", function () {

        // Kiểm tra dữ liệu

        if (!validateCalculator()) {

            return;

        }

        // Lấy dữ liệu từ DOM

        let gender = document.getElementById("gender").value;

        let age = Number(document.getElementById("age").value);

        let weight = Number(document.getElementById("weight").value);

        let height = Number(document.getElementById("height").value);

        let activity = Number(document.getElementById("activity").value);

        // Tính toán

        let bmi = calculateBMI(weight, height);

        let bmr = calculateBMR(

            gender,

            weight,

            height,

            age

        );

        let tdee = calculateTDEE(

            bmr,

            activity

        );

        let healthyWeight =

            calculateHealthyWeight(height);

        // Hiển thị kết quả

        displayResult(

            bmi,

            bmr,

            tdee,

            healthyWeight

        );

    });

    document.getElementById("resetBtn").addEventListener("click", function () {

        resetCalculator();

    });
