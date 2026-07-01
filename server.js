const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();

/* =======================
   FIX CORS (IMPORTANT)
======================= */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json({ limit: '10mb' }));
const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "admin123";
/* =======================
   SERVE FRONTEND FILES
======================= */
app.use(express.static(path.join(__dirname, 'public')));

/* =======================
   ENV
======================= */
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CREDS = JSON.parse(process.env.GOOGLE_CREDENTIALS);

/* =======================
   GOOGLE SHEETS AUTH
======================= */
function getDoc() {
  const auth = new JWT({
    email: CREDS.client_email,
    key: CREDS.private_key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return new GoogleSpreadsheet(SHEET_ID, auth);
}

/* =======================
   GET SHEET
======================= */
async function getSheet(title) {

  const doc = getDoc();

  await doc.loadInfo();

  const schemas = {
    Users: [
      'phone',
      'name',
      'email',
      'avatar',
      'created_at'
    ],
    Products: [
      'id',
      'name',
      'price',
      'desc',
      'img'
    ],
    Orders: [
      'id',
      'time',
      'customer',
      'phone',
      'items',
      'total',
      'status'
    ]
  };

  let sheet =
    doc.sheetsByTitle[title];

  if (!sheet) {

    sheet =
      await doc.addSheet({
        title,
        headerValues:
          schemas[title]
      });

    return sheet;
  }

  try {

    await sheet.loadHeaderRow();

  } catch {

    await sheet.setHeaderRow(
      schemas[title]
    );

  }

  return sheet;
}

/* =======================
   ROUTES - HTML FIX
======================= */

// default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manufacturer_products.html'));
});

app.get('/shop', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'user_products.html'));
});

app.get('/api/admin/auth', (req,res)=>{
  res.json({
    status:'working'
  });
});

/* =======================
   ADMIN AUTH
======================= */

const jwt = require("jsonwebtoken");

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "admin123";

const JWT_SECRET =
  process.env.JWT_SECRET || "dreammode-secret";

/* Login */

app.post("/api/admin/auth", (req, res) => {

  try {

    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        ok: false,
        error: "Password required"
      });
    }

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({
        ok: false,
        error: "Invalid password"
      });
    }

    const token = jwt.sign(
      {
        role: "admin"
      },
      JWT_SECRET,
      {
        expiresIn: "24h"
      }
    );

    res.json({
      ok: true,
      token
    });

  } catch (err) {

    res.status(500).json({
      ok: false,
      error: err.message
    });

  }

});

/* Verify Token */

function verifyAdmin(req, res, next) {

  const auth =
    req.headers.authorization;

  if (!auth) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized"
    });
  }

  const token =
    auth.replace("Bearer ", "");

  try {

    jwt.verify(
      token,
      JWT_SECRET
    );

    next();

  } catch {

    res.status(401).json({
      ok: false,
      error: "Token expired"
    });

  }

}

/* Check Login */

app.get(
  "/api/admin/check",
  verifyAdmin,
  (req, res) => {

    res.json({
      ok: true
    });

  }
);

app.get("/api/admin/check", verifyAdmin, (req,res)=>{

    res.json({
        ok:true
    });

});

/* =======================
   USER LOGIN
======================= */
app.post('/api/user/login', async (req, res) => {
  try {
    const sheet = await getSheet('Users');
    const rows = await sheet.getRows();

    const { name, phone, email, avatar } = req.body;

    let user = rows.find(r => r.phone === phone);

    if (user) {
      return res.json({ exists: true, user });
    }

    await sheet.addRow({
      phone,
      name,
      email,
      avatar,
      created_at: new Date().toISOString()
    });

    res.json({ exists: false, user: { name, phone, email, avatar } });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/session', async (req, res) => {

  try {

    const sheet =
      await getSheet('Users');

    const rows =
      await sheet.getRows();

    const user = rows.find(
      r => String(r.phone) ===
      String(req.body.phone)
    );

    if (!user) {
      return res.status(404).json({
        error:'Not found'
      });
    }

    res.json({
      ok:true
    });

  } catch(err) {

    res.status(500).json({
      error: err.message
    });

  }

});

/* =======================
   PRODUCTS
======================= */
/* =======================
   PRODUCTS
======================= */

app.get("/api/products", async (req, res) => {

  try {

    const sheet = await getSheet("Products");
    const rows = await sheet.getRows();

    const products = rows
      .map(r => ({
        id: String(r.id || "").trim(),
        name: String(r.name || "").trim(),
        price: Number(r.price || 0),
        desc: String(r.desc || "").trim(),
        img: String(r.img || "").trim()
      }))
      .filter(p => p.id !== "");

    res.json(products);

  } catch (err) {

    res.status(500).json({
      ok: false,
      error: err.message
    });

  }

});

app.post(
  "/api/products/save",
  verifyAdmin,
  async (req, res) => {
console.log("BODY:", req.body);
    try {

      const {

        id,
        name,
        price,
        desc,
        img

      } = req.body;

      if (!name || !price) {

        return res.status(400).json({
          ok: false,
          error: "Name and price are required"
        });

      }

      const sheet = await getSheet("Products");

      const rows = await sheet.getRows();

      const productId =
        id || Date.now().toString();

      const existing = rows.find(
        r => String(r.id).trim() === String(productId).trim()
      );

      if (existing) {

        existing.name = name;
        existing.price = Number(price);
        existing.desc = desc || "";
        existing.img = img || "";

        await existing.save();

        return res.json({
          ok: true,
          action: "updated"
        });

      }

      await sheet.addRow({

        id: productId,

        name,

        price: Number(price),

        desc: desc || "",

        img: img || ""

      });

      res.json({
        ok: true,
        action: "created"
      });

    } catch (err) {

      res.status(500).json({
        ok: false,
        error: err.message
      });

    }

  }
);

app.post(
  "/api/products/delete",
  verifyAdmin,
  async (req, res) => {

    try {

      const { id } = req.body;

      if (!id) {

        return res.status(400).json({
          ok: false,
          error: "Missing product ID"
        });

      }

      const sheet = await getSheet("Products");

      const rows = await sheet.getRows();

      const row = rows.find(
        r => String(r.id).trim() === String(id).trim()
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

    } catch (err) {

      res.status(500).json({
        ok: false,
        error: err.message
      });

    }

  }
);

app.get('/debug-sheet', async (req,res)=>{

  const doc = getDoc();

  await doc.loadInfo();

  res.json({
    sheetId:SHEET_ID,
    tabs:Object.keys(doc.sheetsByTitle)
  });

});
/* =======================
   ORDERS
======================= */
/* =======================
   SAVE ORDER
======================= */
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