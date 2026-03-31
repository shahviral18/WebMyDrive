<?php
/**
 * JWT Helper — HS256 JSON Web Token implementation (no external libraries)
 *
 * Compatible with the tokens minted by the Node.js backend (jsonwebtoken library).
 * Both use HS256 with the same JWT_SECRET.
 *
 * Token payload shape: { userId: int, role: string, iat: int, exp: int }
 */

declare(strict_types=1);

class JwtHelper
{
    /**
     * Encode a payload into a signed JWT string.
     */
    public static function encode(array $payload): string
    {
        $secret = self::getSecret();

        $header = self::base64UrlEncode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $payload['iat'] = $payload['iat'] ?? time();
        $payload['exp'] = $payload['exp'] ?? (time() + JWT_EXPIRY);
        $body = self::base64UrlEncode(json_encode($payload));
        $sig = self::base64UrlEncode(hash_hmac('sha256', "$header.$body", $secret, true));

        return "$header.$body.$sig";
    }

    /**
     * Decode and verify a JWT. Returns the payload array or throws on failure.
     *
     * @throws RuntimeException on invalid/expired token
     */
    public static function decode(string $token): array
    {
        $secret = self::getSecret();

        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            throw new RuntimeException('Invalid token structure');
        }

        [$headerB64, $payloadB64, $sigB64] = $parts;

        $expectedSig = self::base64UrlEncode(hash_hmac('sha256', "$headerB64.$payloadB64", $secret, true));
        // Constant-time comparison to prevent timing attacks
        if (!hash_equals($expectedSig, $sigB64)) {
            throw new RuntimeException('Invalid token signature');
        }

        $payload = json_decode(self::base64UrlDecode($payloadB64), true);
        if (!is_array($payload)) {
            throw new RuntimeException('Invalid token payload');
        }

        if (isset($payload['exp']) && time() > (int) $payload['exp']) {
            throw new RuntimeException('TokenExpiredError');
        }

        return $payload;
    }

    /**
     * Generate a signed token for a user.
     */
    public static function generateToken(int $userId, string $role): string
    {
        return self::encode(['userId' => $userId, 'role' => $role]);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private static function getSecret(): string
    {
        $secret = JWT_SECRET;
        if (
            APP_ENV === 'production' &&
            in_array($secret, ['default_secret', 'super_secret_key_change_me_in_prod'], true)
        ) {
            throw new RuntimeException('JWT_SECRET is not set to a secure value in production');
        }
        return $secret ?: 'default_secret';
    }

    private static function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string
    {
        $padded = strtr($data, '-_', '+/');
        $padded .= str_repeat('=', (4 - strlen($padded) % 4) % 4);
        return base64_decode($padded);
    }
}
