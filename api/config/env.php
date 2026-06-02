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
define('JWT_SECRET',         env('JWT_SECRET', ''));
define('JWT_EXPIRY',         (int) env('JWT_EXPIRY', 86400 * 7)); // 7 days in seconds

// ── Google OAuth ──────────────────────────────────────────────────────────────
define('GOOGLE_CLIENT_ID',   env('GOOGLE_CLIENT_ID', ''));

// ── Zoho Payments ─────────────────────────────────────────────────────────────
// All secrets MUST be set in the server .env file — no defaults here.
define('ZOHO_PAYMENTS_API_KEY',        env('ZOHO_PAYMENTS_API_KEY',        ''));
define('ZOHO_PAYMENTS_ACCOUNT_ID',     env('ZOHO_PAYMENTS_ACCOUNT_ID',     ''));
define('ZOHO_PAYMENTS_SIGNING_KEY',    env('ZOHO_PAYMENTS_SIGNING_KEY',    ''));
define('ZOHO_PAYMENTS_WEBHOOK_SECRET', env('ZOHO_PAYMENTS_WEBHOOK_SECRET', ''));
// OAuth for server-side Payment Sessions API
define('ZOHO_OAUTH_CLIENT_ID',     env('ZOHO_OAUTH_CLIENT_ID',     ''));
define('ZOHO_OAUTH_CLIENT_SECRET', env('ZOHO_OAUTH_CLIENT_SECRET', ''));
define('ZOHO_OAUTH_REFRESH_TOKEN', env('ZOHO_OAUTH_REFRESH_TOKEN', ''));

// ── Zoho Books ────────────────────────────────────────────────────────────────
define('ZOHO_BOOKS_ORG_ID',        env('ZOHO_BOOKS_ORG_ID',        ''));
define('ZOHO_BOOKS_CLIENT_ID',     env('ZOHO_BOOKS_CLIENT_ID',     ''));
define('ZOHO_BOOKS_CLIENT_SECRET', env('ZOHO_BOOKS_CLIENT_SECRET', ''));
define('ZOHO_BOOKS_REFRESH_TOKEN', env('ZOHO_BOOKS_REFRESH_TOKEN', ''));
define('ZOHO_BOOKS_INVOICE_PREFIX',env('ZOHO_BOOKS_INVOICE_PREFIX','WMD'));  // configurable prefix

// ── Site URLs ─────────────────────────────────────────────────────────────────
define('SITE_URL',           env('SITE_URL', 'https://webmydrive.com'));

// ── Internal / Cron ───────────────────────────────────────────────────────────
define('INTERNAL_CRON_TOKEN', env('INTERNAL_CRON_TOKEN', ''));

// ── Logging ───────────────────────────────────────────────────────────────────
define('LOG_DIR',            env('LOG_DIR', __DIR__ . '/../logs'));
