<?php
/**
 * Auth Middleware
 *
 * Mirrors src/middleware/auth.ts:
 *  - authenticate(): verify Bearer JWT, inject req->user, block disabled accounts
 *  - authorize(roles[]): check role list
 *
 * Middleware functions accept a Request object.
 * They call Response::error() (exits) on failure, or return on success.
 */

declare(strict_types=1);

class AuthMiddleware
{
    /**
     * Verify the Bearer JWT and set $request->user = ['userId' => int, 'role' => string].
     * Blocks disabled USER accounts from accessing protected routes.
     */
    public static function authenticate(Request $request): void
    {
        $token = $request->bearerToken();

        if ($token === null || $token === '') {
            Response::error('Unauthorized', 401);
        }

        try {
            $payload = JwtHelper::decode($token);
        } catch (RuntimeException $e) {
            $msg = $e->getMessage();
            if ($msg === 'TokenExpiredError') {
                Response::error('Session expired. Please log in again.', 401);
            }
            Response::error('Invalid token', 401);
        }

        $userId = (int) ($payload['userId'] ?? 0);
        $role = (string) ($payload['role'] ?? '');

        if ($userId === 0 || $role === '') {
            Response::error('Invalid token', 401);
        }

        // For regular USERs (not ADMIN/SUPERADMIN/DISTRIBUTOR), check isDisabled
        if (!in_array($role, ['DISTRIBUTOR', 'ADMIN', 'SUPERADMIN'], true)) {
            $user = Database::queryOne(
                'SELECT isDisabled FROM "User" WHERE id = :id',
                [':id' => $userId]
            );
            if ($user && (bool) $user['isDisabled']) {
                Response::error('Your account has been suspended. Please contact support.', 403);
            }
        }

        $request->user = ['userId' => $userId, 'role' => $role];
    }

    /**
     * Returns a closure that allows only the given roles.
     * Must be used AFTER authenticate().
     *
     * @param string[] $roles
     */
    public static function authorize(array $roles): callable
    {
        return function (Request $request) use ($roles): void {
            $user = $request->user;
            if ($user === null || !in_array($user['role'], $roles, true)) {
                Response::error('Forbidden', 403);
            }
        };
    }

    /**
     * Combined middleware: authenticate + authorize.
     * Convenient for admin routes.
     *
     * @param string[] $roles
     * @return callable[]
     */
    public static function adminOnly(array $roles = ['ADMIN', 'SUPERADMIN']): array
    {
        return [
            [self::class, 'authenticate'],
            self::authorize($roles),
        ];
    }
}
