/* =====================================================
   INVESTPRO - app.js
   Handles: register, login, logout, login protection.

   User accounts are saved in the browser (localStorage)
   and are NEVER deleted on logout. Logout only ends the
   current login session.
   ===================================================== */

(function () {

    "use strict";

    var root = (typeof window !== "undefined") ? window : globalThis;

    var USERS_KEY   = "investpro_users";     // all registered accounts
    var SESSION_KEY = "investpro_session";   // email of the logged-in user
    var EMAIL_RE    = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;


    /* ---------- storage helpers ---------- */

    function getUsers() {
        try {
            var list = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
            return Array.isArray(list) ? list : [];
        } catch (e) {
            return [];
        }
    }

    function saveUsers(list) {
        localStorage.setItem(USERS_KEY, JSON.stringify(list));
    }

    function lower(s) {
        return String(s == null ? "" : s).trim().toLowerCase();
    }

    function findByEmail(email) {
        var e = lower(email);
        var list = getUsers();
        for (var i = 0; i < list.length; i++) {
            if (lower(list[i].email) === e) return list[i];
        }
        return null;
    }

    function findByLogin(id) {
        var v = lower(id);
        var digits = v.replace(/[^0-9]/g, "");
        var list = getUsers();
        for (var i = 0; i < list.length; i++) {
            var u = list[i];
            if (lower(u.email) === v) return u;
            if (digits.length >= 10 && String(u.phone || "").replace(/[^0-9]/g, "") === digits) return u;
        }
        return null;
    }


    /* ---------- password hashing ---------- */

    async function hashPassword(password, salt) {

        var data = salt + ":" + password;

        if (root.crypto && root.crypto.subtle && typeof TextEncoder !== "undefined") {
            var buf = await root.crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
            return Array.prototype.map.call(new Uint8Array(buf), function (b) {
                return ("0" + b.toString(16)).slice(-2);
            }).join("");
        }

        // fallback for browsers without crypto.subtle
        var h = 5381;
        for (var i = 0; i < data.length; i++) h = ((h << 5) + h + data.charCodeAt(i)) | 0;
        return "x" + (h >>> 0).toString(16);
    }

    function makeSalt() {
        return Math.random().toString(36).slice(2) + Date.now().toString(36);
    }


    /* ---------- session ---------- */

    function getCurrentUser() {

        var email = localStorage.getItem(SESSION_KEY);
        if (!email) return null;

        var u = findByEmail(email);

        if (!u) {
            localStorage.removeItem(SESSION_KEY);
            return null;
        }

        return u;
    }

    function logout() {
        // only ends the session, accounts and deposits stay saved
        localStorage.removeItem(SESSION_KEY);
        root.location.href = "login.html";
    }


    /* ---------- register / login logic ---------- */

    async function registerUser(d) {

        var firstName = String(d.firstName || "").trim();
        var lastName  = String(d.lastName || "").trim();
        var email     = lower(d.email);
        var phone     = String(d.phone || "").trim();
        var password  = String(d.password || "");
        var referral  = String(d.referral || "").trim().toUpperCase();

        if (!firstName || !lastName) return { ok: false, error: "Please enter your first and last name." };
        if (!EMAIL_RE.test(email))   return { ok: false, error: "Please enter a valid email address." };
        if (phone.replace(/[^0-9]/g, "").length < 10) return { ok: false, error: "Please enter a valid phone number." };
        if (password.length < 6)     return { ok: false, error: "Password must be at least 6 characters." };

        if (findByEmail(email)) {
            return { ok: false, error: "This email is already registered. Please login." };
        }

        // Check referral code (optional field)
        if (referral && root.IPRef) {
            var referrer = root.IPRef.resolveCode(referral);
            if (!referrer) return { ok: false, error: "Referral code not found. Check the code or leave it empty." };
            if (referrer === email) return { ok: false, error: "You cannot use your own referral code." };
        }

        var salt = makeSalt();

        var user = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            firstName: firstName,
            lastName: lastName,
            name: firstName + " " + lastName,
            email: email,
            phone: phone,
            referral: referral,
            salt: salt,
            passwordHash: await hashPassword(password, salt),
            createdAt: new Date().toISOString()
        };

        var list = getUsers();
        list.push(user);
        saveUsers(list);

        if (root.IPRef) root.IPRef.rememberReferral(email, referral, user.name);

        return { ok: true, user: user };
    }

    async function loginUser(id, password) {

        var u = findByLogin(id);

        if (!u) return { ok: false, error: "Wrong email or password." };

        var hash = await hashPassword(String(password || ""), u.salt || "");

        if (hash !== u.passwordHash) return { ok: false, error: "Wrong email or password." };

        localStorage.setItem(SESSION_KEY, lower(u.email));

        return { ok: true, user: u };
    }

    function selectPlan(name) {
        root.location.href = "deposit.html?plan=" + encodeURIComponent(String(name).toLowerCase());
    }


    /* ---------- page glue ---------- */

    function showMsg(form, text, ok) {

        var box = form.querySelector(".app-msg");

        if (!box) {
            box = document.createElement("p");
            box.className = "app-msg";
            var btn = form.querySelector("button[type=submit]");
            form.insertBefore(box, btn);
        }

        box.className = "app-msg " + (ok ? "form-ok" : "form-error");
        box.textContent = text;
    }

    function bindForms() {

        var regForm = document.getElementById("registerForm");

        if (regForm) {
            regForm.addEventListener("submit", async function (e) {

                e.preventDefault();

                var btn = regForm.querySelector("button[type=submit]");
                btn.disabled = true;

                var res = await registerUser({
                    firstName: document.getElementById("firstName").value,
                    lastName:  document.getElementById("lastName").value,
                    email:     document.getElementById("email").value,
                    phone:     document.getElementById("phone").value,
                    password:  document.getElementById("password").value,
                    referral:  document.getElementById("referral").value
                });

                if (!res.ok) {
                    showMsg(regForm, res.error, false);
                    btn.disabled = false;
                    return;
                }

                showMsg(regForm, "Account created successfully. Redirecting to login...", true);

                setTimeout(function () { root.location.href = "login.html"; }, 1000);
            });
        }

        var loginForm = document.getElementById("loginForm");

        if (loginForm) {
            loginForm.addEventListener("submit", async function (e) {

                e.preventDefault();

                var btn = loginForm.querySelector("button[type=submit]");
                btn.disabled = true;

                var res = await loginUser(
                    document.getElementById("loginEmail").value,
                    document.getElementById("loginPassword").value
                );

                if (!res.ok) {
                    showMsg(loginForm, res.error, false);
                    btn.disabled = false;
                    return;
                }

                root.location.href = "dashboard.html";
            });
        }
    }

    function init() {

        if (typeof document === "undefined") return;

        // Ask the browser not to clear this site's saved data
        if (navigator.storage && navigator.storage.persist) {
            navigator.storage.persist().catch(function () {});
        }

        var user = getCurrentUser();

        // Pages for logged-in users only (dashboard, plans, deposit)
        if (document.body.classList.contains("dashboard-page") && !user) {
            root.location.replace("login.html");
            return;
        }

        // Show the user's name
        if (user) {
            var w = document.getElementById("welcomeUser");
            if (w) w.textContent = "Hi, " + user.name;

            var p = document.getElementById("planUser");
            if (p) p.textContent = user.name;

            // Home page: replace Register/Login buttons with Dashboard
            var nav = document.querySelector(".nav-buttons");
            if (nav) nav.innerHTML = '<a href="dashboard.html" class="btn btn-primary">Dashboard</a>';
        }

        bindForms();
    }

    root.logout = logout;
    root.selectPlan = selectPlan;

    root.IPApp = {
        registerUser: registerUser,
        loginUser: loginUser,
        getCurrentUser: getCurrentUser,
        getUsers: getUsers,
        logout: logout
    };

    init();

})();
