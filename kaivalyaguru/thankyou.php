<?php
session_start();
$prize  = $_GET['prize']  ?? '';
$coupon = $_GET['coupon'] ?? '';
if (!$prize || !$coupon) { header('Location: index.php'); exit; }
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kaivalya Guru — Thank You!</title>
  <link rel="stylesheet" href="assets/style.css">
  <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js"></script>
  <style>
    .ty-card{background:#fff;border-radius:18px;box-shadow:0 8px 32px rgba(21,101,192,.13);padding:40px 36px;width:100%;max-width:480px;text-align:center}
    .ty-card h2{color:var(--green);font-size:1.7rem;margin:14px 0 6px}
    .ty-card p.sub{color:#666;font-size:.95rem;margin-bottom:24px}
    .coupon-box{background:linear-gradient(135deg,var(--blue),#1976d2);border-radius:12px;padding:22px;color:#fff;margin-bottom:20px}
    .coupon-label{font-size:.75rem;letter-spacing:2px;text-transform:uppercase;opacity:.85}
    .coupon-code{font-size:2rem;font-weight:900;letter-spacing:4px;margin-top:6px}
    #qr-ty{margin:16px auto 8px;display:inline-block}
    .qr-hint{font-size:.8rem;color:#888;margin-bottom:24px}
    .prize-badge{display:inline-block;background:#f0fdf4;border:2px solid var(--green);color:var(--green);border-radius:50px;padding:8px 22px;font-weight:700;font-size:1rem;margin-bottom:20px}
    .note{font-size:.83rem;color:#aaa}
  </style>
</head>
<body>
<div class="kg-header">
  <img src="assets/logo.png" alt="Kaivalya Guru">
  <p class="tagline">Harmonize Space &middot; Heal Life &middot; Design Destiny</p>
</div>

<div class="ty-card">
  <div style="font-size:3rem">🎉</div>
  <h2>Thank You!</h2>
  <p class="sub">You have won an exclusive offer from Kaivalya Guru</p>

  <div class="prize-badge">🎁 <?= htmlspecialchars($prize) ?></div>

  <div class="coupon-box">
    <div class="coupon-label">Your Coupon Code</div>
    <div class="coupon-code"><?= htmlspecialchars($coupon) ?></div>
  </div>

  <div id="qr-ty"></div>
  <p class="qr-hint">Show this QR code at our office to redeem your offer</p>

  <p class="note">Details have been sent to your email address.<br>This coupon is valid for one-time use only.</p>
</div>

<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
<script>
  new QRCode(document.getElementById('qr-ty'), {
    text: '<?= htmlspecialchars($coupon) ?>',
    width: 150, height: 150,
    colorDark: '#1565C0', colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });

  // Confetti burst on load
  window.addEventListener('load', () => {
    const end = Date.now() + 2200;
    const colors = ['#1565C0','#C62828','#2E7D32','#F9A825'];
    (function burst() {
      confetti({ particleCount: 6, angle: 60,  spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(burst);
    })();
  });
</script>
</body>
</html>
