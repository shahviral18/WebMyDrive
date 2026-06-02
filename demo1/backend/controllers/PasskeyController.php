<?php
/**
 * PasskeyController — WebAuthn passkey registration & authentication
 *
 * Routes:
 *   POST /api/passkey/register-challenge   [auth]  — generate registration options
 *   POST /api/passkey/register-verify      [auth]  — verify & store credential
 *   POST /api/passkey/login-challenge              — generate assertion options
 *   POST /api/passkey/login-verify                 — verify assertion & return JWT
 *   GET  /api/passkey/list                 [auth]  — list user's passkeys
 *   DELETE /api/passkey/delete             [auth]  — delete a passkey
 */

declare(strict_types=1);

require_once BASE_PATH . '/lib/WebAuthn/WebAuthn.php';

use lbuchs\WebAuthn\WebAuthn;
use lbuchs\WebAuthn\WebAuthnException;

class PasskeyController
{
    private static function getWebAuthn(): WebAuthn
    {
        $rpName   = 'WebMyDrive';
        $rpId     = parse_url(defined('SITE_URL') ? SITE_URL : 'https://webmydrive.com', PHP_URL_HOST) ?: 'webmydrive.com';
        return new WebAuthn($rpName, $rpId, ['none', 'packed', 'fido-u2f', 'apple'], true);
    }

    // ── Registration: Step 1 — send challenge to browser ─────────────────────
    public function registerChallenge(Request $req): void
    {
        $userId = (int) $req->user['userId'];
        $user   = Database::queryOne('SELECT id, name, email FROM "User" WHERE id = :id', [':id' => $userId]);
        if (!$user) { Response::json(['error' => 'User not found'], 404); return; }

        $wa = self::getWebAuthn();

        // Exclude credentials the user already registered (avoid duplicates)
        $existing = Database::query(
            'SELECT credentialId FROM "UserPasskey" WHERE "userId" = :uid',
            [':uid' => $userId]
        );
        $exclude = array_map(fn($r) => base64_decode($r['credentialId']), $existing);

        $challenge = $wa->getCreateArgs(
            \lbuchs\WebAuthn\Binary\ByteBuffer::fromBase64Url(base64_encode((string)$userId)),
            $user['name'] ?: $user['email'],
            $user['email'],
            60,     // timeout seconds
            false,  // requireResidentKey
            'preferred', // userVerification
            $exclude
        );

        // Store challenge in session
        session_start();
        $_SESSION['passkey_challenge'] = $wa->getChallenge()->getHex();

        Response::json($challenge);
    }

    // ── Registration: Step 2 — verify browser response ───────────────────────
    public function registerVerify(Request $req): void
    {
        $userId = (int) $req->user['userId'];
        $body   = $req->body;

        session_start();
        $challengeHex = $_SESSION['passkey_challenge'] ?? null;
        unset($_SESSION['passkey_challenge']);

        if (!$challengeHex) { Response::json(['error' => 'No challenge found. Try again.'], 400); return; }

        try {
            $wa = self::getWebAuthn();

            $clientData    = base64_decode($body['response']['clientDataJSON']);
            $attestation   = base64_decode($body['response']['attestationObject']);

            $data = $wa->processCreate($clientData, $attestation,
                \lbuchs\WebAuthn\Binary\ByteBuffer::fromHex($challengeHex),
                true, true, false
            );

            $credentialId = base64_encode($data->credentialId);
            $publicKey    = $data->credentialPublicKey;
            $deviceName   = trim($body['deviceName'] ?? '') ?: 'Passkey';

            // Check for duplicate credential
            $dup = Database::queryOne(
                'SELECT id FROM "UserPasskey" WHERE "credentialId" = :cid',
                [':cid' => $credentialId]
            );
            if ($dup) { Response::json(['error' => 'This passkey is already registered.'], 409); return; }

            Database::insert(
                'INSERT INTO "UserPasskey" ("userId", "credentialId", "publicKey", "signCount", "deviceName", "createdAt")
                 VALUES (:uid, :cid, :pk, :sc, :dn, NOW())',
                [
                    ':uid' => $userId,
                    ':cid' => $credentialId,
                    ':pk'  => base64_encode($publicKey),
                    ':sc'  => $data->signCount ?? 0,
                    ':dn'  => $deviceName,
                ]
            );

            Response::json(['success' => true, 'message' => 'Passkey registered successfully!']);

        } catch (WebAuthnException $e) {
            Response::json(['error' => $e->getMessage()], 400);
        }
    }

