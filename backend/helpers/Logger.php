<?php
/**
 * Logger — Structured file-based logging
 *
 * Writes daily log files to LOG_DIR (default: server-php/logs/).
 * Supports levels: DEBUG, INFO, WARN, ERROR.
 */

declare(strict_types=1);

class Logger
{
    private static string $logDir = '';

    private static function dir(): string
    {
        if (self::$logDir === '') {
            self::$logDir = defined('LOG_DIR') ? LOG_DIR : __DIR__ . '/../logs';
        }
        return self::$logDir;
    }

    private static function write(string $level, string $message, array $context = []): void
    {
        $dir = self::dir();
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $date = date('Y-m-d');
        $timestamp = date('Y-m-d H:i:s');
        $logFile = "$dir/app-$date.log";

        if (!empty($context)) {
            $message .= ' ' . json_encode($context);
        }

        $line = "[$timestamp] [$level] $message" . PHP_EOL;

        file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX);
    }

    public static function debug(string $message, array $context = []): void
    {
        self::write('DEBUG', $message, $context);
    }
    public static function info(string $message, array $context = []): void
    {
        self::write('INFO', $message, $context);
    }
    public static function warn(string $message, array $context = []): void
    {
        self::write('WARN', $message, $context);
    }
    public static function error(string $message, array $context = []): void
    {
        self::write('ERROR', $message, $context);
    }
}
