<?php
/**
 * AuditService — Mirrors src/services/AuditService.ts
 *
 * Inserts a row into the AuditLog table.
 * Non-fatal: errors are logged to file, never thrown.
 */

declare(strict_types=1);

class AuditService
{
    /**
     * @param string      $actionName  e.g. 'LOGIN', 'PAYMENT_VERIFIED'
     * @param int|null    $actorId     userId (or null for system)
     * @param string|null $ipAddress
     * @param array       $payload     Extra context (stored as JSON)
     */
    public static function log(
        string $actionName,
        ?int $actorId = null,
        ?string $ipAddress = null,
        array $payload = []
    ): void {
        try {
            Database::insert(
                'INSERT INTO "AuditLog" (userId, action, details, ip, createdAt)
                 VALUES (:userId, :action, :details, :ip, NOW())',
                [
                    ':userId' => $actorId,
                    ':action' => $actionName,
                    ':details' => $payload ? json_encode($payload) : null,
                    ':ip' => $ipAddress,
                ]
            );
        } catch (Throwable $e) {
            Logger::warn("[AuditService] Failed to write audit log '$actionName': " . $e->getMessage());
        }
    }
}
