/* ==========================================
   DREAMMODE ADMIN V3
========================================== */

const API =
"https://dream-yinl.onrender.com";

/* ==========================================
   CLOUDINARY
========================================== */

const CLOUDINARY_CLOUD =
"dreammode";

const CLOUDINARY_PRESET =
"products_unsigned";

/* ==========================================
   ELEMENTS
========================================== */

const loginModal =
document.getElementById(
"loginModal"
);

const app =
document.getElementById(
"app"
);

const loginBtn =
document.getElementById(
"loginBtn"
);

const logoutBtn =
document.getElementById(
"logoutBtn"
);

const refreshBtn =
document.getElementById(
"refreshBtn"
);

const loadingOverlay =
document.getElementById(
"loadingOverlay"
);

const toast =
document.getElementById(
"toast"
);

/* ==========================================
   AUTHENTICATION (SESSION STORAGE)
========================================== */

function isLoggedIn() {
    return sessionStorage.getItem("manufacturer_auth") === "true";
}

function saveLogin() {
    sessionStorage.setItem("manufacturer_auth", "true");
}

function logout() {
    sessionStorage.removeItem("manufacturer_auth");
    location.reload();
}

async function login() {

    const password = document
        .getElementById("adminPassword")
        .value
        .trim();

    if (!password) {
        showToast("Enter admin password", false);
        return;
    }

    showLoader();

    try {

        const response = await fetch(API + "/api/admin/auth", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                password
            })

        });

        const data = await response.json();

        hideLoader();

        if (!data.ok) {

            showToast(
                data.error || "Wrong password",
                false
            );

            return;

        }

        saveLogin();

        loginModal.style.display = "none";

        app.classList.remove("hidden");

        showToast("Welcome Manufacturer");

        initialize();

    }

    catch (err) {

        hideLoader();

        console.error(err);

        showToast(
            "Cannot connect to server",
            false
        );

    }

}

function checkLogin() {

    if (isLoggedIn()) {

        loginModal.style.display = "none";

        app.classList.remove("hidden");

        initialize();

    }

    else {

        loginModal.style.display = "flex";

    }

}
/* ==========================================
   EDIT PRODUCT
========================================== */

function editProduct(id) {

    const product = products.find(p => p.id == id);

    if (!product) return;

    editingId = id;

    document.getElementById("productName").value = product.name;
    document.getElementById("productPrice").value = product.price;
    document.getElementById("productDesc").value = product.desc;

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}

/* ==========================================
   DELETE PRODUCT
========================================== */

async function deleteProduct(id) {

    if (!confirm("Delete this product?")) return;

    showLoader();

    try {

        const res = await fetch(

            API + "/api/products/delete",

            {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    id
                })

            }

        );

        const data = await res.json();

        if (data.ok) {

            showToast("Product deleted");

            loadProducts();

        } else {

            showToast(
                data.error || "Delete failed",
                false
            );

        }

    } catch (err) {

        console.error(err);

        showToast(
            "Server error",
            false
        );

    }

    hideLoader();

}

/* ==========================================
   CLEAR FORM
========================================== */

function clearForm() {

    editingId = null;

    document.getElementById("productName").value = "";
    document.getElementById("productPrice").value = "";
    document.getElementById("productDesc").value = "";
    document.getElementById("productImage").value = "";

}

/* ==========================================
   LOAD ORDERS
========================================== */

async function loadOrders() {

    try {

        const res = await fetch(
            API + "/api/orders"
        );

        orders = await res.json();

        renderOrders();

        updateStats();

    }

    catch (err) {

        console.error(err);

    }

}

/* ==========================================
   RENDER ORDERS
========================================== */

function renderOrders() {

    const tbody =
        document.getElementById(
            "ordersTable"
        );

    tbody.innerHTML = "";

    orders.forEach(order => {

        tbody.innerHTML += `

<tr>

<td>${order.customer}</td>

<td>${order.phone}</td>

<td>₦${Number(order.total).toLocaleString()}</td>

<td>

<span class="status ${order.status}">

${order.status}

</span>

</td>

<td>

<button
class="done-btn"
onclick="updateOrder('${order.id}')">

Done

</button>

</td>

</tr>

`;

    });

}

/* ==========================================
   UPDATE ORDER
========================================== */

async function updateOrder(id) {

    await fetch(

        API +
        "/api/orders/update",

        {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                id,

                status: "delivered"

            })

        }

    );

    loadOrders();

}

/* ==========================================
   DASHBOARD STATS
========================================== */

function updateStats() {

    document.getElementById("productsCount").innerText =
        products.length;

    document.getElementById("ordersCount").innerText =
        orders.length;

    const revenue =
        orders.reduce((sum, o) =>
            sum + Number(o.total || 0), 0);

    document.getElementById("revenue").innerText =
        "₦" + revenue.toLocaleString();

    const pending =
        orders.filter(o =>
            o.status !== "delivered"
        ).length;

    document.getElementById("pendingOrders").innerText =
        pending;

}

/* ==========================================
   NAVIGATION
========================================== */

document.querySelectorAll(".nav-btn")

.forEach(btn => {

    btn.onclick = function () {

        document.querySelectorAll(".nav-btn")

        .forEach(b =>
            b.classList.remove("active")
        );

        this.classList.add("active");

        document.querySelectorAll(".page")

        .forEach(page =>
            page.classList.remove("active")
        );

        document.getElementById(

            this.dataset.page

        ).classList.add("active");

    };

});

/* ==========================================
   INITIALIZE
========================================== */

async function initialize() {

    await loadProducts();

    await loadOrders();

}

/* ==========================================
   EVENTS
========================================== */

document.getElementById(
"saveProductBtn"
).onclick = saveProduct;

logoutBtn.onclick = logout;

refreshBtn.onclick = initialize;

window.onload = checkLogin;

/* ==========================================
   CHECK LOGIN
========================================== */

async function checkLogin(){

const token =
getToken();

if(!token){

loginModal.style.display =
"flex";

return;

}

try{

const res =
await fetch(

API +
"/api/admin/check",

{
headers:{
Authorization:
"Bearer " +
token
}
}

);

const data =
await res.json();

if(!data.ok){

clearToken();

loginModal.style.display =
"flex";

return;

}

loginModal.style.display =
"none";

app.classList.remove(
"hidden"
);

await initialize();

}
catch{

clearToken();

loginModal.style.display =
"flex";

}

}

/* ==========================================
   LOGOUT
========================================== */

function logout(){

clearToken();

location.reload();

}