<?php
/**
 * Input Validator Class
 * Centralized validation logic
 */

class Validator {
    
    /**
     * Validate Indian mobile number
     */
    public static function mobileNumber(string $mobile): bool {
        $mobile = trim($mobile);
        return preg_match('/^[6-9][0-9]{9}$/', $mobile) === 1;
    }
    
    /**
     * Validate email username (before @webmydrive.com)
     */
    public static function emailUsername(string $username): bool {
        $username = trim($username);
        return preg_match('/^[a-z0-9._-]{3,30}$/i', $username) === 1;
    }
    
    /**
     * Validate email address
     */
    public static function email(string $email): bool {
        return filter_var(trim($email), FILTER_VALIDATE_EMAIL) !== false;
    }
    
    /**
     * Validate name (first/last)
     */
    public static function name(string $name): bool {
        $name = trim($name);
        return !empty($name) && strlen($name) >= 2 && strlen($name) <= 50;
    }
    
    /**
     * Validate plan code
     */
    public static function planCode(string $code): bool {
        $validCodes = ['A', 'B', 'C', 'D', 'AM', 'AB', 'AC', 'AD'];
        return in_array(trim($code), $validCodes, true);
    }
    
    /**
     * Sanitize string
     */
    public static function sanitizeString(string $input): string {
        return htmlspecialchars(trim($input), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
    
    /**
     * Validate and return errors for account creation form
     */
    public static function validateAccountForm(array $data): array {
        $errors = [];
        
        if (!self::name($data['first_name'] ?? '')) {
            $errors[] = 'First name must be 2-50 characters';
        }
        
        if (!self::name($data['last_name'] ?? '')) {
            $errors[] = 'Last name must be 2-50 characters';
        }
        
        if (!self::mobileNumber($data['mobile'] ?? '')) {
            $errors[] = 'Valid 10-digit mobile number starting with 6, 7, 8, or 9 is required';
        }
        
        if (!self::email($data['recovery_email'] ?? '')) {
            $errors[] = 'Valid recovery email address is required';
        }
        
        if (!self::emailUsername($data['desired_email'] ?? '')) {
            $errors[] = 'Email username must be 3-30 characters (letters, numbers, dots, hyphens, underscores only)';
        }
        
        if (!self::planCode($data['plan_code'] ?? '')) {
            $errors[] = 'Invalid plan code';
        }
        
        return $errors;
    }
}
