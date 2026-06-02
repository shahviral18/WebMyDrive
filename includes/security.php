<?php
/**
 * Security Functions
 * CSRF Protection and Rate Limiting
 */

class Security {
    private static $config;
    
    public static function init($config) {
        self::$config = $config['security'];
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
    }
    
    /**
     * Generate CSRF token
     */
    public static function generateCSRFToken(): string {
        if (empty($_SESSION['csrf_token']) || empty($_SESSION['csrf_token_time']) 
            || (time() - $_SESSION['csrf_token_time']) > self::$config['session_timeout']) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
            $_SESSION['csrf_token_time'] = time();
        }
        return $_SESSION['csrf_token'];
    }
    
    /**
     * Validate CSRF token
     */
    public static function validateCSRFToken(?string $token): bool {
        if (empty($_SESSION['csrf_token']) || empty($token)) {
            self::logSecurityEvent('CSRF validation failed: empty token');
            return false;
        }
        
        if (!hash_equals($_SESSION['csrf_token'], $token)) {
            self::logSecurityEvent('CSRF validation failed: token mismatch');
            return false;
        }
        
        return true;
    }
    
    /**
     * Rate limiting by IP address
     */
    public static function checkRateLimit(string $action, int $maxRequests = null, int $window = null): bool {
        $maxRequests = $maxRequests ?? self::$config['rate_limit_max_requests'];
        $window = $window ?? self::$config['rate_limit_window'];
        
        $ip = self::getClientIP();
        $key = $action . '_' . $ip;
        
        $rateLimitFile = __DIR__ . '/../logs/rate_limit.json';
        
        // Load existing data
        $data = [];
        if (file_exists($rateLimitFile)) {
            $data = json_decode(file_get_contents($rateLimitFile), true) ?? [];
        }
        
        $now = time();
        
        // Clean old entries
        foreach ($data as $k => $v) {
            if (($now - $v['time']) > $window) {
                unset($data[$k]);
            }
        }
        
        // Check current IP
        if (!isset($data[$key])) {
            $data[$key] = ['count' => 0, 'time' => $now];
        }
        
        // Reset if window expired
        if (($now - $data[$key]['time']) > $window) {
            $data[$key] = ['count' => 0, 'time' => $now];
        }
        
        // Increment counter
        $data[$key]['count']++;
        
        // Save data
        file_put_contents($rateLimitFile, json_encode($data));
        
        // Check limit
        if ($data[$key]['count'] > $maxRequests) {
            self::logSecurityEvent("Rate limit exceeded for {$action} from {$ip}");
            return false;
        }
        
        return true;
    }
    
    /**
     * Get client IP address
     */
    public static function getClientIP(): string {
        $ip = 'unknown';
        
        if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
            $ip = $_SERVER['HTTP_CLIENT_IP'];
        } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ip = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0];
        } elseif (!empty($_SERVER['REMOTE_ADDR'])) {
            $ip = $_SERVER['REMOTE_ADDR'];
        }
        
        return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : 'unknown';
    }
    
    /**
     * Log security events
     */
    private static function logSecurityEvent(string $message): void {
        $logFile = '/home/wmdadmin/logs/security.log';
        $timestamp = date('Y-m-d H:i:s');
        $ip = self::getClientIP();
        $entry = "[{$timestamp}] IP:{$ip} - {$message}\n";
        @error_log($entry, 3, $logFile);
    }
    
    /**
     * Generate request ID for tracking
     */
    public static function generateRequestID(): string {
        return uniqid('req_', true);
    }
}
