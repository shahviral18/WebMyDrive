<?php
$log = '/home1/wmdadmin/public_html/error_log';
if (!file_exists($log)) { echo "not found"; exit; }
$lines = array_slice(file($log), -60);
header('Content-Type: text/plain');
echo implode('', $lines);
