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
/* ==========================================
   EVENTS
========================================== */

loginBtn.onclick = login;

logoutBtn.onclick = logout;

refreshBtn.onclick = initialize;

window.onload = checkLogin;