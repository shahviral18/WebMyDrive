<?php
session_start();
require_once dirname(__DIR__) . '/db.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
if (!$body) {
    echo json_encode(['success' => false, 'message' => 'Invalid request']);
    exit;
}

$first_name = trim($body['first_name'] ?? '');
$last_name  = trim($body['last_name']  ?? '');
$email      = trim($body['email']      ?? '');
$mobile     = trim($body['mobile']     ?? '');
$dob        = trim($body['dob']        ?? '');
$feedback   = trim($body['feedback']   ?? '');

// Basic validation
if (!$first_name || !$last_name || !$email || !$mobile || !$dob) {
    echo json_encode(['success' => false, 'message' => 'All required fields must be filled.']);
    exit;
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'Invalid email address.']);
    exit;
}
if (!preg_match('/^\d{10}$/', $mobile)) {
    echo json_encode(['success' => false, 'message' => 'Invalid mobile number.']);
    exit;
}

try {
    $db = db();

    // Check email uniqueness
    $stmt = $db->prepare('SELECT id FROM kg_entries WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        echo json_encode(['success' => false, 'message' => 'This email has already been used to participate.']);
        exit;
    }
    // Check mobile uniqueness
    $stmt = $db->prepare('SELECT id FROM kg_entries WHERE mobile = ? LIMIT 1');
    $stmt->execute([$mobile]);
    if ($stmt->fetch()) {
        echo json_encode(['success' => false, 'message' => 'This mobile number has already been used to participate.']);
        exit;
    }

    $stmt = $db->prepare('
        INSERT INTO kg_entries (first_name, last_name, email, mobile, dob, feedback)
        VALUES (?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([$first_name, $last_name, $email, $mobile, $dob, $feedback]);
    $entry_id = $db->lastInsertId();

    $_SESSION['kg_entry_id'] = $entry_id;

    echo json_encode(['success' => true, 'entry_id' => $entry_id]);

} catch (PDOException $e) {
    // Unique constraint violation
    if ($e->getCode() === '23000') {
        echo json_encode(['success' => false, 'message' => 'You have already participated. Each visitor may spin only once.']);
    } else {
        error_log('KG register error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Server error. Please try again.']);
    }
}
