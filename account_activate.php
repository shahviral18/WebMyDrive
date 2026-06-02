<?php
/**
 * Account Activation Page - PRODUCTION VERSION v2.1
 * 
 * NEW in v2.1:
 * - Added subscription_id duplicate check (prevents multiple accounts per subscription)
 * - Shows friendly "already exists" page with existing account details
 * 
 * Features:
 * - CSRF Protection
 * - Rate Limiting
 * - Enhanced Error Handling
 * - Proper Validation
 * - Better Logging
 * - HTML Email Templates
 * - Subscription Duplicate Prevention
 */

declare(strict_types=1);
error_reporting(E_ALL);
ini_set('display_errors', '0'); // Change to '1' for debugging

// Load configuration and dependencies
$config = require __DIR__ . '/includes/config.php';
require_once __DIR__ . '/../websiteconfig/dbcon.php';
require_once __DIR__ . '/includes/security.php';
require_once __DIR__ . '/includes/validator.php';
require_once __DIR__ . '/includes/functions.php';

// Initialize
$mysqli = db_get_mysqli();
$request_id = Security::generateRequestID();
Security::init($config);

log_msg("=== NEW REQUEST ===");
log_msg("IP: " . Security::getClientIP());
log_msg("User Agent: " . ($_SERVER['HTTP_USER_AGENT'] ?? 'unknown'));

$start_time = microtime(true);

// Form retention
$form_data = [
    'desired_email' => $_POST['desired_email'] ?? '',
    'first_name' => $_POST['first_name'] ?? '',
    'last_name' => $_POST['last_name'] ?? '',
    'recovery_email' => $_POST['recovery_email'] ?? '',
    'mobile' => $_POST['mobile'] ?? '',
    'payment_email' => $_POST['payment_email'] ?? ''
];

// State variables
$show_form = false;
$account_created = false;
$account_exists = false; // NEW: For "already exists" page
$existing_account_data = []; // NEW: Store existing account info
$creation_error = '';
$account_data = [];
$redirect_data = null;

/**
 * Create Google Workspace Account
 */
function createGoogleWorkspaceAccount(array $userData): array {
    global $config;
    
    log_msg("🔄 Starting Google Workspace user creation for: " . $userData['user_email']);
    
    try {
        $autoloadPath = $config['google']['api_path'] . '/vendor/autoload.php';
        if (!file_exists($autoloadPath)) {
            throw new Exception("Google API library not found");
        }
        require_once $autoloadPath;
        
        $credentialsPath = $config['google']['credentials_file'];
        if (!file_exists($credentialsPath)) {
            throw new Exception("Credentials file not found");
        }
        
        $client = new Google_Client();
        $client->setApplicationName($config['site']['name'] . ' Account Creator');
        $client->setAuthConfig($credentialsPath);
        $client->setScopes([
            'https://www.googleapis.com/auth/admin.directory.user',
            'https://www.googleapis.com/auth/admin.directory.orgunit'
        ]);
        $client->setSubject($config['google']['admin_email']);
        
        $service = new Google_Service_Directory($client);

        $user = new Google_Service_Directory_User();
        $user->setPrimaryEmail($userData['user_email']);

        $userName = new Google_Service_Directory_UserName();
        $userName->setGivenName($userData['first_name']);
        $userName->setFamilyName($userData['last_name']);
        $userName->setFullName($userData['first_name'] . ' ' . $userData['last_name']);
        $user->setName($userName);

        $tempPassword = generateTempPassword();
        $user->setPassword($tempPassword);
        $user->setChangePasswordAtNextLogin(true);

        $user->setOrgUnitPath($userData['org_unit_path']);
        $user->setRecoveryEmail($userData['recovery_email']);

        if (!empty($userData['mobile'])) {
            $phone = new Google_Service_Directory_UserPhone();
            $phone->setType('mobile');
            $phone->setValue('+91' . $userData['mobile']);
            $user->setPhones([$phone]);
        }

        log_msg("⏳ Calling Google API to create user in OU: " . $userData['org_unit_path']);
        $createdUser = $service->users->insert($user);
        log_msg("✅ Google account created successfully");

        return [
            'user_id' => $createdUser->getId(),
            'primary_email' => $createdUser->getPrimaryEmail(),
            'temp_password' => $tempPassword,
            'status' => 'CREATED'
        ];

    } catch (Exception $e) {
        log_msg("❌ Google API Error: " . $e->getMessage());
        throw new Exception("Failed to create Google Workspace account. Please contact support.");
    }
}

