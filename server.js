const express = require("express");
const cors = require("cors");
const path = require("path");

const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");

const app = express();

/* ======================================
   CONFIG
====================================== */

const PORT = process.env.PORT || 10000;

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "admin123";

const SHEET_ID =
    process.env.GOOGLE_SHEET_ID;

if (!SHEET_ID) {
    throw new Error("GOOGLE_SHEET_ID is missing.");
}

if (!process.env.GOOGLE_CREDENTIALS) {
    throw new Error("GOOGLE_CREDENTIALS is missing.");
}

const CREDS =
    JSON.parse(process.env.GOOGLE_CREDENTIALS);

/* ======================================
   MIDDLEWARE
====================================== */

app.use(cors({
    origin: "*",
    methods: [
        "GET",
        "POST",
        "PUT",
        "DELETE"
    ],
    allowedHeaders: [
        "Content-Type",
        "x-admin-password"
    ]
}));

app.use(express.json({
    limit: "10mb"
}));

app.use(express.urlencoded({
    extended: true
}));

app.use(express.static(
    path.join(__dirname, "public")
));

/* ======================================
   GOOGLE SHEETS
====================================== */

function getDocument() {

    const auth = new JWT({

        email: CREDS.client_email,

        key: CREDS.private_key.replace(
            /\\n/g,
            "\n"
        ),

        scopes: [
            "https://www.googleapis.com/auth/spreadsheets"
        ]

    });

    return new GoogleSpreadsheet(
        SHEET_ID,
        auth
    );

}

/* ======================================
   SHEET SCHEMAS
====================================== */

const SCHEMAS = {

    Users: [
        "phone",
        "name",
        "email",
        "avatar",
        "created_at"
    ],

    Products: [
        "id",
        "name",
        "price",
        "desc",
        "img"
    ],

    Orders: [
        "id",
        "time",
        "customer",
        "phone",
        "items",
        "total",
        "status"
    ]

};

/* ======================================
   GET SHEET
====================================== */

async function getSheet(title) {

    const doc = getDocument();

    await doc.loadInfo();

    let sheet =
        doc.sheetsByTitle[title];

    if (!sheet) {

        sheet =
            await doc.addSheet({

                title,

                headerValues:
                    SCHEMAS[title]

            });

        return sheet;

    }

    try {

        await sheet.loadHeaderRow();

    }

    catch {

        await sheet.setHeaderRow(
            SCHEMAS[title]
        );

    }

    return sheet;

}

/* ======================================
   HELPERS
====================================== */

function clean(value) {

    return String(value ?? "").trim();

}

function number(value) {

    const n = Number(value);

    return Number.isFinite(n)
        ? n
        : 0;

}

/* ======================================
   STATIC ROUTES
====================================== */

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "login.html"
        )
    );

});

app.get("/login", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "login.html"
        )
    );

});

app.get("/admin", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "manufacturer_products.html"
        )
    );

});

app.get("/shop", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "user_products.html"
        )
    );

});

app.get("/debug-sheet", async (req, res) => {

    try {

        const doc = getDocument();

        await doc.loadInfo();

        res.json({

            ok: true,

            sheetId: SHEET_ID,

            tabs: Object.keys(doc.sheetsByTitle)

        });

    }

    catch (err) {

        res.status(500).json({

            ok: false,

            error: err.message

        });

    }

});

/* ======================================
   ADMIN AUTHENTICATION
====================================== */

/*
Login

Body:

{
    "password":"admin123"
}
*/

app.post("/api/admin/auth", (req, res) => {

    try {

        const password =
            clean(req.body.password);

        if (!password) {

            return res.status(400).json({

                ok: false,

                error: "Password is required"

            });

        }

        if (password !== ADMIN_PASSWORD) {

            return res.status(401).json({

                ok: false,

                error: "Incorrect password"

            });

        }

        res.json({

            ok: true,

            message: "Login successful"

        });

    }

    catch (err) {

        res.status(500).json({

            ok: false,

            error: err.message

        });

    }

});

/* ======================================
   ADMIN MIDDLEWARE
====================================== */

function verifyAdmin(req, res, next) {

    const password = clean(

        req.headers["x-admin-password"] ||

        req.body.password

    );

    if (!password) {

        return res.status(401).json({

            ok: false,

            error: "Admin password required"

        });

    }

    if (password !== ADMIN_PASSWORD) {

        return res.status(401).json({

            ok: false,

            error: "Unauthorized"

        });

    }

    next();

}

/* ======================================
   ADMIN STATUS
====================================== */

app.get("/api/admin/check", (req, res) => {

    res.json({

        ok: true,

        authenticated: true

    });

});
/* =======================
   USER LOGIN
======================= */
/* ======================================
   USER API
====================================== */

