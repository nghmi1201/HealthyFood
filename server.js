const cors = require("cors");
const session = require("express-session");
const { randomBytes } = require("crypto");
const fs = require("fs/promises");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;
// Cho phép Live Server kết nối với Backend
app.use(cors({
    origin: "http://127.0.0.1:5501",
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"]
}));
// Cho phép server nhận dữ liệu JSON
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Cho phép trình duyệt truy cập các file giao diện
app.use(express.static(
    path.join(__dirname, "HealthyFood")
));

const usersFile = path.join(
    __dirname,
    "server",
    "data",
    "user.json"
);

// API đăng ký tài khoản
app.post("/api/register", async (req, res) => {
    const { fullName, email, phone, password } = req.body;

    // Kiểm tra dữ liệu đăng ký
    if (
        typeof fullName !== "string" ||
        typeof email !== "string" ||
        typeof password !== "string" ||
        !fullName.trim() ||
        !email.trim() ||
        password.length < 8
    ) {
        return res.status(400).json({
            message: "Thông tin không hợp lệ hoặc mật khẩu dưới 8 ký tự"
        });
    }

    const normalizedEmail = email.trim().toLowerCase();

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({
        message: "Email không hợp lệ"
    });
}

    try {
        // Đọc danh sách khách hàng từ JSON
        const data = await fs.readFile(usersFile, "utf8");
        const customers = JSON.parse(data);

        // Kiểm tra email đã đăng ký chưa
        const exists = customers.some(
            customer => customer.email === normalizedEmail
        );

        if (exists) {
            return res.status(409).json({
                message: "Email đã được đăng ký"
            });
        }

        // Tạo tài khoản khách hàng
        const customer = {
            id: randomUUID(),
            fullName: fullName.trim(),
            email: normalizedEmail,
            phone: typeof phone === "string" ? phone.trim() : "",
            passwordHash: await bcrypt.hash(password, 12),
            createdAt: new Date().toISOString()
        };

        // Thêm khách hàng vào danh sách
        customers.push(customer);

        // Lưu danh sách mới vào file JSON
        await fs.writeFile(
            usersFile,
            JSON.stringify(customers, null, 2),
            "utf8"
        );

        res.status(201).json({
            message: "Đăng ký thành công",
            customer: {
                id: customer.id,
                fullName: customer.fullName,
                email: customer.email
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Lỗi xử lý đăng ký tài khoản"
        });
    }
});

 // API đăng nhập tài khoản
app.post("/api/login", async (req, res) => {
    const { email, password } = req.body || {};

    // Kiểm tra thông tin đầu vào
    if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        !password
    ) {
        return res.status(400).json({
            message: "Vui lòng nhập email và mật khẩu"
        });
    }

    try {
        // Đọc danh sách tài khoản từ JSON
        const data = await fs.readFile(usersFile, "utf8");
        const users = JSON.parse(data);

        // Tìm tài khoản bằng email
        const user = users.find(
            u => u.email === email.trim().toLowerCase()
        );

        // Kiểm tra tài khoản và mật khẩu
        const validPassword = user
            ? await bcrypt.compare(password, user.passwordHash)
            : false;

        if (!validPassword) {
            return res.status(401).json({
                message: "Email hoặc mật khẩu không chính xác"
            });
        }

        // Tạo phiên đăng nhập mới
        req.session.regenerate((error) => {
            if (error) {
                return res.status(500).json({
                    message: "Không thể tạo phiên đăng nhập"
                });
            }

            // Lưu thông tin khách hàng
            req.session.user = {
                id: user.id,
                fullName: user.fullName,
                email: user.email
            };

            // Lưu phiên đăng nhập
            req.session.save((error) => {
                if (error) {
                    return res.status(500).json({
                        message: "Không thể lưu phiên đăng nhập"
                    });
                }

                return res.status(200).json({
                    message: "Đăng nhập thành công",
                    user: req.session.user
                });
            });
        });


    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Lỗi xử lý đăng nhập"
        });
    }
});
app.get("/api/me", (req, res) => {
    if (!req.session.user) {
        return res.json({ loggedIn: false });
    }

    return res.json({
        loggedIn: true,
        user: req.session.user
    });
});

