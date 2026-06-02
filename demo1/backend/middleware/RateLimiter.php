<?php
declare(strict_types=1);

class RateLimiter
{
    /**
     * Check if request should be rate-limited.
     * Uses AuditLog table to count recent actions by IP.
     *
     * @param string $ip      Client IP
     * @param string $action  Action identifier (e.g., 'LOGIN_ATTEMPT')
     * @param int    $maxAttempts  Max attempts in window
     * @param int    $windowSeconds  Time window in seconds
     * @return bool  True if request is allowed, false if rate-limited
     */
    public static function check(string $ip, string $action, int $maxAttempts = 10, int $windowSeconds = 900): bool
    {
        try {
            $since = date('Y-m-d H:i:s', time() - $windowSeconds);
            $count = Database::scalar(
                'SELECT COUNT(*) FROM `AuditLog` WHERE ip = :ip AND action = :action AND createdAt > :since',
                [':ip' => $ip, ':action' => $action, ':since' => $since]
            );
            return (int) $count < $maxAttempts;
        } catch (\Throwable $e) {
            // AuditLog table may not exist yet — allow request through
            return true;
        }
    }

    /**
     * Middleware factory: returns a closure that checks rate limit before proceeding.
     */
    public static function limit(string $action, int $maxAttempts = 10, int $windowSeconds = 900): Closure
    {
        return function (Request $req) use ($action, $maxAttempts, $windowSeconds) {
            $ip = $req->ip ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            if (!self::check($ip, $action, $maxAttempts, $windowSeconds)) {
                Response::error('Too many requests. Please try again later.', 429);
            }
        };
    }
}
