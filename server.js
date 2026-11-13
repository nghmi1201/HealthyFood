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
// Khởi động server
app.listen(PORT, () => {
    console.log(`HealthyFood chạy tại http://localhost:${PORT}`);
});