/**
 * Fetch subscription details from database
 */
function fetchSubscriptionDetails($mysqli, string $subscriptionId): ?array {
    global $config;
    
    if (empty($subscriptionId)) return null;
    
    try {
        $stmt = $mysqli->prepare('SELECT plan_name, plan_code, billing_period FROM ' . $config['database']['subscriptions_table'] . ' WHERE subscription_id = ? LIMIT 1');
        
        if (!$stmt) {
            log_msg("⚠️ Failed to prepare query: " . $mysqli->error);
            return null;
        }
        
        $stmt->bind_param('s', $subscriptionId);
        
        if (!$stmt->execute()) {
            log_msg("⚠️ Failed to execute query: " . $stmt->error);
            $stmt->close();
            return null;
        }
        
        $result = $stmt->get_result();
        
        if ($result && $result->num_rows > 0) {
            $data = $result->fetch_assoc();
            $stmt->close();
            
            // Convert billing_period to display format
            $data['billing_cycle'] = formatBillingPeriod($data['billing_period'] ?? null);
            
            log_msg("✅ Fetched subscription: Plan=" . ($data['plan_name'] ?? 'N/A') . ", Billing=" . $data['billing_cycle']);
            return $data;
        }
        
        $stmt->close();
        log_msg("⚠️ Subscription not found for ID: {$subscriptionId}");
        return null;
        
    } catch (Exception $e) {
        log_msg("❌ Error fetching subscription: " . $e->getMessage());
        return null;
    }
}

// Parse redirect from Zoho
$redirect_token = parseRedirectToken();

if ($redirect_token) {
    $subscriptionId = $redirect_token['subscription_id'];
    $planName = $redirect_token['plan_name'];
    $planCode = extractPlanCodeFromName($planName);
    
    log_msg("🔗 Zoho redirect detected");
    log_msg("   Subscription ID: {$subscriptionId}");
    log_msg("   Plan Name: {$planName}");
    log_msg("   Extracted Plan Code: {$planCode}");
    
    $redirect_data = [
        'subscription_id' => $subscriptionId,
        'plan_name' => $planName,
        'plan_code' => $planCode
    ];
    
    // Fetch actual subscription details
    try {
        $subDetails = fetchSubscriptionDetails($mysqli, $subscriptionId);
        if ($subDetails && is_array($subDetails)) {
            $redirect_data['actual_plan_name'] = $subDetails['plan_name'] ?? null;
            $redirect_data['actual_billing_cycle'] = $subDetails['billing_cycle'] ?? null;
            if (!empty($subDetails['plan_code'])) {
                $redirect_data['plan_code'] = $subDetails['plan_code'];
            }
        }
    } catch (Exception $e) {
        log_msg("⚠️ Error fetching subscription: " . $e->getMessage());
    }
    
    $show_form = true;
}

// POST: Manual email lookup
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['payment_email']) && !isset($_POST['desired_email'])) {
    
    // CSRF Check
    if (!Security::validateCSRFToken($_POST['csrf_token'] ?? '')) {
        $creation_error = 'Invalid request. Please try again.';
        log_msg("❌ CSRF validation failed for email lookup");
    }
    // Rate Limit Check
    elseif (!Security::checkRateLimit('email_lookup', 10, 300)) {
        $creation_error = 'Too many requests. Please wait a few minutes and try again.';
        log_msg("❌ Rate limit exceeded for email lookup");
    }
    else {
        $paymentEmail = trim($_POST['payment_email'] ?? '');
        
        log_msg("=== 🔍 Manual email lookup ===");
        log_msg("   Email: {$paymentEmail}");
        
        if (!Validator::email($paymentEmail)) {
            $creation_error = 'Please enter a valid email address.';
        } else {
            try {
                $stmt = $mysqli->prepare('SELECT * FROM ' . $config['database']['subscriptions_table'] . ' WHERE customer_email = ? ORDER BY purchase_date DESC LIMIT 1');
                
                if ($stmt) {
                    $stmt->bind_param('s', $paymentEmail);
                    $stmt->execute();
                    $result = $stmt->get_result();
                    
                    if ($result && $result->num_rows > 0) {
                        $subscription = $result->fetch_assoc();
                        log_msg("✅ Found subscription for email");
                        
                        $planCode = $subscription['plan_code'] ?? extractPlanCodeFromName($subscription['plan_name'] ?? '');
                        $billingCycle = formatBillingPeriod($subscription['billing_period'] ?? null);
                        
                        $redirect_data = [
                            'subscription_id' => $subscription['subscription_id'] ?? '',
                            'plan_name' => $subscription['plan_name'] ?? 'Unknown Plan',
                            'plan_code' => $planCode,
                            'actual_plan_name' => $subscription['plan_name'] ?? null,
                            'actual_billing_cycle' => $billingCycle
                        ];
                        
                        $show_form = true;
                    } else {
                        $creation_error = 'No subscription found for this email address. Please check your email or contact support if you recently completed payment.';
                        log_msg("❌ No subscription found for: {$paymentEmail}");
                    }
                    $stmt->close();
                }
            } catch (Exception $e) {
                $creation_error = 'Database error. Please contact support.';
                log_msg("❌ Database error: " . $e->getMessage());
            }
        }
    }
}

