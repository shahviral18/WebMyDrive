<?php
/**
 * public/index.php — Front Controller (Entry Point)
 *
 * ALL requests to the PHP backend must be routed here via Apache/Nginx rewrite rules.
 *
 * Architecture:
 *   public/          ← only publicly accessible directory (document root)
 *   public/index.php ← this file
 *   config/          ← env, database
 *   helpers/         ← Logger, JwtHelper, Request, Response, Router
 *   middleware/      ← AuthMiddleware
 *   services/        ← business logic
 *   controllers/     ← HTTP handlers
 *   logs/            ← runtime logs (writable)
 *
 * IMPORTANT: Set your web server document root to the `public/` folder.
 *            Apache: DirectoryIndex index.php; with .htaccess below.
 *            Nginx:  try_files $uri /index.php;
 */

declare(strict_types=1);

header("Content-Type: application/json");

// CORS is handled by Response::sendCorsHeaders() after bootstrap.
// Handle preflight early but with proper origin checking.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // Bootstrap must load first so CORS config is available
    define('BASE_PATH', dirname(__DIR__));
    require BASE_PATH . '/helpers/Logger.php';
    require BASE_PATH . '/config/env.php';
    require BASE_PATH . '/helpers/Response.php';
    Response::handleOptions();
}
// ── Bootstrap ─────────────────────────────────────────────────────────────────
define('BASE_PATH', dirname(__DIR__));

// Load helpers and config (order matters)
require BASE_PATH . '/helpers/Logger.php';
require BASE_PATH . '/config/env.php';      // defines constants + env()
require BASE_PATH . '/config/database.php'; // Database class
require BASE_PATH . '/helpers/JwtHelper.php';
require BASE_PATH . '/helpers/Request.php';
require BASE_PATH . '/helpers/Response.php';
require BASE_PATH . '/helpers/Router.php';

// Services
require BASE_PATH . '/services/AuditService.php';
require BASE_PATH . '/services/ConfigService.php';
require BASE_PATH . '/services/ReferralLinkService.php';
require BASE_PATH . '/services/ReferralService.php';
require BASE_PATH . '/services/DistributorService.php';
require BASE_PATH . '/services/ZohoPaymentService.php';
require BASE_PATH . '/services/ZohoBooksService.php';
require BASE_PATH . '/services/ZohoMandateService.php';
require BASE_PATH . '/services/SubscriptionService.php';
require BASE_PATH . '/services/GoogleWorkspaceService.php';

// Middleware
require BASE_PATH . '/middleware/AuthMiddleware.php';
require BASE_PATH . '/middleware/SubscriptionMiddleware.php';
require BASE_PATH . '/middleware/RateLimiter.php';

// Controllers
require BASE_PATH . '/controllers/AuthController.php';
require BASE_PATH . '/controllers/AdminController.php';
require BASE_PATH . '/controllers/UserController.php';
require BASE_PATH . '/controllers/ReferralController.php';
require BASE_PATH . '/controllers/DistributorController.php';
require BASE_PATH . '/controllers/SubscriptionController.php';
require BASE_PATH . '/controllers/DistributorApplicationController.php';
require BASE_PATH . '/controllers/PaymentController.php';
require BASE_PATH . '/controllers/InternalController.php';
require BASE_PATH . '/controllers/InvoiceController.php';

