/* =====================================================
   INVESTPRO - app.js
   Handles: register, login, logout, login protection
   and EMAIL OTP (one-time code) verification.

   - OTP is required when registering AND on every login.
   - User accounts are saved in the browser (localStorage)
     and are NEVER deleted on logout.
   ===================================================== */

(function () {

    "use strict";

    var root = (typeof window !== "undefined") ? window : globalThis;


    /* =====================================================
       OTP / EMAIL SETTINGS  -  FILL THESE IN (see EmailJS)
       Leave the 3 EMAILJS values empty = DEMO MODE
       (the code is shown on screen instead of emailed)
       ===================================================== */
    var CONFIG = {
        EMAILJS_PUBLIC_KEY:  "",     // EmailJS > Account > Public Key
        EMAILJS_SERVICE_ID:  "",     // EmailJS > Email Services > Service ID
        EMAILJS_TEMPLATE_ID: "",     // EmailJS > Email Templates > Template ID

        SITE_NAME: "InvestPro",
        CODE_LENGTH: 6,              // digits in the code
        EXPIRY_MINUTES: 5,           // code expires after this
        MAX_ATTEMPTS: 3,             // wrong tries before the code is cancelled
        RESEND_SECONDS: 30           // wait time before "Resend"
    };


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

    function esc(s) {
        return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
                                         .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

    function maskEmail(e) {
        var p = String(e || "").split("@");
        if (p.length !== 2) return e || "";
        return p[0].slice(0, 2) + "***@" + p[1];
    }


    /* ---------- hashing ---------- */

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


    /* =====================================================
       OTP: create, send by email, verify
       ===================================================== */

    var otpState = null;   // { hash, salt, expires, attempts }

    function randomCode(len) {

        var out = "";

        if (root.crypto && root.crypto.getRandomValues) {
            var arr = new Uint32Array(len);
            root.crypto.getRandomValues(arr);
            for (var i = 0; i < len; i++) out += String(arr[i] % 10);
        } else {
            for (var j = 0; j < len; j++) out += String(Math.floor(Math.random() * 10));
        }

        return out;
    }

    function emailConfigured() {
        return !!(CONFIG.EMAILJS_PUBLIC_KEY && CONFIG.EMAILJS_SERVICE_ID && CONFIG.EMAILJS_TEMPLATE_ID);
    }

    // Creates a new code and emails it. In demo mode returns the code to show on screen.
    async function sendOtp(email, name, purpose) {

        var code = randomCode(CONFIG.CODE_LENGTH);
        var salt = makeSalt();

        otpState = {
            salt: salt,
            hash: await hashPassword(code, salt),
            expires: Date.now() + CONFIG.EXPIRY_MINUTES * 60000,
            attempts: 0
        };

        if (!emailConfigured()) {
            return { ok: true, demoCode: code };
        }

        try {

            var res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    service_id:  CONFIG.EMAILJS_SERVICE_ID,
                    template_id: CONFIG.EMAILJS_TEMPLATE_ID,
                    user_id:     CONFIG.EMAILJS_PUBLIC_KEY,
                    template_params: {
                        to_email: email,
                        to_name: name || "",
                        otp_code: code,
                        expiry_minutes: CONFIG.EXPIRY_MINUTES,
                        purpose_text: purpose === "register" ? "complete your registration" : "log in to your account",
                        site_name: CONFIG.SITE_NAME
                    }
                })
            });

            if (!res.ok) {
                otpState = null;
                return { ok: false, error: "Could not send the email. Please try again in a moment." };
            }

            return { ok: true };

        } catch (e) {
            otpState = null;
            return { ok: false, error: "Network problem. Check your internet connection and try again." };
        }
    }

    async function checkOtp(input) {

        if (!otpState) return { ok: false, locked: true, error: "No active code. Please request a new one." };

        if (Date.now() > otpState.expires) {
            otpState = null;
            return { ok: false, locked: true, error: "This code has expired. Please request a new one." };
        }

        otpState.attempts++;

        var hash = await hashPassword(String(input || "").trim(), otpState.salt);

        if (hash === otpState.hash) {
            otpState = null;
            return { ok: true };
        }

        if (otpState.attempts >= CONFIG.MAX_ATTEMPTS) {
            otpState = null;
            return { ok: false, locked: true, error: "Too many wrong attempts. Please request a new code." };
        }

        var left = CONFIG.MAX_ATTEMPTS - otpState.attempts;
        return { ok: false, error: "Wrong code. " + left + (left === 1 ? " try" : " tries") + " left." };
    }


    /* ---------- OTP popup (UI) ---------- */

    function injectOtpStyles() {

        if (document.getElementById("otpStyles")) return;

        var css =
            ".otp-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(10,40,25,.55);backdrop-filter:blur(4px)}" +
            ".otp-box{width:100%;max-width:420px;padding:34px 30px;background:#fff;border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.35);text-align:center;font-family:var(--sans,'Inter','Segoe UI',Arial,sans-serif);color:var(--text,#10261b)}" +
            ".otp-icon{width:56px;height:56px;margin:0 auto 16px;border-radius:50%;background:#e1f5ea;color:#178a58;display:flex;align-items:center;justify-content:center;font-size:26px}" +
            ".otp-box h2{font-family:var(--serif,Georgia,serif);font-size:26px;margin-bottom:8px;font-weight:600}" +
            ".otp-sub{color:#4d6a5a;font-size:14px;margin-bottom:18px;line-height:1.5}" +
            ".otp-demo{margin-bottom:16px;padding:10px 12px;border-radius:10px;background:#fdf1d8;color:#a86a0c;font-size:13px;font-weight:600;line-height:1.5}" +
            ".otp-input{width:100%;padding:14px;border-radius:12px;border:1px solid rgba(18,70,45,.25);font-size:28px;font-weight:700;letter-spacing:10px;text-align:center;outline:none;font-family:inherit;color:#10261b;background:#fbfefc}" +
            ".otp-input:focus{border-color:#178a58;box-shadow:0 0 0 3px rgba(34,165,106,.18)}" +
            ".otp-msg{min-height:22px;margin:12px 0;font-size:13px;font-weight:600}" +
            ".otp-msg.err{color:#d64545}.otp-msg.ok{color:#178a58}" +
            ".otp-verify{width:100%;padding:14px;border:none;border-radius:10px;background:linear-gradient(135deg,#22a56a,#178a58);color:#fff;font-weight:600;font-size:15px;cursor:pointer;font-family:inherit}" +
            ".otp-verify:disabled{opacity:.5;cursor:not-allowed}" +
            ".otp-row{display:flex;justify-content:space-between;margin-top:16px}" +
            ".otp-row button{background:none;border:none;color:#178a58;font-weight:600;font-size:13px;cursor:pointer;font-family:inherit}" +
            ".otp-row button:disabled{color:#7b9588;cursor:not-allowed}";

        var st = document.createElement("style");
        st.id = "otpStyles";
        st.textContent = css;
        document.head.appendChild(st);
    }

    // Shows the popup. Resolves true when the code is correct, false if cancelled.
    function openOtp(opts) {

        injectOtpStyles();

        return new Promise(function (resolve) {

            var overlay = document.createElement("div");
            overlay.className = "otp-overlay";

            overlay.innerHTML =
                '<div class="otp-box" role="dialog" aria-modal="true" aria-labelledby="otpTitle">' +
                    '<div class="otp-icon">✉</div>' +
                    '<h2 id="otpTitle">Verify your email</h2>' +
                    '<p class="otp-sub"></p>' +
                    '<div class="otp-demo" hidden></div>' +
                    '<form class="otp-form" novalidate>' +
                        '<input class="otp-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="' + CONFIG.CODE_LENGTH + '" placeholder="------" aria-label="Verification code">' +
                        '<p class="otp-msg" role="alert"></p>' +
                        '<button type="submit" class="otp-verify">Verify</button>' +
                    '</form>' +
                    '<div class="otp-row">' +
                        '<button type="button" class="otp-resend">Resend code</button>' +
                        '<button type="button" class="otp-cancel">Cancel</button>' +
                    '</div>' +
                '</div>';

            document.body.appendChild(overlay);

            var sub    = overlay.querySelector(".otp-sub");
            var demo   = overlay.querySelector(".otp-demo");
            var form   = overlay.querySelector(".otp-form");
            var input  = overlay.querySelector(".otp-input");
            var msg    = overlay.querySelector(".otp-msg");
            var verify = overlay.querySelector(".otp-verify");
            var resend = overlay.querySelector(".otp-resend");
            var cancel = overlay.querySelector(".otp-cancel");

            var timer = null;

            function setMsg(text, ok) {
                msg.textContent = text || "";
                msg.className = "otp-msg " + (text ? (ok ? "ok" : "err") : "");
            }

            function close(result) {
                clearInterval(timer);
                document.removeEventListener("keydown", onKey);
                overlay.remove();
                resolve(result);
            }

            function onKey(e) {
                if (e.key === "Escape") close(false);
            }

            document.addEventListener("keydown", onKey);

            function startCooldown() {

                var left = CONFIG.RESEND_SECONDS;
                clearInterval(timer);
                resend.disabled = true;
                resend.textContent = "Resend code (" + left + "s)";

                timer = setInterval(function () {
                    left--;
                    if (left <= 0) {
                        clearInterval(timer);
                        resend.disabled = false;
                        resend.textContent = "Resend code";
                    } else {
                        resend.textContent = "Resend code (" + left + "s)";
                    }
                }, 1000);
            }

            async function send() {

                verify.disabled = true;
                resend.disabled = true;
                input.value = "";
                demo.hidden = true;
                setMsg("Sending code...", true);

                var r = await sendOtp(opts.email, opts.name, opts.purpose);

                if (!r.ok) {
                    setMsg(r.error, false);
                    resend.disabled = false;
                    resend.textContent = "Try again";
                    return;
                }

                sub.innerHTML = "We sent a " + CONFIG.CODE_LENGTH + "-digit code to <b>" + esc(maskEmail(opts.email)) +
                                "</b>. It expires in " + CONFIG.EXPIRY_MINUTES + " minutes.";

                if (r.demoCode) {
                    demo.hidden = false;
                    demo.textContent = "DEMO MODE: email sending is not set up yet. Your code is " + r.demoCode;
                }

                setMsg("", true);
                verify.disabled = false;
                input.focus();
                startCooldown();
            }

            input.addEventListener("input", function () {
                input.value = input.value.replace(/[^0-9]/g, "");
            });

            form.addEventListener("submit", async function (e) {

                e.preventDefault();

                var code = input.value.trim();

                if (code.length !== CONFIG.CODE_LENGTH) {
                    setMsg("Enter the " + CONFIG.CODE_LENGTH + "-digit code.", false);
                    return;
                }

                verify.disabled = true;

                var r = await checkOtp(code);

                if (r.ok) {
                    close(true);
                    return;
                }

                setMsg(r.error, false);
                input.value = "";

                if (r.locked) {
                    verify.disabled = true;
                    clearInterval(timer);
                    resend.disabled = false;
                    resend.textContent = "Send new code";
                } else {
                    verify.disabled = false;
                    input.focus();
                }
            });

            resend.addEventListener("click", send);
            cancel.addEventListener("click", function () { close(false); });

            send();
        });
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

    function completeLogin(user) {
        localStorage.setItem(SESSION_KEY, lower(user.email));
    }

    function logout() {
        // only ends the session, accounts and deposits stay saved
        localStorage.removeItem(SESSION_KEY);
        root.location.href = "login.html";
    }


    /* ---------- register / login logic ---------- */

    // returns an error text, or "" when the data is fine
    function checkRegistration(d) {

        var firstName = String(d.firstName || "").trim();
        var lastName  = String(d.lastName || "").trim();
        var email     = lower(d.email);
        var phone     = String(d.phone || "").trim();
        var password  = String(d.password || "");
        var referral  = String(d.referral || "").trim().toUpperCase();

        if (!firstName || !lastName) return "Please enter your first and last name.";
        if (!EMAIL_RE.test(email))   return "Please enter a valid email address.";
        if (phone.replace(/[^0-9]/g, "").length < 10) return "Please enter a valid phone number.";
        if (password.length < 6)     return "Password must be at least 6 characters.";

        if (findByEmail(email)) return "This email is already registered. Please login.";

        if (referral && root.IPRef) {
            var referrer = root.IPRef.resolveCode(referral);
            if (!referrer) return "Referral code not found. Check the code or leave it empty.";
            if (referrer === email) return "You cannot use your own referral code.";
        }

        return "";
    }

    // saves the account (call this only AFTER the email code is verified)
    async function registerUser(d) {

        var error = checkRegistration(d);
        if (error) return { ok: false, error: error };

        var firstName = String(d.firstName).trim();
        var lastName  = String(d.lastName).trim();
        var email     = lower(d.email);
        var referral  = String(d.referral || "").trim().toUpperCase();
        var salt      = makeSalt();

        var user = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            firstName: firstName,
            lastName: lastName,
            name: firstName + " " + lastName,
            email: email,
            phone: String(d.phone).trim(),
            referral: referral,
            emailVerified: true,
            salt: salt,
            passwordHash: await hashPassword(String(d.password), salt),
            createdAt: new Date().toISOString()
        };

        var list = getUsers();
        list.push(user);
        saveUsers(list);

        if (root.IPRef) root.IPRef.rememberReferral(email, referral, user.name);

        return { ok: true, user: user };
    }

    // checks email/phone + password only (no session yet, OTP comes next)
    async function verifyCredentials(id, password) {

        var u = findByLogin(id);

        if (!u) return { ok: false, error: "Wrong email or password." };

        var hash = await hashPassword(String(password || ""), u.salt || "");

        if (hash !== u.passwordHash) return { ok: false, error: "Wrong email or password." };

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

                var data = {
                    firstName: document.getElementById("firstName").value,
                    lastName:  document.getElementById("lastName").value,
                    email:     document.getElementById("email").value,
                    phone:     document.getElementById("phone").value,
                    password:  document.getElementById("password").value,
                    referral:  document.getElementById("referral").value
                };

                var error = checkRegistration(data);

                if (error) {
                    showMsg(regForm, error, false);
                    btn.disabled = false;
                    return;
                }

                showMsg(regForm, "Please verify your email to continue.", true);

                // STEP 1: email OTP
                var verified = await openOtp({ email: lower(data.email), name: data.firstName, purpose: "register" });

                if (!verified) {
                    showMsg(regForm, "Email verification was cancelled. Your account was not created.", false);
                    btn.disabled = false;
                    return;
                }

                // STEP 2: create the account
                var res = await registerUser(data);

                if (!res.ok) {
                    showMsg(regForm, res.error, false);
                    btn.disabled = false;
                    return;
                }

                showMsg(regForm, "Email verified. Account created successfully. Redirecting to login...", true);

                setTimeout(function () { root.location.href = "login.html"; }, 1200);
            });
        }

        var loginForm = document.getElementById("loginForm");

        if (loginForm) {
            loginForm.addEventListener("submit", async function (e) {

                e.preventDefault();

                var btn = loginForm.querySelector("button[type=submit]");
                btn.disabled = true;

                // STEP 1: email + password
                var res = await verifyCredentials(
                    document.getElementById("loginEmail").value,
                    document.getElementById("loginPassword").value
                );

                if (!res.ok) {
                    showMsg(loginForm, res.error, false);
                    btn.disabled = false;
                    return;
                }

                showMsg(loginForm, "Password correct. Enter the code sent to your email.", true);

                // STEP 2: email OTP (required on every login)
                var verified = await openOtp({ email: res.user.email, name: res.user.firstName, purpose: "login" });

                if (!verified) {
                    showMsg(loginForm, "Verification cancelled. You are not logged in.", false);
                    btn.disabled = false;
                    return;
                }

                completeLogin(res.user);
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
        CONFIG: CONFIG,
        checkRegistration: checkRegistration,
        registerUser: registerUser,
        verifyCredentials: verifyCredentials,
        completeLogin: completeLogin,
        sendOtp: sendOtp,
        checkOtp: checkOtp,
        getCurrentUser: getCurrentUser,
        getUsers: getUsers,
        logout: logout
    };

    init();

})();
