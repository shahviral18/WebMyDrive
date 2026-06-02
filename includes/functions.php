<?php
/**
 * Helper Functions
 * Reusable utility functions
 */

/**
 * Safe HTML output
 */
function h($string) {
    return htmlspecialchars((string)$string, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/**
 * Log message with request ID
 */
function log_msg(string $message, string $logFile = null): void {
    global $config, $request_id;
    
    $logFile = $logFile ?? $config['logging']['main_log'];
    $timestamp = date('Y-m-d H:i:s');
    $reqId = $request_id ?? 'N/A';
    $entry = "[{$timestamp}] [{$reqId}] {$message}\n";
    @error_log($entry, 3, $logFile);
}

/**
 * Get plan metadata by code
 */
function getPlanByCode(string $code): ?array {
    global $config;
    return $config['plans'][$code] ?? null;
}

/**
 * Extract plan code from plan name
 */
function extractPlanCodeFromName(string $planName): string {
    $planNameLower = strtolower($planName);
    
    if (strpos($planNameLower, '100') !== false || strpos($planNameLower, 'enterprise') !== false) {
        return 'D';
    } elseif (strpos($planNameLower, '50') !== false || strpos($planNameLower, 'premium') !== false) {
        return 'C';
    } elseif (strpos($planNameLower, '5') !== false || strpos($planNameLower, 'professional') !== false) {
        return 'B';
    } elseif (strpos($planNameLower, '500') !== false || strpos($planNameLower, 'basic') !== false) {
        return 'A';
    }
    
    log_msg("⚠️ Could not determine plan code from: {$planName}, defaulting to A");
    return 'A';
}

/**
 * Convert billing period from DB to display format
 */
function formatBillingPeriod(?string $period): string {
    if (empty($period)) return 'Unknown';
    
    $period = strtolower(trim($period));
    
    if ($period === 'years' || $period === 'year') {
        return 'Yearly';
    } elseif ($period === 'months' || $period === 'month') {
        return 'Monthly';
    }
    
    return ucfirst($period);
}

/**
 * Generate temporary password
 */
function generateTempPassword(int $length = 12): string {
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    $password = '';
    $charCount = strlen($chars);
    
    for ($i = 0; $i < $length; $i++) {
        $password .= $chars[random_int(0, $charCount - 1)];
    }
    
    return $password;
}

/**
 * Parse redirect token from Zoho
 */
function parseRedirectToken(): ?array {
    try {
        $qs = $_SERVER['QUERY_STRING'] ?? '';
        
        if ($qs === '') {
            if (!empty($_SERVER['REQUEST_URI'])) {
                $parts = explode('?', $_SERVER['REQUEST_URI'], 2);
                $qs = $parts[1] ?? '';
            }
        }
        
        if ($qs === '') return null;
        
        $first = explode('&', $qs, 2)[0];
        if ($first === '') return null;
        
        $decoded = urldecode($first);
        
        if (preg_match('/^(\d+)(.*)$/s', $decoded, $m)) {
            return [
                'subscription_id' => $m[1],
                'plan_name' => trim($m[2])
            ];
        }
        
        return null;
    } catch (Exception $e) {
        log_msg("Error parsing redirect token: " . $e->getMessage());
        return null;
    }
}

/**
 * Send email using template
 */
function sendTemplatedEmail(string $to, string $subject, string $templateFile, array $data): bool {
    global $config;
    
    try {
        // Load template
        if (!file_exists($templateFile)) {
            log_msg("Email template not found: {$templateFile}");
            return false;
        }
        
        $template = file_get_contents($templateFile);
        
        // Replace placeholders
        foreach ($data as $key => $value) {
            $template = str_replace("{{" . $key . "}}", h($value), $template);
        }
        
        // Email headers
        $headers = "From: " . $config['site']['name'] . " <" . $config['site']['noreply_email'] . ">\r\n";
        $headers .= "MIME-Version: 1.0\r\n";
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
        
        $sent = mail($to, $subject, $template, $headers);
        
        if ($sent) {
            log_msg("✅ Email sent to {$to}");
        } else {
            log_msg("⚠️ Failed to send email to {$to}");
        }
        
        return $sent;
    } catch (Exception $e) {
        log_msg("❌ Email error: " . $e->getMessage());
        return false;
    }
}