// ── Global error handler ──────────────────────────────────────────────────────
set_exception_handler(function (Throwable $e) {
    Logger::error('[Unhandled] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['error' => 'Internal Server Error']);
    exit;
});

// ── Build Request ─────────────────────────────────────────────────────────────
$request = new Request();

// ── Build Router ──────────────────────────────────────────────────────────────
$router = new Router($request);

// Helper: auth middleware array (used inline below)
$auth = [[AuthMiddleware::class, 'authenticate']];
$adminOnly = [
    [AuthMiddleware::class, 'authenticate'],
    AuthMiddleware::authorize(['ADMIN', 'SUPERADMIN']),
];

// ── Health ────────────────────────────────────────────────────────────────────
$router->get('/api/health', function (Request $req) {
    Response::json(['status' => 'ok', 'timestamp' => date('c'), 'env' => APP_ENV]);
});

// ── Auth ──────────────────────────────────────────────────────────────────────
$router->post('/api/auth/register', [AuthController::class, 'register'], [RateLimiter::limit('REGISTER', 5, 900)]);
$router->post('/api/auth/login', [AuthController::class, 'login'], [RateLimiter::limit('LOGIN_ATTEMPT', 10, 900)]);
$router->post('/api/auth/google-login', [AuthController::class, 'googleLogin']);
$router->post('/api/auth/temp-login', [AuthController::class, 'tempLogin']);
$router->get('/api/auth/me', [AuthController::class, 'me'], $auth);
$router->post('/api/auth/forgot-password', [AuthController::class, 'forgotPassword'], [RateLimiter::limit('FORGOT_PASSWORD', 3, 900)]);
$router->post('/api/auth/forgot-otp-request', [AuthController::class, 'forgotOtpRequest'], [RateLimiter::limit('FORGOT_OTP', 5, 900)]);
$router->post('/api/auth/forgot-otp-verify', [AuthController::class, 'forgotOtpVerify'], [RateLimiter::limit('FORGOT_OTP_VERIFY', 10, 900)]);
$router->post('/api/auth/change-password', [AuthController::class, 'changePassword'], $auth);
$router->post('/api/auth/setup-workspace-password', [AuthController::class, 'setupWorkspacePassword'], $auth);
$router->post('/api/auth/setup-credentials', [AuthController::class, 'setupCredentials']);
$router->post('/api/auth/setup-webmydrive-id', [AuthController::class, 'setupWmdId'], $auth);
$router->post('/api/auth/activate-lookup', [AuthController::class, 'activateLookup']); // Public

// ── Admin ─────────────────────────────────────────────────────────────────────
$router->get('/api/admin/config', [AdminController::class, 'getConfig'], $adminOnly);
$router->post('/api/admin/config', [AdminController::class, 'updateConfig'], $adminOnly);
$router->get('/api/admin/kpis', [AdminController::class, 'getKpis'], $adminOnly);
$router->get('/api/admin/users', [AdminController::class, 'getUsers'], $adminOnly);
$router->get('/api/admin/users/:id', [AdminController::class, 'getUser'], $adminOnly);
$router->post('/api/admin/users', [AdminController::class, 'createUser'], $adminOnly);
$router->post('/api/admin/users/:id/reset-password', [AdminController::class, 'resetUserPassword'], $adminOnly);
$router->delete('/api/admin/users/:id', [AdminController::class, 'deleteUser'], $adminOnly);
$router->post('/api/admin/users/:id/adjust-wallet', [AdminController::class, 'adjustWallet'], $adminOnly);
$router->post('/api/admin/users/:id/toggle-status', [AdminController::class, 'toggleUserStatus'], $adminOnly);
$router->post('/api/admin/users/:id/reactivate',              [AdminController::class, 'reactivateUser'],           $adminOnly);
$router->post('/api/admin/users/:id/send-reactivation-link', [AdminController::class, 'sendReactivationLink'],   $adminOnly);
// Public reactivation endpoints (no auth)
$router->get('/api/public/reactivate',       [PaymentController::class, 'getReactivationInfo'],        []);
$router->post('/api/public/reactivate/pay',  [PaymentController::class, 'createReactivationSession'],  []);
$router->get('/api/admin/orders', [AdminController::class, 'getOrders'], $adminOnly);
$router->get('/api/admin/distributors', [AdminController::class, 'getDistributors'], $adminOnly);
$router->get('/api/admin/distributors/:id/detail', [AdminController::class, 'getDistributorDetail'], $adminOnly);
$router->post('/api/admin/distributors', [AdminController::class, 'createDistributor'], $adminOnly);
$router->post('/api/admin/distributors/:id/reset-password', [AdminController::class, 'resetDistributorPassword'], $adminOnly);
$router->post('/api/admin/distributors/:id/adjust-wallet', [AdminController::class, 'adjustDistributorWallet'], $adminOnly);
$router->get('/api/admin/referrals', [AdminController::class, 'getAllReferrals'], $adminOnly);
$router->patch('/api/admin/referrals/:id/override-commission', [AdminController::class, 'overrideCommission'], $adminOnly);
$router->get('/api/admin/audit-logs', [AdminController::class, 'getAuditLogs'], $adminOnly);
$router->get('/api/admin/referral-analytics', [AdminController::class, 'getReferralAnalytics'], $adminOnly);
$router->get('/api/admin/plans', [AdminController::class, 'getPlans'], $adminOnly);
$router->post('/api/admin/plans', [AdminController::class, 'upsertPlan'], $adminOnly);
$router->delete('/api/admin/plans/:id', [AdminController::class, 'deletePlan'], $adminOnly);
$router->patch('/api/admin/plans/:id/toggle', [AdminController::class, 'togglePlan'], $adminOnly);
$router->get('/api/admin/promo-codes', [AdminController::class, 'getPromoCodes'], $adminOnly);
$router->post('/api/admin/promo-codes', [AdminController::class, 'upsertPromoCode'], $adminOnly);
$router->delete('/api/admin/promo-codes/:id', [AdminController::class, 'deletePromoCode'], $adminOnly);
$router->get('/api/admin/distributor-codes', [AdminController::class, 'getDistributorCodesAll'], $adminOnly);
$router->get('/api/admin/user-codes', [AdminController::class, 'getUserCodesAll'], $adminOnly);
$router->get('/api/admin/distributors/:id/promo-codes', [AdminController::class, 'getDistributorPromoCodes'], $adminOnly);
$router->post('/api/admin/distributors/:id/promo-code', [AdminController::class, 'assignDistributorPromoCode'], $adminOnly);
$router->delete('/api/admin/distributors/:id/promo-code/:dpcId', [AdminController::class, 'revokeDistributorPromoCode'], $adminOnly);
$router->get('/api/admin/validate-ou-path', [AdminController::class, 'validateOuPath'], $adminOnly);
$router->post('/api/admin/users/:id/assign-distributor', [AdminController::class, 'assignUserToDistributor'], $adminOnly);
$router->post('/api/admin/users/:id/assign-referrer', [AdminController::class, 'assignReferrer'], $adminOnly);
$router->get('/api/admin/referral-assignments', [AdminController::class, 'getReferralAssignments'], $adminOnly);
$router->post('/api/admin/users/:id/provision-google', [AdminController::class, 'provisionGoogleAccount'], $adminOnly);
$router->post('/api/admin/users/:id/reassign-attribution', [AdminController::class, 'reassignAttribution'], $adminOnly);
$router->post('/api/admin/distributors/:id/reprocess-sale', [AdminController::class, 'reprocessDistributorSale'], $adminOnly);
$router->post('/api/admin/users/:id/promote-distributor', [AdminController::class, 'promoteUserToDistributor'], $adminOnly);
$router->post('/api/admin/existing-users/sync-google', [AdminController::class, 'syncFromGoogle'], $adminOnly);
$router->get('/api/admin/existing-users', [AdminController::class, 'getExistingUsers'], $adminOnly);
$router->post('/api/admin/existing-users/:id/import', [AdminController::class, 'importExistingUser'], $adminOnly);
$router->post('/api/admin/existing-users/bulk-import', [AdminController::class, 'bulkImportExistingUsers'], $adminOnly);
$router->get('/api/admin/vouchers',            [AdminController::class, 'getVouchers'],       $adminOnly);
$router->post('/api/admin/vouchers',           [AdminController::class, 'createVouchers'],    $adminOnly);
$router->delete('/api/admin/vouchers/:id',     [AdminController::class, 'deactivateVoucher'], $adminOnly);
$router->get('/api/admin/price-revision',      [AdminController::class, 'getPriceRevision'],  $adminOnly);
$router->post('/api/admin/price-revision',     [AdminController::class, 'setPriceRevision'],  $adminOnly);

// ── Super-admin only ──────────────────────────────────────────────────────────
$superAdminOnly = [
    [AuthMiddleware::class, 'authenticate'],
    AuthMiddleware::authorize(['SUPERADMIN']),
];
$router->get('/api/admin/users-with-plans',       [AdminController::class, 'getUsersWithPlans'], $superAdminOnly);
$router->post('/api/admin/users/:id/change-plan', [AdminController::class, 'changePlan'],        $superAdminOnly);

// ── User ──────────────────────────────────────────────────────────────────────
$router->get('/api/user/workspace', [UserController::class, 'getWorkspace'], $auth);
$router->get('/api/user/check-username', [UserController::class, 'checkUsername']);
$router->get('/api/user/plans', [UserController::class, 'getPlans']);
$router->post('/api/user/plans/:id/purchase', [UserController::class, 'purchasePlan'], $auth);
$router->get('/api/user/orders', [UserController::class, 'getOrders'], $auth);
$router->put('/api/user/profile', [UserController::class, 'updateProfile'], $auth);
$router->put('/api/user/profile/name', [UserController::class, 'updateName'], $auth);
$router->put('/api/user/profile/contact', [UserController::class, 'updateContact'], $auth);
$router->put('/api/user/profile/recovery', [UserController::class, 'updateRecovery'], $auth);
$router->get('/api/user/storage', [UserController::class, 'getStorage'], $auth);
$router->get('/api/user/login-history', [UserController::class, 'getLoginHistory'], $auth);
$router->get('/api/user/sessions', [UserController::class, 'getSessions'], $auth);
$router->delete('/api/user/sessions/:id', [UserController::class, 'revokeSession'], $auth);
$router->get('/api/user/shared-drives', [UserController::class, 'getSharedDrives'], $auth);
$router->post('/api/user/refresh-workspace-data', [UserController::class, 'refreshWorkspaceData'], $auth);
$router->get('/api/user/workspace-security', [UserController::class, 'getWorkspaceSecurity'], $auth);
$router->get('/api/user/current-plan',     [UserController::class, 'getCurrentPlan'],    $auth);
$router->get('/api/user/upgrade-preview',  [UserController::class, 'getUpgradePreview'], $auth);
$router->post('/api/user/initiate-upgrade',   [UserController::class, 'initiateUpgrade'],   $auth);
$router->post('/api/user/confirm-upgrade',    [UserController::class, 'confirmUpgrade'],    $auth);
$router->post('/api/user/schedule-downgrade',    [UserController::class, 'scheduleDowngrade'],    $auth);
$router->delete('/api/user/cancel-downgrade',    [UserController::class, 'cancelDowngrade'],      $auth);
$router->get('/api/user/autorenewal-status',     [UserController::class, 'getAutoRenewalStatus'], $auth);
$router->post('/api/user/enable-autorenewal',    [UserController::class, 'enableAutoRenewal'],    $auth);
$router->post('/api/user/confirm-mandate',       [UserController::class, 'confirmMandate'],       $auth);
$router->post('/api/user/disable-autorenewal',   [UserController::class, 'disableAutoRenewal'],   $auth);
$router->patch('/api/user/referral-code',        [UserController::class, 'updateReferralCode'],   $auth);
$router->post('/api/user/redeem-voucher',        [UserController::class, 'redeemVoucher'],         $auth);
$router->get('/api/user/wallet-transactions',    [UserController::class, 'getWalletTransactions'], $auth);

// ── Referral ──────────────────────────────────────────────────────────────────
$router->get('/api/referral/dashboard', [ReferralController::class, 'getDashboard'], $auth);
$router->get('/api/referral/history', [ReferralController::class, 'getHistory'], $auth);
$router->get('/api/referral/my-orders', [ReferralController::class, 'getMyOrders'], $auth);
$router->post('/api/referral/validate-code', [ReferralController::class, 'validatePromoCode']);
$router->get('/api/referral/resolve', [ReferralController::class, 'resolveReferral']);
$router->post('/api/referral/create-checkout', [ReferralController::class, 'createCheckoutSession'], $auth);
$router->post('/api/referral/verify-payment', [ReferralController::class, 'verifyPayment'], $auth);
$router->post('/api/referral/process-purchase', [ReferralController::class, 'processPurchase'], $auth);

// ── Subscription ──────────────────────────────────────────────────────────────
$router->get('/api/subscription/status', [SubscriptionController::class, 'getSubscriptionStatus'], $auth);
$router->get('/api/subscription/details', [SubscriptionController::class, 'getSubscriptionDetails'], $auth);
$router->post('/api/subscription/renew', [SubscriptionController::class, 'renewSubscription'], $auth);
$router->get('/api/subscription/all', [SubscriptionController::class, 'getAllSubscriptions'], $adminOnly);
$router->get('/api/subscription/stats', [SubscriptionController::class, 'getStats'], $adminOnly);
// ── Distributor Applications (public gate + admin review) ──────────────────
$router->get('/api/distributor/check-eligibility', [DistributorApplicationController::class, 'checkEligibility']);
$router->post('/api/distributor/apply', [DistributorApplicationController::class, 'apply']);
$router->get('/api/admin/distributor-applications', [DistributorApplicationController::class, 'adminList'], $adminOnly);
$router->get('/api/admin/distributor-applications/:id', [DistributorApplicationController::class, 'adminDetail'], $adminOnly);
$router->patch('/api/admin/distributor-applications/:id', [DistributorApplicationController::class, 'adminUpdate'], $adminOnly);
$router->get('/api/admin/distributor-applications/:id/files/:type', [DistributorApplicationController::class, 'adminDownload'], $adminOnly);

// ── Distributor ───────────────────────────────────────────────────────────────
$router->post('/api/distributor/onboard', [DistributorController::class, 'onboard'], $auth);
$router->get('/api/distributor/dashboard', [DistributorController::class, 'getDashboard'], $auth);
$router->get('/api/distributor/history', [DistributorController::class, 'getHistory'], $auth);
$router->post('/api/distributor/qa-sale', [DistributorController::class, 'simulateSale'], $auth);
$router->post('/api/distributor/request-payout', [DistributorController::class, 'requestPayout'], $auth);
$router->get('/api/distributor/payouts', [DistributorController::class, 'getPayouts'], $auth);
$router->get('/api/distributor/wallet', [DistributorController::class, 'getWallet'], $auth);
$router->get('/api/distributor/customers', [DistributorController::class, 'getCustomers'], $auth);
$router->get('/api/distributor/earnings', [DistributorController::class, 'getEarningsStats'], $auth);
$router->get('/api/distributor/promo-codes', [DistributorController::class, 'getPromoCodeHistory'], $auth);
$router->get('/api/distributor/settings', [DistributorController::class, 'getSettings'], $auth);
$router->patch('/api/distributor/settings', [DistributorController::class, 'updateSettings'], $auth);

// ── Admin: Distributor payouts ────────────────────────────────────────────────
$router->get('/api/admin/distributor-payouts', [DistributorController::class, 'adminListPayouts'], $adminOnly);
$router->patch('/api/admin/distributor-payouts/:id', [DistributorController::class, 'adminUpdatePayout'], $adminOnly);
$router->get('/api/admin/distributor-payouts/:id/invoice', [DistributorController::class, 'adminDownloadInvoice'], $adminOnly);

// ── Internal (called by GitHub Actions cron — token-authenticated, no JWT) ────
$router->get('/api/cron/run-migration', [InternalController::class, 'runMigration']);
$router->get('/api/cron/run-renewals',  [InternalController::class, 'runRenewals']);

// ── Invoices ──────────────────────────────────────────────────────────────────
$router->get('/api/invoices/my',                        [InvoiceController::class, 'myInvoices'],       $auth);
$router->get('/api/invoices/download/:id',              [InvoiceController::class, 'downloadPdf'],      $auth);
$router->get('/api/admin/invoices/user/:userId',        [InvoiceController::class, 'adminListForUser'], $adminOnly);
$router->post('/api/admin/invoices',                    [InvoiceController::class, 'adminCreate'],      $adminOnly);
$router->put('/api/admin/invoices/:id',                 [InvoiceController::class, 'adminUpdate'],      $adminOnly);
$router->delete('/api/admin/invoices/:id',              [InvoiceController::class, 'adminDelete'],      $adminOnly);

// ── Zoho Payments ─────────────────────────────────────────────────────────────
$router->post('/api/payment/create-session', [PaymentController::class, 'createSession']);
$router->get('/api/payment/status',          [PaymentController::class, 'getStatus']);
$router->post('/api/webhook/zoho-payment',   [PaymentController::class, 'zohoWebhook']);

// ── Dispatch ──────────────────────────────────────────────────────────────────
$router->dispatch();