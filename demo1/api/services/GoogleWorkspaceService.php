<?php
/**
 * GoogleWorkspaceService — Sync user profile changes to Google Workspace.
 *
 * Safety contract:
 *   - Only PATCH (partial update) is used — never delete or suspend.
 *   - All methods are no-ops if the workspace email is not a provisioned
 *     @webmydrive.com address (guards PENDING, demo, null states).
 *   - Errors are logged but NEVER bubble up to the caller — a Google API
 *     failure must never break the portal DB update.
 *
 * Credentials live OUTSIDE public_html:
 *   /home1/wmdadmin/google_api/credentials.json
 */

declare(strict_types=1);

class GoogleWorkspaceService
{
    private const GOOGLE_API_BASE  = '/home1/wmdadmin/google_api';
    private const CREDENTIALS_FILE = self::GOOGLE_API_BASE . '/credentials.json';
    private const ADMIN_EMAIL      = 'admin@webmydrive.com';
    private const SCOPES           = [
        'https://www.googleapis.com/auth/admin.directory.user',
        'https://www.googleapis.com/auth/admin.directory.orgunit.readonly',
    ];
    private const DRIVE_SCOPE      = 'https://www.googleapis.com/auth/drive.readonly';

    // ── Bootstrapping ─────────────────────────────────────────────────────────

    private static bool $loaded = false;

    private static function boot(): void
    {
        if (self::$loaded) return;
        $autoload = self::GOOGLE_API_BASE . '/vendor/autoload.php';
        if (!file_exists($autoload)) {
            throw new RuntimeException('Google API library not found: ' . $autoload);
        }
        require_once $autoload;
        self::$loaded = true;
    }

    private static function getService(): object
    {
        self::boot();
        $client = new Google_Client();
        $client->setApplicationName('WebMyDrive');
        $client->setAuthConfig(self::CREDENTIALS_FILE);
        $client->setScopes(self::SCOPES);
        $client->setSubject(self::ADMIN_EMAIL);
        return new Google_Service_Directory($client);
    }

    private static function getDriveServiceForUser(string $userEmail): object
    {
        self::boot();
        $client = new Google_Client();
        $client->setApplicationName('WebMyDrive');
        $client->setAuthConfig(self::CREDENTIALS_FILE);
        $client->setScopes([self::DRIVE_SCOPE]);
        $client->setSubject($userEmail);
        return new Google_Service_Drive($client);
    }

    // ── Guard ─────────────────────────────────────────────────────────────────

    /**
     * Returns true only for real, provisioned @webmydrive.com addresses.
     * Blocks null, 'PENDING', 'demo@webmydrive.com', etc.
     */
    public static function isProvisioned(?string $email): bool
    {
        return $email !== null
            && $email !== 'PENDING'
            && $email !== 'demo@webmydrive.com'
            && str_ends_with($email, '@webmydrive.com');
    }

    // ── Temp password generator ───────────────────────────────────────────────

    public static function generateTempPassword(): string
    {
        return 'Welcome@' . rand(1000, 9999);
    }

    // ── Create new Workspace user ─────────────────────────────────────────────

