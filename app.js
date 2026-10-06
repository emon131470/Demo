/* =====================================================
   INVESTPRO (DEMO / SIMULATION) - app.js
   - connects the website to Supabase (the backend)
   - email OTP login + register
   - demo banner on every page
   - login protection for dashboard pages

   >>> PUT YOUR 2 SUPABASE VALUES BELOW <<<
   Supabase > Project Settings > API
   ===================================================== */

(function () {

    "use strict";

    var root = window;

    var SUPABASE_URL      = "PASTE_YOUR_SUPABASE_PROJECT_URL_HERE";   // https://xxxx.supabase.co
    var SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_ANON_PUBLIC_KEY_HERE";

    var CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

    var RESEND_SECONDS = 60;     // Supabase allows one email per minute per address
    var CODE_LENGTH    = 6;

    var configured = /^https?:\/\//.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 40;
    var needLogin  = document.body.classList.contains("dashboard-page");


    /* ---------- small helpers ---------- */

    function $(id) { return document.getElementById(id); }

    function esc(s) {
        return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
                                         .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function lower(s) { return String(s == null ? "" : s).trim().toLowerCase(); }

    function maskEmail(e) {
        var p = String(e || "").split("@");
        return p.length === 2 ? p[0].slice(0, 2) + "***@" + p[1] : (e || "");
    }

    function friendly(err) {

        var m = (err && err.message) || "Something went wrong. Please try again.";

        if (/signups? not allowed|user not found|not found/i.test(m)) return "No account found with this email. Please register first.";
        if (/rate limit|security purposes|too many|only request this after/i.test(m)) return "Too many requests. Please wait a minute and try again.";
        if (/expired|invalid/i.test(m)) return "That code is wrong or has expired.";
        if (/failed to fetch|network/i.test(m)) return "Network problem. Check your internet connection.";

        return m;
    }

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement("script");
            s.src = src;
            s.onload = resolve;
            s.onerror = function () { reject(new Error("Could not load the Supabase library.")); };
            document.head.appendChild(s);
        });
    }


    /* ---------- styles for banner + OTP popup ---------- */

    function injectStyles() {

        var css =
            ".demo-banner{background:#fdf1d8;color:#8a5a0a;text-align:center;padding:8px 14px;font:600 12px/1.4 'Inter','Segoe UI',Arial,sans-serif;letter-spacing:.3px;border-bottom:1px solid rgba(168,106,12,.25)}" +
            ".setup-banner{background:#fde8e8;color:#b02a2a;text-align:center;padding:12px 14px;font:600 13px/1.5 'Inter','Segoe UI',Arial,sans-serif;border-bottom:1px solid rgba(214,69,69,.3)}" +

            ".otp-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(10,40,25,.55);backdrop-filter:blur(4px)}" +
            ".otp-box{width:100%;max-width:420px;padding:34px 30px;background:#fff;border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.35);text-align:center;font-family:var(--sans,'Inter','Segoe UI',Arial,sans-serif);color:var(--text,#10261b)}" +
            ".otp-icon{width:56px;height:56px;margin:0 auto 16px;border-radius:50%;background:#e1f5ea;color:#178a58;display:flex;align-items:center;justify-content:center;font-size:26px}" +
            ".otp-box h2{font-family:var(--serif,Georgia,serif);font-size:26px;margin-bottom:8px;font-weight:600}" +
            ".otp-sub{color:#4d6a5a;font-size:14px;margin-bottom:18px;line-height:1.5}" +
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
        st.textContent = css;
        document.head.appendChild(st);
    }

    function addBanner(text, cls) {
        var b = document.createElement("div");
        b.className = cls;
        b.textContent = text;
        document.body.insertBefore(b, document.body.firstChild);
    }

    function reveal() {
        document.documentElement.style.visibility = "";
    }


    /* ---------- OTP popup ---------- */

    // opts: { email, send: () => Promise<{ok,error}>, verify: (code) => Promise<{ok,error}> }
    // Returns true when the code is correct, false if the user cancels.
    function showOtpModal(opts) {

        return new Promise(function (resolve) {

            var overlay = document.createElement("div");
            overlay.className = "otp-overlay";

            overlay.innerHTML =
                '<div class="otp-box" role="dialog" aria-modal="true" aria-labelledby="otpTitle">' +
                    '<div class="otp-icon">✉</div>' +
                    '<h2 id="otpTitle">Verify your email</h2>' +
                    '<p class="otp-sub">We sent a code to <b>' + esc(maskEmail(opts.email)) + '</b>. Enter it below. Check your spam folder too.</p>' +
                    '<form class="otp-form" novalidate>' +
                        '<input class="otp-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="------" aria-label="Verification code">' +
                        '<p class="otp-msg" role="alert"></p>' +
                        '<button type="submit" class="otp-verify">Verify</button>' +
                    '</form>' +
                    '<div class="otp-row">' +
                        '<button type="button" class="otp-resend">Resend code</button>' +
                        '<button type="button" class="otp-cancel">Cancel</button>' +
                    '</div>' +
                '</div>';

            document.body.appendChild(overlay);

            var form   = overlay.querySelector(".otp-form");
            var input  = overlay.querySelector(".otp-input");
            var msg    = overlay.querySelector(".otp-msg");
            var verify = overlay.querySelector(".otp-verify");
            var resend = overlay.querySelector(".otp-resend");
            var cancel = overlay.querySelector(".otp-cancel");
            var timer  = null;

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

            function onKey(e) { if (e.key === "Escape") close(false); }
            document.addEventListener("keydown", onKey);

            function cooldown() {

                var left = RESEND_SECONDS;
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

            input.addEventListener("input", function () {
                input.value = input.value.replace(/[^0-9]/g, "");
            });

            form.addEventListener("submit", async function (e) {

                e.preventDefault();

                var code = input.value.trim();

                if (code.length < CODE_LENGTH) {
                    setMsg("Enter the " + CODE_LENGTH + "-digit code from your email.", false);
                    return;
                }

                verify.disabled = true;
                setMsg("Checking...", true);

                var r = await opts.verify(code);

                if (r.ok) {
                    close(true);
                    return;
                }

                setMsg(r.error, false);
                input.value = "";
                verify.disabled = false;
                input.focus();
            });

            resend.addEventListener("click", async function () {

                resend.disabled = true;
                setMsg("Sending a new code...", true);

                var r = await opts.send();

                if (!r.ok) {
                    setMsg(r.error, false);
                    resend.disabled = false;
                    return;
                }

                setMsg("A new code was sent.", true);
                cooldown();
            });

            cancel.addEventListener("click", function () { close(false); });

            cooldown();
            input.focus();
        });
    }


    /* ---------- Supabase client ---------- */

    var sb = null;

    async function getClient() {

        if (!configured) throw new Error("Supabase is not set up yet.");

        await loadScript(CDN);

        sb = root.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
        });

        root.sb = sb;
        return sb;
    }


    /* ---------- auth flows (used by register, login and admin pages) ---------- */

    // Sends the email code, then opens the popup. Returns {ok, error?, cancelled?}
    async function otpFlow(email, createUser, meta) {

        async function send() {
            var r = await sb.auth.signInWithOtp({
                email: email,
                options: createUser ? { shouldCreateUser: true, data: meta } : { shouldCreateUser: false }
            });
            return r.error ? { ok: false, error: friendly(r.error) } : { ok: true };
        }

        var first = await send();
        if (!first.ok) return first;

        var verified = await showOtpModal({
            email: email,
            send: send,
            verify: async function (code) {
                var r = await sb.auth.verifyOtp({ email: email, token: code, type: "email" });
                return r.error ? { ok: false, error: friendly(r.error) } : { ok: true };
            }
        });

        return verified ? { ok: true } : { ok: false, cancelled: true, error: "Verification cancelled." };
    }

    async function register(d) {

        var firstName = String(d.firstName || "").trim();
        var lastName  = String(d.lastName || "").trim();
        var email     = lower(d.email);
        var phone     = String(d.phone || "").trim();
        var referral  = String(d.referral || "").trim().toUpperCase();

        if (!firstName || !lastName) return { ok: false, error: "Please enter your first and last name." };
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Please enter a valid email address." };
        if (phone.replace(/[^0-9]/g, "").length < 10) return { ok: false, error: "Please enter a valid phone number." };

        if (referral) {
            var chk = await sb.rpc("referral_code_exists", { p_code: referral });
            if (chk.error || !chk.data) return { ok: false, error: "Referral code not found. Check the code or leave it empty." };
        }

        return otpFlow(email, true, { first_name: firstName, last_name: lastName, phone: phone, referral_code: referral });
    }

    async function login(emailInput) {

        var email = lower(emailInput);

        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Please enter a valid email address." };

        return otpFlow(email, false, null);
    }

    async function logout() {
        try { if (sb) await sb.auth.signOut(); } catch (e) {}
        window.location.href = "login.html";
    }

    function showMsg(form, text, ok) {

        var box = form.querySelector(".app-msg");

        if (!box) {
            box = document.createElement("p");
            box.className = "app-msg";
            form.insertBefore(box, form.querySelector("button[type=submit]"));
        }

        box.className = "app-msg " + (ok ? "form-ok" : "form-error");
        box.textContent = text;
    }

    function bindForms() {

        var regForm = $("registerForm");

        if (regForm) {
            regForm.addEventListener("submit", async function (e) {

                e.preventDefault();

                var btn = regForm.querySelector("button[type=submit]");
                btn.disabled = true;

                try { await root.IPReady; } catch (err) {
                    showMsg(regForm, "Backend is not connected yet. Check app.js settings.", false);
                    btn.disabled = false;
                    return;
                }

                showMsg(regForm, "Sending your verification code...", true);

                var res = await register({
                    firstName: $("firstName").value,
                    lastName:  $("lastName").value,
                    email:     $("email").value,
                    phone:     $("phone").value,
                    referral:  $("referral").value
                });

                if (!res.ok) {
                    showMsg(regForm, res.error, false);
                    btn.disabled = false;
                    return;
                }

                showMsg(regForm, "Email verified. Your account is ready. Opening your dashboard...", true);
                setTimeout(function () { window.location.href = "dashboard.html"; }, 900);
            });
        }

        var loginForm = $("loginForm");

        if (loginForm) {
            loginForm.addEventListener("submit", async function (e) {

                e.preventDefault();

                var btn = loginForm.querySelector("button[type=submit]");
                btn.disabled = true;

                try { await root.IPReady; } catch (err) {
                    showMsg(loginForm, "Backend is not connected yet. Check app.js settings.", false);
                    btn.disabled = false;
                    return;
                }

                showMsg(loginForm, "Sending your login code...", true);

                var res = await login($("loginEmail").value);

                if (!res.ok) {
                    showMsg(loginForm, res.error, false);
                    btn.disabled = false;
                    return;
                }

                window.location.href = "dashboard.html";
            });
        }
    }


    /* ---------- start ---------- */

    injectStyles();

    addBanner("DEMO / SIMULATION: all balances are virtual. No real money is accepted or paid.", "demo-banner");

    if (needLogin) document.documentElement.style.visibility = "hidden";

    bindForms();

    root.logout = logout;
    root.IPAuth = { register: register, login: login, logout: logout, showOtpModal: showOtpModal };

    // Pages wait for this:  IPReady.then(function (ctx) { ctx.sb, ctx.session, ctx.profile })
    root.IPReady = (async function () {

        try {
            await getClient();
        } catch (e) {
            addBanner("Backend not connected: open app.js and paste your Supabase URL and anon key at the top.", "setup-banner");
            reveal();
            throw e;
        }

        var sess = (await sb.auth.getSession()).data.session;
        var profile = null;

        if (sess) {
            var p = await sb.from("profiles").select("*").eq("id", sess.user.id).maybeSingle();
            profile = p.data || null;
        }

        if (needLogin && !sess) {
            window.location.replace("login.html");
            return new Promise(function () {});   // never continues on this page
        }

        if (sess) {

            var fullName = profile ? (profile.first_name + " " + profile.last_name).trim() : sess.user.email;

            if ($("welcomeUser")) $("welcomeUser").textContent = "Hi, " + fullName;
            if ($("planUser"))    $("planUser").textContent = fullName;

            // Home page: show a Dashboard button instead of Register / Login
            var nav = document.querySelector(".nav-buttons");
            if (nav) nav.innerHTML = '<a href="dashboard.html" class="btn btn-primary">Dashboard</a>';
        }

        reveal();

        return { sb: sb, session: sess, profile: profile };

    })();

    root.IPReady.catch(function () {});

})();
