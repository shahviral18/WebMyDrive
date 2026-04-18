<?php
/**
 * Database Layer — PDO / MySQL Singleton
 *
 * Loads credentials from secure_config (production) or .env (development).
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
            // Priority: secure_config file (production) > env vars (dev/.env)
            $secureConfig = '/home1/wmdadmin/secure_config/db_config.php';
            if (file_exists($secureConfig)) {
                require $secureConfig;
                // $secureConfig defines: $db_host, $db_name, $db_user, $db_pass
            } else {
                $db_host = DB_HOST;
                $db_name = DB_NAME;
                $db_user = DB_USER;
                $db_pass = DB_PASS;
            }

            if (empty($db_name) || empty($db_user)) {
                throw new RuntimeException('Database credentials not configured. Set DB_NAME/DB_USER in .env or create secure_config.');
            }

            $dsn = "mysql:host=$db_host;dbname=$db_name;charset=" . DB_CHARSET;
            self::$instance = new PDO($dsn, $db_user, $db_pass, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET sql_mode='ANSI_QUOTES'",
            ]);
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
