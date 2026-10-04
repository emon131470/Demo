<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>InvestPro - Smart Investment Platform</title>

    <link rel="stylesheet" href="style.css">
</head>

<body>

<!-- ================= HEADER ================= -->
<header class="header">

    <div class="logo">
        <span>INVEST</span>PRO
    </div>

    <!-- CENTER MENU -->
    <nav class="navbar">
        <a href="index.php" class="active">Home</a>
        <a href="#plans">Investment</a>
        <a href="#about">About</a>
        <a href="#how">How It Works</a>
        <a href="#faq">FAQ</a>
    </nav>

    <!-- RIGHT BUTTONS -->
    <div class="auth-buttons">
        <a href="register.php" class="register-btn">Register</a>
        <a href="login.php" class="login-btn">Login</a>
    </div>

    <!-- MOBILE MENU -->
    <div class="menu-toggle" onclick="toggleMenu()">
        ☰
    </div>

</header>


<!-- ================= HERO SECTION ================= -->
<section class="hero">

    <div class="hero-content">

        <div class="small-title">
            SMART INVESTMENT • BRIGHTER FUTURE
        </div>

        <h1>
            Invest Today.<br>
            <span>Build a Brighter Tomorrow.</span>
        </h1>

        <p>
            Discover smart investment opportunities designed to help
            you take control of your financial future and grow your
            wealth with confidence.
        </p>

        <div class="hero-buttons">

            <a href="register.php" class="primary-btn">
                Start Investing
                <span>→</span>
            </a>

            <a href="#how" class="secondary-btn">
                Learn More
            </a>

        </div>

        <div class="trust-box">

            <div>
                <strong>✓</strong>
                Transparent
            </div>

            <div>
                <strong>✓</strong>
                Easy to Manage
            </div>

            <div>
                <strong>✓</strong>
                Flexible Plans
            </div>

        </div>

    </div>


    <!-- HERO RIGHT SIDE -->
    <div class="hero-graphic">

        <div class="glow"></div>

        <div class="coin coin-one">$</div>
        <div class="coin coin-two">$</div>
        <div class="coin coin-three">$</div>

        <div class="investment-card">

            <div class="card-top">
                <span>Investment Growth</span>
                <span>↗</span>
            </div>

            <div class="chart">

                <div class="line"></div>

                <div class="point point1"></div>
                <div class="point point2"></div>
                <div class="point point3"></div>
                <div class="point point4"></div>
                <div class="point point5"></div>

            </div>

            <div class="card-bottom">
                <div>
                    <small>Portfolio</small>
                    <strong>$24,850</strong>
                </div>

                <div class="growth">
                    +18.42%
                </div>
            </div>

        </div>

    </div>

</section>


<!-- ================= FEATURES ================= -->
<section class="features" id="about">

    <div class="section-heading">

        <span>WHY CHOOSE US</span>

        <h2>
            A Smarter Way To Plan Your Future
        </h2>

        <p>
            Manage your investments through a simple and transparent
            platform built with your financial goals in mind.
        </p>

    </div>


    <div class="feature-container">

        <div class="feature-card">

            <div class="feature-icon">
                ◈
            </div>

            <h3>Flexible Plans</h3>

            <p>
                Choose an investment option that fits your goals
                and financial strategy.
            </p>

        </div>


        <div class="feature-card">

            <div class="feature-icon">
                ↗
            </div>

            <h3>Track Your Growth</h3>

            <p>
                Easily monitor your investments, transactions
                and account activity from your dashboard.
            </p>

        </div>


        <div class="feature-card">

            <div class="feature-icon">
                🔒
            </div>

            <h3>Secure Platform</h3>

            <p>
                Your account information and investment activity
                are organized in one secure platform.
            </p>

        </div>

    </div>

</section>


<!-- ================= CTA ================= -->
<section class="cta">

    <div>

        <span>START YOUR JOURNEY</span>

        <h2>
            Your Financial Future Starts With A Smart Decision.
        </h2>

        <p>
            Create your account and explore the investment options
            available to you.
        </p>

        <a href="register.php" class="primary-btn">
            Create Account →
        </a>

    </div>

</section>


<!-- ================= FOOTER ================= -->
<footer>

    <div class="footer-logo">
        <span>INVEST</span>PRO
    </div>

    <p>
        © 2026 InvestPro. All rights reserved.
    </p>

</footer>


<script>

function toggleMenu() {

    const navbar = document.querySelector(".navbar");

    navbar.classList.toggle("show");

}

</script>

</body>
</html>
