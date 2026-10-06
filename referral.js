/* =====================================================
   INVESTPRO REFERRAL SYSTEM
   - every user gets a unique referral code (made from their email)
   - when a referred user buys a plan and the admin approves it,
     the referrer earns a commission % based on that plan
   ===================================================== */

var IPRef = (function () {

    "use strict";

    /* ---------- SETTINGS: CHANGE THESE ---------- */

    // Referral commission (% of the deposit amount) for each plan
    var REF_RATES = {
        Starter: 5,
        Silver:  6,
        Gold:    8,
        Diamond: 10
    };

    /* -------------------------------------------- */

    var REFS_KEY = "investpro_refs";
    var DEP_KEY  = "investpro_deposits";
    var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

    function lower(s) { return String(s == null ? "" : s).trim().toLowerCase(); }

    function read(key, store) {
        try { return JSON.parse((store || localStorage).getItem(key)); } catch (e) { return null; }
    }

    function nameOf(u) {
        return u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || u.email || "";
    }

    /* ----- unique code from email ----- */
    function codeFor(email) {

        var s = lower(email);
        if (!s) return "";

        var h1 = 2166136261, h2 = 5381;

        for (var i = 0; i < s.length; i++) {
            var c = s.charCodeAt(i);
            h1 ^= c;
            h1 = Math.imul(h1, 16777619);
            h2 = (Math.imul(h2, 33) ^ c);
        }

        var n = (h1 >>> 0) * 65536 + ((h2 >>> 0) & 65535);
        var t = n.toString(36).toUpperCase();
        while (t.length < 6) t = "0" + t;

        return "IP" + t.slice(-6);
    }

    /* ----- stored data ----- */
    function allRefs() {
        var r = read(REFS_KEY);
        return (r && typeof r === "object" && !Array.isArray(r)) ? r : {};
    }

    function saveRefs(r) {
        try { localStorage.setItem(REFS_KEY, JSON.stringify(r)); } catch (e) {}
    }

    // Registered user records saved by the website (arrays or objects of users)
    function userRecords() {

        var out = [];

        for (var i = 0; i < localStorage.length; i++) {

            var key = localStorage.key(i);
            if (key === DEP_KEY || key === REFS_KEY) continue;

            var val = read(key);
            var items = null;

            if (Array.isArray(val)) {
                items = val;
            } else if (val && typeof val === "object") {
                var vals = Object.keys(val).map(function (k) { return val[k]; });
                if (vals.length && vals.every(function (x) { return x && typeof x === "object"; })) items = vals;
            }

            if (!items) continue;

            items.forEach(function (u) {
                if (u && typeof u === "object" && u.email) out.push(u);
            });
        }

        return out;
    }

    function findUser(email) {
        var e = lower(email);
        var list = userRecords();
        for (var i = 0; i < list.length; i++) {
            if (lower(list[i].email) === e) return list[i];
        }
        return null;
    }

    function knownEmails() {

        var seen = {}, list = [];

        function add(e) {
            e = lower(e);
            if (EMAIL_RE.test(e) && !seen[e]) { seen[e] = 1; list.push(e); }
        }

        userRecords().forEach(function (u) { add(u.email); });
        Object.keys(allRefs()).forEach(add);

        (read(DEP_KEY) || []).forEach(function (d) { add(d.user); add(d.refBy); });

        var me = currentUser();
        if (me) add(me.email);

        return list;
    }

    /* ----- code -> email ----- */
    function resolveCode(code) {

        var c = String(code || "").trim().toUpperCase();
        if (!c) return "";

        var emails = knownEmails();

        for (var i = 0; i < emails.length; i++) {
            if (codeFor(emails[i]) === c) return emails[i];
        }

        return "";
    }

    /* ----- which code did this user sign up with? ----- */
    function usedCodeOf(email) {

        var r = allRefs()[lower(email)];
        if (r && r.code) return String(r.code).toUpperCase();

        var u = findUser(email);
        if (u) {
            var c = u.referral || u.referralCode || u.refCode || u.ref || "";
            if (c) return String(c).trim().toUpperCase();
        }

        return "";
    }

    function referrerOf(email) {

        var e = lower(email);
        if (!e) return "";

        var ref = resolveCode(usedCodeOf(e));

        return (ref && ref !== e) ? ref : "";
    }

    /* ----- called when someone registers ----- */
    function rememberReferral(email, code, name) {

        var e = lower(email);
        if (!EMAIL_RE.test(e)) return;

        var refs = allRefs();
        if (refs[e]) return;

        refs[e] = {
            code: String(code || "").trim().toUpperCase(),
            name: name || "",
            date: new Date().toISOString()
        };

        saveRefs(refs);
    }

    /* ----- who is logged in right now? ----- */
    function currentUser() {

        // the website's own login session (set by app.js)
        var sess = localStorage.getItem("investpro_session");

        if (sess) {
            var su = findUser(sess);
            if (su) return { email: lower(su.email), name: nameOf(su) };
        }

        var best = null, bestScore = -1;

        [localStorage, sessionStorage].forEach(function (store) {

            for (var i = 0; i < store.length; i++) {

                var key = store.key(i);
                if (/^investpro_/i.test(key)) continue;

                var raw = store.getItem(key), v = null;
                try { v = JSON.parse(raw); } catch (e) { v = raw; }

                var u = null;

                if (v && typeof v === "object" && !Array.isArray(v) && typeof v.email === "string" && EMAIL_RE.test(v.email)) {
                    u = v;
                } else if (typeof v === "string" && EMAIL_RE.test(v) && /current|logged|session|auth|user/i.test(key)) {
                    u = { email: v };
                }

                if (!u) continue;

                var score = /current|logged|session|auth/i.test(key) ? 2 : (/user/i.test(key) ? 1 : 0);

                if (score > bestScore) { best = u; bestScore = score; }
            }
        });

        if (!best) return null;

        var rec = findUser(best.email) || best;

        return { email: lower(best.email), name: nameOf(rec) || nameOf(best) };
    }

    function nameFor(email) {
        var r = allRefs()[lower(email)];
        if (r && r.name) return r.name;
        var u = findUser(email);
        return u ? nameOf(u) : "";
    }

    function rate(plan) {
        return REF_RATES[plan] || 0;
    }

    return {
        REF_RATES: REF_RATES,
        lower: lower,
        codeFor: codeFor,
        allRefs: allRefs,
        knownEmails: knownEmails,
        resolveCode: resolveCode,
        usedCodeOf: usedCodeOf,
        referrerOf: referrerOf,
        rememberReferral: rememberReferral,
        currentUser: currentUser,
        nameFor: nameFor,
        findUser: findUser,
        rate: rate
    };

})();
