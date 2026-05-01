<?php
require_once dirname(__DIR__) . '/db.php';
require_once dirname(__DIR__) . '/config.php';
require_once dirname(__DIR__) . '/lib/PHPMailer/Exception.php';
require_once dirname(__DIR__) . '/lib/PHPMailer/PHPMailer.php';
require_once dirname(__DIR__) . '/lib/PHPMailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

header('Content-Type: application/json');

define('REDEEM_USER', 'kgstaff');
define('REDEEM_PASS', 'KGStaff@2025');
define('AUTH_TOKEN',  hash('sha256', REDEEM_USER . REDEEM_PASS . 'kg_salt_2025'));

// Auth check
$tokenOk = ($_POST['_token'] ?? '') === AUTH_TOKEN || ($_COOKIE['kg_auth'] ?? '') === AUTH_TOKEN;
if (!$tokenOk) { echo json_encode(['success' => false, 'message' => 'Not authenticated']); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Method not allowed']); exit;
}

$entry_id = intval($_POST['entry_id'] ?? 0);
if (!$entry_id) { echo json_encode(['success' => false, 'message' => 'Invalid entry']); exit; }

// Same slices as the wheel
$slices = [
    "Access Bars Healing 15% Off", "Sound Healing 15% Off",
    "Vaastu Consultancy 50% Off",  "Access Bars Healing 25% Off",
    "Numerology 25% Off",          "Vaastu Consultancy 25% Off",
    "Tarot Card Reading 25% Off",  "Access Body Process 15% Off",
    "Access Bars Healing 50% Off", "Sound Healing 25% Off",
    "Access Body Process 25% Off", "Tarot Card Reading 50% Off",
    "Numerology 15% Off",          "Tarot Card Reading 15% Off",
    "Vaastu Consultancy 25% Off",  "Numerology 50% Off",
];
$prize = $slices[array_rand($slices)];

$db = db();

$stmt = $db->prepare('SELECT * FROM kg_entries WHERE id = ? LIMIT 1');
$stmt->execute([$entry_id]);
$entry = $stmt->fetch();

if (!$entry) { echo json_encode(['success' => false, 'message' => 'Entry not found']); exit; }
if ($entry['has_spun']) { echo json_encode(['success' => false, 'message' => 'Already spun']); exit; }

$coupon = 'KG-' . strtoupper(substr(str_shuffle('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'), 0, 8));

$db->prepare('UPDATE kg_entries SET prize = ?, coupon_code = ?, has_spun = 1 WHERE id = ?')
   ->execute([$prize, $coupon, $entry_id]);

// Send email
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

    $qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=160x160&color=1565C0&data=' . urlencode($coupon);
    $name  = htmlspecialchars($entry['first_name']);
    $p     = htmlspecialchars($prize);
    $c     = htmlspecialchars($coupon);

    $mail->isHTML(true);
    $mail->Subject = 'Congratulations from Kaivalya Guru! Your Exclusive Offer Awaits 🎉';
    $mail->Body    = <<<HTML
<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;background:#f0f4ff;margin:0;padding:0}
  .wrap{max-width:520px;margin:30px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.12)}
  .header{background:linear-gradient(135deg,#1565C0,#1976d2);padding:28px 24px;text-align:center}
  .header img{width:120px;height:auto}
  .header p{margin:8px 0 0;color:rgba(255,255,255,.85);font-size:.88rem;font-style:italic}
  .body{padding:32px 28px;text-align:center}
  .congrats{font-size:1.3rem;font-weight:700;color:#2E7D32;margin-bottom:8px}
  .coupon-box{background:linear-gradient(135deg,#1565C0,#1976d2);border-radius:10px;padding:20px;color:#fff;margin-bottom:20px}
  .coupon-label{font-size:.75rem;letter-spacing:2px;text-transform:uppercase;opacity:.85}
  .coupon-code{font-size:2rem;font-weight:900;letter-spacing:4px;margin-top:6px}
  .footer{background:#f0f4ff;padding:18px 24px;text-align:center;font-size:.8rem;color:#888}
</style></head><body>
<div class="wrap">
  <div class="header">
    <img src="https://webmydrive.com/kaivalyaguru/assets/logo.png" alt="Kaivalya Guru">
    <p>Harmonize Space &middot; Heal Life &middot; Design Destiny</p>
  </div>
  <div class="body">
    <p class="congrats">🎉 Congratulations, {$name}!</p>
    <p>You have won: <strong>{$p}</strong></p>
    <div class="coupon-box">
      <div class="coupon-label">Your Coupon Code</div>
      <div class="coupon-code">{$c}</div>
    </div>
    <img src="{$qrUrl}" width="160" height="160" alt="QR Code" style="border:4px solid #e8edf5;border-radius:8px">
    <p style="font-size:.8rem;color:#888;margin-top:6px">Show this QR code at our office to redeem your offer</p>
    <p style="font-size:.85rem;color:#666;margin-top:16px">This coupon is valid for one-time use only.<br>Thank you for visiting us on our special day!</p>
  </div>
  <div class="footer">Kaivalya Guru &mdash; <a href="mailto:umesh@kaivalyaguru.com" style="color:#1565C0">umesh@kaivalyaguru.com</a></div>
</div></body></html>
HTML;
    $mail->AltBody = "Congratulations {$entry['first_name']}!\n\nYou won: {$prize}\nCoupon: {$coupon}\n\nPresent this at our office to redeem.\n\nKaivalya Guru";
    $mail->send();
    $emailSent = true;
} catch (Exception $e) {
    error_log('KG staff-spin email error: ' . $e->getMessage());
}

echo json_encode(['success' => true, 'prize' => $prize, 'coupon' => $coupon, 'email_sent' => $emailSent]);
