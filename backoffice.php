<?php
/**
 * WebMyDrive Admin Backoffice
 * Complete admin panel with all features
 * Version: 4.0 Final
 */

declare(strict_types=1);
error_reporting(E_ALL);
ini_set('display_errors', '0');

session_start();

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

// Check if logged in
function isLoggedIn(): bool {
    return isset($_SESSION['admin_logged_in']) && 
           $_SESSION['admin_logged_in'] === true && 
           isset($_SESSION['admin_email']);
}

// Handle logout
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: backoffice.php');
    exit;
}

// Handle login
$login_error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['login'])) {
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';
    
    if (empty($email) || empty($password)) {
        $login_error = 'Please enter both email and password.';
    } else {
        $stmt = $mysqli->prepare('SELECT id, email, password, name, role, is_active FROM admin_users WHERE email = ? LIMIT 1');
        
        if ($stmt) {
            $stmt->bind_param('s', $email);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result && $result->num_rows > 0) {
                $user = $result->fetch_assoc();
                
                if ($user['is_active'] != 1) {
                    $login_error = 'Your account has been deactivated.';
                } elseif (password_verify($password, $user['password'])) {
                    // Login successful
                    $_SESSION['admin_logged_in'] = true;
                    $_SESSION['admin_id'] = $user['id'];
                    $_SESSION['admin_email'] = $user['email'];
                    $_SESSION['admin_name'] = $user['name'];
                    $_SESSION['admin_role'] = $user['role'];
                    
                    // Update last login
                    $updateStmt = $mysqli->prepare('UPDATE admin_users SET last_login = NOW() WHERE id = ?');
                    $updateStmt->bind_param('i', $user['id']);
                    $updateStmt->execute();
                    $updateStmt->close();
                    
                    header('Location: backoffice.php');
                    exit;
                } else {
                    $login_error = 'Invalid email or password.';
                }
            } else {
                $login_error = 'Invalid email or password.';
            }
            $stmt->close();
        } else {
            $login_error = 'Login error. Please try again.';
        }
    }
}

// If not logged in, show login page
if (!isLoggedIn()) {
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Admin Login - WebMyDrive</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gradient-to-br from-blue-100 to-indigo-200 min-h-screen flex items-center justify-center p-4">
    
    <div class="max-w-md w-full">
        <div class="bg-white rounded-2xl shadow-2xl p-8">
            
            <div class="text-center mb-8">
                <div class="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mx-auto flex items-center justify-center mb-4">
                    <svg class="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>
                </div>
                <h1 class="text-3xl font-bold text-gray-900">Admin Login</h1>
                <p class="text-gray-600 mt-2">WebMyDrive Backoffice</p>
            </div>
            
            <?php if ($login_error): ?>
                <div class="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md">
                    <p class="text-sm font-medium"><?= h($login_error) ?></p>
                </div>
            <?php endif; ?>
            
            <form method="post" class="space-y-5">
                <div>
                    <label for="email" class="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                    <input type="email" id="email" name="email" required autofocus
                        class="block w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="admin@webmydrive.com">
                </div>
                
                <div>
                    <label for="password" class="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                    <input type="password" id="password" name="password" required
                        class="block w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="••••••••">
                </div>
                
                <button type="submit" name="login"
                    class="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-200">
                    Sign In
                </button>
            </form>
            
            <div class="mt-6 text-center text-sm text-gray-500">
                <p>Authorized personnel only</p>
            </div>
        </div>
    </div>
    
</body>
</html>
<?php
    exit;
}

// User is logged in - Show Dashboard
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Dashboard - WebMyDrive Backoffice</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen">
    
    <header class="bg-white shadow-md">
        <div class="container mx-auto px-4 py-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                        <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                        </svg>
                    </div>
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900">WebMyDrive Backoffice</h1>
                        <p class="text-sm text-gray-600">Admin Dashboard</p>
                    </div>
                </div>
                
                <div class="flex items-center space-x-4">
                    <div class="text-right">
                        <p class="text-sm font-semibold text-gray-900"><?= h($_SESSION['admin_name']) ?></p>
                        <p class="text-xs text-gray-600"><?= h($_SESSION['admin_email']) ?></p>
                    </div>
                    <a href="?logout" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold text-sm">
                        Logout
                    </a>
                </div>
            </div>
        </div>
    </header>
    
    <div class="container mx-auto px-4 py-8">
        
        <div class="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow-lg p-8 mb-8 text-white">
            <h2 class="text-3xl font-bold mb-2">Welcome back, <?= h(explode(' ', $_SESSION['admin_name'])[0]) ?>! 👋</h2>
            <p class="text-blue-100">Here's what you can do in the backoffice</p>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            <!-- Accounts Report -->
            <a href="backoffice_accounts_report.php" class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition transform hover:scale-105 block">
                <div class="flex items-center justify-between mb-4">
                    <div class="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                    </div>
                    <span class="text-sm font-semibold text-blue-600">REPORTS</span>
                </div>
                <h3 class="text-xl font-bold text-gray-900 mb-2">Accounts Report</h3>
                <p class="text-gray-600 text-sm">View and export account creation data by date range</p>
            </a>
            
            <!-- User Management -->