// POST: Account creation
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['desired_email'])) {
    
    // CSRF Check
    if (!Security::validateCSRFToken($_POST['csrf_token'] ?? '')) {
        $creation_error = 'Invalid request. Please refresh the page and try again.';
        log_msg("❌ CSRF validation failed for account creation");
        $show_form = true;
    }
    // Rate Limit Check
    elseif (!Security::checkRateLimit('account_creation', 3, 300)) {
        $creation_error = 'Too many account creation attempts. Please wait 5 minutes and try again.';
        log_msg("❌ Rate limit exceeded for account creation");
        $show_form = true;
    }
    else {
        $firstName = trim($_POST['first_name'] ?? '');
        $lastName = trim($_POST['last_name'] ?? '');
        $mobile = trim($_POST['mobile'] ?? '');
        $recoveryEmail = trim($_POST['recovery_email'] ?? '');
        $desiredUsername = strtolower(trim($_POST['desired_email'] ?? ''));
        $desiredEmail = $desiredUsername . '@webmydrive.com';
        $planCode = trim($_POST['plan_code'] ?? '');
        $subscriptionId = trim($_POST['subscription_id'] ?? '');
        $planName = trim($_POST['plan_name'] ?? '');

        log_msg("=== 📝 Account creation requested ===");
        log_msg("   Email: {$desiredEmail}");
        log_msg("   Plan Code: {$planCode}");
        log_msg("   Subscription ID: {$subscriptionId}");

        // Validate using Validator class
        $errors = Validator::validateAccountForm([
            'first_name' => $firstName,
            'last_name' => $lastName,
            'mobile' => $mobile,
            'recovery_email' => $recoveryEmail,
            'desired_email' => $desiredUsername,
            'plan_code' => $planCode
        ]);

        if (!empty($errors)) {
            $creation_error = implode('<br>', $errors);
            log_msg("❌ Validation failed");
            $show_form = true;
            
            $redirect_data = [
                'subscription_id' => $subscriptionId,
                'plan_name' => $planName,
                'plan_code' => $planCode
            ];
        } else {
            
            // NEW: Check if subscription already has an account (OPTION A - Check First!)
            log_msg("🔍 Step 1: Checking if subscription already has an account: {$subscriptionId}");
            
            $stmt = $mysqli->prepare('SELECT wmdemailid, first_name, last_name FROM ' . $config['database']['accounts_table'] . ' WHERE subscription_id = ? LIMIT 1');
            
            if (!$stmt) {
                $creation_error = 'Database error. Please contact support.';
                $show_form = true;
                log_msg("❌ Failed to prepare subscription check query: " . $mysqli->error);
            } else {
                $stmt->bind_param('s', $subscriptionId);
                $stmt->execute();
                $result = $stmt->get_result();
                
                if ($result && $result->num_rows > 0) {
                    // Account already exists for this subscription!
                    $existing = $result->fetch_assoc();
                    $stmt->close();
                    
                    log_msg("⚠️ Subscription {$subscriptionId} already has an account: {$existing['wmdemailid']}");
                    
                    // Show special "already created" page
                    $account_exists = true;
                    $existing_account_data = [
                        'email' => $existing['wmdemailid'],
                        'first_name' => $existing['first_name'],
                        'last_name' => $existing['last_name'],
                        'subscription_id' => $subscriptionId
                    ];
                    
                    // Don't show form or error
                    $show_form = false;
                    $creation_error = '';
                    
                } else {
                    $stmt->close();
                    
                    // Continue: Check for duplicate email username
                    log_msg("✅ Step 1 passed: Subscription has no existing account");
                    log_msg("🔍 Step 2: Checking if email username is available");
                    
                    $stmt = $mysqli->prepare('SELECT COUNT(*) FROM ' . $config['database']['accounts_table'] . ' WHERE wmdemailid = ?');
                    
                    if (!$stmt) {
                        $creation_error = 'Database error. Please contact support.';
                        $show_form = true;
                    } else {
                        $stmt->bind_param('s', $desiredEmail);
                        $stmt->execute();
                        $stmt->bind_result($count);
                        $stmt->fetch();
                        $stmt->close();

                        if ($count > 0) {
                            $creation_error = 'That email address is already in use. Please choose a different username.';
                            log_msg("❌ Email exists: {$desiredEmail}");
                            $show_form = true;
                            
                            $redirect_data = [
                                'subscription_id' => $subscriptionId,
                                'plan_name' => $planName,
                                'plan_code' => $planCode
                            ];
                        } else {
                            // All checks passed - Create account!
                            log_msg("✅ Step 2 passed: Email username is available");
                            log_msg("🚀 Proceeding with account creation...");
                            
                            try {
                                $planMeta = getPlanByCode($planCode);
                                $orgUnitPath = $planMeta['ou'] ?? '/webmydrive.com/Users';
                                
                                log_msg("📁 Using OU path: {$orgUnitPath}");
                                
                                // Create Google account
                                $googleResult = createGoogleWorkspaceAccount([
                                    'first_name' => $firstName,
                                    'last_name' => $lastName,
                                    'mobile' => $mobile,
                                    'recovery_email' => $recoveryEmail,
                                    'user_email' => $desiredEmail,
                                    'org_unit_path' => $orgUnitPath
                                ]);

                                $googleId = $googleResult['user_id'];
                                $tempPassword = $googleResult['temp_password'];

                                // Save to database
                                $stmt = $mysqli->prepare('INSERT INTO ' . $config['database']['accounts_table'] . ' (wmdemailid, emailid, first_name, last_name, phone, plan_name, plan_code, subscription_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "active")');
                                
                                if (!$stmt) {
                                    throw new Exception("Database error: " . $mysqli->error);
                                }
                                
                                $stmt->bind_param('ssssssss', $desiredEmail, $recoveryEmail, $firstName, $lastName, $mobile, $planName, $planCode, $subscriptionId);
                                
                                if (!$stmt->execute()) {
                                    throw new Exception("Failed to save account: " . $stmt->error);
                                }
                                
                                $stmt->close();
                                log_msg("✅ Database record created");

                                // Send welcome email using template
                                sendTemplatedEmail(
                                    $recoveryEmail,
                                    'Welcome to WebMyDrive - Your Account is Ready!',
                                    $config['templates']['welcome_email'],
                                    [
                                        'first_name' => $firstName,
                                        'email' => $desiredEmail,
                                        'password' => $tempPassword,
                                        'plan' => $planName
                                    ]
                                );

                                // Success!
                                $account_created = true;
                                $account_data = [
                                    'email' => $desiredEmail,
                                    'password' => $tempPassword,
                                    'first_name' => $firstName,
                                    'mobile' => $mobile,
                                    'recovery' => $recoveryEmail,
                                    'plan' => $planName,
                                    'plan_code' => $planCode,
                                    'google_id' => $googleId
                                ];
                                
                                $form_data = ['desired_email' => '', 'first_name' => '', 'last_name' => '', 'recovery_email' => '', 'mobile' => '', 'payment_email' => ''];
                                
                                log_msg("=== ✅ Account creation SUCCESS ===");

                            } catch (Exception $e) {
                                $creation_error = 'An error occurred. Please contact support@webmydrive.com';
                                log_msg("❌ Account creation failed: " . $e->getMessage());
                                
                                $show_form = true;
                                $redirect_data = [
                                    'subscription_id' => $subscriptionId,
                                    'plan_name' => $planName,
                                    'plan_code' => $planCode
                                ];
                            }
                        }
                    }
                }
            }
        }
    }
}

