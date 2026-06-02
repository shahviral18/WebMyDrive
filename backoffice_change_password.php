<?php
/**
 * Change Password - Admin Users
 * Allow logged-in users to change their own password
 */

declare(strict_types=1);
error_reporting(E_ALL);
ini_set('display_errors', '1');

session_start();

// Check if logged in
if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
    header('Location: backoffice.php');
    exit;
}

// Use existing dbcon.php
require_once __DIR__ . '/../websiteconfig/dbcon.php';
$mysqli = db_get_mysqli();

if (!$mysqli) {
    die('Database connection failed!');
}

// Helper function
function h($string) {
    return htmlspecialchars((string)$string, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

$success_message = '';
$error_message = '';

// Handle Password Change
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['change_password'])) {
    $current_password = $_POST['current_password'] ?? '';
    $new_password = $_POST['new_password'] ?? '';
    $confirm_password = $_POST['confirm_password'] ?? '';
    
    if (empty($current_password) || empty($new_password) || empty($confirm_password)) {
        $error_message = 'All fields are required!';
    } elseif (strlen($new_password) < 8) {
        $error_message = 'New password must be at least 8 characters!';
    } elseif ($new_password !== $confirm_password) {
        $error_message = 'New password and confirmation do not match!';
    } else {
        // Verify current password
        $stmt = $mysqli->prepare('SELECT password FROM admin_users WHERE id = ?');
        $stmt->bind_param('i', $_SESSION['admin_id']);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result && $result->num_rows > 0) {
            $user = $result->fetch_assoc();
            
            if (password_verify($current_password, $user['password'])) {
                // Current password is correct, update to new password
                $new_password_hash = password_hash($new_password, PASSWORD_BCRYPT);
                $update_stmt = $mysqli->prepare('UPDATE admin_users SET password = ? WHERE id = ?');
                $update_stmt->bind_param('si', $new_password_hash, $_SESSION['admin_id']);
                
                if ($update_stmt->execute()) {
                    $success_message = 'Password changed successfully! Please use your new password for next login.';
                } else {
                    $error_message = 'Error updating password. Please try again.';
                }
                $update_stmt->close();
            } else {
                $error_message = 'Current password is incorrect!';
            }
        } else {
            $error_message = 'User not found!';
        }
        $stmt->close();
    }
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Change Password - WebMyDrive Admin</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen">
    
    <div class="container mx-auto px-4 py-8">
        
        <!-- Header -->
        <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div class="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 class="text-3xl font-bold text-gray-900">🔐 Change Password</h1>
                    <p class="text-gray-600 mt-1">Update your login password</p>
                    <p class="text-sm text-gray-500 mt-2">Logged in as: <strong><?= h($_SESSION['admin_email']) ?></strong></p>
                </div>
                <div class="flex gap-2">
                    <a href="backoffice.php" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center">
                        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                        </svg>
                        Back to Dashboard
                    </a>
                </div>
            </div>
        </div>
        
        <!-- Success/Error Messages -->
        <?php if ($success_message): ?>
            <div class="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-md">
                <div class="flex">
                    <svg class="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                    </svg>
                    <p class="text-sm font-medium"><?= h($success_message) ?></p>
                </div>
            </div>
        <?php endif; ?>
        
        <?php if ($error_message): ?>
            <div class="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md">
                <div class="flex">
                    <svg class="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                    </svg>
                    <p class="text-sm font-medium"><?= h($error_message) ?></p>
                </div>
            </div>
        <?php endif; ?>
        
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <!-- Change Password Form -->
            <div class="lg:col-span-2">
                <div class="bg-white rounded-lg shadow-lg p-6">
                    <h2 class="text-xl font-bold text-gray-900 mb-6">Update Your Password</h2>
                    
                    <form method="post" class="space-y-5" id="passwordForm">
                        
                        <div>
                            <label for="current_password" class="block text-sm font-semibold text-gray-700 mb-2">
                                Current Password <span class="text-red-500">*</span>
                            </label>
                            <input 
                                type="password" 
                                id="current_password" 
                                name="current_password" 
                                required
                                class="block w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter your current password"
                                autocomplete="current-password">
                        </div>
                        
                        <div class="border-t border-gray-200 pt-5"></div>
                        
                        <div>
                            <label for="new_password" class="block text-sm font-semibold text-gray-700 mb-2">
                                New Password <span class="text-red-500">*</span>
                            </label>
                            <input 
                                type="password" 
                                id="new_password" 
                                name="new_password" 
                                required
                                minlength="8"
                                class="block w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter new password (min 8 characters)"
                                autocomplete="new-password">
                            <div id="password-strength" class="mt-2 text-sm"></div>
                        </div>
                        
                        <div>
                            <label for="confirm_password" class="block text-sm font-semibold text-gray-700 mb-2">
                                Confirm New Password <span class="text-red-500">*</span>
                            </label>
                            <input 
                                type="password" 
                                id="confirm_password" 
                                name="confirm_password" 
                                required
                                minlength="8"
                                class="block w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Re-enter new password"
                                autocomplete="new-password">
                            <div id="password-match" class="mt-2 text-sm"></div>
                        </div>
                        
                        <div class="flex gap-3 pt-4">
                            <button 
                                type="submit" 
                                name="change_password"
                                class="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold shadow-lg hover:shadow-xl transform hover:scale-105">
                                Change Password
                            </button>
                            <button 
                                type="reset"
                                class="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition font-semibold">
                                Clear
                            </button>
                        </div>
                        
                    </form>
                </div>
            </div>
            
            <!-- Security Tips -->
            <div class="lg:col-span-1">
                <div class="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg shadow-lg p-6">
                    <h3 class="text-lg font-bold text-gray-900 mb-4">🛡️ Password Security Tips</h3>
                    <ul class="space-y-3 text-sm text-gray-700">
                        <li class="flex items-start">
                            <svg class="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                            </svg>
                            <span>Use at least <strong>8 characters</strong></span>
                        </li>
                        <li class="flex items-start">
                            <svg class="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                            </svg>
                            <span>Mix <strong>uppercase and lowercase</strong> letters</span>
                        </li>
                        <li class="flex items-start">
                            <svg class="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                            </svg>
                            <span>Include <strong>numbers and symbols</strong></span>
                        </li>
                        <li class="flex items-start">
                            <svg class="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                            </svg>
                            <span>Avoid common words or patterns</span>
                        </li>
                        <li class="flex items-start">
                            <svg class="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                            </svg>
                            <span>Don't reuse passwords</span>
                        </li>
                        <li class="flex items-start">
                            <svg class="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                            </svg>
                            <span>Change regularly</span>
                        </li>
                    </ul>
                </div>
                
                <!-- Account Info -->
                <div class="bg-white rounded-lg shadow-lg p-6 mt-6">
                    <h3 class="text-lg font-bold text-gray-900 mb-4">👤 Account Info</h3>
                    <div class="space-y-3 text-sm">
                        <div>
                            <p class="text-gray-600">Name</p>
                            <p class="font-semibold text-gray-900"><?= h($_SESSION['admin_name']) ?></p>
                        </div>
                        <div>
                            <p class="text-gray-600">Email</p>
                            <p class="font-semibold text-gray-900"><?= h($_SESSION['admin_email']) ?></p>
                        </div>
                        <div>
                            <p class="text-gray-600">Role</p>
                            <p class="font-semibold text-gray-900"><?= ucfirst(h($_SESSION['admin_role'])) ?></p>
                        </div>
                    </div>
                </div>
            </div>
            
        </div>
        
        <!-- Footer -->
        <div class="mt-6 text-center text-sm text-gray-500">
            <p>WebMyDrive Admin Tool &copy; <?= date('Y') ?></p>
        </div>
        
    </div>
    
    <script>
        // Password strength indicator
        document.getElementById('new_password').addEventListener('input', function() {
            const password = this.value;
            const strengthDiv = document.getElementById('password-strength');
            
            if (password.length === 0) {
                strengthDiv.innerHTML = '';
                return;
            }
            
            let strength = 0;
            let feedback = [];
            
            // Length check
            if (password.length >= 8) strength++;
            if (password.length >= 12) strength++;
            
            // Character variety checks
            if (/[a-z]/.test(password)) strength++;
            if (/[A-Z]/.test(password)) strength++;
            if (/[0-9]/.test(password)) strength++;
            if (/[^a-zA-Z0-9]/.test(password)) strength++;
            
            // Determine strength level
            let color, text;
            if (strength <= 2) {
                color = 'text-red-600';
                text = '❌ Weak - Add more character types';
            } else if (strength <= 4) {
                color = 'text-yellow-600';
                text = '⚠️ Medium - Consider adding more variety';
            } else {
                color = 'text-green-600';
                text = '✅ Strong - Good password!';
            }
            
            strengthDiv.innerHTML = '<span class="' + color + ' font-semibold">' + text + '</span>';
        });
        
        // Password match indicator
        document.getElementById('confirm_password').addEventListener('input', function() {
            const newPassword = document.getElementById('new_password').value;
            const confirmPassword = this.value;
            const matchDiv = document.getElementById('password-match');
            
            if (confirmPassword.length === 0) {
                matchDiv.innerHTML = '';
                return;
            }
            
            if (newPassword === confirmPassword) {
                matchDiv.innerHTML = '<span class="text-green-600 font-semibold">✅ Passwords match</span>';
            } else {
                matchDiv.innerHTML = '<span class="text-red-600 font-semibold">❌ Passwords do not match</span>';
            }
        });
        
        // Form validation
        document.getElementById('passwordForm').addEventListener('submit', function(e) {
            const newPassword = document.getElementById('new_password').value;
            const confirmPassword = document.getElementById('confirm_password').value;
            
            if (newPassword !== confirmPassword) {
                e.preventDefault();
                alert('Passwords do not match!');
                return false;
            }
            
            if (newPassword.length < 8) {
                e.preventDefault();
                alert('Password must be at least 8 characters!');
                return false;
            }
        });
    </script>
    
</body>
</html>
