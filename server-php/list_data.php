<?php
try {
    $dbPath = __DIR__ . '/database/dev.db';
    if (!file_exists($dbPath)) {
        die("Database not found at $dbPath");
    }
    $db = new PDO("sqlite:$dbPath");
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "--- USERS ---\n";
    try {
        $users = $db->query('SELECT id, email, role FROM "User"')->fetchAll(PDO::FETCH_ASSOC);
        foreach ($users as $u) {
            echo "ID: {$u['id']} | Email: {$u['email']} | Role: {$u['role']}\n";
        }
    } catch (Exception $e) {
        echo "User table error: " . $e->getMessage() . "\n";
    }

    echo "\n--- DISTRIBUTORS ---\n";
    try {
        $dist = $db->query('SELECT id, email FROM "Distributor"')->fetchAll(PDO::FETCH_ASSOC);
        foreach ($dist as $d) {
            echo "ID: {$d['id']} | Email: {$d['email']}\n";
        }
    } catch (Exception $e) {
        echo "Distributor table error: " . $e->getMessage() . "\n";
    }

    echo "\n--- PLANS ---\n";
    try {
        $plans = $db->query('SELECT id, name FROM "SubscriptionPlan"')->fetchAll(PDO::FETCH_ASSOC);
        foreach ($plans as $p) {
            echo "ID: {$p['id']} | Name: {$p['name']}\n";
        }
    } catch (Exception $e) {
        echo "SubscriptionPlan table error: " . $e->getMessage() . "\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