    /**
     * Creates a new Google Workspace user with a temporary password.
     * Places them in the OU corresponding to their plan (googleOrgUnit).
     * Returns the temp password so it can be emailed to the customer.
     */
    public static function createUser(
        string $email,
        string $firstName,
        string $lastName,
        string $orgUnitPath = '/'
    ): string {
        self::boot();
        $service = self::getService();

        $tempPassword = self::generateTempPassword();

        $user = new Google_Service_Directory_User();
        $user->setPrimaryEmail($email);
        $user->setPassword($tempPassword);
        $user->setChangePasswordAtNextLogin(false);
        $finalOuPath = $orgUnitPath ? '/' . ltrim($orgUnitPath, '/') : '/';
        $user->setOrgUnitPath($finalOuPath);
        Logger::info("[GWS] createUser orgUnitPath='" . $finalOuPath . "' email=" . $email);

        $name = new Google_Service_Directory_UserName();
        $name->setGivenName($firstName ?: explode('@', $email)[0]);
        $name->setFamilyName($lastName ?: '.');
        $user->setName($name);

        $service->users->insert($user);
        Logger::info("[GWS] createUser OK → $email (OU: $orgUnitPath)");

        return $tempPassword;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Sync first/last name to Google Workspace.
     * PATCH — only name is touched, nothing else changes.
     */
    public static function updateName(
        string $workspaceEmail,
        string $firstName,
        string $lastName
    ): bool {
        if (!self::isProvisioned($workspaceEmail)) return false;
        if (!$firstName) return false;

        try {
            $service  = self::getService();
            $userPatch = new Google_Service_Directory_User();
            $name = new Google_Service_Directory_UserName();
            $name->setGivenName($firstName);
            $name->setFamilyName($lastName ?: $firstName);
            $userPatch->setName($name);
            $service->users->patch($workspaceEmail, $userPatch);
            Logger::info("[GWS] updateName OK → $workspaceEmail");
            return true;
        } catch (Throwable $e) {
            Logger::error("[GWS] updateName FAILED → $workspaceEmail: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Sync mobile phone to Google Workspace.
     * PATCH — sets phones array to a single mobile entry.
     * (Users typically have one phone; safe to replace.)
     */
    public static function updatePhone(
        string $workspaceEmail,
        string $phone
    ): bool {
        if (!self::isProvisioned($workspaceEmail)) return false;
        if (!$phone) return false;

        try {
            $service   = self::getService();
            $userPatch = new Google_Service_Directory_User();
            $phoneObj  = new Google_Service_Directory_UserPhone();
            $phoneObj->setType('mobile');
            $phoneObj->setValue($phone);
            $phoneObj->setPrimary(true);
            $userPatch->setPhones([$phoneObj]);
            $service->users->patch($workspaceEmail, $userPatch);
            Logger::info("[GWS] updatePhone OK → $workspaceEmail");
            return true;
        } catch (Throwable $e) {
            Logger::error("[GWS] updatePhone FAILED → $workspaceEmail: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Sync recovery email and/or recovery phone to Google Workspace.
     * PATCH — only the recovery fields supplied are updated.
     */
    public static function updateRecovery(
        string  $workspaceEmail,
        ?string $recoveryEmail,
        ?string $recoveryPhone
    ): bool {
        if (!self::isProvisioned($workspaceEmail)) return false;
        if (!$recoveryEmail && !$recoveryPhone) return false;

        try {
            $service   = self::getService();
            $userPatch = new Google_Service_Directory_User();
            if ($recoveryEmail) $userPatch->setRecoveryEmail($recoveryEmail);
            if ($recoveryPhone) $userPatch->setRecoveryPhone($recoveryPhone);
            $service->users->patch($workspaceEmail, $userPatch);
            Logger::info("[GWS] updateRecovery OK → $workspaceEmail");
            return true;
        } catch (Throwable $e) {
            Logger::error("[GWS] updateRecovery FAILED → $workspaceEmail: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Change the Google Workspace account password.
     * PATCH — only password is changed, changePasswordAtNextLogin forced false.
     */
    public static function updatePassword(string $workspaceEmail, string $password): bool
    {
        if (!self::isProvisioned($workspaceEmail)) return false;
        if (strlen($password) < 8) return false;

        try {
            $service   = self::getService();
            $userPatch = new Google_Service_Directory_User();
            $userPatch->setPassword($password);
            $userPatch->setChangePasswordAtNextLogin(false);
            $service->users->patch($workspaceEmail, $userPatch);
            Logger::info("[GWS] updatePassword OK → $workspaceEmail");
            return true;
        } catch (Throwable $e) {
            Logger::error("[GWS] updatePassword FAILED → $workspaceEmail: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Fetch storage quota breakdown from Google Drive API.
     * Requires drive.readonly scope in domain-wide delegation.
     * Returns null if Drive API is not authorised or unavailable.
     */
    public static function getStorageInfo(string $workspaceEmail): ?array
    {
        if (!self::isProvisioned($workspaceEmail)) return null;

        try {
            $drive = self::getDriveServiceForUser($workspaceEmail);
            $about = $drive->about->get(['fields' => 'storageQuota']);
            $q     = $about->getStorageQuota();

            $usage      = (int) ($q->getUsage()             ?? 0);
            $limit      = (int) ($q->getLimit()             ?? 0);
            $inDrive    = (int) ($q->getUsageInDrive()      ?? 0);
            $inTrash    = (int) ($q->getUsageInDriveTrash() ?? 0);
            $inMail     = max(0, $usage - $inDrive - $inTrash);

            Logger::info("[GWS] getStorageInfo OK → $workspaceEmail");
            return [
                'used'       => $usage,
                'limit'      => $limit,
                'drive'      => $inDrive,
                'driveTrash' => $inTrash,
                'mail'       => $inMail,
            ];
        } catch (Throwable $e) {
            Logger::error("[GWS] getStorageInfo FAILED → $workspaceEmail: " . $e->getMessage());
            return null;
        }
    }

    /**
     * List Shared Drives the user is a member of.
     * Requires drive.readonly scope in domain-wide delegation.
     * Returns empty array on error or missing scope.
     */
    public static function getSharedDrives(string $workspaceEmail): array
    {
        if (!self::isProvisioned($workspaceEmail)) return [];

        try {
            $drive  = self::getDriveServiceForUser($workspaceEmail);
            $result = $drive->drives->listDrives([
                'pageSize' => 50,
                'fields'   => 'drives(id,name,createdTime)',
            ]);

            $drives = [];
            foreach ($result->getDrives() as $d) {
                $driveId     = $d->getId();
                $fileCount   = 0;
                $storageUsed = 0;

                try {
                    $filesResult = $drive->files->listFiles([
                        'driveId'                   => $driveId,
                        'corpora'                   => 'drive',
                        'includeItemsFromAllDrives' => true,
                        'supportsAllDrives'         => true,
                        'q'                         => "trashed = false and mimeType != 'application/vnd.google-apps.folder'",
                        'fields'                    => 'files(size),nextPageToken',
                        'pageSize'                  => 1000,
                    ]);
                    $files       = $filesResult->getFiles();
                    $fileCount   = count($files);
                    $storageUsed = (int) array_sum(array_map(fn($f) => (int)($f->getSize() ?? 0), $files));
                } catch (Throwable $fe) {
                    Logger::error("[GWS] getSharedDrives files.list FAILED → $driveId: " . $fe->getMessage());
                }

                $drives[] = [
                    'id'          => $driveId,
                    'name'        => $d->getName(),
                    'createdTime' => $d->getCreatedTime(),
                    'fileCount'   => $fileCount,
                    'storageUsed' => $storageUsed,
                ];
            }
            Logger::info("[GWS] getSharedDrives OK → $workspaceEmail (" . count($drives) . " drives)");
            return $drives;
        } catch (Throwable $e) {
            Logger::error("[GWS] getSharedDrives FAILED → $workspaceEmail: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Check if the user has 2-Step Verification enabled on their Google account.
     * Returns true (enrolled), false (not enrolled), or null (not provisioned / error).
     */
    /**
     * Move a workspace user to a different Organizational Unit (changes their plan tier).
     * Called immediately on upgrade; called at renewal for downgrades.
     * No-op (returns false + logs) if orgUnitPath is empty or provisioning fails.
     */
    public static function moveUserToOrgUnit(string $workspaceEmail, string $orgUnitPath): bool
    {
        if (!self::isProvisioned($workspaceEmail) || !$orgUnitPath) return false;

        try {
            $service = self::getService();
            $user    = new Google_Service_Directory_User();
            $user->setOrgUnitPath($orgUnitPath);
            $service->users->patch($workspaceEmail, $user);
            Logger::info("[GWS] moveUserToOrgUnit → $workspaceEmail → $orgUnitPath");
            return true;
        } catch (Throwable $e) {
            Logger::error("[GWS] moveUserToOrgUnit FAILED → $workspaceEmail: " . $e->getMessage());
            return false;
        }
    }

    public static function get2FAStatus(string $workspaceEmail): ?bool
    {
        if (!self::isProvisioned($workspaceEmail)) return null;

        try {
            $service = self::getService();
            $user    = $service->users->get($workspaceEmail, ['fields' => 'isEnrolledIn2Sv']);
            $result  = $user->getIsEnrolledIn2Sv();
            Logger::info("[GWS] get2FAStatus → $workspaceEmail: " . ($result ? 'enabled' : 'disabled'));
            return (bool) $result;
        } catch (Throwable $e) {
            Logger::error("[GWS] get2FAStatus FAILED → $workspaceEmail: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Validate that a Google Workspace OU path exists.
     * Uses orgunits.get with the path to confirm existence.
     */
    public static function validateOrgUnit(string $path): bool
    {
        if (!$path) return false;
        try {
            $service    = self::getService();
            // orgunits.get expects path without leading slash, e.g. "webmydrive.com/A - Basic - 500GB"
            $apiPath    = ltrim($path, '/');
            $service->orgunits->get('my_customer', $apiPath);
            Logger::info("[GWS] validateOrgUnit: '$path' is valid");
            return true;
        } catch (Throwable $e) {
            Logger::warn("[GWS] validateOrgUnit: '$path' not found — " . $e->getMessage());
            return false;
        }
    }
}
