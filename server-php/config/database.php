<?php
/**
 * Database Layer — PDO / SQLite Singleton
 *
 * The PHP backend uses the SAME SQLite database as the Node/Prisma backend.
 * DB_PATH points to `server/prisma/dev.db` (configured in config/env.php).
 *
 * All queries use PDO prepared statements — zero raw interpolation.
 */

declare(strict_types=1);

class Database
{
    private static ?PDO $instance = null;

    /**
     * Returns the singleton PDO connection.
     */
    public static function getConnection(): PDO
    {
        if (self::$instance === null) {
            $dbPath = DB_PATH;

            if (!file_exists($dbPath)) {
                // Graceful error — helps during first-time setup
                Logger::error("[Database] SQLite file not found at: $dbPath");
                throw new RuntimeException("Database file not found. Run: npx prisma migrate deploy (in server/ folder).");
            }

            $dsn = "sqlite:$dbPath";
            self::$instance = new PDO($dsn, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,  // throw exceptions on error
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,        // return assoc arrays
                PDO::ATTR_EMULATE_PREPARES => false,                   // use native prepares
            ]);

            // Enable WAL mode for better concurrent read performance
            self::$instance->exec('PRAGMA journal_mode=WAL;');
            self::$instance->exec('PRAGMA foreign_keys=ON;');
        }

        return self::$instance;
    }

    /**
     * Execute a query with bound parameters and return all rows.
     *
     * @param string $sql    SQL with named (:key) or positional (?) placeholders
     * @param array  $params Parameter bindings
     * @return array<int, array<string, mixed>>
     */
    public static function query(string $sql, array $params = []): array
    {
        $stmt = self::getConnection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /**
     * Execute a query and return a single row (or null).
     *
     * @return array<string, mixed>|null
     */
    public static function queryOne(string $sql, array $params = []): ?array
    {
        $stmt = self::getConnection()->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();
        return $row !== false ? $row : null;
    }

    /**
     * Execute an INSERT/UPDATE/DELETE statement and return affected row count.
     */
    public static function execute(string $sql, array $params = []): int
    {
        $stmt = self::getConnection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    /**
     * Execute an INSERT and return the last inserted row ID.
     */
    public static function insert(string $sql, array $params = []): int
    {
        $stmt = self::getConnection()->prepare($sql);
        $stmt->execute($params);
        return (int) self::getConnection()->lastInsertId();
    }

    /**
     * Begin a transaction.
     */
    public static function beginTransaction(): void
    {
        self::getConnection()->beginTransaction();
    }

    /**
     * Commit a transaction.
     */
    public static function commit(): void
    {
        self::getConnection()->commit();
    }

    /**
     * Rollback a transaction.
     */
    public static function rollback(): void
    {
        if (self::getConnection()->inTransaction()) {
            self::getConnection()->rollBack();
        }
    }

    /**
     * Count rows matching a WHERE clause.
     */
    public static function count(string $table, string $where = '1=1', array $params = []): int
    {
        $row = self::queryOne("SELECT COUNT(*) AS cnt FROM $table WHERE $where", $params);
        return (int) ($row['cnt'] ?? 0);
    }

    /**
     * Retrieve a scalar value from a query.
     */
    public static function scalar(string $sql, array $params = []): mixed
    {
        $stmt = self::getConnection()->prepare($sql);
        $stmt->execute($params);
        $val = $stmt->fetchColumn();
        return $val !== false ? $val : null;
    }
}