/*
Register/Login User

If the phone already exists,
return the existing user.

Otherwise create a new user.
*/

app.post("/api/user/login", async (req, res) => {

    try {

        const phone = clean(req.body.phone);
        const name = clean(req.body.name);
        const email = clean(req.body.email);
        const avatar = clean(req.body.avatar);

        if (!phone) {

            return res.status(400).json({

                ok: false,
                error: "Phone number is required"

            });

        }

        const sheet =
            await getSheet("Users");

        const rows =
            await sheet.getRows();

        const existing =
            rows.find(

                row =>
                    clean(row.phone) === phone

            );

        if (existing) {

            return res.json({

                ok: true,

                exists: true,

                user: {

                    phone: clean(existing.phone),
                    name: clean(existing.name),
                    email: clean(existing.email),
                    avatar: clean(existing.avatar),
                    created_at: clean(existing.created_at)

                }

            });

        }

        const createdAt =
            new Date().toISOString();

        await sheet.addRow({

            phone,

            name,

            email,

            avatar,

            created_at: createdAt

        });

        res.json({

            ok: true,

            exists: false,

            user: {

                phone,

                name,

                email,

                avatar,

                created_at: createdAt

            }

        });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            ok: false,

            error: err.message

        });

    }

});

/* ======================================
   RESTORE USER SESSION
====================================== */

app.post("/api/user/session", async (req, res) => {

    try {

        const phone =
            clean(req.body.phone);

        if (!phone) {

            return res.status(400).json({

                ok: false,

                error: "Phone number required"

            });

        }

        const sheet =
            await getSheet("Users");

        const rows =
            await sheet.getRows();

        const user =
            rows.find(

                row =>
                    clean(row.phone) === phone

            );

        if (!user) {

            return res.status(404).json({

                ok: false,

                error: "User not found"

            });

        }

        res.json({

            ok: true,

            user: {

                phone: clean(user.phone),
                name: clean(user.name),
                email: clean(user.email),
                avatar: clean(user.avatar),
                created_at: clean(user.created_at)

            }

        });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            ok: false,

            error: err.message

        });

    }

});

/* ======================================
   GET ALL USERS (ADMIN)
====================================== */

app.get(

    "/api/users",

    verifyAdmin,

    async (req, res) => {

        try {

            const sheet =
                await getSheet("Users");

            const rows =
                await sheet.getRows();

            const users =
                rows.map(row => ({

                    phone:
                        clean(row.phone),

                    name:
                        clean(row.name),

                    email:
                        clean(row.email),

                    avatar:
                        clean(row.avatar),

                    created_at:
                        clean(row.created_at)

                }));

            res.json({

                ok: true,

                users

            });

        }

        catch (err) {

            console.error(err);

            res.status(500).json({

                ok: false,

                error: err.message

            });

        }

    }

);
/* ======================================
   PRODUCTS
====================================== */

/*
GET ALL PRODUCTS
*/

app.get("/api/products", async (req, res) => {

    try {

        const sheet =
            await getSheet("Products");

        const rows =
            await sheet.getRows();

        const products = rows

            .map(row => ({

                id: clean(row.id),

                name: clean(row.name),

                price: number(row.price),

                desc: clean(row.desc),

                img: clean(row.img)

            }))

            .filter(product => product.id);

        res.json({

            ok: true,

            products

        });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            ok: false,

            error: err.message

        });

    }

});

/* ======================================
   CREATE / UPDATE PRODUCT
====================================== */

app.post(

    "/api/products/save",

    verifyAdmin,

    async (req, res) => {

        try {

            const id =
                clean(req.body.id);

            const name =
                clean(req.body.name);

            const price =
                number(req.body.price);

            const desc =
                clean(req.body.desc);

            const img =
                clean(req.body.img);

            if (!name) {

                return res.status(400).json({

                    ok: false,

                    error: "Product name is required"

                });

            }

            if (price <= 0) {

                return res.status(400).json({

                    ok: false,

                    error: "Price must be greater than zero"

                });

            }

            const sheet =
                await getSheet("Products");

            const rows =
                await sheet.getRows();

            const existing =
                rows.find(

                    row =>

                        clean(row.id) === id

                );

            if (existing) {

                existing.name = name;
                existing.price = price;
                existing.desc = desc;
                existing.img = img;

                await existing.save();

                return res.json({

                    ok: true,

                    action: "updated",

                    product: {

                        id,

                        name,

                        price,

                        desc,

                        img

                    }

                });

            }

            const product = {

                id:
                    Date.now().toString(),

                name,

                price,

                desc,

                img

            };

            await sheet.addRow(product);

            res.json({

                ok: true,

                action: "created",

                product

            });

        }

        catch (err) {

            console.error(err);

            res.status(500).json({

                ok: false,

                error: err.message

            });

        }

    }

);