$pageTitle = $account_created ? 'Account Created' : ($account_exists ? 'Account Already Exists' : ($show_form ? 'Create Your Account' : 'Welcome'));

// Log request completion time
$endTime = microtime(true);
log_msg("Request completed in " . round($endTime - $start_time, 3) . "s");
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title><?= h($pageTitle) ?> - <?= h($config['site']['name']) ?></title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        'brand-primary': '#1bb2e2',
                        'brand-secondary': '#fba02f'
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
    <div class="min-h-screen flex items-center justify-center p-4">
        <div class="max-w-2xl w-full">
            
            <?php if ($creation_error): ?>
                <div class="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md shadow">
                    <div class="flex">
                        <svg class="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                        </svg>
                        <div class="ml-3">
                            <p class="text-sm font-medium"><?= $creation_error ?></p>
                        </div>
                    </div>
                </div>
            <?php endif; ?>
            
            <?php if ($account_exists): ?>
                <!-- ACCOUNT ALREADY EXISTS PAGE -->
                <div class="bg-white rounded-lg shadow-2xl p-8">
                    <div class="text-center mb-6">
                        <div class="w-20 h-20 bg-blue-100 rounded-full mx-auto flex items-center justify-center">
                            <svg class="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                        </div>
                        <h2 class="text-3xl font-bold text-blue-600 mt-4">Account Already Created</h2>
                        <p class="text-gray-600 mt-2">Good news! Your account has already been set up.</p>
                    </div>

                    <div class="space-y-4">
                        <div class="p-5 bg-blue-50 border-2 border-blue-200 rounded-lg">
                            <p class="text-sm font-medium text-gray-700 mb-3">Your Existing Account Details:</p>
                            <div class="space-y-2">
                                <div class="flex items-center">
                                    <svg class="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                                    </svg>
                                    <span class="text-gray-700"><strong>Name:</strong> <?= h($existing_account_data['first_name']) ?> <?= h($existing_account_data['last_name']) ?></span>
                                </div>
                                <div class="flex items-center">
                                    <svg class="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                    </svg>
                                    <span class="text-gray-700"><strong>Email:</strong> <span class="font-mono text-blue-900"><?= h($existing_account_data['email']) ?></span></span>
                                </div>
                            </div>
                        </div>

                        <div class="p-5 bg-gray-50 rounded-lg border border-gray-200">
                            <h3 class="font-bold text-gray-900 mb-3 flex items-center">
                                <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                                </svg>
                                Forgot Your Password?
                            </h3>
                            <ol class="list-decimal list-inside space-y-2 text-gray-700 ml-4 text-sm">
                                <li>Visit <a href="https://accounts.google.com/recovery" target="_blank" class="text-blue-600 hover:underline font-semibold">accounts.google.com/recovery</a></li>
                                <li>Enter your email: <strong class="font-mono text-sm"><?= h($existing_account_data['email']) ?></strong></li>
                                <li>Follow Google's password reset instructions</li>
                            </ol>
                        </div>

                        <div class="p-4 bg-indigo-50 border-l-4 border-indigo-500 text-sm">
                            <p class="text-indigo-900 font-semibold mb-2">📞 Need Help?</p>
                            <p class="text-indigo-800">If you're having trouble accessing your account, our support team is here to help:</p>
                            <div class="mt-2 space-y-1">
                                <p class="text-indigo-900"><strong>Email:</strong> <a href="mailto:<?= h($config['site']['support_email']) ?>" class="hover:underline"><?= h($config['site']['support_email']) ?></a></p>
                                <p class="text-indigo-900"><strong>Phone:</strong> <a href="tel:+919825027360" class="hover:underline">+91-9825027360</a></p>
                                <p class="text-indigo-700 text-xs">Mon-Fri: 9:30 AM - 6:30 PM</p>
                            </div>
                        </div>
                    </div>

                    <div class="mt-6 text-center">
                        <a href="<?= h($config['site']['url']) ?>" class="inline-flex items-center px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-blue-600 transition font-semibold">
                            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                            </svg>
                            Back to Homepage
                        </a>
                    </div>
                </div>
            
            <?php elseif ($account_created): ?>
                <!-- SUCCESS PAGE (existing code unchanged) -->
                <div class="bg-white rounded-lg shadow-2xl p-8">
                    <div class="text-center mb-6">
                        <div class="w-20 h-20 bg-green-100 rounded-full mx-auto flex items-center justify-center">
                            <svg class="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                        </div>
                        <h2 class="text-3xl font-bold text-green-600 mt-4">🎉 Account Created!</h2>
                        <p class="text-gray-600 mt-2">Welcome to <?= h($config['site']['name']) ?>, <?= h($account_data['first_name']) ?>!</p>
                    </div>

                    <div class="space-y-4">
                        <div class="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                            <p class="text-sm font-medium text-gray-700 mb-1">Your Google Workspace Email:</p>
                            <p class="text-xl font-mono font-bold text-blue-900"><?= h($account_data['email']) ?></p>
                        </div>

                        <div class="p-5 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
                            <div class="flex items-start">
                                <svg class="w-6 h-6 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                                </svg>
                                <div class="flex-1">
                                    <p class="font-bold text-yellow-900 mb-2">Save Your Temporary Password!</p>
                                    <div class="bg-white p-4 rounded border-2 border-yellow-300 mb-3">
                                        <p class="text-3xl font-mono font-bold text-gray-900 select-all break-all"><?= h($account_data['password']) ?></p>
                                    </div>
                                    <p class="text-sm text-yellow-800">⚠️ You must change this password on your first login.</p>
                                </div>
                            </div>
                        </div>

                        <div class="p-5 bg-gray-50 rounded-lg border border-gray-200">
                            <h3 class="font-bold text-gray-900 mb-4 flex items-center">
                                <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                </svg>
                                Next Steps
                            </h3>

                            <!-- Gmail Login Button with AddSession -->
                            <div class="mb-6">
                                <a href="https://accounts.google.com/AddSession?Email=<?= urlencode($account_data['email']) ?>&continue=https://mail.google.com/mail/" 
                                   target="_blank"
                                   class="w-full inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-200">
                                    <svg class="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                                    </svg>
                                    🚀 Login to Your Gmail Now
                                </a>
                            </div>

                            <!-- Warning About Multiple Accounts -->
                            <div class="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
                                <div class="flex items-start">
                                    <svg class="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                                    </svg>
                                    <div>
                                        <p class="text-sm font-semibold text-yellow-800 mb-1">Already logged into Gmail?</p>
                                        <p class="text-sm text-yellow-700">
                                            The button will show the account chooser. Click <strong>"Add Account"</strong> or <strong>"Use another account"</strong> to login with your new WebMyDrive email.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <!-- Step by Step -->
                            <div class="bg-gray-50 rounded-lg p-4">
                                <p class="text-sm font-semibold text-gray-800 mb-3">📋 Step-by-Step Guide:</p>
                                <div class="space-y-2 text-sm text-gray-700">
                                    <div class="flex items-start">
                                        <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs mr-3 flex-shrink-0">1</span>
                                        <span>Click the <strong>"Login to Your Gmail Now"</strong> button above</span>
                                    </div>
                                    <div class="flex items-start">
                                        <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs mr-3 flex-shrink-0">2</span>
                                        <span>Choose <strong>"Add Account"</strong> and enter <strong class="font-mono text-xs"><?= h($account_data['email']) ?></strong></span>
                                    </div>
                                    <div class="flex items-start">
                                        <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs mr-3 flex-shrink-0">3</span>
                                        <span>Use the temporary password shown above</span>
                                    </div>
                                    <div class="flex items-start">
                                        <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs mr-3 flex-shrink-0">4</span>
                                        <span>Create a new password when prompted</span>
                                    </div>
                                    <div class="flex items-start">
                                        <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs mr-3 flex-shrink-0">5</span>
                                        <span>Access files at <a href="https://drive.google.com" target="_blank" class="text-blue-600 hover:underline font-semibold">Google Drive</a></span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="p-4 bg-blue-50 border-l-4 border-blue-500 text-sm">
                            <p class="text-blue-900"><strong>📧 Confirmation Email:</strong> Sent to <strong><?= h($account_data['recovery']) ?></strong></p>
                            <p class="text-blue-700 mt-1 text-xs">Check your inbox and spam folder.</p>
                        </div>

                        <div class="grid grid-cols-2 gap-4 p-4 bg-gray-100 rounded text-sm">
                            <div>
                                <p class="text-gray-600">Plan:</p>
                                <p class="font-semibold"><?= h($account_data['plan']) ?></p>
                            </div>
                            <div>
                                <p class="text-gray-600">Plan Code:</p>
                                <p class="font-semibold"><?= h($account_data['plan_code']) ?></p>
                            </div>
                            <div>
                                <p class="text-gray-600">Mobile:</p>
                                <p class="font-semibold">+91 <?= h($account_data['mobile']) ?></p>
                            </div>
                            <div>
                                <p class="text-gray-600">Status:</p>
                                <p class="font-semibold">✅ Active</p>
                            </div>
                        </div>
                    </div>

                    <div class="mt-6 text-center text-sm text-gray-500 border-t pt-4">
                        Need help? Email us at <a href="mailto:<?= h($config['site']['support_email']) ?>" class="text-blue-600 hover:underline"><?= h($config['site']['support_email']) ?></a>
                    </div>
                </div>
            
            <?php elseif ($show_form && $redirect_data): ?>
                <!-- ACCOUNT CREATION FORM (existing code - continues in next part due to length...) -->