// API đăng xuất tài khoản
app.post("/api/logout", (req, res) => {

    // Hủy phiên đăng nhập hiện tại
    req.session.destroy((error) => {

        if (error) {
            return res.status(500).json({
                message: "Đăng xuất thất bại"
            });
        }

        // Xóa cookie phiên đăng nhập
        res.clearCookie("connect.sid", {
            path: "/"
        });

        return res.status(200).json({
            message: "Đăng xuất thành công"
        });
    });
});
// Kiểm tra khách hàng đang đăng nhập
app.get("/api/me", (req, res) => {
    if (!req.session.user) {
        return res.json({
            loggedIn: false
        });
    }

    return res.json({
        loggedIn: true,
        user: req.session.user
    });
});
// API đặt hàng: lưu đơn vào server/data/invoices.json
const ordersFile = path.join(__dirname, "server", "data", "invoices.json");
const productsFile = path.join(__dirname, "HealthyFood", "assets", "data", "products.json");

app.post("/api/orders", async (req, res) => {
    // [QR] 4a: thêm paymentRef (mã chuyển khoản)
    const { customer, invoice, items, paymentMethod, paymentRef } = req.body || {};

    // Kiểm tra thông tin khách hàng
    if (
        !customer ||
        typeof customer.fullName !== "string" || !customer.fullName.trim() ||
        typeof customer.address !== "string" || !customer.address.trim() ||
        !/^(0|\+84)\d{9}$/.test(String(customer.phone || ""))
    ) {
        return res.status(400).json({ message: "Thông tin khách hàng không hợp lệ" });
    }

    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
        return res.status(400).json({ message: "Giỏ hàng trống hoặc không hợp lệ" });
    }

    // [QR] 4b: cho phép thanh toán COD hoặc chuyển tiền QR
    if (!["cod", "qr"].includes(paymentMethod)) {
        return res.status(400).json({ message: "Phương thức thanh toán không hợp lệ" });
    }
    if (paymentMethod === "qr" && !/^HF[A-Z0-9]{4,20}$/.test(String(paymentRef || ""))) {
        return res.status(400).json({ message: "Mã thanh toán QR không hợp lệ" });
    }

    try {
        // Tính lại giá từ dữ liệu sản phẩm, không tin giá do trình duyệt gửi
        const products = JSON.parse(await fs.readFile(productsFile, "utf8"));
        const orderItems = [];
        let total = 0;

        for (const item of items) {
            const product = products.find(p => String(p.id) === String(item.id));
            const qty = Number(item.qty);

            if (!product || !Number.isInteger(qty) || qty < 1 || qty > 99) {
                return res.status(400).json({ message: "Sản phẩm trong giỏ không hợp lệ" });
            }
            if (Number(product.inStock) < qty) {
                return res.status(400).json({ message: `"${product.name}" chỉ còn ${product.inStock} sản phẩm` });
            }

            orderItems.push({ id: product.id, name: product.name, price: product.price, qty });
            total += product.price * qty;
        }

        const orderId = "HF" + Date.now().toString(36).toUpperCase();
        const order = {
            orderId,
            createdAt: new Date().toISOString(),
            customer: {
                fullName: customer.fullName.trim(),
                phone: customer.phone,
                email: String(customer.email || "").trim(),
                address: customer.address.trim(),
                province: String(customer.province || ""),
                district: String(customer.district || ""),
                note: String(customer.note || "").slice(0, 500)
            },
            invoice: invoice ? {
                company: String(invoice.company || ""),
                taxCode: String(invoice.taxCode || ""),
                companyAddress: String(invoice.companyAddress || "")
            } : null,
            items: orderItems,
            paymentMethod,
            // [QR] 4c: mã chuyển khoản + trạng thái thanh toán
            paymentRef: paymentMethod === "qr" ? paymentRef : null,
            paymentStatus: paymentMethod === "qr" ? "awaiting_confirmation" : "cod",
            total,
            userEmail: req.session.user ? req.session.user.email : null
        };

        await fs.mkdir(path.dirname(ordersFile), { recursive: true });
        let orders = [];
        try {
            orders = JSON.parse(await fs.readFile(ordersFile, "utf8"));
        } catch (error) {
            // Chưa có file đơn hàng: bắt đầu danh sách mới
        }
        orders.push(order);
        await fs.writeFile(ordersFile, JSON.stringify(orders, null, 2), "utf8");

        return res.status(201).json({ orderId, total });
    } catch (error) {
        console.error("Lỗi lưu đơn hàng:", error);
        return res.status(500).json({ message: "Không thể lưu đơn hàng, vui lòng thử lại" });
    }
});

