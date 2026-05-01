<?php
session_start();
require_once dirname(__DIR__) . '/db.php';
require_once dirname(__DIR__) . '/config.php';
require_once dirname(__DIR__) . '/lib/PHPMailer/Exception.php';
require_once dirname(__DIR__) . '/lib/PHPMailer/PHPMailer.php';
require_once dirname(__DIR__) . '/lib/PHPMailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
$entry_id  = intval($body['entry_id'] ?? 0);
$prize     = trim($body['prize']     ?? '');

if (!$entry_id || !$prize) {
    echo json_encode(['success' => false, 'message' => 'Invalid data']);
    exit;
}

$db = db();

// Fetch entry
$stmt = $db->prepare('SELECT * FROM kg_entries WHERE id = ? LIMIT 1');
$stmt->execute([$entry_id]);
$entry = $stmt->fetch();

if (!$entry) {
    echo json_encode(['success' => false, 'message' => 'Entry not found']);
    exit;
}
if ($entry['has_spun']) {
    echo json_encode(['success' => false, 'message' => 'Already spun']);
    exit;
}

// Generate coupon
$coupon = 'KG-' . strtoupper(substr(str_shuffle('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'), 0, 8));

// Save spin result
$stmt = $db->prepare('UPDATE kg_entries SET prize = ?, coupon_code = ?, has_spun = 1 WHERE id = ?');
$stmt->execute([$prize, $coupon, $entry_id]);

// Clear session so they can't re-spin
unset($_SESSION['kg_entry_id']);

// ── Send email ────────────────────────────────────────────────────────────────
$emailSent = false;
try {
    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host       = SMTP_HOST;
    $mail->SMTPAuth   = true;
    $mail->Username   = SMTP_USER;
    $mail->Password   = SMTP_PASS;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = SMTP_PORT;

    $mail->setFrom(SMTP_FROM, SMTP_FROM_NAME);
    $mail->addReplyTo(SMTP_REPLY_TO, SMTP_FROM_NAME);
    $mail->addAddress($entry['email'], $entry['first_name'] . ' ' . $entry['last_name']);
    $mail->addCC('umesh@kaivalyaguru.com', 'Kaivalya Guru');

    $mail->isHTML(true);
    $mail->Subject = 'Congratulations from Kaivalya Guru! Your Exclusive Offer Awaits 🎉';
    $mail->Body    = buildEmailHtml($entry, $prize, $coupon);
    $mail->AltBody = buildEmailText($entry, $prize, $coupon);

    $mail->send();
    $emailSent = true;
} catch (Exception $e) {
    error_log('KG email error: ' . $e->getMessage());
}

echo json_encode(['success' => true, 'coupon' => $coupon, 'email_sent' => $emailSent]);

// ── Email templates ───────────────────────────────────────────────────────────
function buildEmailHtml(array $e, string $prize, string $coupon): string {
    $name   = htmlspecialchars($e['first_name']);
    $p      = htmlspecialchars($prize);
    $c      = htmlspecialchars($coupon);
    $qrUrl  = 'https://api.qrserver.com/v1/create-qr-code/?size=160x160&color=1565C0&data=' . urlencode($coupon);
    return <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;background:#f0f4ff;margin:0;padding:0}
  .wrap{max-width:520px;margin:30px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.12)}
  .header{background:linear-gradient(135deg,#1565C0,#1976d2);padding:28px 24px;text-align:center}
  .header img{width:120px;height:auto}
  .header p{margin:8px 0 0;color:rgba(255,255,255,.85);font-size:.88rem;font-style:italic}
  .body{padding:32px 28px;text-align:center}
  .congrats{font-size:1.3rem;font-weight:700;color:#2E7D32;margin-bottom:8px}
  .prize{font-size:1.1rem;color:#333;margin-bottom:24px}
  .coupon-box{background:linear-gradient(135deg,#1565C0,#1976d2);border-radius:10px;padding:20px;color:#fff;margin-bottom:20px}
  .coupon-label{font-size:.75rem;letter-spacing:2px;text-transform:uppercase;opacity:.85}
  .coupon-code{font-size:2rem;font-weight:900;letter-spacing:4px;margin-top:6px}
  .qr-section{margin:0 auto 20px;text-align:center}
  .qr-section p{font-size:.8rem;color:#888;margin-top:6px}
  .note{font-size:.85rem;color:#666;margin-bottom:24px}
  .footer{background:#f0f4ff;padding:18px 24px;text-align:center;font-size:.8rem;color:#888}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <img src="https://webmydrive.com/kaivalyaguru/assets/logo.png" alt="Kaivalya Guru">
    <p>Harmonize Space &middot; Heal Life &middot; Design Destiny</p>
  </div>
  <div class="body">
    <p class="congrats">🎉 Congratulations, {$name}!</p>
    <p class="prize">You have won: <strong>{$p}</strong></p>
    <div class="coupon-box">
      <div class="coupon-label">Your Coupon Code</div>
      <div class="coupon-code">{$c}</div>
    </div>
    <div class="qr-section">
      <img src="{$qrUrl}" width="160" height="160" alt="QR Code" style="border:4px solid #e8edf5;border-radius:8px">
      <p>Show this QR code at our office to redeem your offer</p>
    </div>
    <p class="note">This coupon is valid for one-time use only.<br>Thank you for visiting us on our special day!</p>
  </div>
  <div class="footer">
    Kaivalya Guru &mdash; <a href="mailto:umesh@kaivalyaguru.com" style="color:#1565C0">umesh@kaivalyaguru.com</a>
  </div>
</div>
</body>
</html>
HTML;
}

function buildEmailText(array $e, string $prize, string $coupon): string {
    $name = $e['first_name'] . ' ' . $e['last_name'];
    return "Congratulations, {$name}!\n\n"
         . "You have won: {$prize}\n\n"
         . "Your Coupon Code: {$coupon}\n\n"
         . "Present this coupon at our office to redeem your offer.\n\n"
         . "Thank you for visiting Kaivalya Guru!\n"
         . "info@kaivalyaguru.com";
}
