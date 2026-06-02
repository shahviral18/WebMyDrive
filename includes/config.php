<?php
/**
 * WebMyDrive Configuration
 * Centralized settings for the entire application
 */

return [
    // Site Settings
    'site' => [
        'name' => 'WebMyDrive',
        'url' => 'https://www.webmydrive.com',
        'support_email' => 'support@webmydrive.com',
        'noreply_email' => 'noreply@technodoc.in',
    ],

    // Security Settings
    'security' => [
        'csrf_token_name' => 'csrf_token',
        'session_timeout' => 3600, // 1 hour
        'max_login_attempts' => 5,
        'rate_limit_window' => 300, // 5 minutes
        'rate_limit_max_requests' => 10,
    ],

    // Database Settings (loaded from dbcon.php)
    'database' => [
        'accounts_table' => 'webmydrive_accounts',
        'subscriptions_table' => 'zoho_subscriptions',
    ],

    // Google API Settings
    'google' => [
        'api_path' => __DIR__ . '/../google-api',
        'credentials_file' => __DIR__ . '/../google-api/credentials.json',
        'admin_email' => 'admin@webmydrive.com',
    ],

    // Plans Configuration
    'plans' => [
        'A'  => ['code' => 'A',  'name' => 'Basic',        'storage' => '500 GB',  'cycle' => 'Yearly',  'ou' => '/webmydrive.com/A - Basic - 500GB'],
        'B'  => ['code' => 'B',  'name' => 'Professional', 'storage' => '5 TB',    'cycle' => 'Yearly',  'ou' => '/webmydrive.com/B - Professional - 5TB'],
        'C'  => ['code' => 'C',  'name' => 'Premium',      'storage' => '50 TB',   'cycle' => 'Yearly',  'ou' => '/webmydrive.com/C - Premium - 50TB'],
        'D'  => ['code' => 'D',  'name' => 'Enterprise',   'storage' => '100 TB',  'cycle' => 'Yearly',  'ou' => '/webmydrive.com/D - Enterprise - 100TB'],
        'AM' => ['code' => 'AM', 'name' => 'Basic',        'storage' => '500 GB',  'cycle' => 'Monthly', 'ou' => '/webmydrive.com/A - Basic - 500GB'],
        'AB' => ['code' => 'AB', 'name' => 'Professional', 'storage' => '5 TB',    'cycle' => 'Monthly', 'ou' => '/webmydrive.com/B - Professional - 5TB'],
        'AC' => ['code' => 'AC', 'name' => 'Premium',      'storage' => '50 TB',   'cycle' => 'Monthly', 'ou' => '/webmydrive.com/C - Premium - 50TB'],
        'AD' => ['code' => 'AD', 'name' => 'Enterprise',   'storage' => '100 TB',  'cycle' => 'Monthly', 'ou' => '/webmydrive.com/D - Enterprise - 100TB'],
    ],

    // Logging
    'logging' => [
        'main_log' => '/home/wmdadmin/logs/account_activate.log',
        'error_log' => '/home/wmdadmin/logs/php_errors.log',
        'security_log' => '/home/wmdadmin/logs/security.log',
    ],

    // Email Templates
    'templates' => [
        'welcome_email' => __DIR__ . '/../templates/email-welcome.html',
    ],
];
