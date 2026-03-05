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

    private static function write(string $level, string $message): void
    {
        $dir = self::dir();
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $date = date('Y-m-d');
        $timestamp = date('Y-m-d H:i:s');
        $logFile = "$dir/app-$date.log";
        $line = "[$timestamp] [$level] $message" . PHP_EOL;

        file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX);
    }

    public static function debug(string $message): void
    {
        self::write('DEBUG', $message);
    }
    public static function info(string $message): void
    {
        self::write('INFO', $message);
    }
    public static function warn(string $message): void
    {
        self::write('WARN', $message);
    }
    public static function error(string $message): void
    {
        self::write('ERROR', $message);
    }
}
