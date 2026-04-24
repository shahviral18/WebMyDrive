<?php
/**
 * Environment Configuration
 * All environment variables are read here from $_ENV / getenv().
 * Copy `.env.example` to `.env` and fill in real values.
 *
 * In production, set these as real server environment variables.
 */

// Load .env file if it exists (simple key=value parser — no external library needed)
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue; // skip comments
        if (!str_contains($line, '=')) continue;
        [$key, $val] = explode('=', $line, 2);
        $key = trim($key);
        $val = trim($val);
        // Remove surrounding quotes if present
        if (strlen($val) >= 2 && in_array($val[0], ['"', "'"], true) && $val[0] === $val[-1]) {
            $val = substr($val, 1, -1);
        }
        if (!array_key_exists($key, $_ENV)) {
            $_ENV[$key]  = $val;
            putenv("$key=$val");
        }
    }
}

/**
 * Helper to read an env variable with a default fallback.
 */
function env(string $key, mixed $default = null): mixed
{
    $val = $_ENV[$key] ?? getenv($key);
    return ($val !== false && $val !== null && $val !== '') ? $val : $default;
}

// ── Application ───────────────────────────────────────────────────────────────
define('APP_ENV',            env('NODE_ENV', 'development'));    // 'production' | 'development'
define('APP_PORT',           (int) env('PORT', 4000));
define('ALLOWED_ORIGINS',    env('ALLOWED_ORIGINS', ''));        // comma-separated list

// ── Database (MySQL) ─────────────────────────────────────────────────────────
define('DB_HOST',     env('DB_HOST', 'localhost'));
define('DB_NAME',     env('DB_NAME', ''));
define('DB_USER',     env('DB_USER', ''));
define('DB_PASS',     env('DB_PASS', ''));
define('DB_CHARSET',  env('DB_CHARSET', 'utf8mb4'));

// ── JWT ───────────────────────────────────────────────────────────────────────
define('JWT_SECRET',         env('JWT_SECRET', 'default_secret'));
define('JWT_EXPIRY',         (int) env('JWT_EXPIRY', 86400 * 7)); // 7 days in seconds

// ── Google OAuth ──────────────────────────────────────────────────────────────
define('GOOGLE_CLIENT_ID',   env('GOOGLE_CLIENT_ID', ''));

// ── Razorpay ──────────────────────────────────────────────────────────────────
define('RAZORPAY_KEY_ID',    env('RAZORPAY_KEY_ID', ''));
define('RAZORPAY_KEY_SECRET',env('RAZORPAY_KEY_SECRET', ''));

// ── Zoho Payments ─────────────────────────────────────────────────────────────
define('ZOHO_PAYMENTS_API_KEY',        env('ZOHO_PAYMENTS_API_KEY',        '1003.2d44007cbc28ce3285119f4ac758d854.702587377c1ecdb22019c757d7c668f0'));
define('ZOHO_PAYMENTS_ACCOUNT_ID',     env('ZOHO_PAYMENTS_ACCOUNT_ID',     '60035396803'));
define('ZOHO_PAYMENTS_SIGNING_KEY',    env('ZOHO_PAYMENTS_SIGNING_KEY',    'c6661699ecc6d8671b58c6c6ac5ebedf3c76ba3d3b53e050715a85d550a6cda86ac4e27d9527a04796eea9e7c4d7e1ebccb7a972e98ff7c6e421810fe4bb15d960ce747724e979588d9745e20d658331'));
define('ZOHO_PAYMENTS_WEBHOOK_SECRET', env('ZOHO_PAYMENTS_WEBHOOK_SECRET', ''));
// OAuth for server-side Payment Sessions API
define('ZOHO_OAUTH_CLIENT_ID',     env('ZOHO_OAUTH_CLIENT_ID',     '1000.0XGGBEHRRV8OEQL6XOCX6GGQZFL1PW'));
define('ZOHO_OAUTH_CLIENT_SECRET', env('ZOHO_OAUTH_CLIENT_SECRET', '5272e02f141e6f13d180e266ac4081216a47cdacc6'));
define('ZOHO_OAUTH_REFRESH_TOKEN', env('ZOHO_OAUTH_REFRESH_TOKEN', '1000.9ae9c9d4de88f98eb60fb2aa547cc453.8aa99cec1697326ed481c60a856dbfaa'));

// ── Zoho Books ────────────────────────────────────────────────────────────────
define('ZOHO_BOOKS_ORG_ID',        env('ZOHO_BOOKS_ORG_ID',        '60034597554'));
define('ZOHO_BOOKS_CLIENT_ID',     env('ZOHO_BOOKS_CLIENT_ID',     '1000.0XGGBEHRRV8OEQL6XOCX6GGQZFL1PW'));
define('ZOHO_BOOKS_CLIENT_SECRET', env('ZOHO_BOOKS_CLIENT_SECRET', '5272e02f141e6f13d180e266ac4081216a47cdacc6'));
define('ZOHO_BOOKS_REFRESH_TOKEN', env('ZOHO_BOOKS_REFRESH_TOKEN', '1000.961decb2db051bb99b629e3eb57edcca.a5fa83fcbc42129d9769d82a83686b5f'));
define('ZOHO_BOOKS_INVOICE_PREFIX',env('ZOHO_BOOKS_INVOICE_PREFIX','WMD'));  // configurable prefix

// ── Site URLs ─────────────────────────────────────────────────────────────────
define('SITE_URL',           env('SITE_URL', 'https://webmydrive.com'));

// ── Logging ───────────────────────────────────────────────────────────────────
define('LOG_DIR',            env('LOG_DIR', __DIR__ . '/../logs'));