    // ── Authentication: Step 1 — send challenge ───────────────────────────────
    public function loginChallenge(Request $req): void
    {
        $email = strtolower(trim((string)($req->body['email'] ?? '')));
        $allowList = [];

        if ($email) {
            $user = Database::queryOne('SELECT id FROM "User" WHERE email = :e', [':e' => $email]);
            if ($user) {
                $creds = Database::query(
                    'SELECT "credentialId" FROM "UserPasskey" WHERE "userId" = :uid',
                    [':uid' => $user['id']]
                );
                $allowList = array_map(fn($r) => base64_decode($r['credentialId']), $creds);
            }
        }

        $wa        = self::getWebAuthn();
        $challenge = $wa->getGetArgs($allowList, 60, 'preferred');

        session_start();
        $_SESSION['passkey_login_challenge'] = $wa->getChallenge()->getHex();

        Response::json($challenge);
    }

    // ── Authentication: Step 2 — verify assertion & issue JWT ────────────────
    public function loginVerify(Request $req): void
    {
        $body = $req->body;

        session_start();
        $challengeHex = $_SESSION['passkey_login_challenge'] ?? null;
        unset($_SESSION['passkey_login_challenge']);

        if (!$challengeHex) { Response::json(['error' => 'No challenge. Try again.'], 400); return; }

        try {
            $credentialId = base64_encode(base64_decode($body['rawId'] ?? ''));

            $passkey = Database::queryOne(
                'SELECT p.*, u.id as uid, u.role, u.name, u.email, u.isDisabled
                   FROM "UserPasskey" p
                   JOIN "User" u ON u.id = p."userId"
                  WHERE p."credentialId" = :cid',
                [':cid' => $credentialId]
            );

            if (!$passkey) { Response::json(['error' => 'Passkey not recognised.'], 401); return; }
            if ($passkey['isDisabled']) { Response::json(['error' => 'Account disabled.'], 403); return; }

            $wa = self::getWebAuthn();

            $clientData      = base64_decode($body['response']['clientDataJSON']);
            $authenticatorData = base64_decode($body['response']['authenticatorData']);
            $signature       = base64_decode($body['response']['signature']);
            $publicKey       = base64_decode($passkey['publicKey']);

            $wa->processGet(
                $clientData, $authenticatorData, $signature,
                $publicKey,
                \lbuchs\WebAuthn\Binary\ByteBuffer::fromHex($challengeHex),
                (int)$passkey['signCount'],
                true, true
            );

            // Update sign count
            Database::execute(
                'UPDATE "UserPasskey" SET "signCount" = "signCount" + 1, "lastUsedAt" = NOW() WHERE "credentialId" = :cid',
                [':cid' => $credentialId]
            );

            $token = JwtHelper::generateToken((int)$passkey['uid'], $passkey['role']);
            Response::json(['success' => true, 'token' => $token, 'name' => $passkey['name']]);

        } catch (WebAuthnException $e) {
            Response::json(['error' => $e->getMessage()], 401);
        }
    }

    // ── List passkeys ─────────────────────────────────────────────────────────
    public function list(Request $req): void
    {
        $userId = (int) $req->user['userId'];
        $rows   = Database::query(
            'SELECT id, "deviceName", "createdAt", "lastUsedAt" FROM "UserPasskey" WHERE "userId" = :uid ORDER BY "createdAt" DESC',
            [':uid' => $userId]
        );
        Response::json(['passkeys' => $rows]);
    }

    // ── Delete passkey ────────────────────────────────────────────────────────
    public function delete(Request $req): void
    {
        $userId = (int) $req->user['userId'];
        $id     = (int) ($req->body['id'] ?? $_GET['id'] ?? 0);
        if (!$id) { Response::json(['error' => 'Missing id'], 400); return; }

        $deleted = Database::execute(
            'DELETE FROM "UserPasskey" WHERE id = :id AND "userId" = :uid',
            [':id' => $id, ':uid' => $userId]
        );

        if ($deleted === 0) { Response::json(['error' => 'Not found'], 404); return; }
        Response::json(['success' => true]);
    }
}
