<?php
// Check backend app log and also PHP error log in demo1
$files = [
    '/home1/wmdadmin/public_html/demo1/backend/logs/app.log',
    '/home1/wmdadmin/public_html/demo1/backend/public/error_log',
    '/home1/wmdadmin/public_html/demo1/error_log',
];
header('Content-Type: text/plain');
foreach ($files as $f) {
    if (file_exists($f)) {
        $sz = filesize($f);
        echo "=== $f ($sz bytes) ===\n";
        $lines = array_slice(file($f), -30);
        echo implode('', $lines) . "\n\n";
    } else {
        echo "=== $f NOT FOUND ===\n\n";
    }
}
// Also show server load
echo "=== Load avg ===\n";
echo implode(' ', sys_getloadavg()) . "\n";
