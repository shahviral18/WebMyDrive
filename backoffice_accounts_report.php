<?php
/**
 * Accounts Report - Protected
 * Must be logged in to access
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

// Get date range from GET parameters (default to today)
$today = date('Y-m-d');
$from_date = $_GET['from_date'] ?? $today;
$to_date = $_GET['to_date'] ?? $today;

// Validate dates
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $from_date)) {
    $from_date = $today;
}
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $to_date)) {
    $to_date = $today;
}

// CSV Export
if (isset($_GET['export']) && $_GET['export'] === 'csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=accounts_report_' . $from_date . '_to_' . $to_date . '.csv');
    
    $output = fopen('php://output', 'w');
    
    // CSV Headers
    fputcsv($output, [
        'Sr. No.',
        'First Name',
        'Last Name',
        'Recovery Email',
        'Mobile',
        'WebMyDrive Email',
        'Plan Name',
        'Plan Code',
        'Subscription ID',
        'Status',
        'Created On'
    ]);
    
    // Fetch data
    $stmt = $mysqli->prepare('
        SELECT 
            first_name,
            last_name,
            emailid as recovery_email,
            phone as mobile,
            wmdemailid,
            plan_name,
            plan_code,
            subscription_id,
            status,
            created_at
        FROM webmydrive_accounts
        WHERE DATE(created_at) BETWEEN ? AND ?
        ORDER BY created_at DESC
    ');
    
    $stmt->bind_param('ss', $from_date, $to_date);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $counter = 1;
    while ($row = $result->fetch_assoc()) {
        fputcsv($output, [
            $counter++,
            $row['first_name'],
            $row['last_name'],
            $row['recovery_email'],
            $row['mobile'],
            $row['wmdemailid'],
            $row['plan_name'],
            $row['plan_code'],
            $row['subscription_id'],
            ucfirst($row['status']),
            date('M d, Y h:i A', strtotime($row['created_at']))
        ]);
    }
    
    fclose($output);
    exit;
}

// Fetch accounts
$accounts = [];
$total_count = 0;

try {
    $stmt = $mysqli->prepare('
        SELECT 
            first_name,
            last_name,
            emailid as recovery_email,
            phone as mobile,
            wmdemailid,
            plan_name,
            plan_code,
            subscription_id,
            status,
            created_at
        FROM webmydrive_accounts
        WHERE DATE(created_at) BETWEEN ? AND ?
        ORDER BY created_at DESC
    ');
    
    if ($stmt) {
        $stmt->bind_param('ss', $from_date, $to_date);
        $stmt->execute();
        $result = $stmt->get_result();
        
        while ($row = $result->fetch_assoc()) {
            $accounts[] = $row;
        }
        
        $total_count = count($accounts);
        $stmt->close();
    }
} catch (Exception $e) {
    $error = "Database error: " . $e->getMessage();
}

// Get quick stats
$today_count = 0;
$this_week_count = 0;
$this_month_count = 0;

try {
    $stmt = $mysqli->prepare('SELECT COUNT(*) as count FROM webmydrive_accounts WHERE DATE(created_at) = CURDATE()');
    if ($stmt) {
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        $today_count = $row['count'];
        $stmt->close();
    }
    
    $stmt = $mysqli->prepare('SELECT COUNT(*) as count FROM webmydrive_accounts WHERE YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1)');
    if ($stmt) {
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        $this_week_count = $row['count'];
        $stmt->close();
    }
    
    $stmt = $mysqli->prepare('SELECT COUNT(*) as count FROM webmydrive_accounts WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())');
    if ($stmt) {
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        $this_month_count = $row['count'];
        $stmt->close();
    }
} catch (Exception $e) {
    // Ignore stats errors
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Accounts Report - WebMyDrive Admin</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @media print {
            .no-print { display: none; }
            body { background: white; }
        }
    </style>
</head>
<body class="bg-gray-100 min-h-screen">
    
    <div class="container mx-auto px-4 py-8">
        
        <!-- Header -->
        <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div class="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 class="text-3xl font-bold text-gray-900">📊 Accounts Report</h1>
                    <p class="text-gray-600 mt-1">View and export account creation data</p>
                    <p class="text-sm text-gray-500 mt-2">Logged in as: <strong><?= h($_SESSION['admin_email']) ?></strong></p>
                </div>
                <div class="flex gap-2 no-print">
                    <a href="backoffice.php" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center">
                        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                        </svg>
                        Back to Dashboard
                    </a>
                    <button onclick="window.print()" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center">
                        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                        </svg>
                        Print
                    </button>
                    <a href="?from_date=<?= h($from_date) ?>&to_date=<?= h($to_date) ?>&export=csv" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center">
                        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        Export CSV
                    </a>
                </div>
            </div>
        </div>
        
        <!-- Quick Stats -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 no-print">
            <div class="bg-blue-50 border-2 border-blue-200 rounded-lg p-5">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm text-blue-600 font-semibold">Today</p>
                        <p class="text-3xl font-bold text-blue-900"><?= $today_count ?></p>
                    </div>
                    <div class="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
                        </svg>
                    </div>
                </div>
            </div>
            
            <div class="bg-green-50 border-2 border-green-200 rounded-lg p-5">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm text-green-600 font-semibold">This Week</p>
                        <p class="text-3xl font-bold text-green-900"><?= $this_week_count ?></p>
                    </div>
                    <div class="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                        </svg>
                    </div>
                </div>
            </div>
            
            <div class="bg-purple-50 border-2 border-purple-200 rounded-lg p-5">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm text-purple-600 font-semibold">This Month</p>
                        <p class="text-3xl font-bold text-purple-900"><?= $this_month_count ?></p>
                    </div>
                    <div class="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
                        </svg>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Date Filter -->
        <div class="bg-white rounded-lg shadow-lg p-6 mb-6 no-print">
            <form method="get" class="flex flex-col md:flex-row gap-4 items-end">
                <div class="flex-1">
                    <label for="from_date" class="block text-sm font-semibold text-gray-700 mb-2">From Date</label>
                    <input type="date" id="from_date" name="from_date" value="<?= h($from_date) ?>" class="block w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                </div>
                
                <div class="flex-1">
                    <label for="to_date" class="block text-sm font-semibold text-gray-700 mb-2">To Date</label>
                    <input type="date" id="to_date" name="to_date" value="<?= h($to_date) ?>" class="block w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                </div>
                
                <div>
                    <button type="submit" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold flex items-center whitespace-nowrap">
                        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                        Filter
                    </button>
                </div>
                
                <div>
                    <a href="?" class="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition font-semibold inline-block text-center">
                        Reset
                    </a>
                </div>
            </form>
        </div>
        
        <!-- Results -->
        <div class="bg-white rounded-lg shadow-lg overflow-hidden">
            <div class="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-900">Results</h2>
                        <p class="text-gray-600 mt-1">
                            Showing <strong><?= $total_count ?></strong> account(s) created from 
                            <strong><?= date('M d, Y', strtotime($from_date)) ?></strong> to 
                            <strong><?= date('M d, Y', strtotime($to_date)) ?></strong>
                        </p>
                    </div>
                </div>
            </div>
            
            <?php if (empty($accounts)): ?>
                <div class="p-12 text-center">
                    <svg class="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <h3 class="text-xl font-semibold text-gray-900 mb-2">No Accounts Found</h3>
                    <p class="text-gray-600">No accounts were created in the selected date range.</p>
                </div>
            <?php else: ?>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-gray-50 border-b-2 border-gray-200">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Sr. No.</th>
                                <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">First Name</th>
                                <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Last Name</th>
                                <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Recovery Email</th>
                                <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Mobile</th>
                                <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">WebMyDrive Email</th>
                                <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                                <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Created On</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            <?php $counter = 1; ?>
                            <?php foreach ($accounts as $account): ?>
                                <tr class="hover:bg-gray-50 transition">
                                    <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900"><?= $counter++ ?></td>
                                    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900"><?= h($account['first_name']) ?></td>
                                    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900"><?= h($account['last_name']) ?></td>
                                    <td class="px-4 py-4 text-sm text-gray-900">
                                        <a href="mailto:<?= h($account['recovery_email']) ?>" class="text-blue-600 hover:underline">
                                            <?= h($account['recovery_email']) ?>
                                        </a>
                                    </td>
                                    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                        <a href="tel:+91<?= h($account['mobile']) ?>" class="text-blue-600 hover:underline">
                                            +91 <?= h($account['mobile']) ?>
                                        </a>
                                    </td>
                                    <td class="px-4 py-4 text-sm text-gray-900">
                                        <span class="font-mono text-blue-700"><?= h($account['wmdemailid']) ?></span>
                                    </td>
                                    <td class="px-4 py-4 whitespace-nowrap text-sm">
                                        <?php if (strtolower($account['status']) === 'active'): ?>
                                            <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                ✓ Active
                                            </span>
                                        <?php else: ?>
                                            <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                <?= h(ucfirst($account['status'])) ?>
                                            </span>
                                        <?php endif; ?>
                                    </td>
                                    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                        <?= date('M d, Y', strtotime($account['created_at'])) ?>
                                        <span class="text-xs text-gray-500 block"><?= date('h:i A', strtotime($account['created_at'])) ?></span>
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
    
</body>
</html>