const profileDir = path.join(require("node:os").homedir(), ".healthyfood", "profiles");

function getProfileFile(id) {
    const key = require("node:crypto")
        .createHash("sha256")
        .update(String(id))
        .digest("hex");

    return path.join(profileDir, key + ".json");
}

async function readSavedProfile(id) {
    try {
        const content = await fs.readFile(getProfileFile(id), "utf8");
        return JSON.parse(content);
    } catch (error) {
        if (error.code === "ENOENT") return {};
        throw error;
    }
}
app.get("/api/profile/contact", async (req, res) => {
    const userId = req.session.user?.id;

    if (!userId) {
        return res.status(401).json({ message: "Bạn cần đăng nhập." });
    }

    try {
        // Đọc user.json và tìm đúng người đang đăng nhập
        const content = await fs.readFile(usersFile, "utf8");
        const users = JSON.parse(content);
        const user = users.find(item => item.id === userId);

        if (!user) {
            return res.status(404).json({ message: "Không tìm thấy tài khoản." });
        }

        res.set("Cache-Control", "no-store");
        const saved = await readSavedProfile(user.id);

res.json({
    id: user.id,
    fullName: saved.fullName ?? user.fullName,
    email: user.email,
    phone: user.phone || "",
    birthday: saved.birthday || "",
    gender: saved.gender || "",
    avatar: saved.avatar || ""
});
    } catch (error) {
        console.error("Lỗi đọc thông tin khách hàng:", error);
        res.status(500).json({ message: "Không đọc được thông tin khách hàng." });
    }
});

app.post("/api/profile/contact", async (req, res) => {
    const user = req.session.user;
    if (!user) {
        return res.status(401).json({ message: "Bạn cần đăng nhập." });
    }

    const body = req.body || {};
    const allowed = ["id", "fullName", "birthday", "gender", "avatar"];

    if (Object.keys(body).some(key => !allowed.includes(key))) {
        return res.status(400).json({ message: "Có trường không được phép sửa." });
    }

    if (body.id !== user.id) {
        return res.status(409).json({ message: "Tài khoản đã thay đổi. Hãy tải lại trang." });
    }

    const { birthday, gender, avatar } = body;
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";

    if (!fullName || fullName.length > 150) {
        return res.status(400).json({ message: "Họ tên cần từ 1 đến 150 ký tự." });
    }

    if (!["", "Nam", "Nữ", "Khác", "Không muốn chia sẻ"].includes(gender)) {
        return res.status(400).json({ message: "Giới tính chưa hợp lệ." });
    }

    if (birthday !== "") {
        const date = new Date(birthday + "T00:00:00Z");
        const today = new Date().toLocaleDateString("sv-SE");

        if (typeof birthday !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(birthday) ||
            Number.isNaN(date.getTime()) ||
            date.toISOString().slice(0, 10) !== birthday ||
            birthday > today) {
            return res.status(400).json({ message: "Ngày sinh chưa hợp lệ." });
        }
    }

    if (typeof avatar !== "string" || avatar.length > 65000 ||
        (avatar && !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(avatar))) {
        return res.status(400).json({ message: "Ảnh đại diện chưa hợp lệ." });
    }

    const profile = { fullName, birthday, gender, avatar };
    const file = getProfileFile(user.id);
    const temporary = file + "." + require("node:crypto").randomUUID() + ".tmp";

    try {
        await fs.mkdir(profileDir, { recursive: true });
        await fs.writeFile(temporary, JSON.stringify(profile), "utf8");
        await fs.rename(temporary, file);
        user.fullName = fullName;
        res.json(profile);
    } catch (error) {
        await fs.rm(temporary, { force: true }).catch(() => {});
        console.error("Lỗi lưu hồ sơ:", error);
        res.status(500).json({ message: "Chưa lưu được hồ sơ." });
    }
});
// Khởi động server
app.listen(PORT, () => {
    console.log(`HealthyFood chạy tại http://localhost:${PORT}`);
});