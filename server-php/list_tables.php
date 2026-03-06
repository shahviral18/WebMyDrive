<?php
try {
    $dbPath = __DIR__ . '/database/dev.db';
    $db = new PDO("sqlite:$dbPath");
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $tables = $db->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
    foreach ($tables as $table) {
        echo "$table\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