<!-- User Management - Admin Only -->
<!-- User Management - Admin Only -->
<?php if ($_SESSION['admin_role'] === 'admin'): ?>
    <a href="backoffice_users.php" class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition transform hover:scale-105 block">
        <div class="flex items-center justify-between mb-4">
            <div class="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
                </svg>
            </div>
            <span class="text-sm font-semibold text-green-600">ADMIN</span>
        </div>
        <h3 class="text-xl font-bold text-gray-900 mb-2">User Management</h3>
        <p class="text-gray-600 text-sm">Manage admin users and permissions</p>
    </a>
<?php else: ?>
    <div class="bg-gray-50 rounded-lg shadow-lg p-6 opacity-60 cursor-not-allowed">
        <div class="flex items-center justify-between mb-4">
            <div class="w-14 h-14 bg-gray-200 rounded-full flex items-center justify-center">
                <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
            </div>
            <span class="text-sm font-semibold text-red-500">🔒 LOCKED</span>
        </div>
        <h3 class="text-xl font-bold text-gray-500 mb-2">User Management</h3>
        <p class="text-gray-400 text-sm">Admin access required</p>
    </div>
<?php endif; ?>

            
            <!-- Change Password -->
            <a href="backoffice_change_password.php" class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition transform hover:scale-105 block">
                <div class="flex items-center justify-between mb-4">
                    <div class="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center">
                        <svg class="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                        </svg>
                    </div>
                    <span class="text-sm font-semibold text-purple-600">SECURITY</span>
                </div>
                <h3 class="text-xl font-bold text-gray-900 mb-2">Change Password</h3>
                <p class="text-gray-600 text-sm">Update your login password</p>
            </a>
            
        </div>
        
        <?php
        try {
            $stmt = $mysqli->prepare('SELECT COUNT(*) as count FROM webmydrive_accounts WHERE DATE(created_at) = CURDATE()');
            if ($stmt) {
                $stmt->execute();
                $result = $stmt->get_result();
                $today = $result->fetch_assoc()['count'];
                $stmt->close();
            } else {
                $today = 0;
            }
            
            $stmt = $mysqli->prepare('SELECT COUNT(*) as count FROM webmydrive_accounts WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())');
            if ($stmt) {
                $stmt->execute();
                $result = $stmt->get_result();
                $month = $result->fetch_assoc()['count'];
                $stmt->close();
            } else {
                $month = 0;
            }
            
            $stmt = $mysqli->prepare('SELECT COUNT(*) as count FROM webmydrive_accounts');
            if ($stmt) {
                $stmt->execute();
                $result = $stmt->get_result();
                $total = $result->fetch_assoc()['count'];
                $stmt->close();
            } else {
                $total = 0;
            }
        ?>
        
        <div class="mt-8 bg-white rounded-lg shadow-lg p-6">
            <h3 class="text-xl font-bold text-gray-900 mb-6">Quick Statistics</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="text-center">
                    <p class="text-3xl font-bold text-blue-600"><?= $today ?></p>
                    <p class="text-gray-600 mt-1">Accounts Today</p>
                </div>
                <div class="text-center">
                    <p class="text-3xl font-bold text-green-600"><?= $month ?></p>
                    <p class="text-gray-600 mt-1">This Month</p>
                </div>
                <div class="text-center">
                    <p class="text-3xl font-bold text-purple-600"><?= $total ?></p>
                    <p class="text-gray-600 mt-1">Total Accounts</p>
                </div>
            </div>
        </div>
        
        <?php } catch (Exception $e) { /* Ignore */ } ?>
        
    </div>
    
    <footer class="mt-12 pb-6 text-center text-sm text-gray-500">
        <p>WebMyDrive Backoffice &copy; <?= date('Y') ?> | Secure Admin Panel</p>
    </footer>
    
</body>
</html>
