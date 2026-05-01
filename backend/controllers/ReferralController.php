<?php
/**
 * ReferralController — Mirrors src/controllers/ReferralController.ts
 *
 * Routes:
 *   GET  /api/referral/dashboard        [auth]
 *   GET  /api/referral/history          [auth]
 *   GET  /api/referral/my-orders        [auth]
 *   POST /api/referral/validate-code
 *   GET  /api/referral/resolve
 *   POST /api/referral/create-checkout  [auth]
 *   POST /api/referral/verify-payment   [auth]
 *   POST /api/referral/process-purchase [auth, admin only]
 *
 * Note: The in-memory pendingPromoCodes Map from Node.js is simulated here
 * via a persistent audit log lookup fallback (same strategy as the TS code's fallback).
 * PHP processes don't share memory between requests, so we rely solely on the audit log.
 */

declare(strict_types=1);

class ReferralController
{
    public function getDashboard(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        if (!$userId)
            Response::error('Unauthorized', 401);

        $data = ReferralService::getUserReferralDashboard($userId);
        if (!$data)
            Response::error('User not found', 404);
        Response::json($data);
    }

    public function getHistory(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        if (!$userId)
            Response::error('Unauthorized', 401);

        $history = ReferralService::getUserReferralHistory($userId);
        Response::json(['referrals' => $history]);
    }

    public function getMyOrders(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        if (!$userId)
            Response::error('Unauthorized', 401);

        $orders = Database::query(
            'SELECT o.*, p.name AS planName FROM "Order" o LEFT JOIN "Plan" p ON p.id = o.planId WHERE o.userId = :uid ORDER BY o.createdAt DESC',
            [':uid' => $userId]
        );
        Response::json(['orders' => $orders]);
    }

    public function resolveReferral(Request $req): void
    {
        $uid = $req->query['uid'] ?? null;
        $did = $req->query['did'] ?? null;

        if ($did) {
            $dist = Database::queryOne('SELECT * FROM "Distributor" WHERE id = :id', [':id' => (int) $did]);
            if ($dist && $dist['status'] === 'APPROVED') {
                $cfg = ConfigService::getDistributorConfig();
                Response::json(['success' => true, 'role' => 'DISTRIBUTOR', 'percent' => ($cfg['defaultCommissionRate'] ?? 0.08) * 100]);
            }
        } elseif ($uid) {
            $user = Database::queryOne('SELECT * FROM "User" WHERE id = :id', [':id' => (int) $uid]);
            if ($user && !(bool) $user['isDisabled']) {
                $cfg = ConfigService::getGlobalPlanConfig();
                Response::json(['success' => true, 'role' => 'USER', 'percent' => (float) $cfg['customerDiscountRate'] * 100]);
            }
        }

        Response::error('Referral link invalid or inactive', 404);
    }

    public function validatePromoCode(Request $req): void
    {
        $promoCode = trim((string) ($req->body['promoCode'] ?? ''));
        $planName  = trim((string) ($req->body['planName'] ?? ''));
        if (!$promoCode)
            Response::error('Promo code required', 400);

        if (strtoupper($promoCode) === 'DEMO123') {
            Response::json(['success' => true, 'discountPct' => 0]);
        }

        // Check distributor promo code (PromoCode linked via DistributorPromoCode)
        $promoRow = Database::queryOne(
            'SELECT pc.*, dpc.distributorId FROM `PromoCode` pc
             JOIN `DistributorPromoCode` dpc ON dpc.promoCodeId = pc.id
             WHERE pc.code = :code AND pc.status = \'ACTIVE\' AND dpc.isActive = 1
               AND (pc.expiresAt IS NULL OR pc.expiresAt > NOW())
             LIMIT 1',
            [':code' => strtoupper($promoCode)]
        );
        if ($promoRow) {
            $config = ConfigService::getDistributorConfig();
            $discountPct = (float)($config['promoDiscounts'][$planName] ?? 0);
            Response::json([
                'success' => true,
                'discountPct' => $discountPct,
                'type' => 'DISTRIBUTOR_PROMO',
                'distributorId' => (int)$promoRow['distributorId'],
            ]);
        }

        // Check standalone promo code (not linked to a distributor)
        $standalonePromo = Database::queryOne(
            'SELECT * FROM `PromoCode`
             WHERE code = :code AND status = \'ACTIVE\'
               AND (expiresAt IS NULL OR expiresAt > NOW())
               AND (usesLimit IS NULL OR usesCount < usesLimit)
             LIMIT 1',
            [':code' => strtoupper($promoCode)]
        );
        if ($standalonePromo) {
            Response::json([
                'success'     => true,
                'discountPct' => (float) $standalonePromo['discountPercent'],
                'type'        => 'PROMO_CODE',
            ]);
        }

        $validLink = ReferralLinkService::validateCode($promoCode);
        if (!$validLink) {
            $expired = Database::queryOne(
                'SELECT id FROM "ReferralLink" WHERE code = :code AND status IN (\'USED\', \'EXPIRED\')',
                [':code' => $promoCode]
            );
            if ($expired)
                Response::error('This referral link has expired.', 400);
            Response::error('Code not valid', 400);
        }

        Response::json(['success' => true, 'discountPct' => 0]);
    }