<!-- Continuing from previous part... -->

                <div class="bg-white rounded-lg shadow-2xl p-8">
                    <div class="text-center mb-6">
                        <h1 class="text-3xl font-bold text-gray-900">Create Your Account</h1>
                        <p class="text-gray-600 mt-2">Let's set up your Google Workspace account</p>
                    </div>
                    
                    <div class="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
                        <h3 class="font-bold text-gray-900 mb-3 flex items-center">
                            <svg class="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                                <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
                            </svg>
                            Your Plan Details
                        </h3>
                        <?php $planMeta = getPlanByCode($redirect_data['plan_code']); ?>
                        <div class="grid grid-cols-3 gap-3">
                            <div>
                                <p class="text-xs text-gray-600">Plan</p>
                                <p class="font-bold text-gray-900"><?= h($redirect_data['actual_plan_name'] ?? $planMeta['name']) ?></p>
                            </div>
                            <div>
                                <p class="text-xs text-gray-600">Storage</p>
                                <p class="font-bold text-gray-900"><?= h($planMeta['storage']) ?></p>
                            </div>
                            <div>
                                <p class="text-xs text-gray-600">Billing</p>
                                <p class="font-bold text-gray-900"><?= h($redirect_data['actual_billing_cycle'] ?? 'Verifying...') ?></p>
                            </div>
                        </div>
                    </div>
                    
                    <form method="post" class="space-y-5">
                        <input type="hidden" name="csrf_token" value="<?= Security::generateCSRFToken() ?>">
                        <input type="hidden" name="subscription_id" value="<?= h($redirect_data['subscription_id']) ?>">
                        <input type="hidden" name="plan_name" value="<?= h($redirect_data['plan_name']) ?>">
                        <input type="hidden" name="plan_code" value="<?= h($redirect_data['plan_code']) ?>">
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label for="first_name" class="block text-sm font-semibold text-gray-700 mb-1">First Name *</label>
                                <input type="text" id="first_name" name="first_name" value="<?= h($form_data['first_name']) ?>" required class="block w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition" placeholder="John">
                            </div>
                            
                            <div>
                                <label for="last_name" class="block text-sm font-semibold text-gray-700 mb-1">Last Name *</label>
                                <input type="text" id="last_name" name="last_name" value="<?= h($form_data['last_name']) ?>" required class="block w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition" placeholder="Doe">
                            </div>
                        </div>
                        
                        <div>
                            <label for="mobile" class="block text-sm font-semibold text-gray-700 mb-1">Mobile Number *</label>
                            <div class="flex">
                                <span class="inline-flex items-center px-4 rounded-l-lg border-2 border-r-0 border-gray-300 bg-gray-100 text-gray-700 font-semibold">+91</span>
                                <input type="text" id="mobile" name="mobile" value="<?= h($form_data['mobile']) ?>" required pattern="[6-9][0-9]{9}" maxlength="10" class="flex-1 block w-full border-2 border-gray-300 rounded-r-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition" placeholder="9876543210">
                            </div>
                            <p class="mt-1 text-xs text-gray-500">10-digit number starting with 6, 7, 8, or 9</p>
                        </div>
                        
                        <div>
                            <label for="recovery_email" class="block text-sm font-semibold text-gray-700 mb-1">Recovery Email *</label>
                            <input type="email" id="recovery_email" name="recovery_email" value="<?= h($form_data['recovery_email']) ?>" required class="block w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition" placeholder="your-personal@email.com">
                            <p class="mt-1 text-xs text-gray-500">Use your personal email for account recovery</p>
                        </div>
                        
                        <div>
                            <label for="desired_email" class="block text-sm font-semibold text-gray-700 mb-1">Choose Your Email *</label>
                            <div class="flex">
                                <input type="text" id="desired_email" name="desired_email" value="<?= h($form_data['desired_email']) ?>" required pattern="[a-zA-Z0-9._-]+" minlength="3" maxlength="30" class="flex-1 block w-full border-2 border-gray-300 rounded-l-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition" placeholder="yourname">
                                <span class="inline-flex items-center px-4 rounded-r-lg border-2 border-l-0 border-gray-300 bg-gray-100 text-gray-700 font-semibold">@webmydrive.com</span>
                            </div>
                            <p class="mt-1 text-xs text-gray-500">3-30 characters: letters, numbers, dots, hyphens, underscores</p>
                        </div>
                        
                        <div class="pt-4">
                            <button type="submit" class="w-full bg-brand-primary hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-200 flex items-center justify-center">
                                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                                </svg>
                                Create My Account
                            </button>
                        </div>
                    </form>
                    
                    <div class="mt-6 text-center text-sm text-gray-500 border-t pt-4">
                        Need help? Email <a href="mailto:<?= h($config['site']['support_email']) ?>" class="text-blue-600 hover:underline"><?= h($config['site']['support_email']) ?></a>
                    </div>
                </div>
            
            <?php else: ?>
                <!-- EMAIL LOOKUP FORM (existing code unchanged) -->
                <div class="bg-white rounded-lg shadow-2xl p-8">
                    <div class="text-center mb-6">
                        <svg class="mx-auto h-16 w-16 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <h3 class="mt-4 text-2xl font-bold text-gray-900">Welcome to <?= h($config['site']['name']) ?></h3>
                        <p class="mt-2 text-gray-600">Please complete your payment to create your account.</p>
                    </div>
                    
                    <div class="mt-8 p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
                        <h4 class="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                            <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            Already Paid?
                        </h4>
                        <p class="text-sm text-gray-600 mb-4">Enter your payment email to fetch your subscription details and create your account.</p>
                        
                        <form method="post" class="space-y-4">
                            <input type="hidden" name="csrf_token" value="<?= Security::generateCSRFToken() ?>">
                            <div>
                                <label for="payment_email" class="block text-sm font-semibold text-gray-700 mb-1">Payment Email Address</label>
                                <input type="email" id="payment_email" name="payment_email" value="<?= h($form_data['payment_email']) ?>" required class="block w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition" placeholder="you@example.com">
                                <p class="mt-1 text-xs text-gray-500">Use the same email you provided during payment</p>
                            </div>
                            
                            <button type="submit" class="w-full bg-brand-primary hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-200 flex items-center justify-center">
                                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                                </svg>
                                Find My Subscription
                            </button>
                        </form>
                    </div>
                    
                    <div class="mt-8 text-center">
                        <p class="text-sm text-gray-500 mb-4">Haven't completed payment yet?</p>
                        <a href="<?= h($config['site']['url']) ?>" class="inline-flex items-center px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition">
                            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                            </svg>
                            Go to Homepage
                        </a>
                    </div>
                    
                    <div class="mt-6 text-center text-xs text-gray-500 border-t pt-4">
                        Need help? Email <a href="mailto:<?= h($config['site']['support_email']) ?>" class="text-blue-600 hover:underline"><?= h($config['site']['support_email']) ?></a>
                    </div>
                </div>
            <?php endif; ?>
            
        </div>
    </div>

    <script>
        const emailInput = document.getElementById('desired_email');
        if (emailInput) {
            emailInput.addEventListener('input', function() {
                this.value = this.value.toLowerCase().replace(/[^a-z0-9._-]/g, '');
            });
        }

        const mobileInput = document.getElementById('mobile');
        if (mobileInput) {
            mobileInput.addEventListener('input', function() {
                this.value = this.value.replace(/[^0-9]/g, '').slice(0, 10);
            });
        }
    </script>
</body>
</html>
