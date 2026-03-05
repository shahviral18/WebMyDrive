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

// ── Database (SQLite) ─────────────────────────────────────────────────────────
// Path to the same SQLite file used by Prisma
define('DB_PATH',            env('DB_PATH', __DIR__ . '/../prisma/dev.db'));

// ── JWT ───────────────────────────────────────────────────────────────────────
define('JWT_SECRET',         env('JWT_SECRET', 'default_secret'));
define('JWT_EXPIRY',         (int) env('JWT_EXPIRY', 86400 * 7)); // 7 days in seconds

// ── Google OAuth ──────────────────────────────────────────────────────────────
define('GOOGLE_CLIENT_ID',   env('GOOGLE_CLIENT_ID', ''));

// ── Razorpay ──────────────────────────────────────────────────────────────────
define('RAZORPAY_KEY_ID',    env('RAZORPAY_KEY_ID', ''));
define('RAZORPAY_KEY_SECRET',env('RAZORPAY_KEY_SECRET', ''));

// ── Stripe ────────────────────────────────────────────────────────────────────
define('STRIPE_SECRET_KEY',  env('STRIPE_SECRET_KEY', ''));
define('STRIPE_WEBHOOK_SECRET', env('STRIPE_WEBHOOK_SECRET', ''));

// ── Site URLs ─────────────────────────────────────────────────────────────────
define('SITE_URL',           env('SITE_URL', 'https://webmydrive.com'));

// ── Logging ───────────────────────────────────────────────────────────────────
define('LOG_DIR',            env('LOG_DIR', __DIR__ . '/../logs'));
