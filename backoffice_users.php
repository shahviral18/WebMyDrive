<?php
/**
 * User Management - Admin Users
 * ADMIN ONLY - Viewers cannot access
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

// ADMIN ONLY - Block viewer access
if ($_SESSION['admin_role'] !== 'admin') {
    header('Location: backoffice.php?error=access_denied');
    exit;
}

// Use existing dbcon.php
require_once __DIR__ . '/../websiteconfig/dbcon.php';
$mysqli = db_get_mysqli();

if (!$mysqli) {
    die('Database connection failed!');
}

// ... rest of the file stays the same


// Helper function
function h($string) {
    return htmlspecialchars((string)$string, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

$success_message = '';
$error_message = '';

// Handle Add New User
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['add_user'])) {
    $email = trim($_POST['email'] ?? '');
    $name = trim($_POST['name'] ?? '');
    $password = $_POST['password'] ?? '';
    $role = $_POST['role'] ?? 'viewer';
    
    if (empty($email) || empty($name) || empty($password)) {
        $error_message = 'All fields are required!';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error_message = 'Invalid email address!';
    } elseif (strlen($password) < 8) {
        $error_message = 'Password must be at least 8 characters!';
    } else {
        // Check if email already exists
        $stmt = $mysqli->prepare('SELECT id FROM admin_users WHERE email = ?');
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows > 0) {
            $error_message = 'Email already exists!';
        } else {
            // Add new user
            $password_hash = password_hash($password, PASSWORD_BCRYPT);
            $stmt = $mysqli->prepare('INSERT INTO admin_users (email, password, name, role, is_active) VALUES (?, ?, ?, ?, 1)');
            $stmt->bind_param('ssss', $email, $password_hash, $name, $role);
            
            if ($stmt->execute()) {
                $success_message = 'User added successfully!';
            } else {
                $error_message = 'Error adding user: ' . $stmt->error;
            }
        }
        $stmt->close();
    }
}

// Handle Delete User
if (isset($_GET['delete']) && is_numeric($_GET['delete'])) {
    $user_id = (int)$_GET['delete'];
    
    // Don't allow deleting yourself
    if ($user_id === $_SESSION['admin_id']) {
        $error_message = 'You cannot delete your own account!';
    } else {
        $stmt = $mysqli->prepare('DELETE FROM admin_users WHERE id = ?');
        $stmt->bind_param('i', $user_id);
        
        if ($stmt->execute()) {
            $success_message = 'User deleted successfully!';
        } else {
            $error_message = 'Error deleting user!';
        }
        $stmt->close();
    }
}

// Handle Toggle Active Status
if (isset($_GET['toggle']) && is_numeric($_GET['toggle'])) {
    $user_id = (int)$_GET['toggle'];
    
    // Don't allow deactivating yourself
    if ($user_id === $_SESSION['admin_id']) {
        $error_message = 'You cannot deactivate your own account!';
    } else {
        $stmt = $mysqli->prepare('UPDATE admin_users SET is_active = NOT is_active WHERE id = ?');
        $stmt->bind_param('i', $user_id);
        
        if ($stmt->execute()) {
            $success_message = 'User status updated successfully!';
        } else {
            $error_message = 'Error updating user status!';
        }
        $stmt->close();
    }
}

// Handle Reset Password
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['reset_password'])) {
    $user_id = (int)$_POST['user_id'];
    $new_password = $_POST['new_password'] ?? '';
    
    if (empty($new_password)) {
        $error_message = 'Password cannot be empty!';
    } elseif (strlen($new_password) < 8) {
        $error_message = 'Password must be at least 8 characters!';
    } else {
        $password_hash = password_hash($new_password, PASSWORD_BCRYPT);
        $stmt = $mysqli->prepare('UPDATE admin_users SET password = ? WHERE id = ?');
        $stmt->bind_param('si', $password_hash, $user_id);
        
        if ($stmt->execute()) {
            $success_message = 'Password reset successfully!';
        } else {
            $error_message = 'Error resetting password!';
        }
        $stmt->close();
    }
}

// Fetch all users
$users = [];
$stmt = $mysqli->prepare('SELECT id, email, name, role, is_active, created_at, last_login FROM admin_users ORDER BY created_at DESC');
if ($stmt) {
    $stmt->execute();
    $result = $stmt->get_result();
    while ($row = $result->fetch_assoc()) {
        $users[] = $row;
    }
    $stmt->close();
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>User Management - WebMyDrive Admin</title>
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
                    <h1 class="text-3xl font-bold text-gray-900">👥 User Management</h1>
                    <p class="text-gray-600 mt-1">Manage admin users and permissions</p>
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
        
        <!-- Add New User Form -->
        <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 class="text-xl font-bold text-gray-900 mb-4">➕ Add New User</h2>
            <form method="post" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                    <label for="email" class="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                    <input type="email" id="email" name="email" required
                        class="block w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="user@example.com">
                </div>
                
                <div>
                    <label for="name" class="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                    <input type="text" id="name" name="name" required
                        class="block w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="John Doe">
                </div>
                
                <div>
                    <label for="password" class="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                    <input type="password" id="password" name="password" required
                        class="block w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Min 8 characters">
                </div>
                
                <div>
                    <label for="role" class="block text-sm font-semibold text-gray-700 mb-2">Role</label>
                    <select id="role" name="role"
                        class="block w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="admin">Admin</option>
                        <option value="viewer">Viewer</option>
                    </select>
                </div>
                
                <div class="flex items-end">
                    <button type="submit" name="add_user"
                        class="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold">
                        Add User
                    </button>
                </div>
            </form>
        </div>
        
        <!-- Users List -->
        <div class="bg-white rounded-lg shadow-lg overflow-hidden">
            <div class="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <h2 class="text-2xl font-bold text-gray-900">Admin Users</h2>
                <p class="text-gray-600 mt-1">Total users: <strong><?= count($users) ?></strong></p>
            </div>
            
            <?php if (empty($users)): ?>
                <div class="p-12 text-center">
                    <p class="text-gray-600">No users found.</p>
                </div>
            <?php else: ?>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-gray-50 border-b-2 border-gray-200">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Name</th>
                                <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Email</th>
                                <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Role</th>
                                <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                                <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Last Login</th>
                                <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            <?php foreach ($users as $user): ?>
                                <tr class="hover:bg-gray-50 transition">
                                    <td class="px-4 py-4 whitespace-nowrap">
                                        <div class="flex items-center">
                                            <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold mr-3">
                                                <?= strtoupper(substr($user['name'], 0, 1)) ?>
                                            </div>
                                            <div>
                                                <p class="text-sm font-medium text-gray-900"><?= h($user['name']) ?></p>
                                                <?php if ($user['id'] === $_SESSION['admin_id']): ?>
                                                    <p class="text-xs text-blue-600 font-semibold">(You)</p>
                                                <?php endif; ?>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                        <?= h($user['email']) ?>
                                    </td>
                                    <td class="px-4 py-4 whitespace-nowrap text-sm">
                                        <?php if ($user['role'] === 'admin'): ?>
                                            <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                                                Admin
                                            </span>
                                        <?php else: ?>
                                            <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                                Viewer
                                            </span>
                                        <?php endif; ?>
                                    </td>
                                    <td class="px-4 py-4 whitespace-nowrap text-sm">
                                        <?php if ($user['is_active']): ?>
                                            <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                ✓ Active
                                            </span>
                                        <?php else: ?>
                                            <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                                ✗ Inactive
                                            </span>
                                        <?php endif; ?>
                                    </td>
                                    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <?php if ($user['last_login']): ?>
                                            <?= date('M d, Y', strtotime($user['last_login'])) ?>
                                            <span class="text-xs block"><?= date('h:i A', strtotime($user['last_login'])) ?></span>
                                        <?php else: ?>
                                            <span class="text-gray-400">Never</span>
                                        <?php endif; ?>
                                    </td>
                                    <td class="px-4 py-4 whitespace-nowrap text-sm">
                                        <div class="flex gap-2">
                                            <!-- Toggle Status -->
                                            <?php if ($user['id'] !== $_SESSION['admin_id']): ?>
                                                <a href="?toggle=<?= $user['id'] ?>" 
                                                   onclick="return confirm('Toggle user status?')"
                                                   class="text-yellow-600 hover:text-yellow-900" title="Toggle Status">
                                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                                                    </svg>
                                                </a>
                                            <?php endif; ?>
                                            
                                            <!-- Reset Password -->
                                            <button onclick="showResetPassword(<?= $user['id'] ?>, '<?= h($user['name']) ?>')"
                                                    class="text-blue-600 hover:text-blue-900" title="Reset Password">
                                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                                                </svg>
                                            </button>
                                            
                                            <!-- Delete -->
                                            <?php if ($user['id'] !== $_SESSION['admin_id']): ?>
                                                <a href="?delete=<?= $user['id'] ?>" 
                                                   onclick="return confirm('Are you sure you want to delete this user?')"
                                                   class="text-red-600 hover:text-red-900" title="Delete User">
                                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                                    </svg>
                                                </a>
                                            <?php endif; ?>
                                        </div>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            <?php endif; ?>
        </div>
        
        <!-- Footer -->
        <div class="mt-6 text-center text-sm text-gray-500">
            <p>WebMyDrive Admin Tool &copy; <?= date('Y') ?></p>
        </div>
        
    </div>
    
    <!-- Reset Password Modal -->
    <div id="resetPasswordModal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div class="mt-3">
                <h3 class="text-lg font-bold text-gray-900 mb-4">Reset Password</h3>
                <p class="text-sm text-gray-600 mb-4">Resetting password for: <strong id="resetUserName"></strong></p>
                
                <form method="post">
                    <input type="hidden" id="resetUserId" name="user_id">
                    
                    <div class="mb-4">
                        <label for="new_password" class="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                        <input type="password" id="new_password" name="new_password" required
                            class="block w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Min 8 characters">
                    </div>
                    
                    <div class="flex gap-2">
                        <button type="submit" name="reset_password"
                            class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold">
                            Reset Password
                        </button>
                        <button type="button" onclick="closeResetPassword()"
                            class="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition font-semibold">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    
    <script>
        function showResetPassword(userId, userName) {
            document.getElementById('resetUserId').value = userId;
            document.getElementById('resetUserName').textContent = userName;
            document.getElementById('resetPasswordModal').classList.remove('hidden');
        }
        
        function closeResetPassword() {
            document.getElementById('resetPasswordModal').classList.add('hidden');
            document.getElementById('new_password').value = '';
        }
        
        // Close modal on outside click
        document.getElementById('resetPasswordModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeResetPassword();
            }
        });
    </script>
    
</body>
</html>