/* ======================================
   DELETE PRODUCT
====================================== */

app.post(

    "/api/products/delete",

    verifyAdmin,

    async (req, res) => {

        try {

            const id =
                clean(req.body.id);

            if (!id) {

                return res.status(400).json({

                    ok: false,

                    error: "Product ID required"

                });

            }

            const sheet =
                await getSheet("Products");

            const rows =
                await sheet.getRows();

            const row =
                rows.find(

                    r => clean(r.id) === id

                );

            if (!row) {

                return res.status(404).json({

                    ok: false,

                    error: "Product not found"

                });

            }

            await row.delete();

            res.json({

                ok: true

            });

        }

        catch (err) {

            console.error(err);

            res.status(500).json({

                ok: false,

                error: err.message

            });

        }

    }

);

/* ======================================
   GET SINGLE PRODUCT
====================================== */

app.get(

    "/api/products/:id",

    async (req, res) => {

        try {

            const id =
                clean(req.params.id);

            const sheet =
                await getSheet("Products");

            const rows =
                await sheet.getRows();

            const row =
                rows.find(

                    r => clean(r.id) === id

                );

            if (!row) {

                return res.status(404).json({

                    ok: false,

                    error: "Product not found"

                });

            }

            res.json({

                ok: true,

                product: {

                    id: clean(row.id),

                    name: clean(row.name),

                    price: number(row.price),

                    desc: clean(row.desc),

                    img: clean(row.img)

                }

            });

        }

        catch (err) {

            console.error(err);

            res.status(500).json({

                ok: false,

                error: err.message

            });

        }

    }

);
/* =======================
   GET ORDERS
======================= */
app.get("/api/orders", async (req, res) => {

    try {

        const sheet = await getSheet("Orders");

        const rows = await sheet.getRows();

        const orders = rows.map(r => ({

            id: String(r.id),

            customer: r.customer,

            phone: r.phone,

            items: JSON.parse(r.items || "[]"),

            total: Number(r.total || 0),

            status: r.status,

            time: r.time

        }));

        res.json(orders);

    } catch (err) {

        res.status(500).json({
            ok: false,
            error: err.message
        });

    }

});

app.post("/api/orders/save", async (req, res) => {

    try {

        const {

            customer,
            phone,
            items,
            total

        } = req.body;

        if (!customer || !phone || !items || !items.length) {

            return res.status(400).json({
                ok: false,
                error: "Incomplete order"
            });

        }

        const sheet = await getSheet("Orders");

        await sheet.addRow({

            id: Date.now().toString(),

            time: new Date().toISOString(),

            customer,

            phone,

            items: JSON.stringify(items),

            total: Number(total),

            status: "Pending"

        });

        res.json({
            ok: true
        });

    } catch (err) {

        res.status(500).json({
            ok: false,
            error: err.message
        });

    }

});

/* =======================
   UPDATE ORDER
======================= */
app.post(

    "/api/orders/update",

    verifyAdmin,

    async (req, res) => {

        try {

            const {

                id,
                status

            } = req.body;

            const sheet =
                await getSheet("Orders");

            const rows =
                await sheet.getRows();

            const row =
                rows.find(

                    r =>
                    String(r.id).trim() ===
                    String(id).trim()

                );

            if (!row) {

                return res.status(404).json({

                    ok: false,

                    error: "Order not found"

                });

            }

            row.status = status;

            await row.save();

            res.json({

                ok: true

            });

        } catch (err) {

            res.status(500).json({

                ok: false,

                error: err.message

            });

        }

    }

);
/* =======================
   DASHBOARD
======================= */
app.get(

    "/api/dashboard",

    verifyAdmin,

    async (req, res) => {

        try {

            const productSheet =
                await getSheet("Products");

            const orderSheet =
                await getSheet("Orders");

            const products =
                await productSheet.getRows();

            const orders =
                await orderSheet.getRows();

            const revenue =
                orders.reduce(

                    (sum, o) =>

                    sum +
                    Number(o.total || 0),

                    0

                );

            const delivered =
                orders.filter(

                    o =>

                    o.status === "Delivered"

                ).length;

            res.json({

                ok: true,

                products:
                    products.length,

                orders:
                    orders.length,

                delivered,

                revenue

            });

        } catch (err) {

            res.status(500).json({

                ok: false,

                error: err.message

            });

        }

    }

);

/* =======================
   START SERVER (RENDER SAFE)
======================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});