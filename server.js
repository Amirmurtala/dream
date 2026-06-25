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

app.post('/api/admin/auth', (req, res) => {

  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      ok: false,
      error: 'Password required'
    });
  }

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({
      ok: false,
      error: 'Wrong password'
    });
  }

  res.json({
    ok: true,
    message: 'Login successful'
  });

});
app.get('/api/admin/check', (req,res)=>{

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
app.get('/api/products', async (req, res) => {
  try {
    const sheet = await getSheet('Products');
    const rows = await sheet.getRows();

    const products = rows.map(r => ({
      id: r.id || r._rawData?.[0],
      name: r.name || "Unnamed product",
      price: Number(r.price || 0),
      desc: r.desc || "",
      img: r.img || ""
    })).filter(p => p.id); // remove broken rows

    res.json(products);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products/save', async (req, res) => {

  try {

    const { name, price, desc, img } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        ok:false,
        error:"Product name required"
      });
    }

    if (!price) {
      return res.status(400).json({
        ok:false,
        error:"Product price required"
      });
    }

    const sheet = await getSheet('Products');

    await sheet.addRow({
      id: Date.now().toString(),
      name: String(name).trim(),
      price: Number(price),
      desc: desc || "",
      img: img || ""
    });

    res.json({
      ok:true
    });

  } catch(err) {

    res.status(500).json({
      ok:false,
      error:err.message
    });

  }

});

app.post('/api/products/delete', async (req, res) => {

  try {

    const sheet = await getSheet('Products');
    const rows = await sheet.getRows();

    const id = String(req.body.id);

    const row = rows.find(
      r => String(r.id) === id
    );

    if (!row) {
      return res.status(404).json({
        ok:false,
        error:"Product not found"
      });
    }

    await row.delete();

    res.json({
      ok:true
    });

  } catch(err) {

    res.status(500).json({
      ok:false,
      error:err.message
    });

  }

});

/* =======================
   ORDERS
======================= */
app.get('/api/orders', async (req, res) => {
  const sheet = await getSheet('Orders');
  const rows = await sheet.getRows();

  res.json(rows.map(r => ({
    id: r.id,
    customer: r.customer,
    phone: r.phone,
    total: r.total,
    status: r.status
  })));
});

app.post('/api/orders/update', async (req, res) => {
  const sheet = await getSheet('Orders');
  const rows = await sheet.getRows();

 const row = rows.find(
  r => String(r.id).trim() === id.trim()
);
  if (!row) return res.status(404).json({ error: "not found" });

  row.status = req.body.status;
  await row.save();

  res.json({ ok: true });
});

/* =======================
   START SERVER (RENDER SAFE)
======================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});