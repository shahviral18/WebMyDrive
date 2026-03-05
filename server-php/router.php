<?php
/**
 * router.php — PHP built-in server router
 * Usage: php -S localhost:4000 -t server-php/public server-php/router.php
 *
 * Forwards all requests to the front controller.
 * Static files in public/ are served directly.
 */
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

// Serve actual static files from public/ directly
if ($uri !== '/' && file_exists(__DIR__ . '/public' . $uri)) {
    return false; // let built-in server handle it
}

// Route everything else to front controller
$_SERVER['SCRIPT_NAME'] = '/index.php';
require __DIR__ . '/public/index.php';
