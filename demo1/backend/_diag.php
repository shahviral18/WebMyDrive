<?php
error_reporting(E_ALL);
ini_set("display_errors", 1);
$log = @file_get_contents(__DIR__ . "/public/error_log");
if ($log) {
    $lines = explode("\n", $log);
    echo implode("\n", array_slice($lines, -150));
} else {
    echo "no log at: " . __DIR__ . "/public/error_log";
    // Try alternate
    $log2 = @file_get_contents(dirname(__DIR__) . "/error_log");
    echo "\nalt: " . ($log2 ? substr($log2, -3000) : "not found");
}
