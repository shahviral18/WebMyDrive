<?php
/**
 * Response — HTTP response helper
 *
 * Mirrors Express's res.json() / res.status() pattern.
 * All JSON responses include CORS headers.
 */

declare(strict_types=1);

class Response
{
    private static bool $headersSent = false;

    /**
     * Send a JSON response and stop execution.
     *
     * @param mixed  $data   Any JSON-serializable value
     * @param int    $status HTTP status code (default 200)
     */
    public static function json(mixed $data, int $status = 200): never
    {
        if (!self::$headersSent) {
            self::sendCorsHeaders();
            http_response_code($status);
            header('Content-Type: application/json; charset=utf-8');
            self::$headersSent = true;
        }
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    /**
     * Shorthand for 4xx / 5xx error responses.
     */
    public static function error(string $message, int $status = 500): never
    {
        self::json(['error' => $message], $status);
    }

    /**
     * Respond to a CORS preflight OPTIONS request.
     */
    public static function handleOptions(): never
    {
        self::sendCorsHeaders();
        http_response_code(204);
        exit;
    }

    // ── Private ───────────────────────────────────────────────────────────────

    private static function sendCorsHeaders(): void
    {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $allowedOrigins = array_filter(array_map(
            'trim',
            explode(',', ALLOWED_ORIGINS)
        ));

        if (APP_ENV !== 'production') {
            // Development: allow all origins
            $allowed = $origin ?: '*';
        } elseif (empty($allowedOrigins) || in_array($origin, $allowedOrigins, true)) {
            $allowed = $origin ?: '*';
        } else {
            // Not in allowed list — don't set the header (browser will block)
            $allowed = '';
        }

        if ($allowed !== '') {
            header("Access-Control-Allow-Origin: $allowed");
        }
        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Allow-Credentials: true');
        header('Vary: Origin');
    }
}
