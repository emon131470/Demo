/* ================= REGISTER ================= */

const registerForm =
    document.getElementById("registerForm");

if (registerForm) {

    registerForm.addEventListener(
        "submit",
        function (e) {

            e.preventDefault();

            const firstName =
                document.getElementById("firstName").value.trim();

            const lastName =
                document.getElementById("lastName").value.trim();

            const email =
                document.getElementById("email").value.trim();

            const phone =
                document.getElementById("phone").value.trim();

            const password =
                document.getElementById("password").value;

            const referral =
                document.getElementById("referral").value.trim();


            const user = {

                firstName: firstName,

                lastName: lastName,

                email: email,

                phone: phone,

                password: password,

                referral: referral

            };


            localStorage.setItem(
                "investproUser",
                JSON.stringify(user)
            );


            alert(
                "Registration successful! Please login."
            );


            window.location.href =
                "login.html";

        }
    );

}


/* ================= LOGIN ================= */

const loginForm =
    document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        function (e) {

            e.preventDefault();


            const email =
                document.getElementById("loginEmail").value.trim();

            const password =
                document.getElementById("loginPassword").value;


            const savedUser =
                JSON.parse(
                    localStorage.getItem("investproUser")
                );


            if (!savedUser) {

                alert(
                    "No account found. Please register first."
                );

                return;
            }


            if (
                email !== savedUser.email ||
                password !== savedUser.password
            ) {

                alert(
                    "Invalid email or password."
                );

                return;
            }


            localStorage.setItem(
                "investproLoggedIn",
                "true"
            );


            window.location.href =
                "dashboard.html";

        }
    );

}


/* ================= LOGIN PROTECTION ================= */

function checkLogin() {

    const loggedIn =
        localStorage.getItem(
            "investproLoggedIn"
        );

    if (loggedIn !== "true") {

        window.location.href =
            "login.html";

    }

}


/* ================= DASHBOARD ================= */

if (
    window.location.pathname.endsWith(
        "dashboard.html"
    )
) {

    checkLogin();

    const user =
        JSON.parse(
            localStorage.getItem("investproUser")
        );


    if (user) {

        const welcome =
            document.getElementById(
                "welcomeUser"
            );

        if (welcome) {

            welcome.textContent =
                "Hi, " + user.firstName;

        }

    }

}


/* ================= INVESTMENT PAGE ================= */

if (
    window.location.pathname.endsWith(
        "investment.html"
    )
) {

    checkLogin();

    const user =
        JSON.parse(
            localStorage.getItem("investproUser")
        );


    if (user) {

        const planUser =
            document.getElementById(
                "planUser"
            );

        if (planUser) {

            planUser.textContent =
                user.firstName;

        }

    }

}


/* ================= SELECT PLAN ================= */

function selectPlan(planName) {

    const loggedIn =
        localStorage.getItem(
            "investproLoggedIn"
        );


    if (loggedIn !== "true") {

        window.location.href =
            "login.html";

        return;

    }


    localStorage.setItem(
        "selectedPlan",
        planName
    );


    alert(
        planName +
        " plan selected. The next step will be the investment/deposit process."
    );

}


/* ================= LOGOUT ================= */

function logout() {

    localStorage.removeItem(
        "investproLoggedIn"
    );

    localStorage.removeItem(
        "selectedPlan"
    );


    window.location.href =
        "index.html";

}