    public function createCheckoutSession(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        if (!$userId)
            Response::error('Unauthorized', 401);

        $planId = $req->body['planId'] ?? null;
        $promoCode = (string) ($req->body['promoCode'] ?? '');
        $referralContext = $req->body['referralContext'] ?? null;

        if (!$planId)
            Response::error('planId is required', 400);

        $buyer = Database::queryOne('SELECT * FROM "User" WHERE id = :id', [':id' => $userId]);
        if (!$buyer)
            Response::error('User not found', 404);
        if ($buyer['isDisabled'])
            Response::error('Your account has been suspended. Contact support.', 403);

        $plan = Database::queryOne('SELECT * FROM "Plan" WHERE id = :id', [':id' => (int) $planId]);
        if (!$plan)
            Response::error('Plan not found', 404);
        if (!$plan['isActive'])
            Response::error('This plan is currently unavailable', 400);

        $billingPeriod = $req->body['billingPeriod'] ?? 'yearly';
        $yearlyAmount = (float) $plan['price'];
        if ($billingPeriod === 'monthly') {
            $amountINR = isset($plan['monthlyPrice']) && $plan['monthlyPrice'] > 0 ? (float) $plan['monthlyPrice'] : round($yearlyAmount / 12);
        } else {
            $amountINR = $yearlyAmount;
        }

        $discountedAmount = $amountINR;
        $discountPct = 0;
        $finalReferralKey = null;
        $now = date('Y-m-d H:i:s');

        // ── 1. Referral context (URL referral — no discount) ──────────────────
        if (!empty($referralContext['id']) && !empty($referralContext['role'])) {
            $refId = (int) $referralContext['id'];
            $refRole = $referralContext['role'];

            $link = ReferralLinkService::getActiveLink($refId, $refRole);

            if ($refRole === 'DISTRIBUTOR') {
                $dist = Database::queryOne('SELECT id FROM "Distributor" WHERE id = :id', [':id' => $refId]);
                if ($dist) {
                    $finalReferralKey = "DIST_{$dist['id']}:{$link['code']}";
                }
            } elseif ($refRole === 'USER') {
                $usr = Database::queryOne('SELECT id FROM "User" WHERE id = :id', [':id' => $refId]);
                if ($usr) {
                    if ((int) $usr['id'] === $userId)
                        Response::error('You cannot use your own referral link.', 400);
                    $finalReferralKey = $link['code'];
                }
            }
        }
        // ── 2. Promo code ─────────────────────────────────────────────────────
        elseif ($promoCode) {
            $cleanCode = strtoupper(trim($promoCode));

            if ($cleanCode !== 'DEMO123') {
                // Check distributor promo code first
                $distPromoRow = Database::queryOne(
                    'SELECT pc.*, dpc.distributorId FROM "PromoCode" pc
                     JOIN "DistributorPromoCode" dpc ON dpc.promoCodeId = pc.id
                     WHERE pc.code = :code AND pc.status = \'ACTIVE\' AND dpc.isActive = 1
                       AND (pc.expiresAt IS NULL OR pc.expiresAt > NOW())
                     LIMIT 1',
                    [':code' => $cleanCode]
                );

                if ($distPromoRow) {
                    $distConfig = ConfigService::getDistributorConfig();
                    $discountPct = (float)($distConfig['promoDiscounts'][$plan['name']] ?? 0);
                    if ($discountPct > 0) {
                        $discountedAmount = round($amountINR * (1 - $discountPct / 100), 2);
                    }
                    $finalReferralKey = "DIST_{$distPromoRow['distributorId']}:{$cleanCode}";

                    if ($distPromoRow['usesLimit'] !== null) {
                        Database::execute(
                            'UPDATE "PromoCode" SET usesCount = usesCount + 1, updatedAt = :now WHERE id = :id',
                            [':now' => $now ?? date('Y-m-d H:i:s'), ':id' => $distPromoRow['id']]
                        );
                    }
                } else {
                    $validLink = ReferralLinkService::validateCode($cleanCode);
                    if (!$validLink) {
                        $expired = Database::queryOne(
                            'SELECT id FROM "ReferralLink" WHERE code = :code AND status IN (\'USED\', \'EXPIRED\')',
                            [':code' => $cleanCode]
                        );
                        if ($expired)
                            Response::error('This referral link has expired.', 400);
                        Response::error("Referral code \"$cleanCode\" is not valid.", 400);
                    }

                    if ($validLink['role'] === 'DISTRIBUTOR') {
                        $finalReferralKey = "DIST_{$validLink['referrerId']}:{$validLink['code']}";
                    } else {
                        if ((int) $validLink['referrerId'] === $userId) {
                            Response::error('You cannot use your own referral code.', 400);
                        }
                        $finalReferralKey = $validLink['code'];
                    }
                }
            }
        }

        // ── Create pending order ──────────────────────────────────────────────
        $orderId = Database::insert(
            'INSERT INTO "Order" (userId, planId, amount, currency, status, createdAt, updatedAt)
             VALUES (:uid, :pid, :amt, \'INR\', \'PENDING\', :now1, :now2)',
            [':uid' => $userId, ':pid' => (int) $planId, ':amt' => $discountedAmount, ':now1' => $now, ':now2' => $now]
        );

        // Store referral key in audit log (persistent, PHP-process-safe)
        if ($finalReferralKey) {
            AuditService::log('CHECKOUT_PROMO_CODE', $userId, null, [
                'promoCode' => $finalReferralKey,
                'entityId' => $orderId,
                'isContextReferral' => !empty($referralContext),
            ]);
        }

        // Create Zoho payment session
        $referenceNumber = 'WMD-' . strtoupper(bin2hex(random_bytes(5)));
        $session = ZohoPaymentService::createSession(
            $discountedAmount,
            $referenceNumber,
            "{$plan['name']} — {$billingPeriod}"
        );
        $zohoSessionId = $session['id'] ?? '';
        Database::execute('UPDATE "Order" SET gatewayTxId = :sid WHERE id = :id', [':sid' => $zohoSessionId, ':id' => $orderId]);

        Response::json([
            'success'            => true,
            'orderId'            => $orderId,
            'payments_session_id'=> $zohoSessionId,
            'account_id'         => ZOHO_PAYMENTS_ACCOUNT_ID,
            'api_key'            => ZOHO_PAYMENTS_API_KEY,
            'referenceNumber'    => $referenceNumber,
            'amount'             => $discountedAmount,
            'originalAmount'     => $amountINR,
            'discountPct'        => (int) round($discountPct * 100),
        ]);
    }

    public function verifyPayment(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        if (!$userId)
            Response::error('Unauthorized', 401);

        $orderId = $req->body['orderId'] ?? null;
        if (!$orderId) Response::error('orderId is required', 400);

        $orderIdNum = (int) $orderId;

        $order = Database::queryOne('SELECT * FROM "Order" WHERE id = :id', [':id' => $orderIdNum]);
        if (!$order) Response::error('Order not found', 404);
        if ((int) $order['userId'] !== $userId) Response::error('Forbidden', 403);

        if ($order['status'] === 'PAID')
            Response::json(['success' => true, 'message' => 'Payment already recorded']);
        if (in_array($order['status'], ['FAILED', 'REFUNDED']))
            Response::error("Order is in terminal state: {$order['status']}", 400);

        // Verify payment via Zoho
        $sessionId = $order['gatewayTxId'] ?? '';
        if (!$sessionId) Response::error('No payment session found for this order', 400);
        $sessionStatus = ZohoPaymentService::getSessionStatus($sessionId);
        if ($sessionStatus !== 'paid') Response::error('Payment not completed (status: ' . $sessionStatus . ')', 402);

        // Mark PAID
        $now = date('Y-m-d H:i:s');
        Database::execute(
            'UPDATE "Order" SET status = \'PAID\', paymentId = :sid, updatedAt = :now WHERE id = :id AND status != \'PAID\'',
            [':sid' => $sessionId, ':now' => $now, ':id' => $orderIdNum]
        );

        AuditService::log('PAYMENT_VERIFIED', $userId, null, [
            'zohoSessionId' => $sessionId,
            'planId'        => $order['planId'],
            'amount'        => $order['amount'],
        ]);

        // Provision workspace (demo mode inline)
        if ($order['planId']) {
            try {
                $userRecord = Database::queryOne('SELECT * FROM "User" WHERE id = :id', [':id' => $userId]);
                $wsEmail = $userRecord['email'] ?? "user$userId@webmydrive.com";
                $emailPrefix = explode('@', $wsEmail)[0];
                $basePass = preg_replace('/[^a-z0-9]/i', '', $emailPrefix);
                $tempPassword = ucfirst(strtolower($basePass)) . date('Y');
                $renewalDate = date('Y-m-d H:i:s', strtotime('+1 year'));

                $existingWs = Database::queryOne(
                    'SELECT * FROM "Workspace" WHERE userId = :uid ORDER BY createdAt DESC LIMIT 1',
                    [':uid' => $userId]
                );

                $metaJson = json_encode([
                    'email' => $wsEmail,
                    'tempPassword' => $tempPassword,
                    'provisioned' => 'demo',
                    'orderId' => $orderIdNum,
                    'provisionedAt' => $now,
                ]);

                if (!$existingWs) {
                    Database::insert(
                        'INSERT INTO "Workspace" (userId, planId, status, renewalDate, googleCustomerId, metadata, createdAt, updatedAt)
                         VALUES (:uid, :pid, \'ACTIVE\', :rd, :email, :meta, :now1, :now2)',
                        [':uid' => $userId, ':pid' => $order['planId'], ':rd' => $renewalDate, ':email' => $wsEmail, ':meta' => $metaJson, ':now1' => $now, ':now2' => $now]
                    );
                } elseif ($existingWs['status'] !== 'ACTIVE') {
                    Database::execute(
                        'UPDATE "Workspace" SET status = \'ACTIVE\', planId = :pid, googleCustomerId = :email, metadata = :meta, updatedAt = :now WHERE id = :id',
                        [':pid' => $order['planId'], ':email' => $wsEmail, ':meta' => $metaJson, ':now' => $now, ':id' => $existingWs['id']]
                    );
                }
            } catch (Throwable $wsErr) {
                Logger::error('[Payment] Workspace provisioning error: ' . $wsErr->getMessage());
                // Non-fatal
            }
        }

        // Process commissions
        $this->processOrderCommission($orderIdNum, $userId);

        Response::json(['success' => true, 'message' => 'Payment verified and workspace activated']);
    }

    public function processPurchase(Request $req): void
    {
        $userId = $req->user['userId'] ?? null;
        $userRole = $req->user['role'] ?? '';

        if (!$userId)
            Response::error('Unauthorized', 401);
        if (!in_array($userRole, ['ADMIN', 'SUPERADMIN']))
            Response::error('Forbidden', 403);

        $orderId = $req->body['orderId'] ?? null;
        $promoCode = (string) ($req->body['promoCode'] ?? '');

        $order = Database::queryOne('SELECT * FROM "Order" WHERE id = :id', [':id' => (int) $orderId]);
        if (!$order)
            Response::error('Order not found', 404);
        if ($order['status'] !== 'PAID')
            Response::error('Order must be PAID to process referral commission', 400);

        $existing = Database::queryOne('SELECT id FROM "ReferralLog" WHERE orderId = :oid', [':oid' => $order['id']]);
        if ($existing)
            Response::error('Referral commission already processed for this order', 409);

        ReferralService::processNewOrder((int) $order['id'], (int) $order['userId'], $promoCode ?: null);
        Response::json(['success' => true, 'message' => 'Referral commission processed']);
    }

    // ── Private ───────────────────────────────────────────────────────────────

    private function processOrderCommission(int $orderIdNum, int $userId): void
    {
        // Look up promo code from audit log (PHP has no shared memory between requests)
        $lockedPromoCode = null;

        $auditLogs = Database::query(
            'SELECT details FROM "AuditLog" WHERE userId = :uid AND action = \'CHECKOUT_PROMO_CODE\' ORDER BY createdAt DESC LIMIT 50',
            [':uid' => $userId]
        );

        foreach ($auditLogs as $log) {
            if (empty($log['details']))
                continue;
            $p = @json_decode($log['details'], true);
            if ($p && isset($p['entityId']) && (string) $p['entityId'] === (string) $orderIdNum && !empty($p['promoCode'])) {
                $lockedPromoCode = $p['promoCode'];
                break;
            }
        }

        if ($lockedPromoCode) {
            if (str_starts_with($lockedPromoCode, 'DIST_')) {
                $parts = explode(':', $lockedPromoCode, 2);
                $distributorId = (int) str_replace('DIST_', '', $parts[0]);
                if ($distributorId > 0) {
                    $order = Database::queryOne('SELECT amount FROM "Order" WHERE id = :id', [':id' => $orderIdNum]);
                    DistributorService::processSale($distributorId, $userId, $orderIdNum, (float) ($order['amount'] ?? 0));
                }
            } else {
                ReferralService::processNewOrder($orderIdNum, $userId, $lockedPromoCode);
            }
        } else {
            // Check for renewal
            $priorRef = Database::queryOne(
                'SELECT id FROM "ReferralLog" WHERE refereeId = :uid LIMIT 1',
                [':uid' => $userId]
            );
            if ($priorRef) {
                ReferralService::processNewOrder($orderIdNum, $userId, null);
            }
        }
    }
}
